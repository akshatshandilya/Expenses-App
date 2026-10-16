/* @auto-imports */
import {pad} from './dates.js';
/* @end-imports */
/* money: integer paise. quantity: integer thousandths. */
export function parseMoney(s){s=String(s==null?'':s).trim().replace(/,/g,'');if(!/^\d+(\.\d{0,2})?$/.test(s))return null;const p=s.split('.');return parseInt(p[0],10)*100+parseInt(((p[1]||'')+'00').slice(0,2),10);}
export function parseQty(s){s=String(s==null?'':s).trim();if(!/^\d+(\.\d{1,3})?$/.test(s))return null;const p=s.split('.');return parseInt(p[0],10)*1000+parseInt(((p[1]||'')+'000').slice(0,3),10);}
export const mul=(qM,uP)=>Math.floor((qM*uP+500)/1000); /* qty x unit price, rounded half-up to the paisa */
export function fmt(p){const neg=p<0;p=Math.abs(p);const r=Math.floor(p/100),f=p%100;let s=r.toLocaleString('en-IN');if(f)s+='.'+pad(f);return (neg?'−':'')+'₹'+s;}
export const rs=p=>p%100?(p/100).toFixed(2):String(p/100);
export const qtyStr=m=>String(m/1000);
export function fmtK(p){const r=p/100;if(r>=100000)return (r/100000).toFixed(1).replace('.0','')+'L';if(r>=10000)return Math.round(r/1000)+'k';if(r>=1000)return (r/1000).toFixed(1).replace('.0','')+'k';return String(Math.round(r));}
export const MAX_MONEY=1000000000, MAX_UNIT=10000000, MAX_QTY=10000000;
