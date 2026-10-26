/* @auto-imports */
import {curMonth,fmtDate,monLabel,monthDate} from '../core/dates.js';
import {fmt} from '../core/money.js';
import {counted,recsIn,sum} from '../core/rules.js';
import {esc} from '../core/util.js';
import {S,UI,catOf,houseOf,houseRentDir,tenantProfiles,paymentDueLabel} from '../data/state.js';
import {empty,hd,monNav,recList,stats} from './components.js';
import {ic} from './icons.js';
import {V} from './registry.js';
/* @end-imports */
function houseBill(cat,title,icon,selector,selectorAction,addAction){
  const mk=S.mon,service=cat==='waterbill'?'water':'electricity';
  if(!S.houses.length)return hd(title)+empty(icon,'Add your first house','Utility bills are kept by house, so you can track more than one. Add a house to start.','<button class="btn pri" data-act="addUtilityHouse">'+ic('plus',20)+'Add a house</button>');
  if(UI[selector]!=='all'&&!houseOf(UI[selector]))UI[selector]='all';
  const one=UI[selector]==='all'?null:houseOf(UI[selector]);
  const a=recsIn(mk,r=>r.cat===cat&&(!one||r.houseId===one.id)).sort((x,y)=>x.date<y.date?1:-1);
  const tot=sum(a.filter(counted)),due=sum(a.filter(r=>r.status==='due'));
  const chips='<div class="seg" role="tablist" style="overflow-x:auto"><button role="tab" aria-selected="'+!one+'" class="'+(!one?'on':'')+'" data-act="'+selectorAction+'" data-id="all" style="flex:none;white-space:nowrap">All houses</button>'+S.houses.map(h=>'<button role="tab" aria-selected="'+(UI[selector]===h.id)+'" class="'+(UI[selector]===h.id?'on':'')+'" data-act="'+selectorAction+'" data-id="'+esc(h.id)+'" style="flex:none;white-space:nowrap">'+esc(h.name)+'</button>').join('')+'</div>';
  const per=(!one&&S.houses.length>1)?'<div class="card"><h2>By house</h2>'+S.houses.map(h=>'<div class="kv"><span>'+esc(h.name)+'</span><span>'+fmt(sum(recsIn(mk,r=>r.cat===cat&&r.houseId===h.id&&counted(r))))+'</span></div>').join('')+'</div>':'';
  const info=one&&(one.addr||one.meter)?'<p class="sub" style="margin:-4px 2px 12px">'+esc([one.addr,one.meter].filter(Boolean).join(' · '))+'</p>':'';
  return hd(title,'<button class="pchip" data-act="houses" aria-label="Manage houses">Houses'+ic('edit',16)+'</button>')+monNav()+chips+info+
   stats([['Total this month',fmt(tot)],['Bills',String(a.length)]])+(due?'<div class="warnbox">Due: '+fmt(due)+'. Not counted in spending until marked paid.</div>':'')+per+
   (a.length?recList(a):empty(icon,'No bills in '+monLabel(mk),one?'No '+service+' bill for '+esc(one.name)+' this month.':'Add a bill for any of your houses.'))+
   '<div class="cta"><button class="btn pri block" data-act="'+addAction+'">'+ic('plus',20)+'Add '+service+' bill</button></div>';
}
V.electricity=()=>houseBill('electricity','Electricity','bolt','eh','eh','elecAdd');
V.waterbill=()=>houseBill('waterbill','Water Bill','drop','wbh','wbh','waterBillAdd');
function mobileBillRecord(profile,period){
  return S.records.find(r=>r.cat==='mobilebill'&&r.mobileBillId===profile.id&&(r.period||r.date.slice(0,7))===period)||null;
}
V.mobilebill=()=>{
  const period=S.mon,future=period>curMonth(),records=recsIn(period,r=>r.cat==='mobilebill');
  const paid=sum(records.filter(r=>r.status!=='due'));
  const due=future?0:S.mobileBills.reduce((total,profile)=>{
    const record=mobileBillRecord(profile,period);
    return total+(record&&record.status!=='due'?0:(record?record.amountP:profile.amountP));
  },0);
  const cards=S.mobileBills.map(profile=>{
    const record=mobileBillRecord(profile,period),isPaid=!!(record&&record.status!=='due'),notLogged=future&&!record;
    const amount=record?record.amountP:profile.amountP,status=isPaid?'Paid':notLogged?'Not logged':'Bill due';
    const toggle=!notLogged?'<div class="rent-status-control"><label class="sw"><input type="checkbox" role="switch" data-act="mobileToggle" data-id="'+esc(profile.id)+'" data-period="'+period+'"'+(isPaid?' checked':'')+'><span class="trk"></span><span data-mobile-toggle-label>'+status+'</span></label><div data-mobile-status-entry></div></div>':'';
    const futureAction=notLogged?'<button class="btn soft block" data-act="mobileAdvance" data-id="'+esc(profile.id)+'" data-period="'+period+'">'+ic('plus',18)+'Log bill in advance</button>':'';
    return '<div class="card rent-due-card mobile-due-card"><div class="kv" style="align-items:center"><span><b style="color:var(--ink);font-weight:600">'+esc(profile.name)+'</b><br><small>'+esc(profile.provider)+' · '+(profile.plan==='postpaid'?'Postpaid':'Prepaid')+'</small></span><span class="pill rent-status-pill '+(isPaid?'good':notLogged?'':'warn')+'">'+status+'</span><button class="ib flat" data-act="mobileEdit" data-id="'+esc(profile.id)+'" aria-label="Edit mobile bill for '+esc(profile.name)+'">'+ic('edit',20)+'</button><button class="ib flat" data-act="mobileDelete" data-id="'+esc(profile.id)+'" aria-label="Delete mobile bill for '+esc(profile.name)+'">'+ic('trash',20)+'</button></div>'+
      '<div class="kv"><span>Bill due date</span><span>'+fmtDate(monthDate(period,profile.dueDay))+'</span></div><div class="kv"><span>Bill amount</span><span>'+fmt(amount)+'</span></div>'+
      (isPaid?'<div class="kv"><span>Paid on</span><span>'+fmtDate(record.date)+'</span></div>':'')+toggle+futureAction+'</div>';
  }).join('');
  return hd('Mobile Bill')+monNav()+stats([['Paid this month',fmt(paid)],['Due this month',fmt(due)],['Family members',String(S.mobileBills.length)]])+
    (cards||empty('wifi','No mobile bills yet','Add a family member’s mobile bill to start tracking monthly due dates and payments.'))+
    '<div class="cta"><button class="btn pri block" data-act="mobileAdd">'+ic('plus',20)+'Add mobile bill details</button></div>'+
    (records.length?'<div class="card"><h2>Mobile bill records</h2><div class="list">'+recList(records)+'</div></div>':'');
};
V.houses=()=>hd('Houses')+'<p class="sub" style="margin:-4px 2px 12px">Manage the houses used for rent, electricity and water bills. Edit a receiving-rent house to manage its tenant list.</p>'+
  (S.houses.length?'<div class="list">'+S.houses.map(h=>{const bills=S.records.filter(r=>(r.cat==='electricity'||r.cat==='waterbill')&&r.houseId===h.id).length,rents=S.records.filter(r=>r.cat==='rent'&&r.houseId===h.id).length,profiles=tenantProfiles(h),direction=houseRentDir(h),rentDetails=direction==='paid'?' · Monthly rent '+(Number.isInteger(h.rentAmountP)?fmt(h.rentAmountP):'not set')+' · Due '+paymentDueLabel(h):' · '+profiles.length+' tenant'+(profiles.length===1?'':'s')+(profiles.length?': '+profiles.map(t=>t.name+' due '+paymentDueLabel(t)).join(', '):'');
    return '<div class="rec" style="cursor:default"><span class="ci" style="--c:#D3A006">'+ic('home',20)+'</span><span class="rt"><b>'+esc(h.name)+(h.demo?'<i class="demo">DEMO</i>':'')+'</b><small>'+esc([h.addr,h.meter].filter(Boolean).join(' · ')||'No details added')+' · '+(direction==='paid'?'Paying Rent':'Receiving Rent')+rentDetails+' · '+bills+' utility bill'+(bills===1?'':'s')+' · '+rents+' rent record'+(rents===1?'':'s')+'</small></span>'+
    '<button class="ib flat" data-act="editHouse" data-id="'+esc(h.id)+'" aria-label="Edit '+esc(h.name)+'">'+ic('edit',20)+'</button><button class="ib flat" data-act="delHouse" data-id="'+esc(h.id)+'" aria-label="Delete '+esc(h.name)+'">'+ic('trash',20)+'</button></div>';}).join('')+'</div>'
   :empty('home','No houses yet','Add a house to use it for rent or electricity records.'))+
  '<div class="cta"><button class="btn pri block" data-act="addHouse">'+ic('plus',20)+'Add a house</button></div>';

/* category screen for simple kinds */
V.cat=p=>{
  const c=catOf(p.id);if(!c)return hd('Category')+empty('info','Category not found','It may have been removed.');
  const mk=S.mon,a=recsIn(mk,r=>r.cat===c.id).sort((x,y)=>x.date<y.date?1:-1);
  const pr=S.prices[c.id];
  return hd(esc(c.name),(c.kind==='unit'&&pr?'<span class="pchip" style="cursor:default">'+fmt(pr.cur)+' / '+esc(c.unit||'unit')+'</span>':''))+monNav()+
   stats([['Total this month',fmt(sum(a.filter(counted)))],['Records',String(a.length)]])+
   (a.length?recList(a):empty(c.icon,'Nothing in '+monLabel(mk),'Add a record for this category.'))+
   '<div class="cta"><button class="btn pri block" data-act="catAdd" data-id="'+esc(c.id)+'">'+ic('plus',20)+'Add '+esc(c.name.toLowerCase())+'</button></div>';
};
