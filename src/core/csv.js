/* @auto-imports */
import {fmtStamp,curMonth,addMonths} from './dates.js';
import {qtyStr,rs} from './money.js';
import {recMonth} from './rules.js';
import {S,catOf,houseOf} from '../data/state.js';
/* @end-imports */
export function csvCell(v){v=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
/* Months from the first one with any data up to now (or the latest month with data, if that is later), oldest first. */
export function csvMonths(){
  const ms=S.records.map(recMonth).concat(S.dist.map(d=>d.date.slice(0,7))).filter(m=>/^\d{4}-\d{2}$/.test(m)).sort();
  const first=ms[0]||curMonth(),cur=curMonth(),last=ms.length&&ms[ms.length-1]>cur?ms[ms.length-1]:cur;
  const out=[];for(let m=first<cur?first:cur;m<=last&&out.length<1200;m=addMonths(m,1))out.push(m);
  return out;
}
/* Rows that fall inside a range of months (reporting month for expenses, the trip date for distance). */
export function csvCount(o){const a=o&&o.from||'0000-00',z=o&&o.to||'9999-99';return S.records.filter(r=>recMonth(r)>=a&&recMonth(r)<=z).length+S.dist.filter(d=>d.date.slice(0,7)>=a&&d.date.slice(0,7)<=z).length;}
export function buildCsv(o){
  const a=o&&o.from||'0000-00',z=o&&o.to||'9999-99',inR=m=>m>=a&&m<=z;
  const h=['type','date','reporting_month','category','detail','direction','title_or_party','tenant','quantity','unit_price_inr','amount_inr','status','notes','added_at'];
  const L=[h.join(',')];
  S.records.filter(r=>inR(recMonth(r))).sort((a,b)=>a.date<b.date?-1:1).forEach(r=>{const c=catOf(r.cat);L.push([ 'expense',r.date,recMonth(r),c?c.name:r.cat,r.sub||(houseOf(r.houseId)?houseOf(r.houseId).name:''),r.dir||'',(r.title||r.party||''),r.tenant||'',r.qtyM?qtyStr(r.qtyM):'',r.unitP?rs(r.unitP):'',rs(r.amountP),r.status||'',r.notes||'',fmtStamp(r.ts)].map(csvCell).join(','));});
  S.dist.filter(d=>inR(d.date.slice(0,7))).sort((a,b)=>a.date<b.date?-1:1).forEach(d=>L.push(['distance',d.date,d.date.slice(0,7),'Travel','distance','',(d.from||'')+(d.to?' to '+d.to:''),'',qtyStr(d.kmM)+' km','','','',d.purpose||'',fmtStamp(d.ts)].map(csvCell).join(',')));
  return L.join('\n');
}
