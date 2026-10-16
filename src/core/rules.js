/* @auto-imports */
import {today} from './dates.js';
import {S,persist} from '../data/state.js';
/* @end-imports */
export const recMonth=r=>r.period||r.date.slice(0,7);
export const isIncome=r=>r.cat==='rent'&&r.dir==='received';
export const counted=r=>r.status!=='due'&&!isIncome(r);
export const recsIn=(mk,f)=>S.records.filter(r=>recMonth(r)===mk&&(!f||f(r)));
export const sum=rs_=>rs_.reduce((a,r)=>a+r.amountP,0);
export const spent=mk=>sum(recsIn(mk,counted));
export const catSpent=(mk,id)=>sum(recsIn(mk,r=>r.cat===id&&counted(r)));
export function priceOn(key,d){const pr=S.prices[key];if(!pr)return null;let v=pr.hist[0].price;pr.hist.forEach(h=>{if(h.from<=d)v=h.price;});return v;}
export function setPrice(key,p,mode){const t=today();let pr=S.prices[key];const old=pr?pr.cur:null;
  if(!pr){pr=S.prices[key]={cur:p,hist:[{from:'0000-00-00',price:p}],log:[]};}
  else if(mode==='all'){pr.hist=[{from:'0000-00-00',price:p}];pr.cur=p;}
  else{pr.hist=pr.hist.filter(h=>h.from!==t);pr.hist.push({from:t,price:p});pr.hist.sort((a,b)=>a.from<b.from?-1:1);pr.cur=p;}
  pr.log.push({at:t,from:old,to:p,mode:mode});persist();}

