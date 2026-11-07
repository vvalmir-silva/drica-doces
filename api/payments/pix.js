import{handle,method,originCheck,serverDB,rateLimit,reject,send,digits,sha}from'../_shared/utils.js';

// Status do Mercado Pago em que o QR Code ainda pode ser pago.
const OPEN=['pending','in_process','authorized'];
const PIX_MINUTES=Math.min(Math.max(Number(process.env.PIX_EXPIRATION_MINUTES)||60,30),1440);
// Mercado Pago espera data com fuso; o Brasil não tem horário de verão desde 2019.
const brDate=ms=>new Date(ms-3*3600000).toISOString().replace('Z','-03:00');
const reply=(res,p,order)=>send(res,200,{status:p.status,qr_code:p.qr_code,qr_code_base64:p.qr_code_base64,amount_cents:p.amount_cents,expires_at:p.expires_at||null,balance_cents:Math.max(0,order.total_cents-p.amount_cents)});

export default handle(async(req,res)=>{
 method(req);originCheck(req);await rateLimit(req,'pix',10,3600);
 if(!process.env.MERCADOPAGO_ACCESS_TOKEN)reject(503,'Integração Pix ainda não ativada.');
 const db=serverDB();
 const orderId=req.body?.order_id,accessToken=req.body?.access_token,cpf=digits(req.body?.cpf);
 if(cpf.length!==11)reject(400,'CPF inválido.');
 const code=String(req.body?.code||'').trim().toUpperCase(),phone=digits(req.body?.phone);
 let order;
 if(code&&phone){
  if(!/^DD-[A-F0-9]{16,28}$/.test(code)||phone.length<10||phone.length>11)reject(400,'Código ou telefone inválido.');
  const {data}=await db.from('orders').select('*').eq('code',code).maybeSingle();
  if(!data||data.customer_phone!==phone)reject(403,'Dados de acesso ao pedido incorretos.');order=data;
 }else{
  if(!/^[\da-f-]{36}$/i.test(orderId||'')||!accessToken)reject(400,'Pedido inválido.');
  const {data}=await db.from('orders').select('*').eq('id',orderId).maybeSingle();
  if(!data||data.access_hash!==sha(accessToken))reject(403,'Acesso ao pedido não autorizado.');order=data;
 }
 if(order.payment_method!=='Pix')reject(409,'Esta encomenda não foi configurada para Pix.');
 if(order.total_cents<100)reject(409,'Valor insuficiente para gerar um Pix.');
 if(order.delivery_fee_cents===null)reject(409,'A taxa de entrega precisa ser confirmada antes do pagamento.');
 if(order.status==='cancelado')reject(409,'Pedido cancelado.');
 if(!['confirmado','preparando','pronto','entregue'].includes(order.status))reject(409,'O Pix só pode ser gerado depois da confirmação da Drica.');
 const percent=Number(order.deposit_percent)||0;
 const chargedCents=percent>0?Math.round(order.total_cents*percent/100):order.total_cents;
 if(chargedCents<100)reject(409,'O valor do Pix é menor que o mínimo permitido.');
 if(!order.customer_email)reject(400,'E-mail necessário para Pix.');
 if(order.payment_status==='approved'||order.payment_status==='deposit_paid')reject(409,'Pagamento já confirmado. Se houver saldo, combine a quitação com a Drica.');

 // Reaproveita apenas um Pix ainda válido; vencido/cancelado/recusado gera um novo.
 const {data:history,error:herr}=await db.from('payments').select('*').eq('order_id',order.id).order('created_at',{ascending:false});
 if(herr)reject(503,'Pagamentos indisponíveis no momento.');
 if((history||[]).some(p=>p.status==='approved'))reject(409,'Pagamento já confirmado. Se houver saldo, combine a quitação com a Drica.');
 const now=Date.now();
 const reusable=(history||[]).find(p=>OPEN.includes(p.status)&&p.amount_cents===chargedCents&&p.qr_code&&(!p.expires_at||Date.parse(p.expires_at)>now+60000));
 if(reusable)return reply(res,reusable,order);
 // Pix aberto mas vencido ou com valor antigo: marca como expirado localmente para liberar um novo.
 const stale=(history||[]).filter(p=>OPEN.includes(p.status)).map(p=>p.id);
 if(stale.length)await db.from('payments').update({status:'expired'}).in('id',stale);

 const site=(process.env.PUBLIC_SITE_URL||'').replace(/\/$/,'');
 if(!site.startsWith('https://'))reject(503,'Configure PUBLIC_SITE_URL usando HTTPS para o webhook.');
 const attempt=(history||[]).length+1;
 const expiresMs=now+PIX_MINUTES*60000;
 const payment={transaction_amount:chargedCents/100,description:`Drica Doces ${order.code}`,payment_method_id:'pix',external_reference:order.id,notification_url:`${site}/api/webhooks/mercadopago`,date_of_expiration:brDate(expiresMs),payer:{email:order.customer_email,first_name:String(order.customer_name||'Cliente').split(' ')[0],identification:{type:'CPF',number:cpf}}};
 const response=await fetch('https://api.mercadopago.com/v1/payments',{method:'POST',headers:{Authorization:`Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,'Content-Type':'application/json','X-Idempotency-Key':`${order.id}-${attempt}-${chargedCents}`},body:JSON.stringify(payment),signal:AbortSignal.timeout(15000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok){console.error('Mercado Pago recusou',response.status,JSON.stringify(result).slice(0,400));reject(502,'Não foi possível gerar o Pix agora.')}
 const qr=result?.point_of_interaction?.transaction_data?.qr_code||'',image=result?.point_of_interaction?.transaction_data?.qr_code_base64||'';
 if(!qr)reject(502,'Pagamento criado, mas sem dados do Pix. Consulte o atendimento.');
 const status=result.status||'pending';
 const expires_at=result.date_of_expiration?new Date(result.date_of_expiration).toISOString():new Date(expiresMs).toISOString();
 const row={order_id:order.id,provider_payment_id:String(result.id),status,amount_cents:chargedCents,qr_code:qr,qr_code_base64:image,expires_at};
 const {error}=await db.from('payments').insert(row);
 if(error){
  // Duas solicitações simultâneas: devolve o Pix aberto que ganhou a corrida.
  if(error.code==='23505'){const {data:other}=await db.from('payments').select('*').eq('order_id',order.id).in('status',OPEN).order('created_at',{ascending:false}).limit(1).maybeSingle();if(other)return reply(res,other,order)}
  console.error('Payment persistence',error.message);reject(502,'Pix gerado, mas não foi possível persistir a transação. Contate o atendimento.');
 }
 await db.from('orders').update({payment_status:status}).eq('id',order.id).not('payment_status','in','(approved,deposit_paid)');
 return reply(res,row,order);
});
