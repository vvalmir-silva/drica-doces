import {handle,method,originCheck,rateLimit,reject,send} from './_shared/utils.js';

// Avaliação 👍/👎 da resposta da assistente: só soma por assunto e mês (sem texto nem dados pessoais).
const TOPICS=['entrega','prazo','data','kit','quantidade','preco','retirada','pagamento','sabores','outro'];

export default handle(async(req,res)=>{
  method(req);originCheck(req);await rateLimit(req,'fb',60,3600);
  const topic=String(req.body?.topic||''),vote=String(req.body?.vote||'');
  if(!TOPICS.includes(topic)||!['up','down'].includes(vote))reject(400,'Avaliação inválida.');
  const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token)reject(503,'Avaliação indisponível.');
  const month=new Date(Date.now()-3*3600000).toISOString().slice(0,7);
  const key=`dd:ai:fb:${month}:${topic}:${vote}`;
  await fetch(`${url.replace(/\/$/,'')}/pipeline`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify([['INCR',key],['EXPIRE',key,34128000]]),signal:AbortSignal.timeout(4000)}).catch(()=>{});
  return send(res,200,{ok:true});
});
