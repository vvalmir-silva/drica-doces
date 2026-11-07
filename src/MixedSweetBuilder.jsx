import React, {useMemo, useState} from 'react';
import {Check, Minus, Plus, ShoppingBag, Sparkles} from 'lucide-react';
import {money} from './data.js';
const QUOTE_THRESHOLD_SWEETS=500;

const MIN_SWEETS=50;
const MAX_SWEETS=100000; // limite técnico de segurança; não é limite de um cento.
const quickTotals=[50,100,200];
const clamp=(v,max)=>Math.max(0,Math.min(max,Math.floor(Number(v)||0)));
export default function MixedSweetBuilder({products,onAdd,onQuote}) {
  const [desired,setDesired]=useState(0);
  const [counts,setCounts]=useState({});
  const [notice,setNotice]=useState('');
  const flavors=useMemo(()=>products.filter(p=>p.active!==false&&p.category==='Docinhos de festa'&&p.id!=='cento-misto'&&(p.options||[]).length),[products]);
  const mixProduct=products.find(p=>p.id==='cento-misto'&&p.active!==false);
  const unitOption=mixProduct?.options?.find(o=>o.id==='mixed-custom');
  const pricePerSweet=unitOption?.price_cents;
  const chosen=Number(desired);
  const targetValid=Number.isSafeInteger(chosen)&&chosen>=MIN_SWEETS&&chosen<=MAX_SWEETS;
  const current=flavors.reduce((n,f)=>n+(counts[f.id]||0),0);
  const estimatedCents=chosen*(pricePerSweet||150);
  const overLimit=chosen>QUOTE_THRESHOLD_SWEETS;
  const valid=targetValid&&current===chosen&&!overLimit&&Boolean(unitOption)&&Number.isInteger(pricePerSweet)&&pricePerSweet>0;
  const quoteDetails=(items,total)=>flavors.filter(f=>(items[f.id]||0)>0).map(f=>`${items[f.id]} ${f.name}`).join(' + ')||`${total.toLocaleString('pt-BR')} docinhos · sabores a combinar`;
  const maybeQuote=(total,items,previous)=>{if(total>QUOTE_THRESHOLD_SWEETS&&previous<=QUOTE_THRESHOLD_SWEETS)onQuote?.({quantity:total,description:quoteDetails(items,total)});};
  const breakdown=Object.fromEntries(flavors.filter(f=>(counts[f.id]||0)>0).map(f=>[f.id,counts[f.id]]));
  const label=flavors.filter(f=>counts[f.id]>0).map(f=>`${counts[f.id]} ${f.name}`).join(' + ');
  function setTarget(value){const isEmpty=value==='';const n=Math.max(0,Math.min(MAX_SWEETS,Math.floor(Number(value)||0)));setDesired(isEmpty?'':n);if(n>0&&flavors.length){const half=Math.floor(n/2);const next={[flavors[0].id]:half,...(flavors[1]?{[flavors[1].id]:n-half}:{[flavors[0].id]:n})};setCounts(next);maybeQuote(n,next,Number(desired)||0);}else setCounts({});setNotice('');}
  function setFlavor(id,value){const nextValue=clamp(value,MAX_SWEETS);const next={...counts,[id]:nextValue};const nextTotal=flavors.reduce((n,f)=>n+(next[f.id]||0),0);maybeQuote(nextTotal,next,Number(desired)||0);setCounts(next);setDesired(nextTotal);setNotice('');}
  function preset(type){if(!targetValid||!flavors.length)return;const next=Object.fromEntries(flavors.map(f=>[f.id,0]));if(type==='single')next[flavors[0].id]=chosen;else if(type==='half'&&flavors.length>=2){next[flavors[0].id]=Math.floor(chosen/2);next[flavors[1].id]=chosen-next[flavors[0].id];}else if(type==='quarter'){let remaining=chosen;for(const f of flavors){const portion=Math.min(25,remaining);next[f.id]=portion;remaining-=portion;if(!remaining)break;}next[flavors[0].id]+=remaining;}else next[flavors[0].id]=chosen;setCounts(next);setNotice('');}
  function resetSelection(){setDesired(0);setCounts({});setNotice('Seleção zerada. Comece sua próxima encomenda.');}
  function add(){if(overLimit){onQuote?.({quantity:chosen,description:label});return;}if(!valid){setNotice(`A soma dos sabores precisa ser exatamente ${chosen} docinhos.`);return;}onAdd({option_id:'mixed-custom',qty:chosen,gift_wrap:false,personal_message:'',mix_breakdown:breakdown,mix_label:label});setNotice(`Encomenda de ${chosen} docinhos adicionada ao carrinho.`)}
  return <section className="mt-9 sm:mt-12 rounded-[28px] border border-[#edd9d3] bg-[#f8ece8] p-4 sm:p-8" aria-label="Monte sua encomenda de docinhos">
    <div className="grid lg:grid-cols-[1.35fr_.65fr] gap-5 sm:gap-7 items-start">
      <div><p className="eyebrow flex items-center gap-2"><Sparkles size={14}/> Personalize qualquer encomenda</p>
        <h3 className="font-display text-3xl sm:text-4xl mt-3">Quantos <em className="text-rose">docinhos</em> sua festa precisa?</h3>
        <p className="text-sm text-taupe leading-7 mt-3">Você informa o total, escolhe os sabores e distribui as quantidades. Pedidos até 500 docinhos podem ser finalizados pelo site. Para 501 doces ou mais, consulte disponibilidade, data e horário com a Drica pelo WhatsApp.</p>
        <label className="block mt-5"><span className="label">Quantidade total de docinhos *</span><input type="number" className="field !text-lg font-bold !min-h-12" inputMode="numeric" min="0" max={MAX_SWEETS} step="1" value={desired} onChange={e=>setTarget(e.target.value)} aria-label="Total de docinhos desejados"/></label>
        <div className="flex flex-wrap gap-2 mt-3">{quickTotals.map(n=><button type="button" key={n} className={`chip !py-2.5 ${desired===n?'!bg-cocoa !text-white':''}`} onClick={()=>setTarget(n)}>{n.toLocaleString('pt-BR')} doces</button>)}</div>
        <div className="flex flex-wrap gap-2 mt-5"><button className="chip !min-h-11 !py-3" type="button" onClick={()=>preset('half')}>Metade / metade</button><button className="chip !min-h-11 !py-3" type="button" onClick={()=>preset('quarter')}>Distribuir de 25 em 25</button><button className="chip !min-h-11 !py-3" type="button" onClick={()=>preset('single')}>Um só sabor</button><button className="chip !min-h-11 !py-3 !border-rose !text-rose" type="button" onClick={resetSelection}>Zerar seleção</button></div>
        <div className="mt-4 space-y-3">{flavors.map(f=><div key={f.id} className="bg-white border border-[#ecdbd4] rounded-2xl p-3 sm:p-4 min-w-0">
          <div className="flex items-center gap-3 min-w-0"><img src={f.image_url||'/favicon.svg'} alt="" loading="lazy" className="w-12 h-12 rounded-xl object-cover shrink-0"/><div className="min-w-0 flex-1"><p className="font-semibold text-sm leading-5">{f.name}</p><p className="text-xs text-taupe mt-1">{(counts[f.id]||0).toLocaleString('pt-BR')} unidades</p></div><strong className="text-sm sm:text-base text-cocoa whitespace-nowrap tabular-nums">{money((counts[f.id]||0)*(pricePerSweet||150))}</strong></div>
          <div className="mt-3 flex items-center gap-2"><button className="h-12 w-12 rounded-xl border border-[#e1c8c0] bg-[#fff8f5] grid place-items-center shrink-0 active:scale-95" type="button" aria-label={`Retirar 25 de ${f.name}`} disabled={!(counts[f.id]>0)} onClick={()=>setFlavor(f.id,(counts[f.id]||0)-25)}><Minus size={20}/></button><input className="min-w-0 flex-1 h-12 rounded-xl border border-[#e1c8c0] text-center text-base font-bold tabular-nums" aria-label={`Quantidade de ${f.name}`} type="number" inputMode="numeric" min="0" max={MAX_SWEETS} value={counts[f.id]||0} onChange={e=>setFlavor(f.id,e.target.value)}/><button className="h-12 w-12 rounded-xl border border-[#e1c8c0] bg-[#fff8f5] grid place-items-center shrink-0 active:scale-95" type="button" aria-label={`Adicionar 25 de ${f.name}`} onClick={()=>setFlavor(f.id,(counts[f.id]||0)+25)}><Plus size={20}/></button></div><p className="text-[11px] text-taupe text-center mt-1">Toque em + ou − para ajustar de 25 em 25</p></div>)}</div>
        <div aria-live="polite" className="mt-4"><div className="h-2 rounded-full bg-white overflow-hidden"><div className={`h-full rounded-full transition-all duration-200 ${valid?'bg-[#4c9169]':'bg-rose'}`} style={{width:`${targetValid?Math.min(100,current/chosen*100):0}%`}}/></div>
          <div className="flex justify-between gap-2 text-sm font-semibold mt-2 flex-wrap"><span className={valid?'text-[#34704f]':'text-cocoa'}>{current.toLocaleString('pt-BR')} de {chosen.toLocaleString('pt-BR')} docinhos {valid?'✓':''}</span><span className={valid?'text-[#34704f]':'text-rose'}>{!targetValid?`Informe pelo menos ${MIN_SWEETS} docinhos`:current<chosen?`Faltam ${(chosen-current).toLocaleString('pt-BR')}`:current>chosen?`Retire ${(current-chosen).toLocaleString('pt-BR')}`:'Quantidade completa'}</span></div></div>
        {!unitOption&&<p className="text-xs text-rose mt-3">Para receber encomendas com quantidades livres no sistema publicado, aplique a migração SQL 003 no Supabase.</p>}
        <p className="text-[11px] text-taupe leading-5 mt-3">A encomenda começa zerada. Ao digitar a quantidade ou tocar em + ou −, o total e o valor são atualizados imediatamente. Quantidade mínima nesta configuração: {MIN_SWEETS} docinhos. Pedidos grandes dependem de disponibilidade e confirmação da confeitaria.</p>
      </div>
      <aside className="bg-white rounded-3xl border border-[#efddda] p-4 sm:p-6 shadow-sm lg:sticky lg:top-24"><p className="eyebrow">Sua encomenda</p><h4 className="font-display text-2xl mt-2">{chosen.toLocaleString('pt-BR')} docinhos</h4><p className="text-xs text-taupe mt-1">Sabores personalizados</p><p className="my-5 text-xs leading-6 text-taupe min-h-16">{label||'Escolha os sabores da sua encomenda.'}</p>
        <div aria-live="polite" aria-label="Valor atualizado da encomenda" className="font-display text-3xl sm:text-4xl border-t pt-4 tabular-nums">{overLimit?'Valor sob consulta':money(estimatedCents)}</div><p className="text-[11px] text-taupe mt-1">Até 500 docinhos: valor proporcional ao cento. Acima de 500: atendimento especial, valor a combinar.</p>
        {overLimit?<button type="button" className="btn-dark w-full !min-h-12 mt-5" onClick={()=>onQuote?.({quantity:chosen,description:label})}><ShoppingBag size={16}/> Consultar disponibilidade no WhatsApp</button>:<button type="button" className="btn-dark w-full !min-h-12 mt-5 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!valid} onClick={add}><ShoppingBag size={16}/> Adicionar encomenda</button>}{notice&&<p className="text-xs text-taupe mt-3" role="status">{notice}</p>}
      </aside></div>
  </section>;
}
