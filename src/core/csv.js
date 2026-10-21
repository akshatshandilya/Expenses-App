/* @auto-imports */
import {fmtStamp} from './dates.js';
import {qtyStr,rs} from './money.js';
import {recMonth} from './rules.js';
import {S,catOf,houseOf} from '../data/state.js';
/* @end-imports */
export function csvCell(v){v=String(v==null?'':v);if(/^[=+\-@\t\r]/.test(v))v="'"+v;return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
export function buildCsv(){
  const h=['type','date','reporting_month','category','detail','direction','title_or_party','tenant','quantity','unit_price_inr','amount_inr','status','notes','added_at'];
  const L=[h.join(',')];
  S.records.slice().sort((a,b)=>a.date<b.date?-1:1).forEach(r=>{const c=catOf(r.cat);L.push([ 'expense',r.date,recMonth(r),c?c.name:r.cat,r.sub||(houseOf(r.houseId)?houseOf(r.houseId).name:''),r.dir||'',(r.title||r.party||''),r.tenant||'',r.qtyM?qtyStr(r.qtyM):'',r.unitP?rs(r.unitP):'',rs(r.amountP),r.status||'',r.notes||'',fmtStamp(r.ts)].map(csvCell).join(','));});
  S.dist.slice().sort((a,b)=>a.date<b.date?-1:1).forEach(d=>L.push(['distance',d.date,d.date.slice(0,7),'Travel','distance','',(d.from||'')+(d.to?' to '+d.to:''),'',qtyStr(d.kmM)+' km','','','',d.purpose||'',fmtStamp(d.ts)].map(csvCell).join(',')));
  return L.join('\n');
}
