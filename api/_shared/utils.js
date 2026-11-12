import {createClient} from '@supabase/supabase-js';
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const serverDB=()=>{if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Object.assign(new Error('Supabase não configurado no servidor.'),{status:503});return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})};
export const sha=v=>createHash('sha256').update(String(v)).digest('hex');
export const token=()=>randomBytes(12).toString('hex').toUpperCase();
export const digits=v=>String(v||'').replace(/\D/g,'');
export const text=(v,min=0,max=100)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max?v.trim():null;
export const reject=(status,error)=>{const e=new Error(error);e.status=status;throw e};
export const send=(res,status,body)=>{res.setHeader('Cache-Control','no-store');return res.status(status).json(body)};
export const method=(req,which='POST')=>{if(req.method!==which)reject(405,'Método não permitido.');if(which==='POST'&&!String(req.headers['content-type']||'').startsWith('application/json'))reject(415,'A requisição deve ser JSON.');if(Number(req.headers['content-length']||0)>30000)reject(413,'Pedido grande demais.');};
export const originCheck=req=>{if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin)}catch{reject(403,'Origem inválida.')}if(origin.host!==req.headers.host)reject(403,'Origem não autorizada.')}};
export const handle=(fn)=>async(req,res)=>{try{await fn(req,res)}catch(err){console.error('API Drica:',err.message);send(res,err.status||500,{error:err.status?err.message:'Falha ao processar a solicitação.'})}};
export async function rateLimit(req,prefix,limit=8,period=60){const url=process.env.UPSTASH_REDIS_REST_URL;const apiToken=process.env.UPSTASH_REDIS_REST_TOKEN;if(!url||!apiToken)reject(503,'A proteção de pedidos não foi configurada no servidor.');const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();const key=`dd:${prefix}:${sha(ip)}:${Math.floor(Date.now()/(period*1000))}`;const r=await fetch(`${url.replace(/\/$/,'')}/pipeline`,{method:'POST',headers:{Authorization:`Bearer ${apiToken}`,'Content-Type':'application/json'},body:JSON.stringify([['INCR',key],['EXPIRE',key,period*2]]),signal:AbortSignal.timeout(5000)});if(!r.ok)reject(503,'Limite de requisições indisponível.');const d=await r.json();const n=Number(d?.[0]?.result);if(!Number.isFinite(n))reject(503,'Verificação antiabuso indisponível.');if(n>limit)reject(429,'Muitas tentativas. Tente novamente em alguns minutos.');}
export async function email({to,subject,textBody}){if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM_EMAIL)return false;try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:process.env.RESEND_FROM_EMAIL,to:[to],subject,text:textBody}),signal:AbortSignal.timeout(9000)});if(!r.ok){console.error('Resend email:',r.status);return false}return true}catch(e){console.error('Resend delivery:',e.message);return false}}
export const cents=n=>Number.isSafeInteger(n)&&n>=0&&n<100000000?n:null;
export const emailValid=v=>Boolean(text(v,5,200)&&EMAIL.test(v));
export const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
export const dateValid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}:00-03:00`));
export function verifySignature({signature,requestId,eventId,secret}){if(!signature||!requestId||!eventId||!secret)return false;const parts=Object.fromEntries(String(signature).split(',').map(x=>x.trim().split('=',2)));const ts=parts.ts,v1=parts.v1;if(!ts||!v1||!/^\d+$/.test(ts)||!/^[a-f\d]{64}$/i.test(v1))return false;const time=Number(ts);const ms=time<100000000000?time*1000:time;if(Math.abs(Date.now()-ms)>15*60*1000)return false;const manifest=`id:${String(eventId).toLowerCase()};request-id:${requestId};ts:${ts};`;const expected=createHmac('sha256',secret).update(manifest).digest('hex');return timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(v1,'hex'))}
export async function adminAuth(req,db){const header=String(req.headers.authorization||'');const match=header.match(/^Bearer\s+(.+)$/);if(!match)reject(401,'Acesso administrativo não autorizado.');const{data:{user},error}=await db.auth.getUser(match[1]);if(error||!user)reject(401,'Sessão inválida.');let sessionId='';try{sessionId=String(JSON.parse(Buffer.from(match[1].split('.')[1],'base64url').toString('utf8')).session_id||'')}catch{}if(!/^[0-9a-f-]{36}$/i.test(sessionId))reject(401,'Sessão inválida.');
// Administrador com sessão ativa e dentro do tempo máximo de acesso (regra única, no banco: migração 011).
const {data, error:e}=await db.rpc('admin_session_valid',{p_user:user.id,p_session:sessionId});if(e){console.error('Sessão admin:',e.message);reject(503,'Não foi possível validar a sessão.')}if(data!==true)reject(401,'Sessão encerrada. Entre novamente no painel.');return user}
/**
 * Envia APENAS template utilitário previamente aprovado no Meta WhatsApp Manager.
 * Retorna "accepted" se a API aceitar; entrega/leitura exigem webhook próprio.
 * Nunca afirma "enviado" quando as credenciais não estão configuradas.
 */
export async function sendStatusWhatsApp(order,statusLabel){
 if(order.whatsapp_status_opt_in!==true)return {state:'no_consent'};
 const token=process.env.META_WHATSAPP_TOKEN;
 const phoneId=process.env.META_WHATSAPP_PHONE_NUMBER_ID;
 const template=process.env.META_WHATSAPP_TEMPLATE_NAME;
 const lang=process.env.META_WHATSAPP_TEMPLATE_LANG||'pt_BR';
 const version=process.env.META_WHATSAPP_API_VERSION||'v24.0';
 if(!token||!phoneId||!template)return {state:'not_configured'};
 if(!/^v\d+\.0$/.test(version))return {state:'configuration_error'};
 let phone=digits(order.customer_phone);
 if(phone.startsWith('55')&&(phone.length===12||phone.length===13))phone=phone.slice(2);
 if(!/^\d{10,11}$/.test(phone))return {state:'invalid_number'};
 try{
  const response=await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneId)}/messages`,{
   method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
   body:JSON.stringify({messaging_product:'whatsapp',to:`55${phone}`,type:'template',
     template:{name:template,language:{code:lang},components:[{type:'body',parameters:[
       {type:'text',text:String(order.customer_name||'Cliente').slice(0,90)},
       {type:'text',text:String(order.code||'').slice(0,40)},
       {type:'text',text:String(statusLabel).slice(0,100)}]}]}}),
   signal:AbortSignal.timeout(12000)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok){const code=String(result?.error?.code??response.status);console.error('Meta WhatsApp recusou o template; codigo:',code);return {state:'api_error',error_code:code}}
  const message_id=result?.messages?.[0]?.id;
  if(typeof message_id!=='string'||!message_id.startsWith('wamid.'))return {state:'unexpected_response'};
  return {state:'accepted',message_id};
 }catch(err){console.error('Meta WhatsApp indisponível:',err?.name||'request_error');return {state:'network_error'}}
}
// Quantos docinhos cada unidade de uma opção representa (capacidade diária e limite de 500).
// A opção pode declarar "sweets" no JSON do produto; sem isso: *-hundred=100, *-half=50, demais=1.
export function piecesPerUnit(optionId,sweets){const n=Number(sweets);if(Number.isSafeInteger(n)&&n>0&&n<=100000)return n;const id=String(optionId||'');if(id==='mixed-custom')return 1;if(/(^|-)half$/.test(id))return 50;if(/(^|-)hundred$/.test(id))return 100;return 1}
export const itemPieces=item=>piecesPerUnit(item?.option_id,item?.sweets_per_unit)*(Number(item?.qty)||0);
export const adminEmail=()=>{const v=String(process.env.ORDER_NOTIFICATION_EMAIL||'').trim();return emailValid(v)?v:null};
