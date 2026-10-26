/* @auto-imports */
import {curMonth,fmtDate,fmtStamp,monLabel} from '../core/dates.js';
import {fmt,mul,qtyStr} from '../core/money.js';
import {counted,recsIn,sum,travelCostPerKm} from '../core/rules.js';
import {esc} from '../core/util.js';
import {S,UI,houseOf,houseRentDir,tenantProfiles,paymentDueLabel} from '../data/state.js';
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
    const rate=travelCostPerKm(mk),est=rate!=null&&km?mul(km,rate):0;
    body=stats([['Distance this month',qtyStr(km)+' km'],['Journeys',String(dist.length)]])+
     '<div class="note">Distance is a measurement. It is never added to your spending.</div>'+
     (dist.length?'<div class="list">'+dist.map(d=>'<button class="rec" data-act="distRow" data-id="'+esc(d.id)+'"><span class="ci" style="--c:#4B6CD6">'+ic('pin',20)+'</span><span class="rt"><b>'+esc(d.from||d.to?((d.from||'?')+' → '+(d.to||'?')):(d.purpose||'Journey'))+(d.demo?'<i class="demo">DEMO</i>':'')+'</b><small>'+fmtDate(d.date)+(d.purpose?' · '+esc(d.purpose):'')+'</small>'+(d.ts?'<small class="stamp">Added '+fmtStamp(d.ts)+'</small>':'')+'</span><span class="amt">'+qtyStr(d.kmM)+' km</span></button>').join('')+'</div>':empty('pin','No journeys in '+monLabel(mk),'Add a journey to track kilometres travelled.'))+
     '<div class="card"><h2>Cost per km estimate</h2>'+(rate!=null?'<div class="kv"><span>Calculated from linked journey expenses</span><b>'+fmt(rate)+' / km</b></div>':'<p class="sub">Add Fuel or Toll to a journey to calculate its cost per km.</p>')+
     (est?'<p class="sub"><b>Estimate: '+fmt(est)+'</b> for '+qtyStr(km)+' km. Not included in your spending.</p><button class="btn soft" style="margin-top:10px" data-act="recKm">Record this estimate as an expense</button>':'')+'</div>'+
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
export function matchesRentHouse(r,h){
  return r.houseId===h.id||(!r.houseId&&(r.party||'').trim().toLowerCase()===h.name.trim().toLowerCase());
}
function rentRecord(h,dir,period,tenant){
  return S.records.find(r=>r.cat==='rent'&&r.dir===dir&&(r.period||r.date.slice(0,7))===period&&matchesRentHouse(r,h)&&(dir==='paid'||(r.tenant||'').trim().toLowerCase()===(tenant||'').trim().toLowerCase()))||null;
}
function editRentButton(h,dir,period,tenant,rec,profile){
  if(period>curMonth()&&!rec)return '';
  const label=tenant?' for '+tenant:'';
  return '<button class="ib flat" data-act="rentEdit" data-id="'+esc(rec&&rec.id||'')+'" data-house="'+esc(h.id)+'" data-dir="'+dir+'" data-period="'+period+'" data-tenant="'+esc(tenant||'')+'" aria-label="Edit rent'+esc(label)+'">'+ic('edit',20)+'</button>';
}
function rentStatusCard(h,dir,period,tenant,profile,rec,withEdit=true){
  const future=period>curMonth(),amount=rec?rec.amountP:profile&&profile.rentAmountP!=null?profile.rentAmountP:h.rentAmountP;
  const hasAmount=Number.isInteger(amount)&&amount>0,paid=!!(rec&&rec.status!=='due'),status=future&&!rec?'Not logged':paid?(dir==='received'?'Received':'Paid'):'Payment due';
  const due=paymentDueLabel((rec&&rec.x&&rec.x.dueBy)?{dueBy:rec.x.dueBy,dueDay:rec.x.dueDay}:profile||h);
  const agreement=profile&&profile.agStart||profile&&profile.agEnd?'<div class="kv"><span>Agreement</span><span>'+((profile.agStart?fmtDate(profile.agStart)+' – ':'')+(profile.agEnd?fmtDate(profile.agEnd):''))+'</span></div>':'';
  const toggle=(!future||rec)&&(dir==='paid'||hasAmount)?'<div class="rent-status-control"><label class="sw"><input type="checkbox" role="switch" data-act="rentToggle" data-dir="'+dir+'" data-house="'+esc(h.id)+'" data-period="'+period+'" data-tenant="'+esc(tenant||'')+'"'+(paid?' checked':'')+'><span class="trk"></span><span data-rent-toggle-label>'+(paid?(dir==='received'?'Received':'Paid'):'Payment due')+'</span></label><div data-rent-status-entry></div></div>':'';
  const futureAction=future&&!rec?'<button class="btn soft block" data-act="rentEdit" data-house="'+esc(h.id)+'" data-dir="'+dir+'" data-period="'+period+'" data-tenant="'+esc(tenant||'')+'">'+ic('plus',18)+'Log rent in advance</button>':'';
  return '<div class="card rent-due-card"><div class="kv" style="align-items:center"><span><b style="color:var(--ink);font-weight:600">'+esc(tenant||(dir==='paid'?'Rent payment':h.name))+'</b>'+(tenant?'<br><small>'+esc(h.name)+' · Tenant</small>':'')+'</span><span class="pill rent-status-pill '+(paid?'good':future&&!rec?'':'warn')+'">'+status+'</span>'+(withEdit?editRentButton(h,dir,period,tenant,rec,profile):'')+'</div>'+
    (hasAmount?'<div class="kv"><span>Monthly rent</span><span>'+fmt(amount)+'</span></div>':'<p class="sub">Set a monthly rent amount in Houses settings to track this payment.</p>')+
    (paid&&rec?'<div class="kv"><span>'+(dir==='received'?'Received on':'Paid on')+'</span><span>'+fmtDate(rec.date)+'</span></div>':'')+
    '<div class="kv"><span>Payment Due By</span><span>'+esc(due)+'</span></div>'+agreement+toggle+futureAction+'</div>';
}
function rentHouseCard(h,dir,period){
  const profiles=dir==='received'?tenantProfiles(h):[null];
  const cards=profiles.length?profiles.map(p=>rentStatusCard(h,dir,period,p&&p.name,p,rentRecord(h,dir,period,p&&p.name))).join(''):'<div class="note">Add tenant details in Houses settings to track received rent.</div>';
  return '<div class="card"><div class="kv" style="align-items:center"><span><b style="color:var(--ink);font-weight:600">'+esc(h.name)+'</b><br><small>'+esc([h.addr,h.meter].filter(Boolean).join(' · ')||'No additional details')+'</small></span>'+(dir==='paid'?editRentButton(h,dir,period,'',rentRecord(h,dir,period,''),null):'')+'</div>'+
    (dir==='paid'?rentStatusCard(h,dir,period,'',null,rentRecord(h,dir,period,''),false):cards)+'</div>';
}
function rentLanding(){
  const mk=S.mon,P=recsIn(mk,r=>r.cat==='rent'&&r.dir==='paid'),R=recsIn(mk,r=>r.cat==='rent'&&r.dir==='received');
  const option=(dir,icon,title,description,records)=>'<button class="opt" data-act="rentPick" data-v="'+dir+'"><span class="ci" style="--c:#C0558C">'+ic(icon,24)+'</span><span style="flex:1;min-width:0"><h3>'+title+'</h3><p>'+description+'</p><span class="num">'+fmt(sum(records.filter(r=>r.status!=='due')))+'</span><span class="sub">'+records.length+' record'+(records.length===1?'':'s')+' in '+monLabel(mk)+'</span></span>'+ic('chevR',20)+'</button>';
  return hd('Rent')+'<h2 style="font:700 20px var(--fd);margin:2px 2px 4px">What would you like to log?</h2><p class="sub" style="margin:0 2px 14px">Choose one. Paid and received rent are kept in separate logs.</p>'+
    option('paid','arrOut','Rent paid','Rent you pay to a landlord. Counted in your household spending.',P)+
    option('received','arrIn','Rent received','Rent you collect from a tenant. Kept as income and not counted as spending.',R);
}
function rentLog(){
  const dir=UI.rentDir,period=S.mon,pd=dir==='paid',current=period<=curMonth();
  const houses=S.houses.filter(h=>houseRentDir(h)===dir);
  if(UI.rentHouse!=='all'&&!houses.some(h=>h.id===UI.rentHouse))UI.rentHouse='all';
  const one=UI.rentHouse==='all'?null:houseOf(UI.rentHouse),visible=one?[one]:houses;
  const chips='<div class="seg" role="tablist" style="overflow-x:auto"><button role="tab" aria-selected="'+!one+'" class="'+(!one?'on':'')+'" data-act="rentHouse" data-id="all" style="flex:none;white-space:nowrap">All houses</button>'+houses.map(h=>'<button role="tab" aria-selected="'+(UI.rentHouse===h.id)+'" class="'+(UI.rentHouse===h.id?'on':'')+'" data-act="rentHouse" data-id="'+esc(h.id)+'" style="flex:none;white-space:nowrap">'+esc(h.name)+'</button>').join('')+'</div>';
  const selected=visible.map(h=>rentHouseCard(h,dir,period)).join('');
  const periodRecords=recsIn(period,r=>r.cat==='rent'&&r.dir===dir&&(!one||matchesRentHouse(r,one)));
  const total=sum(periodRecords.filter(r=>r.status!=='due'));
  let due=sum(periodRecords.filter(r=>r.status==='due'));
  if(period<=curMonth())visible.forEach(h=>{
    const profiles=dir==='received'?tenantProfiles(h):[null];
    profiles.forEach(profile=>{
      if(rentRecord(h,dir,period,profile&&profile.name))return;
      const amount=profile?profile.rentAmountP:h.rentAmountP;
      if(Number.isInteger(amount)&&amount>0)due+=amount;
    });
  });
  const directionTabs='<div class="seg" role="tablist"><button role="tab" aria-selected="'+pd+'" class="'+(pd?'on':'')+'" data-act="rentDir" data-v="paid">Rent paid</button><button role="tab" aria-selected="'+!pd+'" class="'+(!pd?'on':'')+'" data-act="rentDir" data-v="received">Rent received</button></div>';
  return hd('Rent','<button class="pchip" data-act="houses" aria-label="Manage houses">Houses'+ic('edit',16)+'</button>')+
    directionTabs+monNav()+chips+
    '<section class="card"><div class="eyebrow">'+(pd?'Rent paid':'Rent received')+' · '+monLabel(period)+'</div><div class="num" style="font-size:32px;margin:4px 0 6px;'+(pd?'':'color:var(--good)')+'">'+fmt(total)+'</div><div class="pills"><span class="pill '+(due?'warn':'good')+'">'+(due?'Due '+fmt(due):'No overdue balance')+'</span><span class="pill">'+periodRecords.length+' saved record'+(periodRecords.length===1?'':'s')+'</span></div></section>'+
    (houses.length?selected:empty('home','No houses for '+(pd?'rent paid':'rent received'),'Add a house in Settings → Houses to start tracking rent.','<button class="btn pri" data-act="houses">Manage houses</button>'))+
    (periodRecords.length?'<div class="card"><h2>Rent records</h2><div class="list">'+recList(periodRecords)+'</div></div>':'')+
    (current&&houses.length?'<p class="note">Monthly payment cards appear for the selected month. Mark a card paid or received when the payment is complete.</p>':'');
}
V.rent=rentLanding;
V.rentLog=rentLog;
