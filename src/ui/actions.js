/* @auto-imports */
import {addMonths,curMonth,fmtClock,fmtDate,fmtStamp,monLabel,pad,today,validDate,weekday} from '../core/dates.js';
import {MAX_UNIT,fmt,mul,parseMoney,qtyStr} from '../core/money.js';
import {setPrice} from '../core/rules.js';
import {$,esc,uid} from '../core/util.js';
import {DLG,S,UI,blank,catOf,houseOf,persist,replaceState} from '../data/state.js';
import {applyLockEffects} from '../native/lock.js';
import {platform} from '../native/platform.js';
import {miniCal} from './clock.js';
import {chipOf} from './components.js';
import {editParams,entryFor,openEntry,refreshCabRoutes,toggleRentHouse} from './entry.js';
import {ic} from './icons.js';
import {ask,back,closeL,draw,go,openCat,sheet,stack,tab,toast} from './nav.js';
import {openQuick} from './quick.js';
import {recSheet} from './record-sheet.js';
import {A} from './registry.js';
/* @end-imports */
function routesHtml(){
  return '<h2>Edit routes</h2><p class="sub" style="margin-bottom:14px">Rename any route, or add your own. Past rides keep the name they were saved with. Others lets you type a one-off route in the ride form.</p>'+
   S.routes.map(r=>'<div class="rtrow"><input type="text" id="rt_'+esc(r.id)+'" data-rt="'+esc(r.id)+'" value="'+esc(r.name)+'" maxlength="40" aria-label="Route name" autocomplete="off">'+(r.fixed?'<span class="fix">Always last</span>':'<button class="ib flat" data-act="delRoute" data-id="'+esc(r.id)+'" aria-label="Remove '+esc(r.name)+'">'+ic('trash',20)+'</button>')+'</div>').join('')+
   '<button class="btn soft block" data-act="addRoute" style="margin-top:4px">'+ic('plus',20)+'Add a route</button><div class="row2"><button class="btn pri" data-act="closeL">Done</button></div>';
}
function resetRentStatus(card){
  const toggle=card.querySelector('[data-act="rentToggle"]');
  if(toggle)toggle.checked=false;
  const label=card.querySelector('[data-rent-toggle-label]');
  if(label)label.textContent='Payment due';
  const pill=card.querySelector('.rent-status-pill');
  if(pill){pill.classList.remove('good');pill.classList.add('warn');pill.textContent='Payment due';}
  const entry=card.querySelector('[data-rent-status-entry]');
  if(entry)entry.innerHTML='';
}
Object.assign(A,{
 back:()=>back(),
 tab:el=>tab(el.dataset.t),
 closeL:closeL,
 start:()=>{S.onboarded=true;persist();tab('home');},
 mon:el=>{S.mon=addMonths(S.mon,+el.dataset.d);draw(true);},
 monNow:()=>{S.mon=curMonth();draw(true);},
 yr:el=>{S.mon=addMonths(S.mon,12*+el.dataset.d);draw(true);},
 repView:el=>{UI.rv=el.dataset.v;draw(true);},
 openCat:el=>openCat(el.dataset.id),
 pick:()=>go('pick'),
 pickGo:el=>{stack.pop();openCat(el.dataset.id);},
 newCat:()=>{DLG.nc=null;closeL();go('newCat');},
 catAdd:el=>{const c=catOf(el.dataset.id);if(c.kind==='bill')openQuick({cat:c.id});else openEntry(entryFor(c));},
 rec:el=>recSheet(el.dataset.id),
 edit:el=>{const r=S.records.find(x=>x.id===el.dataset.id);if(r){closeL();openEntry(editParams(r));}},
 del:el=>{const kind=el.dataset.kind,id=el.dataset.id;ask({title:'Delete this record?',msg:'It will be removed and your totals will update. This cannot be undone.',ok:'Delete',danger:true,fn:()=>{if(kind==='dist')S.dist=S.dist.filter(x=>x.id!==id);else S.records=S.records.filter(x=>x.id!==id);persist();closeL();draw(true);toast('Deleted');}});},
 markPaid:el=>{const r=S.records.find(x=>x.id===el.dataset.id);if(r){r.status='paid';persist();closeL();draw(true);toast(r.cat==='rent'&&r.dir==='received'?'Marked as received':'Marked as paid');}},
 cf:el=>{UI.cf=el.dataset.id;draw(true);},
 wSetupSave:()=>{const v=parseMoney(DLG.wsp),e=$('#wsErr');if(v==null||v<=0||v>MAX_UNIT){e.textContent='Enter a price above 0, such as 60 or 62.50.';return;}setPrice('water',v,'all');DLG.wsp='';stack[stack.length-1]={n:'water',p:{}};draw();toast('Price saved');},
 wTab:el=>{UI.wTab=el.dataset.v;draw(true);},
 wDay:el=>{UI.wsel=el.dataset.date;draw(true);},
 wAdd:()=>{if(UI.wsel)openEntry({spec:'water',date:UI.wsel});},
 wPrice:()=>{const pr=S.prices.water;DLG.np='';DLG.pm='dated';sheet('<h2>Change bottle price</h2><p class="sub">Current price: <b>'+fmt(pr.cur)+'</b> per bottle. Saved deliveries keep their own price and are never recalculated.</p><div class="fld" style="margin:14px 0 12px"><label for="np">New price per bottle</label><div class="pre"><span>₹</span><input id="np" inputmode="decimal" data-d="np" autocomplete="off" placeholder="65"></div><p class="err" id="npErr" role="alert"></p></div>'+
   '<label class="radio"><input type="radio" name="pm" value="dated" data-d="pm" checked><span><b>New entries and future deliveries (recommended)</b><span>Deliveries dated today or later start at the new price. An older date you add later starts at the price that applied then.</span></span></label>'+
   '<label class="radio"><input type="radio" name="pm" value="all" data-d="pm"><span><b>New entries only</b><span>Every delivery you add from now on starts at the new price, whatever date you pick.</span></span></label>'+
   '<div class="row2"><button class="btn" data-act="closeL">Cancel</button><button class="btn pri" data-act="savePrice">Save price</button></div>',true);},
 savePrice:()=>{const v=parseMoney(DLG.np),pr=S.prices.water,e=$('#npErr');if(v==null||v<=0||v>MAX_UNIT){e.textContent='Enter a price above 0, such as 65 or 62.50.';return;}if(v===pr.cur){e.textContent='That is already the current price.';return;}setPrice('water',v,DLG.pm||'dated');closeL();draw(true);toast('Price updated');},
 tTab:el=>{UI.tt=el.dataset.v;draw(true);},
 tAdd:el=>openEntry({spec:el.dataset.s}),
 routes:()=>sheet(routesHtml()),
 cabAdd:()=>openEntry({spec:'cab'}),
 addRoute:()=>{if(S.routes.length>=200){toast('You can save up to 200 routes','bad');return;}let n=1,name='New route';while(S.routes.some(r=>r.name.toLowerCase()===name.toLowerCase())){n++;name='New route '+n;}const i=S.routes.findIndex(r=>r.fixed),r={id:uid(),name:name};S.routes.splice(i<0?S.routes.length:i,0,r);refreshCabRoutes();persist();draw(true);sheet(routesHtml());const all=document.querySelectorAll('#layer [data-rt]');for(const el of all)if(el.dataset.rt===r.id){el.focus();el.select();break;}},
 delRoute:el=>{S.routes=S.routes.filter(r=>r.id!==el.dataset.id||r.fixed);refreshCabRoutes();persist();draw(true);sheet(routesHtml());},
 distRow:el=>{const d=S.dist.find(x=>x.id===el.dataset.id);if(!d)return;sheet('<h2>'+esc(d.from||d.to?((d.from||'?')+' → '+(d.to||'?')):'Journey')+'</h2><div class="num" style="font-size:28px;margin:4px 0 8px">'+qtyStr(d.kmM)+' km</div><div class="kv"><span>Date</span><span>'+fmtDate(d.date)+'</span></div>'+(d.ts?'<div class="kv"><span>Added</span><span>'+fmtStamp(d.ts)+'</span></div>':'')+(d.es?'<div class="kv"><span>Last edited</span><span>'+fmtStamp(d.es)+'</span></div>':'')+(d.purpose?'<div class="kv"><span>Purpose</span><span>'+esc(d.purpose)+'</span></div>':'')+'<p class="sub" style="margin-top:8px">Distance is not counted as spending.</p><div class="row2"><button class="btn" data-act="editDist" data-id="'+esc(d.id)+'">'+ic('edit',18)+'Edit</button><button class="btn dan" data-act="del" data-kind="dist" data-id="'+esc(d.id)+'">'+ic('trash',18)+'Delete</button></div>');},
 editDist:el=>{closeL();openEntry({spec:'distance',id:el.dataset.id});},
 saveKm:()=>{const v=DLG.kmrate==null?S.kmCost:DLG.kmrate,e=$('#kmErr');if(String(v).trim()===''){S.kmCost='';persist();draw(true);return;}const m=parseMoney(v);if(m==null||m<=0||m>100000){e.textContent='Enter an amount above 0, such as 8 or 7.50.';return;}S.kmCost=String(v).trim();persist();draw(true);toast('Estimate saved');},
 recKm:()=>{const mk=S.mon,km=S.dist.filter(d=>d.date.slice(0,7)===mk).reduce((a,d)=>a+d.kmM,0),rate=parseMoney(S.kmCost);if(!rate||!km)return;const est=mul(km,rate);
   ask({title:'Record estimate as an expense?',msg:'This adds '+fmt(est)+' to your travel spending for '+monLabel(mk)+'. It is only an estimate. You can delete it later.',ok:'Record expense',fn:()=>{const dt=mk===curMonth()?today():mk+'-'+pad(new Date(+mk.slice(0,4),+mk.slice(5),0).getDate());S.records.push({id:uid(),ts:Date.now(),cat:'travel',sub:'other',date:dt,title:'Estimated distance cost ('+qtyStr(km)+' km)',amountP:est,notes:'Estimate from cost per km',x:{est:1}});persist();closeL();draw(true);toast('Recorded');}});},
 todaySheet:()=>{let tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(e){}
   sheet('<div class="eyebrow">'+weekday(today())+'</div><h2 id="tsDate" style="margin:4px 0 2px">'+fmtDate(today())+'</h2><div class="num" id="tsTime" style="font-size:28px">'+fmtClock()+'</div><p class="sub" style="margin:6px 0 12px">Uses your phone’s clock'+(tz?' and time zone ('+esc(tz)+')':'')+'. The date changes by itself at midnight, and a new month starts with no spending.</p><div class="card flat" style="margin-bottom:0"><div class="eyebrow" style="margin-bottom:8px">'+monLabel(today().slice(0,7))+'</div>'+miniCal(today().slice(0,7))+'<div class="legend"><span><i></i>Has records</span></div></div><div class="row2"><button class="btn" data-act="closeL">Close</button></div>');},
 houses:()=>go('houses'),
 addHouse:()=>openEntry({spec:'house'}),
 addUtilityHouse:()=>openEntry({spec:'house',utility:true}),
 editHouse:el=>openEntry({spec:'house',id:el.dataset.id}),
 eh:el=>{UI.eh=el.dataset.id;draw(true);},
 wbh:el=>{UI.wbh=el.dataset.id;draw(true);},
 elecAdd:()=>openQuick({cat:'electricity'}),
 waterBillAdd:()=>openQuick({cat:'waterbill'}),
 delHouse:el=>{const h=houseOf(el.dataset.id);if(!h)return;
   const bills=S.records.filter(r=>(r.cat==='electricity'||r.cat==='waterbill')&&r.houseId===h.id).length,rents=S.records.filter(r=>r.cat==='rent'&&r.houseId===h.id).length;
   ask({title:'Delete '+h.name+'?',msg:(bills?bills+' utility bill'+(bills===1?'':'s')+' will be deleted. ':'')+(rents?'Rent records will be kept and unlinked from this house. ':'')+(!bills&&!rents?'This house has no linked records. ':'')+'This cannot be undone.',ok:'Delete house',danger:true,fn:()=>{S.records=S.records.filter(r=>!((r.cat==='electricity'||r.cat==='waterbill')&&r.houseId===h.id));S.records.forEach(r=>{if(r.cat==='rent'&&r.houseId===h.id)delete r.houseId;});S.houses=S.houses.filter(x=>x.id!==h.id);if(UI.eh===h.id)UI.eh='all';persist();closeL();draw(true);toast('House deleted');}});},
 rentAddHouse:()=>toggleRentHouse(),
 rentPick:el=>{UI.rentDir=el.dataset.v;UI.rentHouse='all';go('rentLog');},
 rentDir:el=>{UI.rentDir=el.dataset.v;UI.rentHouse='all';draw(true);},
 rentHouse:el=>{UI.rentHouse=el.dataset.id;draw(true);},
 rentEdit:el=>{const id=el.dataset.id;closeL();openEntry(id?{spec:'rent',id,dir:el.dataset.dir}:{spec:'rent',dir:el.dataset.dir,houseId:el.dataset.house,tenant:el.dataset.tenant,pre:{period:el.dataset.period}});},
 rentStatusSave:el=>{
   const card=el.closest('.rent-due-card'),date=card&&card.querySelector('[data-act="rentStatusDate"]')?.value;
   if(!validDate(date)){toast('Enter a valid rent date','bad');return;}
   const {dir,house:houseId,period,tenant}=el.dataset,h=houseOf(houseId);if(!h)return;
   let r=S.records.find(x=>x.cat==='rent'&&x.dir===dir&&(x.period||x.date.slice(0,7))===period&&(x.houseId===h.id||(!x.houseId&&(x.party||'').trim().toLowerCase()===h.name.trim().toLowerCase()))&&(dir==='paid'||(x.tenant||'').trim().toLowerCase()===(tenant||'').trim().toLowerCase()));
   const profile=Array.isArray(h.tenants)?h.tenants.find(t=>typeof t!=='string'&&t.name===tenant):null;
   if(!r){
     const amount=dir==='paid'?h.rentAmountP:profile&&profile.rentAmountP;
     if(!Number.isInteger(amount)||amount<=0){toast('Set the monthly rent in Houses first','bad');draw(true);return;}
     r={id:uid(),ts:Date.now(),cat:'rent',dir,date,period,amountP:amount,houseId:h.id,party:h.name,tenant:dir==='received'?tenant:'',notes:'',x:{dueBy:(profile||h).dueBy||'first',dueDay:(profile||h).dueDay||null}};
     S.records.push(r);
   }
   r.date=date;r.status='paid';persist();draw(true);toast(dir==='received'?'Marked as received':'Marked as paid');
 },
 rentStatusCancel:el=>{const card=el.closest('.rent-due-card');if(card)resetRentStatus(card);},
 rentToggle:el=>{
   const {dir,house:houseId,period,tenant}=el.dataset,h=houseOf(houseId);if(!h)return;
   let r=S.records.find(x=>x.cat==='rent'&&x.dir===dir&&(x.period||x.date.slice(0,7))===period&&(x.houseId===h.id||(!x.houseId&&(x.party||'').trim().toLowerCase()===h.name.trim().toLowerCase()))&&(dir==='paid'||(x.tenant||'').trim().toLowerCase()===(tenant||'').trim().toLowerCase()));
   if(el.checked){
     const card=el.closest('.rent-due-card');if(!card)return;
     const entry=card.querySelector('[data-rent-status-entry]');if(!entry||entry.querySelector('.rent-paid-entry'))return;
     const positiveLabel=dir==='received'?'Received':'Paid',pill=card.querySelector('.rent-status-pill'),toggleLabel=card.querySelector('[data-rent-toggle-label]');
     if(pill){pill.classList.remove('warn');pill.classList.add('good');pill.textContent=positiveLabel;}
     if(toggleLabel)toggleLabel.textContent=positiveLabel;
     const date=r&&r.date|| (period===curMonth()?today():period+'-01');
     const dateLabel=dir==='received'?'Received on':'Paid on',saveLabel=dir==='received'?'Save received':'Save paid';
     entry.innerHTML='<div class="rent-paid-entry"><div class="fld rent-date-field"><label>'+dateLabel+'<span class="ro" data-rent-date-display>'+fmtDate(date)+'</span></label><input type="date" data-act="rentStatusDate" aria-label="'+dateLabel+'" value="'+esc(date)+'" min="2000-01-01" max="2100-12-31"></div><div class="rent-paid-actions"><button type="button" class="btn pri" data-act="rentStatusSave" data-dir="'+dir+'" data-house="'+esc(houseId)+'" data-period="'+esc(period)+'" data-tenant="'+esc(tenant||'')+'">'+saveLabel+'</button><button type="button" class="btn" data-act="rentStatusCancel">Cancel</button></div></div>';
     return;
   }
   if(!el.checked){
     const card=el.closest('.rent-due-card'),pending=card&&card.querySelector('[data-rent-status-entry] .rent-paid-entry');
     if(pending){resetRentStatus(card);return;}
   }
   const profile=Array.isArray(h.tenants)?h.tenants.find(t=>typeof t!=='string'&&t.name===tenant):null;
   if(!r){
     const amount=dir==='paid'?h.rentAmountP:profile&&profile.rentAmountP;
     if(!Number.isInteger(amount)||amount<=0){toast('Set the monthly rent in Houses first','bad');draw(true);return;}
     r={id:uid(),ts:Date.now(),cat:'rent',dir,date:period===curMonth()?today():period+'-01',period,amountP:amount,houseId:h.id,party:h.name,tenant:dir==='received'?tenant:'',notes:'',x:{dueBy:(profile||h).dueBy||'first',dueDay:(profile||h).dueDay||null}};
     S.records.push(r);
   }
   r.status=el.checked?'paid':'due';if(el.checked&&period===S.mon)r.date=today();persist();draw(true);toast(el.checked?(dir==='received'?'Marked as received':'Marked as paid'):'Marked as due');
 },
 theme:el=>{S.theme=el.dataset.v;applyTheme();persist();draw(true);},
 lockSetup:()=>go('lockSetup'),
 privacy:()=>go('privacy'),
 backup:()=>go('backup'),
 lockTO:el=>{S.lock.timeout=+el.dataset.v;persist();draw(true);},
 deleteCategory:()=>sheet('<h2>Delete a category</h2><p class="sub" style="margin-bottom:8px">Choose a category to delete. Its expense records will be deleted too.</p>'+
   (S.cats.length?'<div class="list">'+S.cats.map(c=>{const n=S.records.filter(r=>r.cat===c.id).length,d=c.id==='travel'?S.dist.length:0;return '<button class="rec" data-act="deleteCategoryGo" data-id="'+esc(c.id)+'">'+chipOf(c)+'<span class="rt"><b>'+esc(c.name)+'</b><small>'+n+' expense record'+(n===1?'':'s')+(d?' · '+d+' journey'+(d===1?'':'s'):'')+'</small></span></button>';}).join('')+'</div>':'<p class="sub" style="margin-bottom:12px">There are no categories to delete.</p>')+
   '<button class="btn block" data-act="closeL">Close</button>'),
 deleteCategoryGo:el=>{const c=catOf(el.dataset.id);if(!c)return;const n=S.records.filter(r=>r.cat===c.id).length,d=c.id==='travel'?S.dist.length:0;
   const details=[n+' expense record'+(n===1?'':'s'),d+' travel journey'+(d===1?'':'s')].filter((x,i)=>i===0||d>0).join(' and ');
   ask({title:'Delete '+c.name+'?',msg:'This removes the category and '+(n||d?details:'all associated data')+' from this device. This cannot be undone.',ok:'Delete category',danger:true,fn:()=>{S.cats=S.cats.filter(x=>x.id!==c.id);S.records=S.records.filter(r=>r.cat!==c.id);delete S.prices[c.id];if(c.id==='travel')S.dist=[];if(UI.cf===c.id)UI.cf='all';persist();closeL();draw(true);toast('Category deleted');}});},
 delCat:()=>{sheet('<h2>Delete a category’s records</h2><p class="sub" style="margin-bottom:8px">The category stays. Only its records are removed.</p><div class="list">'+S.cats.map(c=>{const n=S.records.filter(r=>r.cat===c.id).length+(c.id==='travel'?S.dist.length:0);return '<button class="rec" data-act="delCatGo" data-id="'+esc(c.id)+'"'+(n?'':' disabled style="opacity:.5"')+'>'+chipOf(c)+'<span class="rt"><b>'+esc(c.name)+'</b><small>'+n+' record'+(n===1?'':'s')+'</small></span></button>';}).join('')+'</div><button class="btn block" data-act="closeL">Close</button>');},
 delCatGo:el=>{const c=catOf(el.dataset.id);if(!c)return;ask({title:'Delete all '+c.name+' records?',msg:'Every record in this category is removed from this device. This cannot be undone.',ok:'Delete records',danger:true,fn:()=>{S.records=S.records.filter(r=>r.cat!==c.id);if(c.id==='travel')S.dist=[];persist();closeL();draw(true);toast('Records deleted');}});},
 clearAll:()=>ask({title:'Clear all data?',msg:'This permanently deletes every record, price and setting on this device. Consider making a backup first.',ok:'Clear everything',danger:true,type:'DELETE',fn:()=>{const t=S.theme;replaceState(blank());S.onboarded=true;S.theme=t;S.mon=curMonth();persist();applyLockEffects();closeL();tab('home');toast('All data cleared');}}),
 ncIcon:el=>{DLG.nc.icon=el.dataset.v;draw(true);},
 ncColor:el=>{DLG.nc.color=el.dataset.v;draw(true);},
 ncKind:el=>{DLG.nc.kind=el.dataset.v;draw(true);},
 saveCat:()=>{const n=DLG.nc,name=(n.name||'').trim(),e=$('#ncErr');
   if(!name){e.textContent='Give the category a name.';return;}
   if(S.cats.some(c=>c.name.toLowerCase()===name.toLowerCase())){e.textContent='You already have a category with this name.';return;}
   if(n.kind==='unit'&&!(n.unit||'').trim()){$('#ncuErr').textContent='Say what you count, such as can or packet.';return;}
   const id='c'+Date.now().toString(36);const u=(n.unit||'').trim();
   S.cats.push({id:id,name:name,icon:n.icon,color:n.color,kind:n.kind,unit:u,units:u+'s'});persist();DLG.nc=null;stack.pop();draw();toast('Category created');}
});
export function applyTheme(){
  const r=document.documentElement;if(S.theme==='system')r.removeAttribute('data-theme');else r.setAttribute('data-theme',S.theme);
  const dark=S.theme==='dark'||(S.theme==='system'&&!!window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
  platform.setBars(dark);
}
