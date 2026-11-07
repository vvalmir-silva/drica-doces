import {handle,method,originCheck,serverDB,rateLimit,reject,send,text,digits,dateValid,cents,emailValid,money,sha,token,email,piecesPerUnit,adminEmail} from '../_shared/utils.js';
// Não devolve ao navegador campos internos de controle.
const publicOrder=({access_hash,client_request_id,order_items,...o})=>o;
const validStatus=['Retirada','Entrega'];const payMethods=['Pix','Cartão no recebimento'];
export default handle(async(req,res)=>{
 method(req);originCheck(req);await rateLimit(req,'orders',6,3600);
 const b=req.body||{};
 const idempotency=text(b.client_request_id,36,36);if(!idempotency||!/^[0-9a-f-]{36}$/i.test(idempotency))reject(400,'Identificador da solicitação inválido.');
 const db=serverDB();
 // Retentativa do mesmo pedido devolve o registro existente antes de validar cupom/vagas de novo.
 const findExisting=async()=>{const {data:o}=await db.from('orders').select('*,order_items(*)').eq('client_request_id',idempotency).maybeSingle();return o?{order:{...publicOrder(o),items:(o.order_items||[]).map(i=>({...i,name:i.product_name}))},access_token:idempotency,emailSent:false,duplicate:true}:null};
 {const dup=await findExisting();if(dup)return send(res,200,dup);}
 if(b.whatsapp_status_opt_in!==undefined && typeof b.whatsapp_status_opt_in!=='boolean')reject(400,'Preferência de notificações inválida.');
 const name=text(b.name,2,90),phone=digits(b.phone),mail=text(b.email||'',0,200),date=b.scheduled_at;
 if(!name||phone.length<10||phone.length>11||(mail&&!emailValid(mail))||!dateValid(date)||!validStatus.includes(b.fulfillment)||!payMethods.includes(b.payment_method))reject(400,'Dados do cliente inválidos.');
 if(b.payment_method==='Pix'&&!emailValid(mail))reject(400,'Informe e-mail para solicitar um Pix.');
 const minNow=Date.now(),chosen=Date.parse(`${date}:00-03:00`);
 const {data:settings,error:serr}=await db.from('shop_settings').select('*').eq('id',1).single();if(serr||!settings)reject(503,'Configuração da loja indisponível.');
 if(chosen<minNow+settings.min_hours*3600000)reject(400,`Antecedência mínima de ${settings.min_hours} horas.`);
 if(date.slice(11)<settings.open_time||date.slice(11)>settings.close_time)reject(400,'Horário fora do atendimento.');
 const {data:blocks,error:berr}=await db.from('blocked_dates').select('date').eq('date',date.slice(0,10));if(berr)reject(503,'Falha ao consultar agenda.');if(blocks?.length)reject(400,'Este dia não aceita encomendas.');
 const raw=b.items;if(!Array.isArray(raw)||!raw.length||raw.length>30)reject(400,'Carrinho vazio ou inválido.');
 const {data:products,error:perr}=await db.from('products').select('id,name,category,active,options').eq('active',true);if(perr)reject(503,'Cardápio indisponível.');
 const entries=products.flatMap(p=>(p.options||[]).map(o=>({...o,product_name:p.name}))); const mixFlavors=products.filter(p=>p.active && p.category==='Docinhos de festa' && p.id!=='cento-misto');const orderItems=[];let subtotal=0;let sweetCount=0;
 for(const i of raw){const opt=entries.find(o=>o.id===i.option_id);if(!opt||!Number.isSafeInteger(i.qty)||i.qty<1||(opt.id==='mixed-custom'?(i.qty<50||i.qty>100000):i.qty>99)||typeof i.gift_wrap!=='boolean'||text(i.personal_message||'',0,120)===null)reject(400,'Personalização ou itens inválidos.');const extra=i.gift_wrap?settings.gift_wrap_cents:0;if(cents(opt.price_cents)===null||cents(extra)===null)reject(503,'Preço inválido na configuração.');const price=opt.price_cents+extra;subtotal+=price*i.qty;const perUnit=piecesPerUnit(opt.id,opt.sweets);sweetCount+=perUnit*i.qty;
 const mixed=['mixed-half','mixed-hundred','mixed-custom'].includes(opt.id);let mix_breakdown={};let mix_label='';
 if(mixed){
   if(opt.id==='mixed-custom'&&i.gift_wrap)reject(400,'Embalagem de presente para grandes pedidos precisa ser combinada com a confeitaria.');const target=opt.id==='mixed-half'?50:opt.id==='mixed-hundred'?100:i.qty;const mix=i.mix_breakdown;
   if(!mix||typeof mix!=='object'||Array.isArray(mix)||Object.keys(mix).length<1||Object.keys(mix).length>20)reject(400,'Informe os sabores do kit personalizado.');
   let n=0;const details=[];
   for(const [id,amount] of Object.entries(mix)){
     const flavor=mixFlavors.find(p=>p.id===id);
     if(!flavor||!Number.isInteger(amount)||amount<1||amount>target)reject(400,'Quantidade ou sabor do kit inválido.');
     mix_breakdown[id]=amount;details.push(`${amount} ${flavor.name}`);n+=amount;
   }
   if(n!==target)reject(400,`A combinação precisa somar ${target} docinhos.`);
   mix_label=details.join(' + ');
 } else if(i.mix_breakdown && Object.keys(i.mix_breakdown).length)reject(400,'Personalização de sabores inválida para este item.');
 orderItems.push({option_id:opt.id,product_name:opt.product_name,option_label:opt.label,qty:i.qty,unit_price_cents:opt.price_cents,extra_cents:extra,gift_wrap:i.gift_wrap,personal_message:i.personal_message||'',mix_breakdown,mix_label,sweets_per_unit:perUnit})}
 if(sweetCount>500)reject(400,'Encomendas acima de 500 docinhos precisam ser consultadas pelo WhatsApp para confirmar disponibilidade, data e horário.');
 if(subtotal<100)reject(400,'Valor da encomenda fora do limite.');
 const cep=digits(b.cep);let address='',fee=0;
 if(b.fulfillment==='Entrega'){
 const street=text(b.street,1,120),number=text(b.number,1,20),neighborhood=text(b.neighborhood,1,90),city=text(b.city,1,90),uf=text(b.state,2,2),comp=text(b.complement||'',0,90);
 if(cep.length!==8||!street||!number||!neighborhood||!city||!/^[A-Z]{2}$/i.test(uf))reject(400,'Endereço de entrega incompleto.');
 // CEP lookup validates that postal code exists; manually entered street remains possible when ViaCEP lacks street data.
 try{const cr=await fetch(`https://viacep.com.br/ws/${cep}/json/`,{signal:AbortSignal.timeout(5000)});const cd=await cr.json();if(cd.erro)reject(400,'CEP inválido.');if(cd.uf&&cd.uf!==uf.toUpperCase())reject(400,'UF diferente da localização do CEP.')}catch(e){if(e.status)throw e;reject(503,'Não foi possível validar o CEP de entrega agora.')}
 address=`${street}, ${number}${comp?', '+comp:''} — ${neighborhood} — ${city}/${uf.toUpperCase()} — CEP ${cep}`;
 const {data:zones,error:zerr}=await db.from('delivery_zones').select('cep_prefix,fee_cents').eq('active',true);if(zerr)reject(503,'Regiões de entrega indisponíveis.');const zone=(zones||[]).filter(z=>cep.startsWith(z.cep_prefix)).sort((a,b)=>b.cep_prefix.length-a.cep_prefix.length)[0];fee=zone?zone.fee_cents:null;
 if(fee===null)reject(400,'Ainda não há frete cadastrado para este CEP. Consulte pelo WhatsApp ou escolha retirada.');
 }
 let discount=0,couponCode=null;const coupon=text(b.coupon||'',0,24)?.toUpperCase();if(coupon){const {data:couponRow}=await db.from('coupons').select('*').eq('code',coupon).eq('active',true).maybeSingle();if(!couponRow||couponRow.used_count>=couponRow.max_uses||subtotal<couponRow.min_cents)reject(400,'Cupom inválido, expirado ou abaixo do valor mínimo.');if(couponRow.customer_hash&&couponRow.customer_hash!==sha((process.env.LOYALTY_PEPPER||'')+phone))reject(400,'Este cupom pertence a outro cliente.');discount=Math.round(subtotal*couponRow.percent_off/100);couponCode=couponRow.code}
 const code='DD-'+token();const total=subtotal-discount+(fee??0);
 const safeNotes=text(b.notes||'',0,350);if(safeNotes===null)reject(400,'Observação muito longa.');
 const order={code,client_request_id:idempotency,access_hash:sha(idempotency),customer_name:name,customer_phone:phone,customer_email:mail||null,scheduled_at:date,fulfillment:b.fulfillment,cep:b.fulfillment==='Entrega'?cep:null,address:address||null,payment_method:b.payment_method,subtotal_cents:subtotal,discount_cents:discount,delivery_fee_cents:fee,total_cents:total,notes:safeNotes,coupon_code:couponCode,status:'solicitado',payment_status:'not_initiated',deposit_percent:Number(settings.deposit_percent||0),whatsapp_status_opt_in:b.whatsapp_status_opt_in===true};
 const {data:created,error:err}=await db.rpc('create_checkout_order',{p_order:order,p_items:orderItems,p_slot_limit:settings.max_orders_per_slot});
 if(err){if(err.code==='23505'){const dup=await findExisting();if(dup)return send(res,200,dup)}if(/lotado|indisponível|limite|capacidade|esgotada/i.test(err.message))reject(409,'Não há mais vagas neste horário.');console.error('Database checkout',err.message);reject(500,'Não foi possível registrar o pedido.')}const orderId=created.id;
 const lines=orderItems.map(i=>`${i.qty} × ${i.product_name} (${i.option_label})${i.mix_label?' | '+i.mix_label:''} — ${money((i.unit_price_cents+i.extra_cents)*i.qty)}`).join('\n');
 const eText=`NOVA SOLICITAÇÃO DRICA DOCES — ${code}\nStatus: SOLICITADO (não confirmado)\n\n${lines}\nSubtotal: ${money(subtotal)}\nDesconto: ${money(discount)}\nEntrega: ${fee===null?'a confirmar':money(fee)}\nTOTAL${fee===null?' PARCIAL':''}: ${money(total)}\n\nCliente: ${name}\nWhatsApp: ${phone}\nE-mail: ${mail||'não informado'}\nData: ${date}\nRecebimento: ${b.fulfillment}\nEndereço: ${address||'Retirada'}\nPagamento preferido: ${b.payment_method}\nObservações: ${safeNotes||'—'}\n\nEste registro não confirma envio da mensagem no WhatsApp nem pagamento.`;
 const notifyTo=adminEmail();const emailed=notifyTo?await email({to:notifyTo,subject:`Drica Doces • Nova solicitação ${code}`,textBody:eText}):false;
 return send(res,201,{order:{...publicOrder(order),id:orderId,items:orderItems.map(i=>({...i,name:i.product_name}))},access_token:idempotency,emailSent:emailed});
});
