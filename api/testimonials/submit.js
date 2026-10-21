import {handle,method,originCheck,serverDB,rateLimit,reject,send} from '../_shared/utils.js';
export default handle(async (req,res)=>{
 method(req);originCheck(req);await rateLimit(req,'testimonials',3,3600);
 const b=req.body||{};
 const name=String(b.name||'').trim().replace(/\s+/g,' ');
 const message=String(b.message||'').trim();
 const rating=Number(b.rating);
 if(name.length<2||name.length>60||message.length<15||message.length>600||!Number.isInteger(rating)||rating<1||rating>5||b.consent!==true)reject(400,'Confira nome, nota, comentário e autorização.');
 const {error}=await serverDB().from('testimonials').insert({name,rating,message,consent:true,status:'pending'});
 if(error){console.error('testimonial_insert_error',error.code);reject(503,'Não foi possível receber o depoimento agora.');}
 return send(res,201,{received:true,pending_approval:true});
});
