import React from 'react';
export const asInt=value=>Math.max(0,Math.round(Number(value)||0));
export function Button({children,soft=false,className='',...props}){return <button className={`${soft?'btn-soft':'btn-dark'} ${className}`} {...props}>{children}</button>}
