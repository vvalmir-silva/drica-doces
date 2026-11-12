// Tempo de acesso do painel administrativo.
// - Inatividade: encerra depois de IDLE_MS sem toque, clique, tecla ou rolagem.
// - Limite total: encerra MAX_MS depois do login, mesmo com uso contínuo (o banco aplica o mesmo limite).
// Os marcadores ficam na sessionStorage (somem ao fechar a aba) com cópia em memória.
export const IDLE_MS=15*60*1000;
export const MAX_MS=8*60*60*1000;
export const WARN_MS=60*1000;
const K_LOGIN='drica-admin-login-at',K_SEEN='drica-admin-seen-at';
const mem={};
const read=k=>{try{const v=Number(sessionStorage.getItem(k));if(v>0)return v}catch{}return mem[k]||0};
const write=(k,v)=>{mem[k]=v;try{sessionStorage.setItem(k,String(v))}catch{}};
const drop=k=>{delete mem[k];try{sessionStorage.removeItem(k)}catch{}};

export const hasSessionMarks=()=>read(K_LOGIN)>0;
export function markLogin(){const now=Date.now();write(K_LOGIN,now);write(K_SEEN,now)}
export function clearSessionMarks(){drop(K_LOGIN);drop(K_SEEN)}
let lastWrite=0;
export function touchSession(force=false){if(!hasSessionMarks())return;const now=Date.now();if(!force&&now-lastWrite<5000)return;lastWrite=now;write(K_SEEN,now)}

// Motivo do encerramento ('idle' | 'max') ou null; sem marcadores, a sessão é tratada como vencida.
export function sessionState(){
  const login=read(K_LOGIN),seen=read(K_SEEN),now=Date.now();
  if(!login||!seen||login>now+60000)return{expired:'max',left:0};
  const idleLeft=seen+IDLE_MS-now,maxLeft=login+MAX_MS-now;
  if(maxLeft<=0)return{expired:'max',left:0};
  if(idleLeft<=0)return{expired:'idle',left:0};
  return{expired:null,left:Math.min(idleLeft,maxLeft),reason:idleLeft<=maxLeft?'idle':'max'};
}

const listeners=new Set();
export const onSessionEvent=fn=>{listeners.add(fn);return()=>listeners.delete(fn)};
const emit=(type,detail)=>listeners.forEach(fn=>{try{fn(type,detail)}catch{}});

let timer=null,expire=null,warned=false;
const ACTIVITY=['pointerdown','keydown','wheel','touchstart','scroll'];
// Atividade renova só o prazo de inatividade; o aviso do limite total continua na tela.
const onActivity=()=>{touchSession();if(warned==='idle'){warned=false;touchSession(true);emit('ok')}};
function tick(){
  const st=sessionState();
  if(st.expired){const run=expire;stopSessionWatch();clearSessionMarks();Promise.resolve(run?.()).catch(()=>{}).finally(()=>emit('expired',st.expired));return}
  if(st.left<=WARN_MS){warned=st.reason;emit('warn',{seconds:Math.max(1,Math.ceil(st.left/1000)),reason:st.reason})}
  else if(warned){warned=false;emit('ok')}
}
const onVisible=()=>{if(document.visibilityState==='visible')tick()};
// Liga o controle (uma única vez). onExpire encerra a sessão no Supabase.
export function startSessionWatch(onExpire){
  expire=onExpire;if(timer)return;
  ACTIVITY.forEach(e=>window.addEventListener(e,onActivity,{passive:true,capture:true}));
  document.addEventListener('visibilitychange',onVisible);window.addEventListener('focus',tick);
  timer=setInterval(tick,5000);
}
export function stopSessionWatch(){
  if(!timer)return;clearInterval(timer);timer=null;warned=false;
  ACTIVITY.forEach(e=>window.removeEventListener(e,onActivity,{capture:true}));
  document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('focus',tick);
}
