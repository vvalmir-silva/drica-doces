import {handle,method,originCheck,serverDB,rateLimit,reject,send,itemPieces} from './_shared/utils.js';

// Somente números agregados por data; não retorna nomes, horários individuais nem telefones.
// Checkout continua verificando a capacidade de forma TRANSACIONAL em SQL.
export default handle(async(req,res)=>{
 method(req);originCheck(req);await rateLimit(req,'availability',30,3600);
 const date=String(req.body?.date||''),requested=Number(req.body?.requested||0);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(requested)||requested<0||requested>500)
  reject(400,'Data ou quantidade inválida.');
 const db=serverDB();
 const [{data:settings,error:se},{data:days,error:de},{data:orders,error:oe}]=await Promise.all([
   db.from('shop_settings').select('daily_capacity_sweets').eq('id',1).single(),
   db.from('blocked_dates').select('date').eq('date',date),
   db.from('orders').select('id,order_items(option_id,qty,sweets_per_unit)').like('scheduled_at',date+'T%').neq('status','cancelado')
 ]);
 if(se||de||oe)reject(503,'Agenda temporariamente indisponível.');
 const capacity=Number(settings?.daily_capacity_sweets||0);
 if(capacity<50)reject(503,'A capacidade ainda não foi configurada.');
 const booked=(orders||[]).reduce((sum,o)=>sum+(o.order_items||[]).reduce((n,item)=>n+itemPieces(item),0),0);
 const available=Math.max(0,capacity-booked),blocked=Boolean(days?.length);
 return send(res,200,{date,capacity,booked,available,blocked,can_book:!blocked&&requested<=available});
});
