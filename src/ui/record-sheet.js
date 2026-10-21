/* @auto-imports */
import {fmtDate,fmtStamp,leftInfo,monLabel} from '../core/dates.js';
import {fmt,qtyStr} from '../core/money.js';
import {isIncome,recMonth} from '../core/rules.js';
import {esc} from '../core/util.js';
import {S,catOf,houseOf} from '../data/state.js';
import {chipOf,recTitle} from './components.js';
import {ic} from './icons.js';
import {sheet} from './nav.js';
/* @end-imports */
export function recSheet(id){
  const r=S.records.find(x=>x.id===id);if(!r)return;const c=catOf(r.cat)||{name:'Other'};
  const kv=(a,b)=>b?'<div class="kv"><span>'+a+'</span><span>'+b+'</span></div>':'';
  sheet('<div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">'+chipOf(c)+'<div style="min-width:0"><h2 style="margin:0">'+esc(recTitle(r))+'</h2><div class="sub">'+esc(c.name)+(r.demo?' · demo data':'')+'</div></div></div>'+
   '<div class="num" style="font-size:30px;margin:6px 0 8px;'+(isIncome(r)?'color:var(--good)':'')+'">'+(isIncome(r)?'+':'')+fmt(r.amountP)+'</div>'+
   kv('Date',fmtDate(r.date))+(r.cat!=='rent'&&r.houseId&&houseOf(r.houseId)?kv('House',esc(houseOf(r.houseId).name)):'')+kv('Counted in',monLabel(recMonth(r))+(r.period?' (billing month)':' (expense date)'))+
   (r.qtyM?kv('Quantity',qtyStr(r.qtyM)+(r.x&&r.x.unitLabel?' '+esc(r.x.unitLabel):'')):'')+(r.unitP?kv('Saved unit price',fmt(r.unitP)):'')+
   kv(r.cat==='cab'?'Route':r.cat==='rent'?'House':'Store or provider',esc(r.cat==='rent'?(houseOf(r.houseId)?houseOf(r.houseId).name:r.party):r.party))+(r.cat==='rent'&&r.dir==='received'?kv('Tenant',esc(r.tenant)):'')+(r.cat==='cab'?kv('Ride type',esc(r.x&&r.x.mode)):'')+kv('Method',esc(r.x&&r.x.method))+kv('Vehicle',esc(r.x&&r.x.vehicle))+kv('Due date',(r.x&&r.x.due)?fmtDate(r.x.due):'')+kv('Agreement start',(r.x&&r.x.agStart)?fmtDate(r.x.agStart):'')+kv('Agreement end',(r.x&&r.x.agEnd)?fmtDate(r.x.agEnd):'')+kv('Time left',(r.x&&r.x.agEnd)?leftInfo(r.x.agEnd).t:'')+
   (r.cat==='rent'?kv('Type',isIncome(r)?'Income, not counted as spending':'Counted as spending'):'')+
   (r.status?kv('Status',r.status==='due'?'Due, not counted yet':(r.cat==='rent'&&r.dir==='received'?'Received':'Paid')):'')+kv('Notes',esc(r.notes))+kv('Added',fmtStamp(r.ts))+(r.es?kv('Last edited',fmtStamp(r.es)):'')+
   '<div class="row2">'+(r.status==='due'?'<button class="btn soft" data-act="markPaid" data-id="'+esc(r.id)+'">'+(r.cat==='rent'&&r.dir==='received'?'Mark as received':'Mark as paid')+'</button>':'')+'<button class="btn" data-act="edit" data-id="'+esc(r.id)+'">'+ic('edit',18)+'Edit</button><button class="btn dan" data-act="del" data-kind="rec" data-id="'+esc(r.id)+'">'+ic('trash',18)+'Delete</button></div>');
}
