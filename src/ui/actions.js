/* @auto-imports */
import {addMonths,curMonth,fmtClock,fmtDate,fmtStamp,monLabel,pad,today,weekday} from '../core/dates.js';
import {MAX_UNIT,fmt,mul,parseMoney,qtyStr} from '../core/money.js';
import {setPrice} from '../core/rules.js';
import {$,esc,uid} from '../core/util.js';
import {DLG,S,UI,blank,catOf,houseOf,persist,replaceState} from '../data/state.js';
import {applyLockEffects} from '../native/lock.js';
import {platform} from '../native/platform.js';
import {miniCal} from './clock.js';
import {chipOf} from './components.js';
import {editParams,entryFor,openEntry} from './entry.js';
import {ic} from './icons.js';
import {ask,back,closeL,draw,go,openCat,sheet,stack,tab,toast} from './nav.js';
import {openQuick} from './quick.js';
import {recSheet} from './record-sheet.js';
import {A} from './registry.js';
/* @end-imports */
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
 markPaid:el=>{const r=S.records.find(x=>x.id===el.dataset.id);if(r){r.status='paid';persist();closeL();draw(true);toast('Marked as paid');}},
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
 distRow:el=>{const d=S.dist.find(x=>x.id===el.dataset.id);if(!d)return;sheet('<h2>'+esc(d.from||d.to?((d.from||'?')+' → '+(d.to||'?')):'Journey')+'</h2><div class="num" style="font-size:28px;margin:4px 0 8px">'+qtyStr(d.kmM)+' km</div><div class="kv"><span>Date</span><span>'+fmtDate(d.date)+'</span></div>'+(d.ts?'<div class="kv"><span>Added</span><span>'+fmtStamp(d.ts)+'</span></div>':'')+(d.es?'<div class="kv"><span>Last edited</span><span>'+fmtStamp(d.es)+'</span></div>':'')+(d.purpose?'<div class="kv"><span>Purpose</span><span>'+esc(d.purpose)+'</span></div>':'')+'<p class="sub" style="margin-top:8px">Distance is not counted as spending.</p><div class="row2"><button class="btn" data-act="editDist" data-id="'+esc(d.id)+'">'+ic('edit',18)+'Edit</button><button class="btn dan" data-act="del" data-kind="dist" data-id="'+esc(d.id)+'">'+ic('trash',18)+'Delete</button></div>');},
 editDist:el=>{closeL();openEntry({spec:'distance',id:el.dataset.id});},
 saveKm:()=>{const v=DLG.kmrate==null?S.kmCost:DLG.kmrate,e=$('#kmErr');if(String(v).trim()===''){S.kmCost='';persist();draw(true);return;}const m=parseMoney(v);if(m==null||m<=0||m>100000){e.textContent='Enter an amount above 0, such as 8 or 7.50.';return;}S.kmCost=String(v).trim();persist();draw(true);toast('Estimate saved');},
 recKm:()=>{const mk=S.mon,km=S.dist.filter(d=>d.date.slice(0,7)===mk).reduce((a,d)=>a+d.kmM,0),rate=parseMoney(S.kmCost);if(!rate||!km)return;const est=mul(km,rate);
   ask({title:'Record estimate as an expense?',msg:'This adds '+fmt(est)+' to your travel spending for '+monLabel(mk)+'. It is only an estimate. You can delete it later.',ok:'Record expense',fn:()=>{const dt=mk===curMonth()?today():mk+'-'+pad(new Date(+mk.slice(0,4),+mk.slice(5),0).getDate());S.records.push({id:uid(),ts:Date.now(),cat:'travel',sub:'other',date:dt,title:'Estimated distance cost ('+qtyStr(km)+' km)',amountP:est,notes:'Estimate from cost per km',x:{est:1}});persist();closeL();draw(true);toast('Recorded');}});},
 todaySheet:()=>{let tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch(e){}
   sheet('<div class="eyebrow">'+weekday(today())+'</div><h2 id="tsDate" style="margin:4px 0 2px">'+fmtDate(today())+'</h2><div class="num" id="tsTime" style="font-size:28px">'+fmtClock()+'</div><p class="sub" style="margin:6px 0 12px">Uses your phone’s clock'+(tz?' and time zone ('+esc(tz)+')':'')+'. The date changes by itself at midnight, and a new month starts with no spending.</p><div class="card flat" style="margin-bottom:0"><div class="eyebrow" style="margin-bottom:8px">'+monLabel(today().slice(0,7))+'</div>'+miniCal(today().slice(0,7))+'<div class="legend"><span><i></i>Has records</span></div></div><div class="row2"><button class="btn" data-act="closeL">Close</button></div>');},
 houses:()=>go('houses'),
 addHouse:()=>openEntry({spec:'house'}),
 editHouse:el=>openEntry({spec:'house',id:el.dataset.id}),
 eh:el=>{UI.eh=el.dataset.id;draw(true);},
 elecAdd:()=>openQuick({cat:'electricity'}),
 delHouse:el=>{const h=houseOf(el.dataset.id);if(!h)return;const n=S.records.filter(r=>r.houseId===h.id).length;
   ask({title:'Delete '+h.name+'?',msg:n?'Its '+n+' electricity bill'+(n===1?'':'s')+' will be deleted too. This cannot be undone.':'This house has no bills. This cannot be undone.',ok:'Delete house',danger:true,fn:()=>{S.records=S.records.filter(r=>r.houseId!==h.id);S.houses=S.houses.filter(x=>x.id!==h.id);if(UI.eh===h.id)UI.eh='all';persist();closeL();draw(true);toast('House deleted');}});},
 rentPick:el=>{UI.rentDir=el.dataset.v;go('rentLog');},
 rentDir:el=>{UI.rentDir=el.dataset.v;draw(true);},
 rentAdd:()=>openQuick({cat:'rent',dir:UI.rentDir}),
 theme:el=>{S.theme=el.dataset.v;applyTheme();persist();draw(true);},
 lockSetup:()=>go('lockSetup'),
 privacy:()=>go('privacy'),
 backup:()=>go('backup'),
 lockTO:el=>{S.lock.timeout=+el.dataset.v;persist();draw(true);},
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

