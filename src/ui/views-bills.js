/* @auto-imports */
import {monLabel} from '../core/dates.js';
import {fmt} from '../core/money.js';
import {counted,recsIn,sum} from '../core/rules.js';
import {esc} from '../core/util.js';
import {S,UI,catOf,houseOf} from '../data/state.js';
import {empty,hd,monNav,recList,stats} from './components.js';
import {ic} from './icons.js';
import {V} from './registry.js';
/* @end-imports */
V.electricity=()=>{
  const mk=S.mon;
  if(!S.houses.length)return hd('Electricity')+empty('bolt','Add your first house','Electricity bills are kept by house, so you can track more than one. Add a house to start.','<button class="btn pri" data-act="addHouse">'+ic('plus',20)+'Add a house</button>');
  if(UI.eh!=='all'&&!houseOf(UI.eh))UI.eh='all';
  const one=UI.eh==='all'?null:houseOf(UI.eh);
  const a=recsIn(mk,r=>r.cat==='electricity'&&(!one||r.houseId===one.id)).sort((x,y)=>x.date<y.date?1:-1);
  const tot=sum(a.filter(counted)),due=sum(a.filter(r=>r.status==='due'));
  const chips='<div class="seg" role="tablist" style="overflow-x:auto"><button role="tab" aria-selected="'+!one+'" class="'+(!one?'on':'')+'" data-act="eh" data-id="all" style="flex:none;white-space:nowrap">All houses</button>'+S.houses.map(h=>'<button role="tab" aria-selected="'+(UI.eh===h.id)+'" class="'+(UI.eh===h.id?'on':'')+'" data-act="eh" data-id="'+esc(h.id)+'" style="flex:none;white-space:nowrap">'+esc(h.name)+'</button>').join('')+'</div>';
  const per=(!one&&S.houses.length>1)?'<div class="card"><h2>By house</h2>'+S.houses.map(h=>'<div class="kv"><span>'+esc(h.name)+'</span><span>'+fmt(sum(recsIn(mk,r=>r.cat==='electricity'&&r.houseId===h.id&&counted(r))))+'</span></div>').join('')+'</div>':'';
  const info=one&&(one.addr||one.meter)?'<p class="sub" style="margin:-4px 2px 12px">'+esc([one.addr,one.meter].filter(Boolean).join(' · '))+'</p>':'';
  return hd('Electricity','<button class="pchip" data-act="houses" aria-label="Manage houses">Houses'+ic('edit',16)+'</button>')+monNav()+chips+info+
   stats([['Total this month',fmt(tot)],['Bills',String(a.length)]])+(due?'<div class="warnbox">Due: '+fmt(due)+'. Not counted in spending until marked paid.</div>':'')+per+
   (a.length?recList(a):empty('bolt','No bills in '+monLabel(mk),one?'No electricity bill for '+esc(one.name)+' this month.':'Add a bill for any of your houses.'))+
   '<div class="cta"><button class="btn pri block" data-act="elecAdd">'+ic('plus',20)+'Add electricity bill</button></div>';
};
V.houses=()=>hd('Houses')+'<p class="sub" style="margin:-4px 2px 12px">Add every house you pay electricity for. Edit a house to rename it or change its details.</p>'+
  (S.houses.length?'<div class="list">'+S.houses.map(h=>{const n=S.records.filter(r=>r.houseId===h.id).length;
    return '<div class="rec" style="cursor:default"><span class="ci" style="--c:#D3A006">'+ic('home',20)+'</span><span class="rt"><b>'+esc(h.name)+(h.demo?'<i class="demo">DEMO</i>':'')+'</b><small>'+esc([h.addr,h.meter].filter(Boolean).join(' · ')||'No details added')+' · '+n+' bill'+(n===1?'':'s')+'</small></span>'+
    '<button class="ib flat" data-act="editHouse" data-id="'+esc(h.id)+'" aria-label="Edit '+esc(h.name)+'">'+ic('edit',20)+'</button><button class="ib flat" data-act="delHouse" data-id="'+esc(h.id)+'" aria-label="Delete '+esc(h.name)+'">'+ic('trash',20)+'</button></div>';}).join('')+'</div>'
   :empty('home','No houses yet','Add a house to start logging electricity bills.'))+
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

