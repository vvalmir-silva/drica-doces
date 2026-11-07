import React from 'react';
import {ChevronDown,MessageCircle} from 'lucide-react';
import {WHATSAPP,money,leadTime} from './data.js';

/** Dúvidas frequentes + atalho para o WhatsApp (substitui o formulário longo). */
export default function ContactSection({settings={},products=[],deliveryOn=false}){
 const unit=products.find(p=>p.id==='cento-misto')?.options?.find(o=>o.id==='mixed-custom')?.price_cents;
 const cento=products.flatMap(p=>p.options||[]).find(o=>/(^|-)hundred$/.test(o.id))?.price_cents;
 const hours=Number(settings.min_hours??240);
 const faq=[
  ['Qual é o pedido mínimo?',`Os kits personalizados começam em 50 docinhos e você escolhe os sabores${unit?` (${money(unit)} por docinho)`:''}. Os sabores avulsos são vendidos por cento${cento?` (${money(cento)})`:''}.`],
  ['Com quanta antecedência devo encomendar?',`Com pelo menos ${leadTime(hours)} de antecedência. Para festas grandes ou datas concorridas, quanto antes melhor — a Drica confirma a disponibilidade pelo WhatsApp.`],
  ['Vocês fazem entrega?',deliveryOn?'Sim, nas regiões atendidas. A taxa é calculada pelo CEP no momento do pedido; também é possível retirar.':'No momento os pedidos pelo site são para retirada. Para entrega, consulte a Drica pelo WhatsApp.'],
  ['E se eu precisar de mais de 500 docinhos?','Pedidos acima de 500 docinhos são combinados direto com a Drica pelo WhatsApp, para garantir data, horário e produção.'],
  ['Como acompanho meu pedido?','Toque em “Acompanhar pedido” (no menu ou no rodapé) e informe o código recebido e o WhatsApp usado na encomenda.'],
 ];
 const url=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá, Drica! Vim pelo site e tenho uma dúvida sobre encomendas.')}`;
 return <section id="contato" className="bg-[#fffbf7] py-14 sm:py-20 scroll-mt-24"><div className="max-w-6xl mx-auto px-4 sm:px-7 grid lg:grid-cols-[.85fr_1.15fr] gap-8 lg:gap-14 items-start">
  <div className="lg:sticky lg:top-28">
   <p className="eyebrow">✦ Estamos por aqui</p>
   <h2 className="h2 mt-3">Ficou alguma <em className="text-rose">dúvida?</em></h2>
   <p className="text-sm sm:text-base text-taupe mt-4 leading-relaxed">Veja as perguntas mais comuns ou fale direto com a Drica — ela responde pelo WhatsApp.</p>
   <a href={url} target="_blank" rel="noopener noreferrer" className="btn-dark mt-6 !min-h-14 !bg-[#1f7a4d] hover:!bg-[#17623d] w-full sm:w-auto"><MessageCircle size={19}/> Chamar no WhatsApp</a>
   <p className="text-xs text-taupe mt-3">(11) 96082-9925</p>
  </div>
  <div className="space-y-3">
   {faq.map(([q,a])=><details key={q} className="group card !rounded-2xl px-5 py-1 open:shadow-soft">
    <summary className="flex items-center justify-between gap-4 cursor-pointer list-none min-h-14 font-semibold text-[15px] text-cocoa [&::-webkit-details-marker]:hidden">{q}<ChevronDown size={18} className="shrink-0 text-rose transition-transform group-open:rotate-180"/></summary>
    <p className="text-sm text-taupe leading-relaxed pb-4 -mt-1">{a}</p>
   </details>)}
  </div>
 </div></section>;
}
