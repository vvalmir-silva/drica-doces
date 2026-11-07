import React, {useEffect, useMemo, useState} from 'react';
import {ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardList, Copy, CreditCard, Gift, MapPin, MessageCircle, Minus, Plus, ShoppingBag, Store, Trash2, Truck, Wallet} from 'lucide-react';
import {WHATSAPP, DEMO_COUPONS, dateBR, digits, localToday, money, prepareWhatsApp, itemPieces, leadTime} from './data.js';
import {createOrder, getDemo, isLive, payPix, checkAvailability} from './api.js';
import SlotPicker from './SlotPicker.jsx';
import {maskPhone} from './ui.jsx';

const empty = {name:'', phone:'', email:'', cpf:'', scheduled_at:'', fulfillment:'Retirada', payment_method:'Cartão no recebimento', cep:'', street:'', number:'', complement:'', neighborhood:'', city:'', state:'', notes:'', coupon:'', whatsapp_status_opt_in:false};
const steps = ['Carrinho', 'Entrega', 'Confirmação'];
const itens = n => `${n} ${n===1?'item':'itens'}`;
const asClock = (value) => `${value || ''}:00-03:00`;

function StepHeading({current}) {
  return <nav aria-label="Etapas de encomenda" className="mb-7">
    <ol className="grid grid-cols-3 gap-1.5 sm:gap-3">
      {steps.map((s,i)=><li key={s} className="min-w-0 flex flex-col items-center gap-2">
        <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${current===i+1?'bg-cocoa text-white':current>i+1?'bg-[#d2e8da] text-[#2b6445]':'bg-[#f7efeb] text-taupe'}`} aria-current={current===i+1?'step':undefined}>{current>i+1?<Check size={17}/>:i+1}</div>
        <span className={`text-[10px] sm:text-xs font-bold text-center ${current===i+1?'text-cocoa':'text-taupe'}`}>{s}</span>
      </li>)}
    </ol>
    <div className="h-1.5 rounded-full bg-[#f4e8e1] mt-4 overflow-hidden"><div className="h-full bg-rose rounded-full transition-all duration-300" style={{width:`${current / 3 * 100}%`}}/></div>
  </nav>;
}
const Field = ({title,children,extraClass=''})=><label className={`block min-w-0 ${extraClass}`}><span className="label">{title}</span>{children}</label>;
const Line = ({label,value,strong=false})=><div className={`flex gap-3 justify-between items-start ${strong?'text-cocoa font-bold text-lg':'text-taupe text-sm'}`}><span>{label}</span><span className="text-right shrink-0">{value}</span></div>;

export default function GuidedCheckout({cart,products,settings,zones,blocked,onFinished,onNotify,onBrowse,onChangeQty,onRemove,onEditCart,onLargeOrder}) {
  const [step,setStep]=useState(1);
  const [form,setForm]=useState(empty);
  const [loadingCep,setLoadingCep]=useState(false);
  const [cepError,setCepError]=useState('');
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState(null);
  const [pix,setPix]=useState(null);
  const [payBusy,setPayBusy]=useState(false);
  const [validation,setValidation]=useState('');
  const [availability,setAvailability]=useState(null);
  const [availabilityBusy,setAvailabilityBusy]=useState(false);
  useEffect(()=>{
    const resetAfterReturn=()=>{
      try{if(sessionStorage.getItem('drica-wpp-handoff-v39')!=='1')return;sessionStorage.removeItem('drica-wpp-handoff-v39')}catch{return}
      onFinished();setResult(null);setStep(1);setForm(empty);setPix(null);setValidation('');
    };
    window.addEventListener('pageshow',resetAfterReturn);
    return()=>window.removeEventListener('pageshow',resetAfterReturn);
  },[onFinished]);
  const set=(k,v)=>{setValidation('');setForm(f=>({...f,[k]:v}));};
  // Sem regiões de frete cadastradas, a entrega fica oculta (evita erro de 'frete não cadastrado').
  const deliveryOn=(zones||[]).length>0;
  const [pixOn,setPixOn]=useState(false);
  const [couponOpen,setCouponOpen]=useState(false);
  useEffect(()=>{if(!isLive)return;let live=true;fetch('/api/config').then(r=>r.ok?r.json():null).then(c=>{if(live&&c)setPixOn(c.pix===true)}).catch(()=>{});return()=>{live=false}},[]);
  useEffect(()=>{if(!pixOn&&form.payment_method==='Pix')setForm(f=>({...f,payment_method:'Cartão no recebimento'}))},[pixOn,form.payment_method]);
  useEffect(()=>{if(!deliveryOn&&form.fulfillment==='Entrega')setForm(f=>({...f,fulfillment:'Retirada'}))},[deliveryOn,form.fulfillment]);
  const today=localToday();
  const rows=useMemo(()=>cart.map(c=>{
    const product=products.find(p=>p.active!==false && (p.options||[]).some(o=>o.id===c.option_id));
    const option=product?.options.find(o=>o.id===c.option_id);
    return {...c, product, option};
  }).filter(x=>x.option && x.option.price_cents>0 && Number.isInteger(x.qty) && x.qty>0),[cart,products]);
  const subtotal=rows.reduce((s,r)=>s+(r.option.price_cents+(r.gift_wrap?Number(settings.gift_wrap_cents||0):0))*r.qty,0);
  const hasItems=rows.length>0 && subtotal>0;
  const largeOrder=rows.reduce((n,r)=>n+itemPieces(r),0)>500;
  const count=rows.reduce((s,r)=>s+r.qty,0);
  const pieceCount=rows.reduce((n,r)=>n+itemPieces(r),0);
  const zone=form.fulfillment==='Entrega' ? [...(zones||[])].filter(z=>z.active!==false && z.cep_prefix && digits(form.cep).startsWith(z.cep_prefix)).sort((a,b)=>b.cep_prefix.length-a.cep_prefix.length)[0] : null;
  const fee=form.fulfillment==='Retirada'?0:zone?.fee_cents??null;
  const noFreight=form.fulfillment==='Entrega' && fee===null;
  const availableCoupon=!isLive && (getDemo().coupons||DEMO_COUPONS).find(c=>String(c.code).toUpperCase()===form.coupon.trim().toUpperCase() && c.active && subtotal>=Number(c.min_cents||0) && Number(c.used_count||0)<Number(c.max_uses||Infinity));
  const discount=availableCoupon && form.coupon.trim()?Math.round(subtotal*Number(availableCoupon.percent_off)/100):0;
  const total=subtotal-discount+(fee??0);
  const scheduledDate=form.scheduled_at.slice(0,10);
  const scheduledHour=form.scheduled_at.slice(11);
  const isBlocked=(blocked||[]).some(b=>b.date===scheduledDate);
  useEffect(()=>{let live=true;setAvailability(null);if(!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate))return;
    setAvailabilityBusy(true);
    checkAvailability(scheduledDate,pieceCount).then(data=>{if(live)setAvailability(data)}).catch(()=>{if(live)setAvailability(null)}).finally(()=>{if(live)setAvailabilityBusy(false)});
    return()=>{live=false};
  },[scheduledDate,pieceCount]);
  const quoteLink=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Olá, Drica Doces! Gostaria de consultar a taxa e a disponibilidade de entrega para o CEP ${form.cep || '(informar CEP)'}. Minha encomenda tem ${itens(count)}, subtotal de ${money(subtotal)}. Obrigado(a)!`)}`;

  useEffect(()=>{
    const cep=digits(form.cep);
    if(form.fulfillment!=='Entrega'||cep.length!==8){setLoadingCep(false);return;}
    const controller=new AbortController();
    const timeout=setTimeout(async()=>{
      setLoadingCep(true);setCepError('');
      try{
        const res=await fetch(`https://viacep.com.br/ws/${cep}/json/`,{signal:controller.signal});
        if(!res.ok)throw new Error('Consulta indisponível');
        const address=await res.json();
        if(address.erro)throw new Error('CEP não encontrado');
        setForm(prev=>digits(prev.cep)===cep?{...prev,street:address.logradouro||prev.street,neighborhood:address.bairro||prev.neighborhood,city:address.localidade||prev.city,state:address.uf||prev.state}:prev);
      }catch(err){if(err.name!=='AbortError')setCepError('Não foi possível consultar o CEP. Confira e preencha o endereço manualmente.');}
      finally{if(!controller.signal.aborted)setLoadingCep(false)}
    },400);
    return()=>{clearTimeout(timeout);controller.abort()};
  },[form.cep,form.fulfillment]);
  useEffect(()=>{if(!hasItems&&!result)setStep(1)},[hasItems,result]);

  function validateDelivery(){
    if(!hasItems)return 'Adicione pelo menos um doce para continuar.';
    if(form.name.trim().length<2)return 'Informe seu nome completo.';
    if(!/^\d{10,11}$/.test(digits(form.phone)))return 'Informe o WhatsApp com DDD válido.';
    if(form.email.trim()&&!/^\S+@\S+\.\S+$/.test(form.email))return 'Confira o endereço de e-mail.';
    if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(form.scheduled_at)||scheduledDate<today)return 'Escolha uma data e um horário válidos.';
    if(isBlocked||availability?.blocked)return 'Esta data está indisponível na agenda.';
    if(availability&&pieceCount>availability.available)return 'A quantidade ultrapassa a capacidade disponível nesta data. Escolha outro dia.';
    const parsed=Date.parse(asClock(form.scheduled_at));
    if(!Number.isFinite(parsed)||parsed<Date.now()+Number(settings.min_hours||0)*3600000)return `A encomenda exige pelo menos ${leadTime(settings.min_hours)} de antecedência.`;
    if(scheduledHour<(settings.open_time||'00:00')||scheduledHour>(settings.close_time||'23:59'))return `Escolha um horário entre ${settings.open_time} e ${settings.close_time}.`;
    if(form.fulfillment==='Entrega'){
      if(digits(form.cep).length!==8 || !form.street.trim() || !form.number.trim() || !form.neighborhood.trim() || !form.city.trim() || !/^[A-Z]{2}$/.test(form.state.toUpperCase().trim()))return 'Preencha CEP, rua, número, bairro, cidade e UF.';
      if(noFreight)return 'Ainda não há taxa cadastrada para este CEP. Consulte o frete pelo WhatsApp ou escolha retirada.';
    }
    return '';
  }
  function advance(){const e=validateDelivery();if(e){setValidation(e);onNotify(e);return;}setValidation('');setStep(3);}
  // Usa navegação na própria aba: alguns navegadores bloqueiam janelas novas
  // após uma chamada assíncrona ao servidor. O pedido já fica salvo no Supabase.
  function openOrderWhatsApp(order){
    const url=prepareWhatsApp(order);
    try{sessionStorage.setItem('drica-wpp-handoff-v39','1')}catch{}
    onFinished(); // Limpa o carrinho persistido antes de sair do site.
    setStep(1);setForm(empty);setPix(null);setValidation('');
    window.location.assign(url);
  }
  async function submit(e){
    e.preventDefault();
    if(largeOrder){onLargeOrder?.();return;}
    if(step!==3 || !hasItems || noFreight){onNotify('Revise o carrinho e a taxa de entrega antes de finalizar.');return;}
    const error=validateDelivery();if(error){setValidation(error);setStep(2);return;}
    if(form.payment_method==='Pix'&&(!/^\S+@\S+\.\S+$/.test(form.email)||digits(form.cpf).length!==11)){setValidation('Para Pix, preencha e-mail e CPF com 11 dígitos.');return;}
    setBusy(true);setValidation('');
    try{
      const payload={...form,phone:digits(form.phone),cep:digits(form.cep),cpf:undefined,items:cart.map(c=>({...c})),client_request_id:(crypto.randomUUID?.()||('00000000-0000-4000-8000-'+Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12)))};
      const response=await createOrder(payload,{products,settings,zones,blocked,coupons:isLive?[]:(getDemo().coupons||undefined)});
      const savedOrder={...response.order,access_token:response.access_token||response.order.access_token};
      setResult(savedOrder);
      if(response.isDemo)onNotify('Pedido salvo nesta demonstração. Abra o WhatsApp e confirme o envio da mensagem.');
      else if(!response.emailSent)onNotify('Pedido registrado. O aviso por e-mail pode não ter sido entregue.');
      // Abertura imediata após confirmação no banco, sem exigir segundo clique.
      // Se o WhatsApp não abrir, a confirmação preserva o link para tentar novamente.
      openOrderWhatsApp(savedOrder);
    }catch(err){setValidation(err.message||'Não foi possível registrar o pedido.');onNotify(err.message||'Erro ao registrar pedido.');}
    finally{setBusy(false)}
  }
  async function generatePix(){if(!result?.items?.length)return;setPayBusy(true);try{setPix(await payPix(result,form.cpf))}catch(err){onNotify(err.message)}finally{setPayBusy(false)}}

  // Carrinho vazio: bloco compacto (o carrinho lateral já mostra o estado vazio).
  if(!hasItems&&!result&&!largeOrder)return <section id="encomendar" className="scroll-mt-24 py-10 sm:py-14 px-4 sm:px-7"><div className="max-w-3xl mx-auto card p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left"><div className="h-14 w-14 rounded-full bg-blush text-rose grid place-items-center shrink-0"><ShoppingBag size={26}/></div><div className="flex-1"><h2 className="font-display text-2xl sm:text-3xl">Pronto para encomendar?</h2><p className="text-taupe text-sm mt-1">Escolha seus doces e finalize aqui em 3 passos: carrinho, entrega e confirmação pelo WhatsApp.</p></div><button type="button" className="btn-dark min-h-12 shrink-0" onClick={onBrowse}>Ver cardápio <ArrowRight size={16}/></button></div></section>;
  return <section id="encomendar" className="scroll-mt-24 py-12 sm:py-20 bg-[linear-gradient(180deg,#fff6f2,#fffbf7)]">
    <div className="max-w-5xl mx-auto px-4 sm:px-7">
      <div className="text-center mb-8"><span className="eyebrow">✦ Encomende com facilidade</span><h2 className="h2 mt-3">Seu carinho em <em className="text-rose">três passos.</em></h2><p className="text-taupe text-sm mt-3">Confira seus doces, escolha a entrega e revise antes de enviar ao WhatsApp.</p></div>
      <div className="grid lg:grid-cols-[1.65fr_1fr] gap-5 sm:gap-7 items-start">
        <div className="card p-4 sm:p-8 min-w-0 order-1 overflow-hidden">
          {largeOrder?<div className="space-y-4 py-6 text-center"><h3 className="font-display text-2xl">Encomenda especial</h3><p className="text-sm text-taupe">Para pedidos acima de 500 docinhos, consulte disponibilidade, data e horário diretamente com a Drica.</p><button type="button" className="btn-dark w-full" onClick={onLargeOrder}><MessageCircle size={17}/> Consultar pelo WhatsApp</button></div>:result?<div className="space-y-5" aria-live="polite">
            <div className="bg-[#edf7ed] rounded-2xl p-5 text-center"><CheckCircle2 size={35} className="mx-auto text-[#398253]"/><p className="eyebrow mt-3">Solicitação registrada</p><h3 className="font-display text-3xl mt-2">{result.code}</h3><button type="button" className="mt-2 rounded-full bg-white px-4 py-2 border border-[#cce3d1] text-xs font-bold text-[#2c6849] inline-flex items-center gap-2" onClick={async()=>{try{await navigator.clipboard.writeText(result.code);onNotify("Código copiado!")}catch{onNotify("Copie o código exibido para acompanhar o pedido.")}}}><Copy size={14}/> Copiar código</button><p className="text-xs text-taupe mt-2">Guarde o código para acompanhar seu pedido. A encomenda ainda precisa ser confirmada pela Drica.</p></div>
            <div className="space-y-2"><Line label="Subtotal" value={money(result.subtotal_cents)}/><Line label="Desconto" value={money(result.discount_cents||0)}/><Line label="Entrega" value={result.delivery_fee_cents===null?'A confirmar':money(result.delivery_fee_cents||0)}/><Line label="Total do pedido" value={money(result.total_cents)} strong/></div>
            <a className="btn-dark w-full min-h-12 text-center" href={prepareWhatsApp(result)} onClick={()=>{
              // Link nativo: não impedir o comportamento padrão do navegador.
              try{sessionStorage.setItem('drica-wpp-handoff-v39','1')}catch{}
              onFinished();setStep(1);setForm(empty);setPix(null);setValidation('');
            }}><MessageCircle size={18}/> Abrir WhatsApp novamente</a>
            <p className="text-xs text-taupe text-center">A encomenda já foi registrada no sistema. Se o WhatsApp não abriu automaticamente, toque no botão acima. Confira a mensagem e toque em Enviar dentro do WhatsApp.</p>
            {result.payment_method==='Pix'&&<div className="bg-[#fff9f5] rounded-xl border p-4 text-xs leading-6 text-taupe"><strong>Pix somente depois da confirmação.</strong><p>Quando a Drica confirmar a encomenda, use “Meu pedido”, informe seu código e WhatsApp, e gere o Pix com CPF. Se houver sinal configurado, o valor será calculado pelo servidor. Não efetue pagamentos na demonstração.</p></div>}
            <button type="button" className="text-sm text-rose underline font-bold" onClick={()=>{setResult(null);setStep(1);setForm(empty);setPix(null)}}>Iniciar outra encomenda</button>
          </div>:!hasItems?<div role="status" className="text-center py-9 sm:py-14"><ShoppingBag size={48} className="mx-auto text-rose opacity-60"/><h3 className="font-display text-3xl mt-5">Carrinho vazio ♡</h3><p className="text-taupe mt-3 mb-6 text-sm">Adicione pelo menos um doce antes de escolher entrega e pagamento.</p><button type="button" className="btn-dark min-h-12" onClick={onBrowse}><ShoppingBag size={16}/> Ver cardápio <ArrowRight size={16}/></button></div>:<>
            <StepHeading current={step}/>
            <div className="lg:hidden -mt-3 mb-5 flex justify-between items-center rounded-xl bg-[#fbf3f0] px-4 py-2.5 text-sm"><span className="text-taupe">{itens(count)}</span><strong className="tabular-nums">Total {fee===null?'a calcular':money(total)}</strong></div>
            {validation&&<p role="alert" className="mb-4 text-sm p-3 rounded-xl bg-[#fff1f0] border border-[#f3c6c5] text-[#9c3737]">{validation}</p>}
            {step===1&&<div className="enter space-y-5">
              <div className="flex justify-between gap-2 items-center"><h3 className="font-display text-2xl">Revise seu carrinho</h3><button className="text-xs text-rose font-bold underline" onClick={onBrowse}>Adicionar doces</button></div>
              <div className="space-y-3">{rows.map(r=><article key={r.line_key||r.option_id} className="flex gap-3 border border-[#f0e3dd] rounded-2xl p-3">
                <img loading="lazy" src={r.product.image_url} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 bg-blush"/>
                <div className="flex-1 min-w-0"><strong className="text-sm block leading-snug">{r.product.name}</strong><p className="text-xs text-taupe">{r.option.label}{r.gift_wrap?' • Embalagem especial':''}</p>{r.mix_label&&<p className="text-[11px] text-taupe break-words">{r.mix_label}</p>}{r.personal_message&&<p className="text-[11px] text-taupe break-words">Cartão: {r.personal_message}</p>}
                  <div className="flex flex-wrap justify-between gap-2 items-center mt-3">{r.option_id==='mixed-custom'?<span className="text-xs text-taupe">{r.qty.toLocaleString('pt-BR')} doces · remova para refazer</span>:<div className="flex items-center gap-2 rounded-full border"><button type="button" className="w-12 h-12 grid place-items-center" aria-label="Diminuir" onClick={()=>onChangeQty(r.line_key||r.option_id,-1)}><Minus size={15}/></button><span className="text-xs font-bold">{r.qty}</span><button type="button" className="w-12 h-12 grid place-items-center" aria-label="Aumentar" onClick={()=>onChangeQty(r.line_key||r.option_id,1)}><Plus size={15}/></button></div>}<strong className="text-sm">{money((r.option.price_cents+(r.gift_wrap?settings.gift_wrap_cents:0))*r.qty)}</strong><button type="button" onClick={()=>onRemove(r.line_key||r.option_id)} className="text-rose p-2" aria-label="Remover item"><Trash2 size={17}/></button></div>
                </div>
              </article>)}</div>
              <Line label={`${count} doce(s) · Subtotal`} value={money(subtotal)} strong/>
              <button type="button" className="btn-dark w-full min-h-12" onClick={()=>{setValidation('');setStep(2)}}>Continuar para entrega <ArrowRight size={17}/></button>
            </div>}
            {step===2&&<div className="enter space-y-5">
              <div><h3 className="font-display text-2xl">Dados e entrega</h3><p className="text-taupe text-xs mt-1">Preencha as informações para reservar a data desejada.</p></div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field title="Nome completo *" extraClass="sm:col-span-2"><input className="field" autoComplete="name" value={form.name} maxLength={90} onChange={e=>set('name',e.target.value)} placeholder="Seu nome"/></Field>
                <Field title="WhatsApp com DDD *"><input className="field" type="tel" inputMode="tel" autoComplete="tel-national" maxLength={16} value={form.phone} onChange={e=>set('phone',maskPhone(e.target.value))} placeholder="(11) 99999-9999"/></Field>
                <Field title="E-mail (opcional, exceto Pix)"><input className="field" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="voce@email.com"/></Field>
              </div>
              <SlotPicker value={form.scheduled_at} onChange={v=>set('scheduled_at',v)} settings={settings} blocked={blocked}/>
              <p className="text-xs text-taupe">Pedidos com {leadTime(settings.min_hours)} de antecedência · a Drica confirma a disponibilidade pelo WhatsApp.</p>
              {scheduledDate&&<div role="status" className={`rounded-xl p-3 text-xs ${availability&&(!availability.can_book||availability.blocked)?'bg-[#fff1ef] text-[#8e382f]':'bg-[#eaf4eb] text-[#285c41]'}`}>{availabilityBusy?'Consultando capacidade de produção...':availability?availability.blocked?'Data bloqueada na agenda.':`Capacidade nesta data: ${availability.available.toLocaleString('pt-BR')} docinhos livres de ${availability.capacity.toLocaleString('pt-BR')}. ${availability.can_book?'Quantidade permitida; aguarde a confirmação da Drica.':'Escolha outro dia ou reduza a quantidade.'}`:'A disponibilidade será validada quando o pedido for registrado.'}</div>}
              {deliveryOn?<div className="grid grid-cols-2 gap-2 sm:gap-3"><button type="button" onClick={()=>set('fulfillment','Retirada')} aria-pressed={form.fulfillment==='Retirada'} className={`min-h-14 flex justify-center items-center gap-2 rounded-xl border text-xs sm:text-sm font-bold ${form.fulfillment==='Retirada'?'bg-blush border-rose':'bg-white border-[#ebd9d2]'}`}><Store size={18}/> Retirada</button><button type="button" onClick={()=>set('fulfillment','Entrega')} aria-pressed={form.fulfillment==='Entrega'} className={`min-h-14 flex justify-center items-center gap-2 rounded-xl border text-xs sm:text-sm font-bold ${form.fulfillment==='Entrega'?'bg-blush border-rose':'bg-white border-[#ebd9d2]'}`}><Truck size={18}/> Entrega</button></div>:<div className="rounded-xl border border-[#ebd9d2] bg-[#fffaf8] p-3 text-sm flex gap-3 items-start"><Store size={18} className="text-rose shrink-0 mt-0.5"/><div><p className="font-bold">Retirada com a Drica</p><p className="text-xs text-taupe mt-1">Precisa de entrega? <a className="underline font-bold text-roseink" href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá, Drica! Vocês entregam no meu endereço? Meu CEP é: ')}`} target="_blank" rel="noopener noreferrer">Consulte pelo WhatsApp</a>.</p></div></div>}
              {deliveryOn&&form.fulfillment==='Entrega'&&<div className="bg-[#fff7f3] border border-[#f0e3dc] p-3 sm:p-4 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 font-semibold text-sm"><MapPin size={16}/> Endereço de entrega</div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field title="CEP *"><input className="field" inputMode="numeric" maxLength={9} autoComplete="postal-code" placeholder="00000-000" value={form.cep} onChange={e=>setForm(f=>({...f,cep:e.target.value,street:'',neighborhood:'',city:'',state:''}))}/><span className="text-xs text-taupe">{loadingCep?'Buscando no ViaCEP...':cepError||'Busca automática de endereço'}</span></Field>
                  <Field title="Número *"><input className="field" maxLength={20} value={form.number} onChange={e=>set('number',e.target.value)}/></Field>
                  <Field title="Rua / Avenida *" extraClass="sm:col-span-2"><input className="field" value={form.street} onChange={e=>set('street',e.target.value)}/></Field>
                  <Field title="Bairro *"><input className="field" value={form.neighborhood} onChange={e=>set('neighborhood',e.target.value)}/></Field>
                  <Field title="Complemento"><input className="field" value={form.complement} onChange={e=>set('complement',e.target.value)}/></Field>
                  <Field title="Cidade *"><input className="field" value={form.city} onChange={e=>set('city',e.target.value)}/></Field>
                  <Field title="UF *"><input className="field" maxLength={2} value={form.state} onChange={e=>set('state',e.target.value.toUpperCase())}/></Field>
                </div>
                {noFreight?<div className="p-3 rounded-xl border border-[#f4d6be] bg-[#fff2e7] text-xs leading-6"><strong>Frete ainda não cadastrado para este CEP.</strong><p>Para evitar um valor incorreto, o pedido online e o Pix ficam bloqueados para entrega até que a taxa seja definida.</p><a href={quoteLink} target="_blank" rel="noopener noreferrer" className="font-bold underline text-[#90553f] flex items-center gap-1 mt-2"><MessageCircle size={16}/> Consultar frete no WhatsApp</a></div>:<div className="flex items-center justify-between rounded-xl bg-[#eaf5ec] border border-[#cbe4d0] p-3 text-xs"><span className="font-semibold">Frete para este CEP</span><strong>{money(fee)}</strong></div>}
              </div>}
              <div className="flex gap-2"><button className="btn-soft min-h-12" type="button" onClick={()=>{setStep(1);setValidation('')}}><ArrowLeft size={16}/> Voltar</button><button type="button" className="btn-dark flex-1 min-h-12" onClick={advance}>Revisar pedido <ArrowRight size={16}/></button></div>
            </div>}
            {step===3&&<form className="enter space-y-5" onSubmit={submit} noValidate>
              <h3 className="font-display text-2xl">Confira antes de enviar</h3>
              <div className="bg-[#fff9f5] rounded-xl p-4 space-y-2"><p className="eyebrow">Itens da encomenda</p>{rows.map(r=><div className="flex justify-between gap-2 text-xs" key={r.line_key||r.option_id}><span>{r.qty} × {r.product.name} — {r.option.label}{r.mix_label?` · ${r.mix_label}`:''}</span><strong className="shrink-0">{money((r.option.price_cents+(r.gift_wrap?settings.gift_wrap_cents:0))*r.qty)}</strong></div>)}</div>
              <div className="rounded-xl border border-[#f0e5df] p-4 text-xs space-y-1"><p><strong>Cliente:</strong> {form.name}</p><p><strong>WhatsApp:</strong> {form.phone}</p><p><strong>Data:</strong> {dateBR(form.scheduled_at)}</p><p><strong>Recebimento:</strong> {form.fulfillment}</p>{form.fulfillment==='Entrega'&&<p className="break-words"><strong>Endereço:</strong> {form.street}, {form.number}, {form.neighborhood}, {form.city}/{form.state} · CEP {form.cep}</p>}<button type="button" className="text-rose underline font-bold pt-2" onClick={()=>{setStep(2);setValidation('')}}>Corrigir dados ou endereço</button></div>
              <div><p className="label">Pagamento</p>{pixOn?<div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de pagamento">{[['Cartão no recebimento',CreditCard,'Cartão','na retirada/entrega'],['Pix',Wallet,'Pix','após a confirmação']].map(([v,Icon,t,sub])=><button type="button" role="radio" aria-checked={form.payment_method===v} key={v} onClick={()=>set('payment_method',v)} className={`rounded-xl border p-3 text-left min-h-16 transition ${form.payment_method===v?'bg-blush border-rose':'bg-white border-[#ebd9d2] hover:border-rose'}`}><span className="flex items-center gap-2 font-bold text-sm"><Icon size={17}/> {t}</span><span className="block text-[11px] text-taupe mt-0.5">{sub}</span></button>)}</div>:<div className="rounded-xl border border-[#ebd9d2] bg-white p-3 flex items-center gap-3 text-sm"><CreditCard size={18} className="text-rose shrink-0"/><span><strong>Cartão no recebimento</strong><span className="block text-[11px] text-taupe">Pague na retirada ou na entrega.</span></span></div>}</div>
              {couponOpen||form.coupon?<Field title="Cupom"><input className="field uppercase" maxLength={24} placeholder="Digite o cupom" autoFocus value={form.coupon} onChange={e=>set('coupon',e.target.value.toUpperCase())}/></Field>:<button type="button" className="text-sm text-roseink font-bold underline min-h-9" onClick={()=>setCouponOpen(true)}>Tem um cupom?</button>}
              <label className="flex items-start gap-3 rounded-2xl border border-[#eadbd6] bg-[#fffaf7] p-4 cursor-pointer">
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#b7757f]" checked={form.whatsapp_status_opt_in} onChange={e=>set('whatsapp_status_opt_in',e.target.checked)}/>
                <span className="text-sm leading-snug text-cocoa"><strong>Receber avisos do pedido pelo WhatsApp</strong><span className="block text-[11px] text-taupe mt-1 leading-relaxed">Confirmação, preparo e pronto para retirada. Opcional — peça para parar quando quiser.</span></span>
              </label>
              {form.payment_method==='Pix'&&<div className="bg-[#fff7f3] border rounded-xl p-3 space-y-3"><p className="font-bold text-xs">Dados necessários para gerar o Pix</p><Field title="CPF (11 dígitos) *"><input className="field" inputMode="numeric" maxLength={14} value={form.cpf} onChange={e=>set('cpf',e.target.value)} placeholder="Somente números"/></Field><Field title="E-mail *"><input className="field" type="email" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="voce@email.com"/></Field><p className="text-xs text-taupe">Pix depende de Mercado Pago configurado. {Number(settings.deposit_percent||0)>0?`Sinal previsto de ${settings.deposit_percent}% após a Drica confirmar disponibilidade; saldo restante a combinar.`:"Pagamento integral, sujeito à confirmação."} Não pague até receber instruções seguras da Drica.</p></div>}
              <Field title="Observações especiais (opcional)"><textarea className="field" rows={2} maxLength={350} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Informe preferências ou detalhes da encomenda"/></Field>
              <div className="space-y-2 border-t pt-4"><Line label="Subtotal" value={money(subtotal)}/><Line label={form.fulfillment==='Retirada'?'Retirada':'Entrega'} value={form.fulfillment==='Retirada'?'Sem frete':fee===null?'A consultar':money(fee)}/>{form.coupon&&<Line label={isLive?'Desconto (validado pelo servidor)':'Desconto demonstrativo'} value={isLive?'A validar':`− ${money(discount)}`}/>}<Line label={isLive&&form.coupon?'Total antes da validação do cupom':'Total previsto'} value={money(total)} strong/>{form.coupon&&isLive&&<p className="text-xs text-taupe">O total definitivo, com o cupom validado, aparecerá após registrar a solicitação e antes de gerar o Pix.</p>}</div>
              <button disabled={!hasItems||noFreight||busy} className="btn-dark w-full !min-h-14 !text-base !bg-[#1f7a4d] hover:!bg-[#17623d]" type="submit"><MessageCircle size={19}/>{busy?'Enviando...':'Enviar pedido pelo WhatsApp'}</button>
              <p className="text-xs text-taupe text-center leading-relaxed">Registramos seu pedido e abrimos o WhatsApp com a mensagem pronta — é só tocar em Enviar. A Drica confirma a disponibilidade.</p>
              <button className="mx-auto flex items-center gap-1.5 text-sm text-taupe font-semibold min-h-11" type="button" onClick={()=>{setStep(2);setValidation('')}}><ArrowLeft size={15}/> Voltar e corrigir</button>
            </form>}
          </>}
        </div>
        <aside className="order-2 hidden lg:block bg-blush rounded-[24px] p-5 sm:p-7 lg:sticky lg:top-24"><p className="eyebrow">♡ Drica Doces</p><h3 className="font-display text-2xl mt-2">Resumo da encomenda</h3><div className="mt-5 space-y-3"><Line label="Doces" value={itens(count)}/><Line label="Subtotal" value={money(subtotal)}/><Line label={form.fulfillment==='Retirada'?'Retirada':'Entrega'} value={form.fulfillment==='Retirada'?'Sem frete':fee===null?'A consultar':money(fee)}/><div className="border-t border-[#e4cec9] pt-3"><Line label="Total estimado" value={fee===null?'Após cotação':money(total)} strong/></div></div>{!result&&step===1&&<button type="button" className="btn-soft mt-4 w-full" onClick={onEditCart}><ShoppingBag size={16}/> Abrir carrinho lateral</button>}</aside>
      </div>
    </div>
  </section>;
}
