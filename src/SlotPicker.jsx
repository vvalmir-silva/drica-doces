import React,{useMemo,useState} from 'react';
import {CalendarDays,Clock} from 'lucide-react';

const WEEK=['dom','seg','ter','qua','qui','sex','sáb'];
const pad=n=>String(n).padStart(2,'0');
// Datas tratadas no fuso de São Paulo (UTC-3, sem horário de verão).
const spNow=()=>new Date(Date.now()-3*3600000);
const iso=d=>`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
const toMs=(date,time)=>Date.parse(`${date}T${time}:00-03:00`);
const minutes=t=>{const [h,m]=String(t||'0:0').split(':').map(Number);return h*60+(m||0)};

/** Escolha de data e horário por botões, respeitando expediente, antecedência mínima e datas bloqueadas. */
export default function SlotPicker({value,onChange,settings,blocked}){
  const [custom,setCustom]=useState(false);
  const date=value.slice(0,10),time=value.slice(11);
  const open=settings?.open_time||'09:00',close=settings?.close_time||'18:00';
  const earliest=Date.now()+Number(settings?.min_hours||0)*3600000;
  const blockedSet=useMemo(()=>new Set((blocked||[]).map(b=>b.date)),[blocked]);
  const times=useMemo(()=>{const out=[];for(let m=minutes(open);m<=minutes(close);m+=60)out.push(`${pad(Math.floor(m/60))}:${pad(m%60)}`);return out},[open,close]);
  const days=useMemo(()=>{const out=[];const base=spNow();for(let i=0;out.length<10&&i<45;i++){const d=new Date(base.getTime()+i*86400000);const key=iso(d);if(blockedSet.has(key))continue;if(!times.some(t=>toMs(key,t)>=earliest))continue;out.push({key,label:`${WEEK[d.getUTCDay()]}`,day:`${pad(d.getUTCDate())}/${pad(d.getUTCMonth()+1)}`})}return out},[blockedSet,times,earliest]);
  const pickDate=key=>{const firstOk=times.find(t=>toMs(key,t)>=earliest);onChange(`${key}T${time&&toMs(key,time)>=earliest?time:(firstOk||times[0])}`)};
  return <div className="space-y-4">
    <div><p className="label flex items-center gap-1.5"><CalendarDays size={14}/> Data *</p>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x" role="radiogroup" aria-label="Data da encomenda">
        {days.map(d=><button type="button" role="radio" aria-checked={date===d.key} key={d.key} onClick={()=>pickDate(d.key)} className={`snap-start shrink-0 w-[68px] rounded-2xl border py-2.5 text-center transition ${date===d.key?'bg-cocoa text-white border-cocoa':'bg-white border-[#eadbd4] text-cocoa hover:border-rose'}`}><span className="block text-[11px] uppercase font-bold opacity-80">{d.label}</span><span className="block text-sm font-bold mt-0.5 tabular-nums">{d.day}</span></button>)}
      </div>
      {!custom?<button type="button" className="text-xs text-rose font-bold underline mt-2 min-h-9" onClick={()=>setCustom(true)}>Escolher outra data</button>:<input className="field mt-2" type="date" aria-label="Outra data" min={days[0]?.key} value={date} onChange={e=>e.target.value&&pickDate(e.target.value)}/>}
      {date&&blockedSet.has(date)&&<p role="alert" className="text-xs text-[#8e382f] mt-1">Esta data não aceita encomendas.</p>}
    </div>
    {date&&<div><p className="label flex items-center gap-1.5"><Clock size={14}/> Horário *</p>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="Horário">
        {times.map(t=>{const ok=toMs(date,t)>=earliest;return <button type="button" role="radio" aria-checked={time===t} key={t} disabled={!ok} onClick={()=>onChange(`${date}T${t}`)} className={`rounded-xl border min-h-11 text-sm font-bold tabular-nums transition ${time===t?'bg-cocoa text-white border-cocoa':'bg-white border-[#eadbd4] text-cocoa hover:border-rose'} disabled:opacity-35`}>{t}</button>})}
      </div></div>}
  </div>;
}
