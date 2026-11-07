import React,{useEffect,useRef,useState} from 'react';
import {MessageCircle,Send,ShoppingBag,Sparkles,X} from 'lucide-react';
import {askAssistant} from './api.js';
import {WHATSAPP,money} from './data.js';
import {useDialog} from './ui.jsx';

const KEY='drica-assistente-v1';
const HELLO={role:'assistant',content:'Oi! Sou a assistente virtual da Drica 💗 Posso calcular quantos docinhos você precisa, montar um kit e tirar dúvidas sobre prazos e retirada.'};
const SUGGESTIONS=['Quantos docinhos para 30 convidados?','Monte um kit de 100 docinhos','Com quanta antecedência devo pedir?','Vocês fazem entrega?','Tenho uma data em mente, tem vaga?'];
// Link do WhatsApp já com a última pergunta da pessoa, para a Drica entender o contexto.
const waLink=(list,i)=>{const q=[...list.slice(0,i)].reverse().find(x=>x.role==='user')?.content||'';return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Olá, Drica! Vim pelo site. ${q}`.trim())}`};
const load=()=>{try{const v=JSON.parse(sessionStorage.getItem(KEY)||'null');return Array.isArray(v)&&v.length?v:[HELLO]}catch{return[HELLO]}};

/** Chat da assistente de encomendas (carregado só quando aberto). */
export default function AssistantChat({onClose,onAddKit}){
  const [msgs,setMsgs]=useState(load);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const ref=useRef(null),listRef=useRef(null),inputRef=useRef(null);
  useDialog(ref,true,onClose);
  useEffect(()=>{try{sessionStorage.setItem(KEY,JSON.stringify(msgs.slice(-20)))}catch{}listRef.current?.scrollTo({top:listRef.current.scrollHeight,behavior:'smooth'})},[msgs,busy]);

  async function ask(q){
    const question=String(q||'').trim().slice(0,500);if(!question||busy)return;
    const next=[...msgs,{role:'user',content:question}];
    setMsgs(next);setText('');setBusy(true);
    // A API recebe só o texto da conversa (sem a saudação inicial), começando por uma pergunta.
    const history=next.filter(m=>m.content&&m.content!==HELLO.content&&!m.error).map(({role,content})=>({role,content})).slice(-14);
    while(history.length&&history[0].role!=='user')history.shift();
    try{const {reply,kit}=await askAssistant(history);setMsgs(m=>[...m,{role:'assistant',content:reply,kit:kit||null}])}
    catch(err){setMsgs(m=>[...m,{role:'assistant',content:err.message||'Não consegui responder agora.',error:true}])}
    finally{setBusy(false);setTimeout(()=>inputRef.current?.focus({preventScroll:true}),50)}
  }
  function reset(){setMsgs([HELLO]);try{sessionStorage.removeItem(KEY)}catch{}}
  const wpp=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá, Drica! Vim pelo site e queria tirar uma dúvida sobre encomendas.')}`;

  return <div className="fixed inset-0 z-[60] bg-[#241814]/40 md:bg-transparent md:pointer-events-none" onClick={onClose}>
    <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ai-title" onClick={e=>e.stopPropagation()}
      className="pointer-events-auto absolute inset-x-0 bottom-0 h-[88dvh] md:inset-auto md:right-6 md:bottom-6 md:h-[600px] md:max-h-[calc(100dvh-48px)] md:w-[390px] flex flex-col bg-cream rounded-t-[28px] md:rounded-[28px] shadow-2xl border border-[#efe0da] outline-none enter overflow-hidden">
      <header className="flex items-center gap-3 px-5 py-4 border-b border-[#efe0da] bg-white">
        <div className="h-10 w-10 rounded-full bg-blush text-rose grid place-items-center shrink-0"><Sparkles size={19}/></div>
        <div className="min-w-0 flex-1"><h2 id="ai-title" className="font-display text-xl leading-tight">Assistente da Drica</h2><p className="text-[11px] text-taupe">Assistente virtual com IA · pode errar</p></div>
        <button type="button" onClick={onClose} aria-label="Fechar assistente" className="min-w-11 min-h-11 grid place-items-center rounded-full hover:bg-blush"><X size={19}/></button>
      </header>
      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
        {msgs.map((m,i)=><div key={i} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-line ${m.role==='user'?'bg-cocoa text-white rounded-br-md':m.error?'bg-[#fff1ef] text-[#8e382f] rounded-bl-md':'bg-white border border-[#efe0da] text-cocoa rounded-bl-md'}`}>
            {m.content}
            {m.kit&&<div className="mt-3 rounded-xl bg-[#fbf3f0] border border-[#efdcd6] p-3">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-roseink">Kit sugerido</p>
              <p className="font-semibold mt-1">{m.kit.total.toLocaleString('pt-BR')} docinhos</p>
              <p className="text-xs text-taupe mt-0.5">{m.kit.label}</p>
              <p className="font-display text-xl mt-2 tabular-nums">{money(m.kit.price_cents)}</p>
              <button type="button" className="btn-dark w-full !min-h-11 mt-2 text-xs" onClick={()=>onAddKit(m.kit)}><ShoppingBag size={15}/> Adicionar ao carrinho</button>
            </div>}
            {m.role!=='user'&&/whatsapp/i.test(m.content||'')&&<a href={waLink(msgs,i)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#1f7a4d] min-h-9"><MessageCircle size={14}/> Combinar pelo WhatsApp</a>}
          </div>
        </div>)}
        {busy&&<div className="flex justify-start"><div className="bg-white border border-[#efe0da] rounded-2xl rounded-bl-md px-4 py-3" aria-label="Consultando"><div className="flex gap-1">{[0,1,2].map(i=><span key={i} className="h-2 w-2 rounded-full bg-rose/60 animate-bounce" style={{animationDelay:`${i*120}ms`}}/>)}</div><p className="text-xs text-taupe mt-1.5">Consultando os sabores e a agenda…</p></div></div>}
        {msgs.length<=1&&!busy&&<div className="flex flex-wrap gap-2 pt-1">{SUGGESTIONS.map(s=><button type="button" key={s} className="chip !min-h-10 !py-2 text-left" onClick={()=>ask(s)}>{s}</button>)}</div>}
      </div>
      <div className="border-t border-[#efe0da] bg-white px-3 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <form className="flex gap-2" onSubmit={e=>{e.preventDefault();ask(text)}}>
          <label className="sr-only" htmlFor="ai-input">Sua pergunta</label>
          <input id="ai-input" ref={inputRef} className="field !min-h-12 flex-1" maxLength={500} autoComplete="off" placeholder="Escreva sua pergunta…" value={text} onChange={e=>setText(e.target.value)} disabled={busy}/>
          <button type="submit" disabled={busy||!text.trim()} aria-label="Enviar pergunta" className="btn-dark !px-4 !min-h-12 shrink-0"><Send size={17}/></button>
        </form>
        <div className="flex items-center justify-between gap-2 mt-2">
          <a href={wpp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1f7a4d] min-h-9"><MessageCircle size={14}/> Falar com a Drica no WhatsApp</a>
          {msgs.length>1&&<button type="button" className="text-xs text-taupe underline min-h-9" onClick={reset}>Nova conversa</button>}
        </div>
      </div>
    </section>
  </div>;
}
