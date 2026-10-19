/* @auto-imports */
import {fmtDate,fmtStamp,monLabel,monShort} from '../core/dates.js';
import {fmt,qtyStr} from '../core/money.js';
import {isIncome} from '../core/rules.js';
import {esc} from '../core/util.js';
import {S,catOf,houseOf} from '../data/state.js';
import {ic} from './icons.js';
/* @end-imports */
export const chipOf=c=>'<span class="ci" style="--c:'+esc(c.color)+'">'+ic(c.icon,22)+'</span>';
export const hd=(t,extra)=>'<header class="hd"><button class="ib" data-act="back" aria-label="Back">'+ic('chevL')+'</button><h1>'+t+'</h1>'+(extra||'')+'</header>';
export function monNav(){return '<div class="mnav"><button class="ib" data-act="mon" data-d="-1" aria-label="Previous month">'+ic('chevL')+'</button><button class="mlabel" data-act="monNow" aria-label="Selected month '+monLabel(S.mon)+'. Tap to jump to the current month">'+ic('calendar',18)+monLabel(S.mon)+'</button><button class="ib" data-act="mon" data-d="1" aria-label="Next month">'+ic('chevR')+'</button></div>';}
export function empty(icon,t,p,btn){return '<div class="card empty"><span class="ci">'+ic(icon,26)+'</span><h3>'+t+'</h3><p>'+p+'</p>'+(btn||'')+'</div>';}
export function stats(a){return '<div class="stats">'+a.map(x=>'<div class="stat"><span>'+x[0]+'</span><b>'+x[1]+'</b></div>').join('')+'</div>';}
export function recTitle(r){
  switch(r.cat){
    case 'water':return 'Water bottles';
    case 'gas':return 'Gas cylinders';
    case 'groceries':return r.title||'Groceries';
    case 'electricity':{const h=houseOf(r.houseId);return 'Electricity'+(h?' \u00B7 '+h.name:'');}
    case 'waterbill':{const h=houseOf(r.houseId);return 'Water bill'+(h?' · '+h.name:'');}
    case 'travel':return r.sub==='fuel'?'Fuel · '+((r.x&&r.x.fuelType)||'Fuel'):r.sub==='toll'?(r.party||'Toll'):(r.title||'Travel charge');
    case 'cab':return ((r.x&&r.x.mode)||'Ride')+' · '+(r.party||'Route');
    case 'rent':{const h=houseOf(r.houseId);return (r.dir==='received'?'Rent received':'Rent paid')+(h?' · '+h.name:(r.party?' · '+r.party:''));}
    default:{const c=catOf(r.cat);return r.title||(c?c.name:'Expense');}
  }
}
export function recSub(r){
  const b=[fmtDate(r.date)];
  if(r.qtyM&&r.unitP)b.push(qtyStr(r.qtyM)+' × '+fmt(r.unitP));
  if(r.period)b.push('For '+monShort(r.period));
  if(r.cat==='groceries'&&r.party)b.push(r.party);
  if(r.cat==='travel'&&r.sub==='toll'&&r.x&&r.x.vehicle)b.push(r.x.vehicle);
  return b.join(' · ');
}
export function recRow(r){
  const c=catOf(r.cat)||{icon:'dots',color:'#6F8079'};const inc=isIncome(r);
  return '<button class="rec" data-act="rec" data-id="'+esc(r.id)+'">'+chipOf(c)+'<span class="rt"><b>'+esc(recTitle(r))+(r.demo?'<i class="demo">DEMO</i>':'')+'</b><small>'+esc(recSub(r))+'</small>'+(r.ts?'<small class="stamp">Added '+fmtStamp(r.ts)+'</small>':'')+'</span><span class="amt'+(inc?' in':'')+'">'+(inc?'+':'')+fmt(r.amountP)+(r.status==='due'?'<em class="due">Due</em>':'')+'</span></button>';
}
export const recList=a=>'<div class="list">'+a.map(recRow).join('')+'</div>';
