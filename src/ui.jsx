import React,{useEffect} from 'react';
export const asInt=value=>Math.max(0,Math.round(Number(value)||0));
export function Button({children,soft=false,className='',...props}){return <button className={`${soft?'btn-soft':'btn-dark'} ${className}`} {...props}>{children}</button>}

/** Formata telefone brasileiro enquanto digita: (11) 91234-5678 / (11) 1234-5678. */
export function maskPhone(value){
  let d=String(value||'').replace(/\D/g,'');
  if(d.length>11&&d.startsWith('55'))d=d.slice(2);
  d=d.slice(0,11);
  if(d.length<=2)return d?`(${d}`:'';
  if(d.length<=6)return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if(d.length<=10)return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
/** Popup acessível: Esc fecha, foco entra no popup, Tab circula dentro dele e volta ao botão de origem ao fechar. */
export function useDialog(ref,open,onClose){
  useEffect(()=>{
    if(!open)return;
    const previous=document.activeElement;
    const node=ref.current;
    const first=()=>node?.querySelector(FOCUSABLE);
    (first()||node)?.focus?.({preventScroll:true});
    const onKey=e=>{
      if(e.key==='Escape'){e.stopPropagation();onClose?.();return}
      if(e.key!=='Tab'||!node)return;
      const items=[...node.querySelectorAll(FOCUSABLE)].filter(el=>el.offsetParent!==null);
      if(!items.length)return;
      const a=items[0],z=items[items.length-1];
      if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}
      else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
    };
    document.addEventListener('keydown',onKey);
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=overflow;previous?.focus?.({preventScroll:true})};
  },[open]);
}
