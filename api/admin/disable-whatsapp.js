import {handle,method,originCheck,serverDB,adminAuth,reject,send} from '../_shared/utils.js';
// Administrador pode desativar avisos quando o cliente solicitar.
// Reativação exige novo consentimento explícito do próprio cliente.
export default handle(async(req,res)=>{
 method(req);originCheck(req);
 const db=serverDB();await adminAuth(req,db);
 const id=req.body?.order_id;
 if(!/^[0-9a-f-]{36}$/i.test(id||''))reject(400,'Pedido inválido.');
 const {data,error}=await db.from('orders').update({whatsapp_status_opt_in:false}).eq('id',id).select('id').maybeSingle();
 if(error)reject(500,'Não foi possível desativar os avisos.');
 if(!data)reject(404,'Pedido não encontrado.');
 return send(res,200,{saved:true,whatsapp_status_opt_in:false});
});
