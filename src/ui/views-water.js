/* @auto-imports */
import {MONTHS,curMonth,fmtDate,fmtStamp,monLabel,today,weekday,ymd} from '../core/dates.js';
import {fmt,qtyStr} from '../core/money.js';
import {recsIn,sum} from '../core/rules.js';
import {esc} from '../core/util.js';
import {S,UI} from '../data/state.js';
import {empty,hd,monNav,recRow,stats} from './components.js';
import {ic} from './icons.js';
import {V} from './registry.js';
/* @end-imports */
/* water */
V.wSetup=()=>hd('Water Bottles')+'<div class="card"><span class="ci" style="--c:#2D8FD5">'+ic('bottle',24)+'</span><h2 style="margin:12px 0 4px;font-size:20px">What is the price per bottle?</h2><p class="sub" style="margin-bottom:14px">Set this once. Each delivery you add starts from this price, and you can change it later when your supplier does.</p>'+
 '<div class="fld" style="margin-bottom:6px"><label for="wsp">Price per bottle</label><div class="pre"><span>₹</span><input id="wsp" inputmode="decimal" placeholder="60" data-d="wsp" autocomplete="off" autofocus></div><p class="err" id="wsErr" role="alert"></p></div>'+
 '<div class="row2" style="display:flex;gap:10px;margin-top:14px"><button class="btn" data-act="back" style="flex:1">Cancel</button><button class="btn pri" data-act="wSetupSave" style="flex:1">Save price</button></div></div>';

export function calGrid(){
  const a=S.mon.split('-').map(Number),y=a[0],m=a[1],first=new Date(y,m-1,1).getDay(),dim=new Date(y,m,0).getDate();
  const has=new Set(S.records.filter(r=>r.cat==='water'&&r.date.slice(0,7)===S.mon).map(r=>r.date));
  let h='<div class="cal" role="group" aria-label="'+monLabel(S.mon)+'">'+['S','M','T','W','T','F','S'].map(d=>'<div class="dw" aria-hidden="true">'+d+'</div>').join('');
  for(let i=0;i<first;i++)h+='<div></div>';
  for(let d=1;d<=dim;d++){const ds=ymd(y,m,d);
    h+='<button class="day'+(has.has(ds)?' has':'')+(ds===today()?' today':'')+(ds===UI.wsel?' sel':'')+'" data-act="wDay" data-date="'+ds+'" aria-pressed="'+(ds===UI.wsel)+'" aria-label="'+d+' '+MONTHS[m-1]+' '+y+(has.has(ds)?', delivery recorded':'')+'">'+d+'<i></i></button>';}
  return h+'</div>';
}
V.water=()=>{
  const pr=S.prices.water;if(!pr)return V.wSetup();
  const mk=S.mon,a=recsIn(mk,r=>r.cat==='water').sort((x,y)=>x.date<y.date?1:x.date>y.date?-1:0);
  const bottles=a.reduce((s,r)=>s+r.qtyM,0),tot=sum(a);
  if(!UI.wsel||UI.wsel.slice(0,7)!==mk)UI.wsel=(mk===curMonth()?today():null);
  let body;
  if(UI.wTab==='cal'){
    const sel=UI.wsel,day=sel?a.filter(r=>r.date===sel):[];
    body='<div class="card">'+calGrid()+'<div class="legend"><span><i></i>Delivery recorded</span><span>Tap a date, then add a delivery</span></div></div>'+
     (sel?'<div class="card"><div class="eyebrow">'+weekday(sel)+'</div><h2 style="font-size:19px;margin:4px 0 8px">'+fmtDate(sel)+'</h2>'+
       (day.length?'<div class="list" style="margin-bottom:10px">'+day.map(recRow).join('')+'</div>':'<p class="sub" style="margin-bottom:10px">No deliveries on this date yet.</p>')+
       '<button class="btn pri block" data-act="wAdd">'+ic('plus',20)+(day.length?'Add another delivery':'Add delivery')+'</button></div>':'<div class="note">Select a date on the calendar to add a delivery. Past dates work too.</div>')+
     stats([['Bottles this month',qtyStr(bottles)],['Spent this month',fmt(tot)]]);
  }else{
    body=stats([['Bottles received',qtyStr(bottles)],['Total spent',fmt(tot)],['Deliveries',String(a.length)],['Average per delivery',a.length?fmt(Math.round(tot/a.length)):'—']])+
     '<div class="note">Each delivery keeps the price it was saved with. Today’s default is <b>'+fmt(pr.cur)+'</b> per bottle.</div>'+
     (a.length?'<div class="list">'+a.map(r=>'<div class="rec" style="cursor:default"><span class="rt"><b>'+fmtDate(r.date)+(r.demo?'<i class="demo">DEMO</i>':'')+'</b><small>'+qtyStr(r.qtyM)+' × '+fmt(r.unitP)+' = <b style="color:var(--ink)">'+fmt(r.amountP)+'</b></small>'+(r.unitP!==pr.cur?'<span class="tagp diff">Saved at '+fmt(r.unitP)+', default is now '+fmt(pr.cur)+'</span>':'<span class="tagp">At default price</span>')+(r.notes?'<small style="white-space:normal">'+esc(r.notes)+'</small>':'')+(r.ts?'<small class="stamp">Added '+fmtStamp(r.ts)+'</small>':'')+'</span>'+
       '<button class="ib flat" data-act="edit" data-id="'+esc(r.id)+'" aria-label="Edit delivery on '+fmtDate(r.date)+'">'+ic('edit',20)+'</button><button class="ib flat" data-act="del" data-kind="rec" data-id="'+esc(r.id)+'" aria-label="Delete delivery on '+fmtDate(r.date)+'">'+ic('trash',20)+'</button></div>').join('')+'</div>'
      :empty('bottle','No deliveries in '+monLabel(mk),'Pick a date on the calendar to add one.','<button class="btn pri" data-act="wTab" data-v="cal">Open calendar</button>'))+
     (pr.log.length?'<div class="card"><h2>Price changes</h2>'+pr.log.slice().reverse().map(l=>'<div class="kv"><span>'+fmtDate(l.at)+'</span><span>'+(l.from!=null?fmt(l.from)+' → ':'Set to ')+fmt(l.to)+'<br><small style="color:var(--ink2);font-weight:500">'+(l.mode==='all'?'New entries only':'From that date onward')+'</small></span></div>').join('')+'</div>':'');
  }
  return hd('Water Bottles','<button class="pchip" data-act="wPrice" aria-label="Change price, currently '+fmt(pr.cur)+' per bottle">'+fmt(pr.cur)+' / bottle'+ic('edit',16)+'</button>')+
   '<div class="seg" role="tablist"><button role="tab" aria-selected="'+(UI.wTab==='cal')+'" class="'+(UI.wTab==='cal'?'on':'')+'" data-act="wTab" data-v="cal">Calendar</button><button role="tab" aria-selected="'+(UI.wTab==='hist')+'" class="'+(UI.wTab==='hist'?'on':'')+'" data-act="wTab" data-v="hist">History</button></div>'+monNav()+body;
};

