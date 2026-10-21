import React, {useEffect, useState} from 'react';
import {CalendarDays, Clock3, Heart, MessageCircle, X} from 'lucide-react';
import {WHATSAPP} from './data.js';

/** Consultas especiais nunca viram pedido confirmado nem passam pelo checkout. */
export default function LargeOrderModal({quote,onClose}) {
  const [date,setDate]=useState('');
  const [time,setTime]=useState('');
  useEffect(()=>{if(!quote)return;const onKey=e=>{if(e.key==='Escape')onClose()};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[quote,onClose]);
  if(!quote)return null;
  const qty=Number(quote.quantity||0);
  const heading=qty?`${qty.toLocaleString('pt-BR')} docinhos`:'Encomenda especial';
  const flavors=quote.description||'Sabores a combinar';
  const dateText=date?date.split('-').reverse().join('/'):'a combinar';
  const message=[
    'Olá, Drica! 💖 Tudo bem?',
    'Estou organizando uma festa muito especial e queria deixar esse momento ainda mais doce com suas delícias! 🎉🍬',
    `Gostaria de consultar uma encomenda especial de ${heading}.`,
    `Sabores / composição: ${flavors}`,
    `Data desejada: ${dateText}`,
    `Horário desejado: ${time||'a combinar'}`,
    '',
    'Você consegue me confirmar a disponibilidade para essa quantidade, a melhor data e horário para entrega ou retirada e o orçamento? Vai ser um prazer ter a Drica Doces na nossa comemoração! 💕'
  ].join('\n');
  const url=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;
  return <div className="fixed inset-0 z-[80] bg-[#281915]/70 backdrop-blur-sm flex items-center justify-center p-3" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section role="dialog" aria-modal="true" aria-label="Consultar encomenda especial" className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-[28px] border border-[#ead0cb] bg-[#fffaf7] shadow-2xl p-5 sm:p-8" onMouseDown={e=>e.stopPropagation()}>
      <div className="flex justify-between gap-3 items-start"><div className="w-12 h-12 rounded-full bg-blush text-rose grid place-items-center"><Heart size={24}/></div><button type="button" aria-label="Fechar pop-up" className="p-2 bg-white border rounded-full" onClick={onClose}><X size={20}/></button></div>
      <p className="eyebrow mt-4">✦ Atendimento especial ✦</p>
      <h2 className="font-display text-3xl sm:text-4xl leading-tight mt-2">Sua festa merece <em className="text-rose">um toque de carinho!</em></h2>
      <p className="text-sm leading-7 text-taupe mt-4">Que alegria fazer parte da sua comemoração! Para pedidos acima de 500 docinhos, queremos preparar tudo com atenção especial. Converse com a Drica para confirmar a disponibilidade, a data, o horário e o orçamento da sua encomenda.</p>
      <div className="mt-4 rounded-2xl bg-[#f8ece8] p-4 text-sm"><strong>{heading}</strong><p className="text-taupe mt-1 break-words text-xs">{flavors}</p><p className="font-semibold text-rose mt-2">Valor sob consulta</p></div>
      <div className="grid sm:grid-cols-2 gap-3 mt-5"><label className="block"><span className="label flex gap-2 items-center"><CalendarDays size={14}/> Data desejada (opcional)</span><input type="date" className="field" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="block"><span className="label flex gap-2 items-center"><Clock3 size={14}/> Horário desejado (opcional)</span><input type="time" className="field" value={time} onChange={e=>setTime(e.target.value)}/></label></div>
      <a href={url} target="_blank" rel="noopener noreferrer" className="btn-dark w-full mt-5 min-h-12 text-center"><MessageCircle size={18}/> Conversar com a Drica no WhatsApp</a>
      <p className="text-[11px] text-taupe mt-3 text-center">A conversa será aberta no número (11) 96081-4357. Envie a mensagem no WhatsApp para consultar a disponibilidade. Nenhum pedido ou pagamento será registrado automaticamente.</p>
    </section>
  </div>;
}
