import React,{useRef,useState} from 'react';
import {Heart,MessageCircle,Send,Star,ShieldCheck,X} from 'lucide-react';
import {useDialog} from './ui.jsx';
import {isLive,postJSON} from './api.js';
const initial={name:'',rating:5,message:'',consent:false};
export default function TestimonialsSection({testimonials=[]}){
 const [form,setForm]=useState(initial),[saving,setSaving]=useState(false),[feedback,setFeedback]=useState(''),[open,setOpen]=useState(false),[thanks,setThanks]=useState(null);
 const approved=(testimonials||[]).filter(t=>t&&t.name&&t.message);
 async function submit(e){e.preventDefault();setFeedback('');if(!form.consent){setFeedback('Autorize a publicação antes de enviar.');return;}if(!isLive){setFeedback('A prévia não recebe depoimentos reais. Envie quando a loja estiver conectada ao Supabase.');return;}
 setSaving(true);try{await postJSON('/api/testimonials/submit',{name:form.name.trim(),rating:Number(form.rating),message:form.message.trim(),consent:true});setThanks({name:form.name.trim().split(' ')[0],rating:Number(form.rating)});setForm(initial);setOpen(false)}catch(err){setFeedback(err.message||'Não foi possível receber seu depoimento.')}finally{setSaving(false)} }
 return <section id="depoimentos" className="bg-[#f9ece9] py-12 sm:py-16 scroll-mt-24"><div className="max-w-6xl mx-auto px-4 sm:px-7">
 <div className="text-center max-w-2xl mx-auto"><p className="eyebrow">♡ Histórias que adoçam</p><h2 className="h2 mt-3">O carinho de quem <em className="text-rose">experimentou.</em></h2><p className="text-sm text-taupe mt-3 leading-relaxed">{approved.length?'Depoimentos de clientes, publicados com autorização.':'Já provou nossos docinhos? Conte como foi — publicamos após revisão.'}</p></div>
 {approved.length?<div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{approved.map(t=><article key={t.id} className="card p-6 sm:p-7 flex flex-col gap-4"><div className="flex items-center gap-2 text-[#b7757f]" aria-label={`${t.rating} de 5 estrelas`}>{Array.from({length:5},(_,i)=><Star key={i} size={16} fill={i<t.rating?'currentColor':'none'}/>)}</div><p className="font-display text-xl leading-relaxed text-cocoa flex-1">“{t.message}”</p><div className="flex gap-2 items-center border-t pt-4"><span className="h-10 w-10 rounded-full bg-blush text-rose grid place-items-center font-bold">{t.name[0]?.toUpperCase()}</span><strong className="text-sm">{t.name}</strong></div></article>)}</div>:null}
 {!open?<div className="mt-6 text-center"><button type="button" className="btn-soft" onClick={()=>setOpen(true)}><MessageCircle size={16}/> Deixar meu depoimento</button></div>:<div className="mt-9 card p-5 sm:p-8 max-w-3xl mx-auto enter"><div className="flex gap-3 items-center"><MessageCircle className="text-rose" size={24}/><div><h3 className="font-display text-2xl">Conte como foi sua experiência</h3><p className="text-taupe text-xs mt-1">Sua mensagem só será exibida após aprovação.</p></div></div>
 <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4 mt-5"><label className="block"><span className="label">Seu primeiro nome *</span><input className="field" maxLength={60} minLength={2} required value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} placeholder="Como podemos chamar você?"/></label><label className="block"><span className="label">Sua avaliação *</span><select className="field" value={form.rating} onChange={e=>setForm(v=>({...v,rating:e.target.value}))}>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} {n===1?'estrela':'estrelas'}</option>)}</select></label>
 <label className="sm:col-span-2 block"><span className="label">Seu depoimento *</span><textarea className="field min-h-[118px]" required minLength={15} maxLength={600} value={form.message} onChange={e=>setForm(v=>({...v,message:e.target.value}))} placeholder="Conte sobre os docinhos, atendimento ou sua celebração..."/></label>
 <label className="sm:col-span-2 text-xs text-taupe flex gap-3 items-start cursor-pointer"><input className="mt-0.5 accent-[#b7757f] h-5 w-5 shrink-0" type="checkbox" checked={form.consent} onChange={e=>setForm(v=>({...v,consent:e.target.checked}))} required/> Autorizo a Drica Doces a publicar meu primeiro nome, nota e depoimento no site. Não informe dados pessoais sensíveis.</label>
 <button className="btn-dark sm:col-span-2" type="submit" disabled={saving}><Send size={17}/> {saving?'Publicando...':'Publicar depoimento'}</button></form><p className="text-xs text-taupe mt-3" role="status" aria-live="polite">{feedback}</p><p className="flex gap-2 text-xs text-taupe items-center mt-1"><ShieldCheck size={14}/> As avaliações não são publicadas automaticamente.</p></div>}</div><ThanksModal thanks={thanks} onClose={()=>setThanks(null)}/></section>
}

/** Agradecimento após o envio do depoimento. */
function ThanksModal({thanks,onClose}){
 const ref=useRef(null);useDialog(ref,Boolean(thanks),onClose);
 if(!thanks)return null;
 return <div className="fixed inset-0 z-[70] bg-[#2a1b17]/60 backdrop-blur-[3px] grid place-items-center p-4" onClick={onClose}>
  <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="thanks-title" onClick={e=>e.stopPropagation()} className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] bg-cream shadow-2xl text-center outline-none enter">
   <div className="relative h-32 bg-[radial-gradient(circle_at_50%_120%,#f2c9cc_0%,#f8e4e1_45%,#fbf1ee_100%)]">
    <span aria-hidden="true" className="absolute left-[14%] top-6 text-rose/50 text-lg">✦</span><span aria-hidden="true" className="absolute right-[18%] top-10 text-rose/40">♡</span><span aria-hidden="true" className="absolute left-[30%] top-16 text-rose/30 text-sm">✦</span><span aria-hidden="true" className="absolute right-[30%] top-4 text-rose/30 text-sm">✦</span>
    <button type="button" onClick={onClose} aria-label="Fechar" className="absolute top-3 right-3 min-w-11 min-h-11 grid place-items-center rounded-full bg-white/80 hover:bg-white text-cocoa"><X size={18}/></button>
    <div className="absolute left-1/2 -bottom-9 -translate-x-1/2 h-[76px] w-[76px] rounded-full bg-white shadow-soft grid place-items-center"><div className="h-[60px] w-[60px] rounded-full bg-blush grid place-items-center text-rose"><Heart size={28} fill="currentColor" strokeWidth={1.5}/></div></div>
   </div>
   <div className="px-7 pt-14 pb-7">
    <p className="eyebrow">Depoimento recebido</p>
    <h3 id="thanks-title" className="font-display text-[30px] leading-tight mt-2">Obrigada{thanks.name?`, ${thanks.name}`:''}!</h3>
    <div className="flex justify-center gap-1 mt-3 text-[#c98a93]" aria-label={`${thanks.rating} de 5 estrelas`}>{Array.from({length:5},(_,i)=><Star key={i} size={18} fill={i<thanks.rating?'currentColor':'none'}/>)}</div>
    <p className="text-taupe text-[15px] leading-relaxed mt-4">Seu carinho adoçou o nosso dia. Cada palavra nos inspira a caprichar ainda mais em cada docinho.</p>
    <p className="text-xs text-taupe mt-3 flex items-center justify-center gap-1.5"><ShieldCheck size={14}/> Ele aparece no site assim que a Drica revisar.</p>
    <div className="mt-6 grid gap-2">
     <button type="button" className="btn-dark w-full" onClick={()=>{onClose();document.getElementById('cardapio')?.scrollIntoView({behavior:'smooth'})}}>Ver os docinhos</button>
     <button type="button" className="btn-soft w-full" onClick={onClose}>Fechar</button>
    </div>
    <p className="font-display italic text-rose mt-5">— com carinho, Drica Doces</p>
   </div>
  </div>
 </div>;
}
