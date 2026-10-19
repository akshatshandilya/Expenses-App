/* @auto-imports */
import {fmtDate,fmtStamp,leftInfo,monLabel,monShort} from '../core/dates.js';
import {fmt,mul,parseMoney,qtyStr} from '../core/money.js';
import {counted,recsIn,sum} from '../core/rules.js';
import {esc} from '../core/util.js';
import {S,UI} from '../data/state.js';
import {empty,hd,monNav,recList,stats} from './components.js';
import {ic} from './icons.js';
import {V} from './registry.js';
/* @end-imports */
/* travel */
V.travel=()=>{
  const mk=S.mon,tt=UI.tt;
  const fuel=recsIn(mk,r=>r.cat==='travel'&&r.sub==='fuel'&&counted(r)).sort((x,y)=>x.date<y.date?1:-1);
  const toll=recsIn(mk,r=>r.cat==='travel'&&r.sub==='toll'&&counted(r)).sort((x,y)=>x.date<y.date?1:-1);
  const other=recsIn(mk,r=>r.cat==='travel'&&r.sub==='other'&&counted(r));
  const dist=S.dist.filter(d=>d.date.slice(0,7)===mk).sort((x,y)=>x.date<y.date?1:-1);
  const fS=sum(fuel),tS=sum(toll),oS=sum(other),km=dist.reduce((a,d)=>a+d.kmM,0),actual=fS+tS+oS;
  const tc=(k,ico,l,v,c)=>'<button class="tcard" style="--c:'+c+'" data-act="tTab" data-v="'+k+'" aria-pressed="'+(tt===k)+'"><span class="ci" style="--c:'+c+'">'+ic(ico,22)+'</span><b>'+l+'</b><span class="num">'+v+'</span></button>';
  let body='';
  if(tt==='distance'){
    const rate=parseMoney(S.kmCost),est=rate&&km?mul(km,rate):0;
    body=stats([['Distance this month',qtyStr(km)+' km'],['Journeys',String(dist.length)]])+
     '<div class="note">Distance is a measurement. It is never added to your spending.</div>'+
     (dist.length?'<div class="list">'+dist.map(d=>'<button class="rec" data-act="distRow" data-id="'+esc(d.id)+'"><span class="ci" style="--c:#4B6CD6">'+ic('pin',20)+'</span><span class="rt"><b>'+esc(d.from||d.to?((d.from||'?')+' → '+(d.to||'?')):(d.purpose||'Journey'))+(d.demo?'<i class="demo">DEMO</i>':'')+'</b><small>'+fmtDate(d.date)+(d.purpose?' · '+esc(d.purpose):'')+'</small>'+(d.ts?'<small class="stamp">Added '+fmtStamp(d.ts)+'</small>':'')+'</span><span class="amt">'+qtyStr(d.kmM)+' km</span></button>').join('')+'</div>':empty('pin','No journeys in '+monLabel(mk),'Add a journey to track kilometres travelled.'))+
     '<div class="card"><h2>Cost per km estimate <small class="sub">optional</small></h2><div class="fld" style="margin-bottom:8px"><label for="kmrate" class="lb">Your estimate per km</label><div class="pre"><span>₹</span><input id="kmrate" inputmode="decimal" value="'+esc(S.kmCost)+'" placeholder="e.g. 8" data-d="kmrate" autocomplete="off"><button class="link" data-act="saveKm">Save</button></div><p class="err" id="kmErr" role="alert"></p></div>'+
     (est?'<p class="sub"><b>Estimate: '+fmt(est)+'</b> for '+qtyStr(km)+' km. Not included in your spending.</p><button class="btn soft" style="margin-top:10px" data-act="recKm">Record this estimate as an expense</button>':'<p class="sub">Without an estimate, distance has no cost attached.</p>')+'</div>'+
     '<div class="cta"><button class="btn pri block" data-act="tAdd" data-s="distance">'+ic('plus',20)+'Add journey</button></div>';
  }else if(tt==='fuel'){
    const q=fuel.reduce((a,r)=>a+r.qtyM,0),veh={};fuel.forEach(r=>{const v=(r.x&&r.x.vehicle)||'';if(v)veh[v]=(veh[v]||0)+r.amountP;});
    body=stats([['Fuel spent',fmt(fS)],['Fuel quantity',qtyStr(q)+' L'],['Average price per litre',q?fmt(Math.round(fS*1000/q)):'—'],['Purchases',String(fuel.length)]])+
     (Object.keys(veh).length?'<div class="card"><h2>By vehicle</h2>'+Object.keys(veh).map(v=>'<div class="kv"><span>'+esc(v)+'</span><span>'+fmt(veh[v])+'</span></div>').join('')+'</div>':'')+
     (fuel.length?recList(fuel):empty('pump','No fuel purchases in '+monLabel(mk),'Add a purchase to see totals here.'))+
     '<div class="cta"><button class="btn pri block" data-act="tAdd" data-s="fuel">'+ic('plus',20)+'Add fuel purchase</button></div>';
  }else{
    body=stats([['Toll spent',fmt(tS)],['Transactions',String(toll.length)]])+
     (toll.length?recList(toll):empty('toll','No toll charges in '+monLabel(mk),'Add a toll charge to see totals here.'))+
     '<div class="cta"><button class="btn pri block" data-act="tAdd" data-s="toll">'+ic('plus',20)+'Add toll charge</button></div>';
  }
  return hd('Travel')+monNav()+
   '<section class="card" aria-label="Travel summary"><div class="eyebrow">Actual travel spending</div><div class="num" style="font-size:32px;margin:4px 0 8px">'+fmt(actual)+'</div><div class="kv"><span>Fuel</span><span>'+fmt(fS)+'</span></div><div class="kv"><span>Toll</span><span>'+fmt(tS)+'</span></div>'+(oS?'<div class="kv"><span>Other travel charges</span><span>'+fmt(oS)+'</span></div>':'')+'<div class="kv"><span>Distance (not spending)</span><span>'+qtyStr(km)+' km</span></div></section>'+
   '<div class="tabs3">'+tc('distance','pin','Distance',qtyStr(km)+' km','#4B6CD6')+tc('fuel','pump','Fuel',fmt(fS),'#E0762B')+tc('toll','toll','Toll',fmt(tS),'#16A0B0')+'</div>'+body;
};

V.cab=()=>{
  const mk=S.mon,a=recsIn(mk,r=>r.cat==='cab').sort((x,y)=>x.date<y.date?1:x.date>y.date?-1:(y.ts||0)-(x.ts||0));
  const tot=sum(a.filter(counted)),au=a.filter(r=>(r.x&&r.x.mode)==='Auto'),cb=a.filter(r=>(r.x&&r.x.mode)==='Cab');
  const by={};a.forEach(r=>{const k=r.party||'Route';by[k]=(by[k]||0)+r.amountP;});
  const top=Object.keys(by).sort((x,y)=>by[y]-by[x]).slice(0,4);
  return hd('Auto and Cabs','<button class="pchip" data-act="routes" aria-label="Edit routes">Routes'+ic('edit',16)+'</button>')+monNav()+
   stats([['Spent this month',fmt(tot)],['Rides',String(a.length)]])+
   (a.length?'<div class="card"><h2>By type</h2><div class="kv"><span>Auto · '+au.length+(au.length===1?' ride':' rides')+'</span><span>'+fmt(sum(au))+'</span></div><div class="kv"><span>Cab · '+cb.length+(cb.length===1?' ride':' rides')+'</span><span>'+fmt(sum(cb))+'</span></div></div>'+
     '<div class="card"><h2>By route</h2>'+top.map(k=>'<div class="kv"><span>'+esc(k)+'</span><span>'+fmt(by[k])+'</span></div>').join('')+'</div>':'')+
   (a.length?recList(a):empty('cab','No rides in '+monLabel(mk),'Add an auto or cab ride and it will show up here.'))+
   '<div class="cta"><button class="btn pri block" data-act="cabAdd">'+ic('plus',20)+'Add ride</button></div>';
};

/* rent */
export function agCards(dir){
  const by={};
  S.records.filter(r=>r.cat==='rent'&&r.dir===dir&&r.x&&r.x.agEnd).sort((x,y)=>x.date<y.date?-1:x.date>y.date?1:(x.ts||0)-(y.ts||0)).forEach(r=>{by[(r.houseId||r.party||'').trim().toLowerCase()]=r;});
  const ks=Object.keys(by);if(!ks.length)return '';
  return '<div class="card"><h2>Agreement'+(ks.length>1?'s':'')+'</h2>'+ks.map(k=>{const r=by[k],L=leftInfo(r.x.agEnd);
    return '<div class="kv" style="align-items:center"><span style="min-width:0"><b style="color:var(--ink);font-weight:600">'+esc((houseOf(r.houseId)&&houseOf(r.houseId).name)||r.party||'Rent agreement')+'</b><br><small>'+(r.x.agStart?fmtDate(r.x.agStart)+' to ':'Ends ')+fmtDate(r.x.agEnd)+'</small></span><span class="pill '+(L.tone==='good'?'good':L.tone==='bad'?'bad':'warn')+'">'+L.t+'</span></div>';}).join('')+'</div>';
}
V.rent=()=>{
  const mk=S.mon,P=recsIn(mk,r=>r.cat==='rent'&&r.dir==='paid'),R=recsIn(mk,r=>r.cat==='rent'&&r.dir==='received');
  const o=(dir,ico,t,d,list)=>'<button class="opt" data-act="rentPick" data-v="'+dir+'"><span class="ci" style="--c:#C0558C">'+ic(ico,24)+'</span><span style="flex:1;min-width:0"><h3>'+t+'</h3><p>'+d+'</p><span class="num">'+fmt(sum(list.filter(r=>r.status!=='due')))+'</span><span class="sub">'+list.length+' record'+(list.length===1?'':'s')+' in '+monShort(mk)+'</span></span>'+ic('chevR',20)+'</button>';
  return hd('Rent')+'<h2 style="font:700 20px var(--fd);margin:2px 2px 4px">What would you like to log?</h2><p class="sub" style="margin:0 2px 14px">Choose one. Paid and received rent are kept in separate logs.</p>'+
   o('paid','arrOut','Rent paid','Rent you pay to a landlord. Counted in your household spending.',P)+
   o('received','arrIn','Rent received','Rent you collect from a tenant. Kept as income and not counted as spending.',R);
};
V.rentLog=()=>{
  const dir=UI.rentDir,mk=S.mon,a=recsIn(mk,r=>r.cat==='rent'&&r.dir===dir).sort((x,y)=>x.date<y.date?1:-1);
  const done=sum(a.filter(r=>r.status!=='due')),due=sum(a.filter(r=>r.status==='due'));
  const pd=dir==='paid';
  return hd('Rent')+
   '<div class="seg" role="tablist"><button role="tab" aria-selected="'+pd+'" class="'+(pd?'on':'')+'" data-act="rentDir" data-v="paid">Rent paid</button><button role="tab" aria-selected="'+!pd+'" class="'+(!pd?'on':'')+'" data-act="rentDir" data-v="received">Rent received</button></div>'+monNav()+
   '<section class="card"><div class="eyebrow">'+(pd?'Paid':'Received')+' for '+monLabel(mk)+'</div><div class="num" style="font-size:34px;margin:4px 0 6px;'+(pd?'':'color:var(--good)')+'">'+fmt(done)+'</div>'+
   '<div class="pills"><span class="pill">'+a.length+' record'+(a.length===1?'':'s')+'</span>'+(due?'<span class="pill warn">Due '+fmt(due)+'</span>':'')+'<span class="pill '+(pd?'':'good')+'">'+(pd?'Counted as spending':'Income, not counted as spending')+'</span></div></section>'+agCards(dir)+
   (a.length?recList(a):empty('key','No rent '+(pd?'paid':'received')+' for '+monLabel(mk),'Log a '+(pd?'payment to your landlord':'receipt from your tenant')+' for this month.'))+
   '<div class="cta"><button class="btn pri block" data-act="rentAdd">'+ic('plus',20)+'Log rent '+(pd?'paid':'received')+'</button></div>';
};
