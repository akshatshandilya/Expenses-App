/* @auto-imports */
import {curMonth,fmtDate,leftInfo,monLabel,monShort,today,validDate,validMonth} from '../core/dates.js';
import {MAX_MONEY,MAX_QTY,MAX_UNIT,fmt,mul,parseMoney,parseQty,qtyStr,rs} from '../core/money.js';
import {priceOn,recMonth,setPrice} from '../core/rules.js';
import {$,$$,esc,uid} from '../core/util.js';
import {S,UI,catOf,houseOf,houseRentDir,tenantProfiles,persist} from '../data/state.js';
import {empty,hd,tenantOptions,tenantPicker} from './components.js';
import {ic} from './icons.js';
import {closeL,draw,go,sheet,stack,toast} from './nav.js';
import {A,V} from './registry.js';
/* @end-imports */
export let F=null;
export function getF(){return F;}
export function clearF(){F=null;}
export function refreshCabRoutes(){
  if(!F||F.sp.cat!=='cab')return;
  const f=F.sp.fields.find(x=>x.k==='route');if(!f)return;
  f.opts=S.routes.map(r=>[r.id,r.name]);
  if(!S.routes.some(r=>r.id===F.vals.route))F.vals.route=S.routes[0]?S.routes[0].id:'';
}
export function toggleRentHouse(){
  if(!F||F.sp.cat!=='rent')return;
  F.vals.addHouse=!F.vals.addHouse;draw(true);
}
const emptyTenant=()=>({name:'',agStart:'',agEnd:'',rentAmount:''});
function tenantRowsHtml(tenants,group){
  const rows=tenants.map((t,i)=>'<div class="rent-house-new"><div class="fld"><label for="f_'+group+'_name_'+i+'">Tenant name</label><input id="f_'+group+'_name_'+i+'" type="text" maxlength="80" data-f="tenantProfile" data-tenant-group="'+group+'" data-tenant-index="'+i+'" data-tenant-key="name" value="'+esc(t.name||'')+'" placeholder="Tenant name" autocomplete="off"><p class="err" data-err="tenant_'+group+'_'+i+'" role="alert"></p></div>'+
    '<div class="fld"><label for="f_'+group+'_start_'+i+'">Agreement start date <small>optional</small></label><input id="f_'+group+'_start_'+i+'" type="date" min="2000-01-01" max="2100-12-31" data-f="tenantProfile" data-tenant-group="'+group+'" data-tenant-index="'+i+'" data-tenant-key="agStart" value="'+esc(t.agStart||'')+'"></div>'+
    '<div class="fld"><label for="f_'+group+'_end_'+i+'">Agreement end date <small>optional</small></label><input id="f_'+group+'_end_'+i+'" type="date" min="2000-01-01" max="2100-12-31" data-f="tenantProfile" data-tenant-group="'+group+'" data-tenant-index="'+i+'" data-tenant-key="agEnd" value="'+esc(t.agEnd||'')+'"></div>'+
    '<div class="fld"><label for="f_'+group+'_rent_'+i+'">Monthly rent</label><div class="pre"><span>₹</span><input id="f_'+group+'_rent_'+i+'" inputmode="decimal" data-f="tenantProfile" data-tenant-group="'+group+'" data-tenant-index="'+i+'" data-tenant-key="rentAmount" value="'+esc(t.rentAmount||'')+'" placeholder="0" autocomplete="off"></div></div>'+
    '<div class="fld"><label for="f_'+group+'_dueBy_'+i+'">Payment Due By</label><select class="device-theme" id="f_'+group+'_dueBy_'+i+'" data-f="tenantProfile" data-tenant-group="'+group+'" data-tenant-index="'+i+'" data-tenant-key="dueBy"><option value="first"'+((t.dueBy||'first')==='first'?' selected':'')+'>1st of every month</option><option value="seventh"'+(t.dueBy==='seventh'?' selected':'')+'>7th of every month</option><option value="custom"'+(t.dueBy==='custom'?' selected':'')+'>Custom</option></select></div>'+
    '<div class="fld"'+(t.dueBy==='custom'?'':' hidden')+'><label for="f_'+group+'_dueDay_'+i+'">Day of every month</label><input id="f_'+group+'_dueDay_'+i+'" type="number" min="1" max="31" inputmode="numeric" data-f="tenantProfile" data-tenant-group="'+group+'" data-tenant-index="'+i+'" data-tenant-key="dueDay" value="'+esc(t.dueDay||'')+'" placeholder="e.g. 12"></div>'+
    (tenants.length>1?'<button type="button" class="link" data-act="tenantRemove" data-group="'+group+'" data-index="'+i+'">Remove tenant</button>':'')+'</div>').join('');
  return rows+'<button type="button" class="btn soft block" data-act="tenantAdd" data-group="'+group+'">'+ic('plus',18)+'Add another tenant</button>';
}
/* entry form */
export function fieldHtml(f){
  const v=F.vals,k=f.k,id='f_'+k,val=v[k]==null?'':v[k];
  const show=!f.show||f.show(v);
  const ro=(f.t==='date'||f.t==='month')?'<span class="ro" id="ro_'+k+'">'+(f.t==='date'?fmtDate(val):(validMonth(val)?monShort(val):''))+'</span>':'';
  const lab=f.l&&f.t!=='switch'&&f.t!=='seg'&&f.t!=='radio'&&f.t!=='houseRadio'&&f.t!=='calc'&&f.t!=='tenantRoster'?'<label for="'+id+'">'+f.l+(f.opt?'<small>optional</small>':'')+ro+'</label>':(f.t==='seg'||f.t==='radio'||f.t==='houseRadio'?'<div class="lb">'+f.l+'</div>':'');
  let inner='';
  switch(f.t){
    case 'date':inner='<input id="'+id+'" type="date" data-f="'+k+'" value="'+esc(val)+'" min="2000-01-01" max="2100-12-31">';break;
    case 'month':inner='<input id="'+id+'" type="month" data-f="'+k+'" value="'+esc(val)+'" min="2000-01" max="2100-12">';break;
    case 'text':inner='<input id="'+id+'" type="text" data-f="'+k+'" value="'+esc(val)+'" maxlength="80" autocomplete="off" placeholder="'+esc(f.ph||'')+'">';break;
    case 'number':inner='<input id="'+id+'" type="number" min="'+(f.min||'')+'" max="'+(f.max||'')+'" inputmode="numeric" data-f="'+k+'" value="'+esc(val)+'" placeholder="'+esc(f.ph||'')+'">';break;
    case 'area':inner='<textarea id="'+id+'" data-f="'+k+'" maxlength="'+(f.max||200)+'" placeholder="'+esc(f.ph||'')+'">'+esc(val)+'</textarea>';break;
    case 'money':inner='<div class="pre"><span>₹</span><input id="'+id+'" inputmode="decimal" data-f="'+k+'" value="'+esc(val)+'" placeholder="0" autocomplete="off"></div>';break;
    case 'qty':inner='<div class="qty">'+(f.step?'<button type="button" class="ib" data-act="step" data-k="'+k+'" data-d="-1" aria-label="Decrease">−</button>':'')+'<div class="pre"><input id="'+id+'" inputmode="decimal" data-f="'+k+'" value="'+esc(val)+'" placeholder="0" autocomplete="off"><span class="sfx" style="font:500 13px var(--fb)">'+esc(typeof f.sfx==='function'?f.sfx(v):(f.sfx||''))+'</span></div>'+(f.step?'<button type="button" class="ib" data-act="step" data-k="'+k+'" data-d="1" aria-label="Increase">+</button>':'')+'</div>';break;
    case 'select':inner='<select'+(k==='dueBy'?' class="device-theme"':'')+' id="'+id+'" data-f="'+k+'"><option value="">Not specified</option>'+f.opts.map(o=>{const value=Array.isArray(o)?o[0]:o,label=Array.isArray(o)?o[1]:o;return '<option value="'+esc(value)+'"'+(value===val?' selected':'')+'>'+esc(label)+'</option>';}).join('')+'</select>';break;
    case 'hsel':inner='<select id="'+id+'" data-f="'+k+'"><option value="">Choose a house</option>'+S.houses.map(h=>'<option value="'+esc(h.id)+'"'+(h.id===val?' selected':'')+'>'+esc(h.name)+'</option>').join('')+'</select>';break;
    case 'tenantSelect':{const house=houseOf(v.houseId),profiles=v.addHouse?(v.newTenants||[]).filter(t=>t.name.trim()):tenantProfiles(house);
      inner=tenantPicker(val,profiles,id,'tenantPicker');break;}
    case 'tenantRoster':inner='<div class="lb">'+f.l+'</div>'+tenantRowsHtml(val||[emptyTenant()],k);break;
    case 'houseRadio':inner='<div class="house-options" role="radiogroup" aria-label="House">'+S.houses.filter(h=>!f.filter||f.filter(h,v)).map(h=>'<label class="radio house-option"><input type="radio" name="'+id+'" data-f="'+k+'" value="'+esc(h.id)+'"'+(val===h.id?' checked':'')+'><span><b>'+esc(h.name)+'</b><small>'+esc([h.addr,h.meter].filter(Boolean).join(' · ')||'No additional details')+'</small></span></label>').join('')+'</div>'+
      '<button type="button" class="btn soft block" data-act="rentAddHouse">'+ic('plus',18)+'Add a house</button>'+
      (v.addHouse?'<div class="rent-house-new"><div class="fld"><label for="f_houseName">House name</label><input id="f_houseName" type="text" data-f="houseName" maxlength="80" value="'+esc(v.houseName||'')+'" placeholder="e.g. Main home" autocomplete="off"><p class="err" data-err="houseName" role="alert"></p></div><div class="fld"><label for="f_houseAddr">Address or area <small>optional</small></label><input id="f_houseAddr" type="text" data-f="houseAddr" maxlength="80" value="'+esc(v.houseAddr||'')+'" placeholder="e.g. Flat 4B" autocomplete="off"></div><div class="fld"><label for="f_houseMeter">Consumer or meter number <small>optional</small></label><input id="f_houseMeter" type="text" data-f="houseMeter" maxlength="80" value="'+esc(v.houseMeter||'')+'" autocomplete="off"></div><div class="fld"><div class="lb">Rent type</div><div class="rgrp"><label class="radio"><input type="radio" name="f_houseDir" data-f="houseDir" value="paid"'+((v.houseDir||'paid')==='paid'?' checked':'')+'><span><b>Paying</b><span>Rent paid to a landlord</span></span></label><label class="radio"><input type="radio" name="f_houseDir" data-f="houseDir" value="received"'+(v.houseDir==='received'?' checked':'')+'><span><b>Receiving</b><span>Rent collected from a tenant</span></span></label></div></div>'+(v.houseDir==='paid'?'<div class="fld"><label for="f_houseRentAmount">Monthly rent</label><div class="pre"><span>₹</span><input id="f_houseRentAmount" inputmode="decimal" data-f="houseRentAmount" value="'+esc(v.houseRentAmount||'')+'" placeholder="0"></div><p class="err" data-err="houseRentAmount" role="alert"></p></div><div class="fld"><label for="f_houseDueBy">Payment Due By</label><select class="device-theme" id="f_houseDueBy" data-f="houseDueBy"><option value="first"'+((v.houseDueBy||'first')==='first'?' selected':'')+'>1st of every month</option><option value="seventh"'+(v.houseDueBy==='seventh'?' selected':'')+'>7th of every month</option><option value="custom"'+(v.houseDueBy==='custom'?' selected':'')+'>Custom</option></select></div>'+(v.houseDueBy==='custom'?'<div class="fld"><label for="f_houseDueDay">Day of every month</label><input id="f_houseDueDay" type="number" min="1" max="31" data-f="houseDueDay" value="'+esc(v.houseDueDay||'')+'" placeholder="e.g. 12"><p class="err" data-err="houseDueDay" role="alert"></p></div>':''):'')+(v.houseDir==='received'?'<div class="fld"><div class="lb">Tenant details</div>'+tenantRowsHtml(v.newTenants||[emptyTenant()],'rent-new')+'<p class="err" data-err="newTenants" role="alert"></p></div>':'')+'</div>':'');break;
    case 'seg':inner='<div class="seg'+(f.wrap?' wrap':'')+'" role="radiogroup" aria-label="'+esc(f.l)+'">'+f.opts.map(o=>'<button type="button" role="radio" aria-checked="'+(val===o[0])+'" class="'+(val===o[0]?'on':'')+'" data-act="seg" data-k="'+k+'" data-v="'+esc(o[0])+'">'+esc(o[1])+'</button>').join('')+'</div>';break;
    case 'radio':inner='<div class="rgrp">'+f.opts.map(o=>'<label class="radio"><input type="radio" name="'+id+'" data-f="'+k+'" value="'+esc(o[0])+'"'+(val===o[0]?' checked':'')+'><span><b>'+esc(o[1])+'</b><span>'+esc(o[2]||'')+'</span></span></label>').join('')+'</div>';break;
    case 'switch':inner='<label class="sw"><input type="checkbox" role="switch" data-f="'+k+'"'+(val?' checked':'')+'><span class="trk"></span><span>'+f.l+'</span></label>';break;
    case 'info':inner='<div class="sub">'+esc(typeof f.value==='function'?f.value(v):f.value||'')+'</div>';break;
    case 'calc':inner='<div class="calc"><div class="formula" id="formula" aria-live="polite"></div><div class="pre"><span>₹</span><input id="f_total" inputmode="decimal" data-f="total" value="'+esc(val)+'" aria-label="Total amount" readonly></div><div style="display:flex;justify-content:space-between;align-items:center"><span class="sub" id="calcNote"></span><button type="button" class="link" id="editLink" data-act="editTotal" hidden></button></div></div>';break;
  }
  return '<div class="fld" data-fk="'+k+'"'+(show?'':' hidden')+'>'+lab+inner+(f.extra?'<div class="xtra">'+f.extra+'</div>':'')+'<p class="hint" id="hint_'+k+'">'+(f.hint?esc(f.hint(v)):'')+'</p><p class="err" data-err="'+k+'" role="alert"></p></div>';
}
V.entry=()=>{
  if(!F)return hd('Entry')+empty('info','Nothing to edit','Go back and try again.');
  const sp=F.sp;
  return hd(esc(sp.title))+'<div class="warnbox" id="warn" role="alert" hidden></div>'+sp.fields.map(fieldHtml).join('')+
   '<div class="cta"><button class="btn pri block" id="saveBtn" data-act="saveForm">'+ic('check',20)+esc(sp.save||'Save')+'</button></div>';
};

export const defDate=p=>p.date||(S.mon===curMonth()?today():S.mon+'-01');
export const unitHint=(id,v)=>{const u=parseMoney(v.unit),d=validDate(v.date)?priceOn(id,v.date):null;
  if(d==null)return 'This price becomes your default for next time.';
  return u!=null&&u!==d?'Default is '+fmt(d)+'. Only this entry uses '+fmt(u)+'.':'Using the default price of '+fmt(d)+'.';};
export function unitSpec(p){
  const c=catOf(p.cat),W=c.kind==='water',un=c.unit||'unit',ups=c.units||un+'s';
  return{cat:c.id,calc:true,title:(p.id?'Edit ':'Add ')+(W?'delivery':'purchase'),save:W?'Save delivery':'Save purchase',
   fields:[{k:'date',t:'date',l:W?'Delivery date':'Purchase date'},{k:'qty',t:'qty',l:W?'Quantity':'Number of '+ups,step:1,sfx:ups,req:1},
    {k:'unit',t:'money',l:'Price per '+un,hint:v=>unitHint(c.id,v)},{k:'total',t:'calc'},
    {k:'setDef',t:'switch',l:'Use this price as my default from now on',opt:1,show:v=>!W&&!!S.prices[c.id]&&parseMoney(v.unit)>0&&parseMoney(v.unit)!==S.prices[c.id].cur},
    {k:'notes',t:'area',l:W?'Notes':'Supplier or notes',opt:1}],
   init:()=>{const d=defDate(p),pr=priceOn(c.id,d);return{date:d,qty:'1',unit:pr!=null?rs(pr):'',notes:'',setDef:false,total:''};},
   fill:r=>({date:r.date,qty:qtyStr(r.qtyM),unit:rs(r.unitP),notes:r.notes||'',setDef:false,total:rs(r.amountP)}),
   build:v=>{const q=parseQty(v.qty),u=parseMoney(v.unit);return{cat:c.id,date:v.date,qtyM:q,unitP:u,amountP:mul(q,u),notes:v.notes.trim()};},
   after:(rec,v)=>{if(!W&&(!S.prices[c.id]||v.setDef))setPrice(c.id,rec.unitP,'all');},
   unitDate:true};
}
export const payHint=v=>v.paid?'Shown as Paid and counted in this month’s spending.':'Shown as Due. It is not counted in spending until you check Paid.';
export const agHint=v=>validDate(v.agEnd)?'Time left: '+leftInfo(v.agEnd).t+'.':'';
export const lastAg=pd=>{const a=S.records.filter(r=>r.cat==='rent'&&r.dir===(pd?'paid':'received')&&r.x&&(r.x.agStart||r.x.agEnd)).sort((x,y)=>x.date<y.date?1:x.date>y.date?-1:(y.ts||0)-(x.ts||0));return a[0]?{s:a[0].x.agStart||'',e:a[0].x.agEnd||''}:{s:'',e:''};};
export function lastFuel(){const a=S.records.filter(r=>r.cat==='travel'&&r.sub==='fuel').sort((x,y)=>x.date<y.date?1:-1);return a[0]?a[0].unitP:null;}
export function getSpec(p){
  const c=catOf(p.cat)||{};
  switch(p.spec){
    case 'water':return unitSpec(Object.assign({},p,{cat:'water'}));
    case 'unit':return unitSpec(p);
    case 'groceries':return{cat:'groceries',calc:true,edit:'toggle',calcIf:v=>!!v.det,title:p.id?'Edit grocery entry':'Add groceries',save:'Save groceries',
      fields:[{k:'date',t:'date',l:'Date'},{k:'title',t:'text',l:'Item or shopping description',ph:'e.g. Weekly vegetables',req:1},
       {k:'det',t:'switch',l:'Add quantity and price per unit',opt:1},
       {k:'qty',t:'qty',l:'Quantity',sfx:v=>v.uLabel||'',show:v=>!!v.det,req:1},{k:'uLabel',t:'text',l:'Unit',ph:'kg, litre, packet',opt:1,show:v=>!!v.det},
       {k:'unit',t:'money',l:'Price per unit',show:v=>!!v.det},{k:'total',t:'calc'},
       {k:'party',t:'text',l:'Store name',opt:1},{k:'notes',t:'area',l:'Notes',opt:1}],
      init:()=>({date:defDate(p),title:'',det:false,qty:'',uLabel:'',unit:'',total:'',party:'',notes:''}),
      fill:r=>({date:r.date,title:r.title||'',det:!!r.qtyM,qty:r.qtyM?qtyStr(r.qtyM):'',uLabel:(r.x&&r.x.unitLabel)||'',unit:r.unitP?rs(r.unitP):'',total:rs(r.amountP),party:r.party||'',notes:r.notes||''}),
      manualOf:r=>!(r.qtyM&&r.unitP&&mul(r.qtyM,r.unitP)===r.amountP),
      build:v=>{const o={cat:'groceries',date:v.date,title:v.title.trim(),party:v.party.trim(),notes:v.notes.trim(),amountP:parseMoney(v.total)};if(v.det){o.qtyM=parseQty(v.qty);o.unitP=parseMoney(v.unit);o.x={unitLabel:v.uLabel.trim()};}return o;}};
    case 'fuel':return{cat:'travel',calc:true,edit:'toggle',title:p.id?'Edit fuel purchase':'Add fuel purchase',save:'Save fuel purchase',
      fields:[{k:'date',t:'date',l:'Date'},{k:'fuelType',t:'seg',l:'Fuel type',opts:[['Petrol','Petrol'],['Diesel','Diesel'],['CNG','CNG'],['Other','Other']]},
       {k:'qty',t:'qty',l:'Quantity purchased',sfx:v=>v.fuelType==='CNG'?'kg':'litres',req:1},{k:'unit',t:'money',l:'Price per litre or unit'},{k:'total',t:'calc'},
       {k:'vehicle',t:'text',l:'Vehicle',ph:'e.g. Car, Scooter',opt:1},{k:'notes',t:'area',l:'Notes',opt:1}],
      init:()=>{const lp=lastFuel();return{date:defDate(p),fuelType:'Petrol',qty:'',unit:lp?rs(lp):'',total:'',vehicle:'',notes:''};},
      fill:r=>({date:r.date,fuelType:(r.x&&r.x.fuelType)||'Petrol',qty:qtyStr(r.qtyM),unit:rs(r.unitP),total:rs(r.amountP),vehicle:(r.x&&r.x.vehicle)||'',notes:r.notes||''}),
      manualOf:r=>mul(r.qtyM,r.unitP)!==r.amountP,
      build:v=>({cat:'travel',sub:'fuel',date:v.date,qtyM:parseQty(v.qty),unitP:parseMoney(v.unit),amountP:parseMoney(v.total),notes:v.notes.trim(),x:{fuelType:v.fuelType,vehicle:v.vehicle.trim(),u:v.fuelType==='CNG'?'kg':'litres'}})};
    case 'cab':{
      const routeOpts=()=>S.routes.map(r=>[r.id,r.name]);
      return{cat:'cab',title:p.id?'Edit ride':'Add ride',save:'Save ride',
       fields:[{k:'date',t:'date',l:'Date'},
        {k:'mode',t:'radio',l:'Type of ride',opts:[['Auto','Auto','Auto-rickshaw'],['Cab','Cab','Taxi or app cab']]},
        {k:'route',t:'seg',l:'Route',wrap:1,opts:routeOpts(),extra:'<button type="button" class="link" data-act="routes">Edit routes</button>'},
        {k:'routeOther',t:'text',l:'Route name',ph:'e.g. Airport, Station to Home',show:v=>v.route==='others'},
        {k:'fare',t:'money',l:'Fare',ph:'e.g. 120'},
        {k:'notes',t:'area',l:'Notes',opt:1}],
       init:()=>({date:defDate(p),mode:'Auto',route:S.routes[0]?S.routes[0].id:'',routeOther:'',fare:'',notes:''}),
       fill:r=>{const rid=(r.x&&r.x.routeId)||'';const known=S.routes.find(x=>x.id===rid&&rid!=='others')||S.routes.find(x=>x.name===r.party&&!x.fixed);
        return{date:r.date,mode:(r.x&&r.x.mode)||'Auto',route:known?known.id:'others',routeOther:known?'':(r.party||''),fare:rs(r.amountP),notes:r.notes||''};},
       build:v=>{const rt=S.routes.find(x=>x.id===v.route);const name=v.route==='others'?v.routeOther.trim():(rt?rt.name:'');
        return{cat:'cab',sub:v.mode.toLowerCase(),date:v.date,amountP:parseMoney(v.fare),party:name,notes:v.notes.trim(),x:{mode:v.mode,routeId:v.route}};},
       check:v=>!S.routes.some(x=>x.id===v.route)?{route:'Choose a route.'}:(v.route==='others'&&!v.routeOther.trim()?{routeOther:'Enter the route name.'}:{})};
    }
    case 'toll':return{cat:'travel',title:p.id?'Edit toll charge':'Add toll charge',save:'Save toll charge',
      fields:[{k:'date',t:'date',l:'Date'},{k:'route',t:'text',l:'Toll plaza or route',opt:1},{k:'vehicle',t:'text',l:'Vehicle',opt:1},{k:'amount',t:'money',l:'Toll amount'},
       {k:'method',t:'select',l:'Payment method',opt:1,opts:['Cash','FASTag','UPI','Card','Other']},{k:'notes',t:'area',l:'Notes',opt:1}],
      init:()=>({date:defDate(p),route:'',vehicle:'',amount:'',method:'',notes:''}),
      fill:r=>({date:r.date,route:r.party||'',vehicle:(r.x&&r.x.vehicle)||'',amount:rs(r.amountP),method:(r.x&&r.x.method)||'',notes:r.notes||''}),
      build:v=>({cat:'travel',sub:'toll',date:v.date,party:v.route.trim(),amountP:parseMoney(v.amount),notes:v.notes.trim(),x:{vehicle:v.vehicle.trim(),method:v.method}})};
    case 'distance':return{cat:'travel',store:'dist',title:p.id?'Edit journey':'Add journey',save:'Save journey',
      fields:[{k:'date',t:'date',l:'Date'},{k:'from',t:'text',l:'Starting location',opt:1},{k:'to',t:'text',l:'Destination',opt:1},{k:'km',t:'qty',l:'Distance travelled',sfx:'km',req:1},{k:'purpose',t:'area',l:'Purpose or notes',opt:1}],
      init:()=>({date:defDate(p),from:'',to:'',km:'',purpose:''}),
      fill:r=>({date:r.date,from:r.from||'',to:r.to||'',km:qtyStr(r.kmM),purpose:r.purpose||''}),
      build:v=>({date:v.date,from:v.from.trim(),to:v.to.trim(),kmM:parseQty(v.km),purpose:v.purpose.trim()})};
    case 'house':return{cat:'electricity',store:'houses',title:p.id?'Edit house':'Add house',save:'Save house',
      fields:[{k:'name',t:'text',l:'House name',ph:'e.g. Main home, Flat 4B',req:1},{k:'addr',t:'text',l:'Address or area',opt:1},{k:'meter',t:'text',l:'Consumer or meter number',opt:1}].concat(p.utility?[]:[{k:'rentDir',t:'radio',l:'Rent type',opts:[['paid','Paying','Rent paid to a landlord'],['received','Receiving','Rent collected from a tenant']]},{k:'rentAmount',t:'money',l:'Monthly rent',req:1,show:v=>v.rentDir==='paid'},{k:'dueBy',t:'select',l:'Payment Due By',opts:[['first','1st of every month'],['seventh','7th of every month'],['custom','Custom']],show:v=>v.rentDir==='paid'},{k:'dueDay',t:'number',min:1,max:31,l:'Day of every month',ph:'e.g. 12',show:v=>v.rentDir==='paid'&&v.dueBy==='custom'},{k:'tenants',t:'tenantRoster',l:'Tenant details',show:v=>v.rentDir==='received',hint:()=> 'Add agreement dates, monthly rent and the payment due day for each tenant.'}]),
      init:()=>({name:'',rentDir:'paid',addr:'',meter:'',rentAmount:'',dueBy:'first',dueDay:'',tenants:[emptyTenant()]}),
      fill:r=>({name:r.name,rentDir:houseRentDir(r),addr:r.addr||'',meter:r.meter||'',rentAmount:Number.isInteger(r.rentAmountP)?rs(r.rentAmountP):'',dueBy:['first','seventh','custom'].includes(r.dueBy)?r.dueBy:'first',dueDay:r.dueDay||'',tenants:tenantProfiles(r).map(t=>({name:t.name,agStart:t.agStart,agEnd:t.agEnd,rentAmount:t.rentAmountP==null?'':rs(t.rentAmountP),dueBy:t.dueBy,dueDay:t.dueDay||''})).concat(tenantProfiles(r).length?[]:[emptyTenant()])}),
      build:v=>({name:v.name.trim(),rentDir:v.rentDir,addr:v.addr.trim(),meter:v.meter.trim(),rentAmountP:v.rentDir==='paid'?parseMoney(v.rentAmount):null,dueBy:v.rentDir==='paid'?v.dueBy:'first',dueDay:v.rentDir==='paid'&&v.dueBy==='custom'?Number(v.dueDay):null,tenants:Array.isArray(v.tenants)?v.tenants.filter(t=>t.name.trim()).map(t=>({name:t.name.trim(),agStart:t.agStart,agEnd:t.agEnd,rentAmountP:parseMoney(t.rentAmount),dueBy:t.dueBy||'first',dueDay:t.dueBy==='custom'?Number(t.dueDay):null})):[]}),
      check:v=>{
        const errors={};
        if(S.houses.some(h=>h.id!==F.id&&h.name.toLowerCase()===v.name.trim().toLowerCase()))errors.name='You already have a house with this name.';
        if(!p.utility&&v.rentDir==='paid'&&v.dueBy==='custom'&&(!/^\d+$/.test(String(v.dueDay||''))||Number(v.dueDay)<1||Number(v.dueDay)>31))errors.dueDay='Enter a day from 1 to 31.';
        const tenants=v.rentDir==='received'?v.tenants.filter(t=>t.name.trim()):[];
        if(tenants.length>100)errors.tenants='A house can have up to 100 tenants.';
        else if(tenants.some(t=>t.name.trim().length>80))errors.tenants='Each tenant name must be 80 characters or fewer.';
        if(tenants.some(t=>t.rentAmount&&(parseMoney(t.rentAmount)==null||parseMoney(t.rentAmount)<=0||parseMoney(t.rentAmount)>MAX_MONEY)))errors.tenants='Enter a valid monthly rent amount for each tenant.';
        if(tenants.some(t=>t.dueBy==='custom'&&(!/^\d+$/.test(String(t.dueDay||''))||Number(t.dueDay)<1||Number(t.dueDay)>31)))errors.tenants='Enter a custom payment due day from 1 to 31 for each tenant.';
        if(v.rentDir==='paid'&&v.rentAmount&&(parseMoney(v.rentAmount)==null||parseMoney(v.rentAmount)<=0||parseMoney(v.rentAmount)>MAX_MONEY))errors.rentAmount='Enter a valid monthly rent amount.';
        if(v.rentDir==='paid'&&v.dueBy==='custom'&&(!/^\d+$/.test(String(v.dueDay||''))||Number(v.dueDay)<1||Number(v.dueDay)>31))errors.dueDay='Enter a day from 1 to 31.';
        if(tenants.some(t=>t.agStart&&!validDate(t.agStart)||t.agEnd&&!validDate(t.agEnd)||t.agStart&&t.agEnd&&t.agEnd<=t.agStart))errors.tenants='Check the tenant agreement dates.';
        const names=tenants.map(t=>t.name.trim().toLowerCase());
        if(names.some((n,i)=>names.indexOf(n)!==i))errors.tenants='Tenant names must be unique within a house.';
        const partial=v.rentDir==='received'?v.tenants.find(t=>!t.name.trim()&&(t.agStart||t.agEnd||t.rentAmount)):null;
        if(partial)errors.tenants='Enter a tenant name or clear the incomplete tenant details.';
        return errors;
      }};
    case 'bill':return{cat:c.id,title:(p.id?'Edit ':'Add ')+c.name.toLowerCase(),save:'Save bill',
      fields:(c.id==='electricity'||c.id==='waterbill'?[{k:'houseId',t:'hsel',l:'House'}]:[]).concat([{k:'period',t:'month',l:'Billing month'},{k:'date',t:'date',l:'Payment or bill date'},{k:'amount',t:'money',l:'Bill amount'},
       {k:'party',t:'text',l:c.id==='electricity'?'Provider':'Provider or meter number',opt:1},{k:'due',t:'date',l:'Due date',opt:1},{k:'paid',t:'switch',l:'Paid',hint:payHint},{k:'notes',t:'area',l:'Notes',opt:1}]),
      init:()=>({houseId:p.houseId||(c.id==='electricity'&&houseOf(UI.eh)?UI.eh:c.id==='waterbill'&&houseOf(UI.wbh)?UI.wbh:(S.houses.length===1?S.houses[0].id:'')),period:S.mon,date:defDate(p),amount:'',party:'',due:'',paid:false,notes:''}),
      fill:r=>({houseId:r.houseId||'',period:r.period||r.date.slice(0,7),date:r.date,amount:rs(r.amountP),party:r.party||'',due:(r.x&&r.x.due)||'',paid:r.status!=='due',notes:r.notes||''}),
      build:v=>Object.assign({cat:c.id,date:v.date,period:v.period,amountP:parseMoney(v.amount),party:v.party.trim(),status:v.paid?'paid':'due',notes:v.notes.trim(),x:{due:v.due}},c.id==='electricity'||c.id==='waterbill'?{houseId:v.houseId}:{}),
      dup:rec=>{const byHouse=c.id==='electricity'||c.id==='waterbill',o=S.records.find(r=>r.cat===c.id&&r.id!==rec.id&&r.period===rec.period&&(!byHouse||r.houseId===rec.houseId));return o?'A '+c.name.toLowerCase()+(byHouse&&houseOf(rec.houseId)?' for '+houseOf(rec.houseId).name:'')+' for '+monLabel(rec.period)+' is already saved ('+fmt(o.amountP)+'). You can still save this one.':'';}};
    case 'rent':{const pd=(p.dir||'paid')==='paid',period=p.pre&&p.pre.period||S.mon;
      const prior=S.records.filter(r=>r.cat==='rent'&&r.dir===(pd?'paid':'received')).sort((x,y)=>x.date<y.date?1:x.date>y.date?-1:(y.ts||0)-(x.ts||0))[0];
      const dirHouses=S.houses.filter(h=>houseRentDir(h)===(pd?'paid':'received'));
      const houseId=p.houseId|| (prior?(houseOf(prior.houseId)?prior.houseId:(S.houses.find(h=>h.name.trim().toLowerCase()===(prior.party||'').trim().toLowerCase())||{}).id||''):(dirHouses.length===1?dirHouses[0].id:''));
      const initialHouse=houseOf(houseId),initialTenant=tenantProfiles(initialHouse).find(t=>t.name===p.tenant);
      const lastForEntity=S.records.filter(r=>r.cat==='rent'&&r.dir===(pd?'paid':'received')&&r.houseId===houseId&&(pd||r.tenant===p.tenant)).sort((x,y)=>x.date<y.date?1:x.date>y.date?-1:(y.ts||0)-(x.ts||0))[0];
      const dueSource=initialTenant||initialHouse||{};
      return{cat:'rent',title:(p.id?'Edit rent ':'Log rent ')+(pd?'paid':'received'),save:pd?'Save rent paid':'Save rent received',
      fields:[{k:'period',t:'month',l:'Rent for month'},{k:'date',t:'date',l:pd?'Paid on':'Received on',show:v=>pd?!!v.paid||!!p.id||!!p.pre:!!v.paid||!!p.id||!!p.pre},{k:'amount',t:'money',l:'Amount'},
       {k:'houseId',t:'houseRadio',l:'House',filter:h=>houseRentDir(h)===(pd?'paid':'received')},
       {k:'tenantInfo',t:'info',l:'Tenant',value:v=>v.tenant||'',show:v=>!pd&&!!v.tenant},
       {k:'dueBy',t:'select',l:'Payment Due By',opts:[['first','1st of every month'],['seventh','7th of every month'],['custom','Custom']]},
       {k:'dueDay',t:'number',min:1,max:31,l:'Day of every month',ph:'e.g. 12',show:v=>v.dueBy==='custom'},
       {k:'method',t:'select',l:'Payment method',opt:1,opts:['Cash','UPI','Bank transfer','Cheque','Other']},
       {k:'agStart',t:'date',l:'Agreement start date',opt:1},{k:'agEnd',t:'date',l:'Agreement end date',opt:1,hint:agHint},{k:'paid',t:'switch',l:pd?'Paid':'Received',hint:v=>v.paid?(pd?'Shown as Paid and counted in this month’s spending.':'Shown as Received. Rent received is income and is not counted as spending.'):(pd?'Shown as Due. It is not counted in spending until you check Paid.':'Shown as Due. Check Received when the tenant has paid.')},{k:'notes',t:'area',l:'Notes',opt:1}],
      init:()=>({period:period,date:p.pre&&p.pre.date||defDate(p),amount:p.pre&&p.pre.amount|| (initialTenant&&initialTenant.rentAmountP?rs(initialTenant.rentAmountP):initialHouse&&initialHouse.rentAmountP?rs(initialHouse.rentAmountP):lastForEntity?rs(lastForEntity.amountP):''),houseId:houseId,tenant:p.tenant||p.pre&&p.pre.tenant||'',dueBy:dueSource.dueBy||'first',dueDay:dueSource.dueDay||'',addHouse:false,newTenants:[emptyTenant()],houseDir:pd?'paid':'received',houseName:'',houseAddr:'',houseMeter:'',houseRentAmount:'',houseDueBy:'first',houseDueDay:'',method:'',agStart:initialTenant&&initialTenant.agStart||lastAg(pd).s,agEnd:initialTenant&&initialTenant.agEnd||lastAg(pd).e,paid:p.pre&&p.pre.paid===true,notes:''}),
      fill:r=>{const h=houseOf(r.houseId),match=h||S.houses.find(x=>x.name.trim().toLowerCase()===(r.party||'').trim().toLowerCase());
        const profile=tenantProfiles(match).find(t=>t.name===r.tenant);
        return{period:r.period||r.date.slice(0,7),date:r.date,amount:rs(r.amountP),houseId:match?match.id:'',tenant:r.tenant||'',dueBy:r.x&&r.x.dueBy||profile&&profile.dueBy||match&&match.dueBy||'first',dueDay:r.x&&r.x.dueDay||profile&&profile.dueDay||match&&match.dueDay||'',addHouse:!match&&!!r.party,newTenants:[emptyTenant()],houseDir:pd?'paid':'received',houseName:!match?(r.party||''):'',houseAddr:'',houseMeter:'',houseRentAmount:'',houseDueBy:'first',houseDueDay:'',method:(r.x&&r.x.method)||'',agStart:(r.x&&r.x.agStart)||'',agEnd:(r.x&&r.x.agEnd)||'',paid:r.status!=='due',notes:r.notes||''};},
      build:v=>{const house=houseOf(v.houseId),profiles=v.addHouse?(v.newTenants||[]):tenantProfiles(house),tenant=profiles.find(t=>t.name===v.tenant);
        return{cat:'rent',dir:pd?'paid':'received',date:v.date||v.period+'-01',period:v.period,amountP:parseMoney(v.amount),houseId:v.houseId,party:v.addHouse?v.houseName.trim():(house?house.name:''),tenant:pd?'':v.tenant.trim(),status:v.paid?'paid':'due',notes:v.notes.trim(),x:{method:v.method,agStart:tenant&&tenant.agStart||v.agStart,agEnd:tenant&&tenant.agEnd||v.agEnd,dueBy:v.dueBy,dueDay:v.dueBy==='custom'?Number(v.dueDay):null}};},
      check:v=>{
        const errors={};
        if(v.addHouse){
          const name=v.houseName.trim();
          if(!name)errors.houseName='Enter a house name.';
          else if(S.houses.some(h=>h.name.trim().toLowerCase()===name.toLowerCase()))errors.houseName='A house with this name already exists. Select it from the list.';
          if(v.houseDir!==(pd?'paid':'received'))errors.houseId='Choose '+(pd?'Paying Rent':'Receiving Rent')+' for this rent log.';
          if(pd&&(parseMoney(v.houseRentAmount)==null||parseMoney(v.houseRentAmount)<=0||parseMoney(v.houseRentAmount)>MAX_MONEY))errors.houseRentAmount='Enter a valid monthly rent amount.';
          if(pd&&v.houseDueBy==='custom'&&(!/^\d+$/.test(String(v.houseDueDay||''))||Number(v.houseDueDay)<1||Number(v.houseDueDay)>31))errors.houseDueDay='Enter a day from 1 to 31.';
        }else if(!houseOf(v.houseId))errors.houseId='Choose a house or add a new one.';
        const profiles=v.addHouse?(v.newTenants||[]).filter(t=>t.name.trim()):tenantProfiles(houseOf(v.houseId));
        if(!pd&&v.addHouse&&!v.tenant&&profiles.length)v.tenant=profiles[0].name;
        if(!pd&&!profiles.some(t=>t.name===v.tenant))errors.houseId=profiles.length?'Open a tenant card to log rent for that tenant.':'Add tenant details to this receiving-rent house first.';
        if(!pd&&v.addHouse){
          const names=profiles.map(t=>t.name.trim().toLowerCase());
          if(v.newTenants.some(t=>!t.name.trim()&&(t.agStart||t.agEnd||t.rentAmount)))errors.newTenants='Enter a tenant name or clear the incomplete tenant details.';
          else if(names.some((n,i)=>names.indexOf(n)!==i))errors.newTenants='Tenant names must be unique within a house.';
          else if(profiles.some(t=>t.rentAmount&&(parseMoney(t.rentAmount)==null||parseMoney(t.rentAmount)<=0||parseMoney(t.rentAmount)>MAX_MONEY)))errors.newTenants='Enter a valid monthly rent amount for each tenant.';
          else if(profiles.some(t=>t.agStart&&!validDate(t.agStart)||t.agEnd&&!validDate(t.agEnd)||t.agStart&&t.agEnd&&t.agEnd<=t.agStart))errors.newTenants='Check the tenant agreement dates.';
          else if(profiles.some(t=>t.dueBy==='custom'&&(!/^\d+$/.test(String(t.dueDay||''))||Number(t.dueDay)<1||Number(t.dueDay)>31)))errors.newTenants='Enter a custom payment due day from 1 to 31 for each tenant.';
        }
        if(v.agStart&&v.agEnd&&v.agEnd<=v.agStart)errors.agEnd='The end date must be after the start date.';
        if(!['first','seventh','custom'].includes(v.dueBy))errors.dueBy='Choose a payment due day.';
        if(v.dueBy==='custom'&&(!/^\d+$/.test(String(v.dueDay||''))||Number(v.dueDay)<1||Number(v.dueDay)>31))errors.dueDay='Enter a day from 1 to 31.';
        return errors;
      },
      dup:rec=>{const o=S.records.find(r=>r.cat==='rent'&&r.dir===rec.dir&&r.id!==rec.id&&r.period===rec.period&&(pd||(r.tenant||'').trim().toLowerCase()===(rec.tenant||'').trim().toLowerCase())&&(rec.houseId?r.houseId===rec.houseId||(!r.houseId&&(r.party||'').trim().toLowerCase()===rec.party.toLowerCase()):(r.party||'').trim().toLowerCase()===rec.party.toLowerCase()));return o?'Rent '+(pd?'paid':'received')+' for '+monLabel(rec.period)+(rec.party?' ('+rec.party+(rec.tenant?' · '+rec.tenant:'')+')':'')+' is already logged ('+fmt(o.amountP)+'). You can still save this one.':'';}};}
    default:return{cat:c.id||'other',title:(p.id?'Edit ':'Add ')+(c.name||'expense').toLowerCase(),save:'Save expense',
      fields:[{k:'date',t:'date',l:'Date'},{k:'title',t:'text',l:'What was it for?',ph:'Short description',opt:1},{k:'amount',t:'money',l:'Amount'},{k:'notes',t:'area',l:'Notes',opt:1}],
      init:()=>({date:defDate(p),title:'',amount:'',notes:''}),
      fill:r=>({date:r.date,title:r.title||'',amount:rs(r.amountP),notes:r.notes||''}),
      build:v=>({cat:c.id||'other',date:v.date,title:v.title.trim(),amountP:parseMoney(v.amount),notes:v.notes.trim()})};
  }
}
export function openEntry(p){
  const sp=getSpec(p);const arr=sp.store==='dist'?S.dist:sp.store==='houses'?S.houses:S.records;
  const rec=p.id?arr.find(r=>r.id===p.id):null;
  F={sp:sp,p:p,id:rec?rec.id:uid(),vals:rec?sp.fill(rec):sp.init(),manual:false,saving:false,dupAck:false,unitTouched:!!rec};
  if(rec&&sp.manualOf)F.manual=sp.manualOf(rec);
  if(p.pre&&!rec)Object.assign(F.vals,p.pre);
  go('entry',p);
}
export function entryFor(c){return c.kind==='groceries'?{spec:'groceries'}:c.kind==='unit'?{spec:'unit',cat:c.id}:c.kind==='bill'?{spec:'bill',cat:c.id}:{spec:'simple',cat:c.id};}
export function editParams(r){const c=catOf(r.cat)||{};let s='simple';
  if(r.cat==='water')s='water';else if(r.cat==='travel')s=r.sub==='fuel'?'fuel':r.sub==='toll'?'toll':'simple';
  else if(r.cat==='cab')s='cab';
  else if(c.kind==='unit')s='unit';else if(c.kind==='bill')s='bill';else if(c.kind==='rent')s='rent';else if(c.kind==='groceries')s='groceries';
  return{spec:s,cat:r.cat,id:r.id,dir:r.dir};}

/* form logic */
export function recalc(){
  if(!F)return;const sp=F.sp,v=F.vals;if(!sp.calc)return;
  const on=!sp.calcIf||sp.calcIf(v),q=parseQty(v.qty),u=parseMoney(v.unit);
  if(on&&!F.manual)v.total=(q&&u)?rs(mul(q,u)):'';
  const ti=$('#f_total');if(ti){if(document.activeElement!==ti)ti.value=v.total||'';ti.readOnly=on&&!F.manual;ti.placeholder='0';}
  const fm=$('#formula');if(fm)fm.textContent=on?((q&&u)?fmt(u)+' × '+qtyStr(q)+' = '+fmt(mul(q,u)):'Enter quantity and price'):'Enter the total amount';
  const nt=$('#calcNote');if(nt)nt.textContent=!on?'':(F.manual?'Entered manually':'Calculated automatically');
  const el=$('#editLink');if(el){el.hidden=!(on&&sp.edit==='toggle');el.textContent=F.manual?'Use calculated total':'Edit total';}
}
export function syncShow(){
  if(!F)return;F.sp.fields.forEach(f=>{const el=$('.fld[data-fk="'+f.k+'"]');if(el&&f.show)el.hidden=!f.show(F.vals);});
  F.sp.fields.forEach(f=>{if(f.hint){const h=$('#hint_'+f.k);if(h)h.textContent=f.hint(F.vals);}});
}
export function onField(el){
  if(!F)return;const k=el.dataset.f,v=F.vals;
  if(el.dataset.tenantGroup){
    const rows=el.dataset.tenantGroup==='tenants'?v.tenants:v.newTenants,index=+el.dataset.tenantIndex;
    if(rows&&rows[index])rows[index][el.dataset.tenantKey]=el.value;
    const err=$('[data-err="tenant_'+el.dataset.tenantGroup+'_'+index+'"]');if(err)err.textContent='';
    if(el.dataset.tenantKey==='dueBy'){draw(true);return;}
    if(el.dataset.tenantKey==='name'){
      const picker=$('#f_tenant'),house=houseOf(v.houseId),profiles=v.addHouse?(v.newTenants||[]).filter(t=>t.name.trim()):tenantProfiles(house);
      if(picker)picker.firstElementChild.textContent=profiles.some(t=>t.name===v.tenant)?v.tenant:'Choose a tenant';
    }
    return;
  }
  v[k]=el.type==='checkbox'?el.checked:el.value;
  if(k==='tenant'&&F.sp.cat==='rent'&&!F.p.id)applyTenant(v.tenant);
  if(k==='total'&&!el.readOnly)F.manual=true;
  if(k==='unit')F.unitTouched=true;
  if(k==='date'&&F.sp.unitDate&&!F.unitTouched&&validDate(v.date)){const pr=priceOn(F.sp.cat,v.date);if(pr!=null){v.unit=rs(pr);const ui=$('#f_unit');if(ui)ui.value=v.unit;}}
  const ro=$('#ro_'+k);if(ro){const f=F.sp.fields.find(x=>x.k===k);ro.textContent=f.t==='date'?fmtDate(v[k]):(validMonth(v[k])?monShort(v[k]):'');}
  const fl=el.closest('.fld');if(fl){fl.classList.remove('bad');const e=$('[data-err]',fl);if(e)e.textContent='';}
  if(k==='houseDir'){const e=$('[data-err="houseId"]');if(e){e.textContent='';const f=e.closest('.fld');if(f)f.classList.remove('bad');}}
  recalc();syncShow();
  if(k==='houseId'&&F.sp.cat==='rent'){
    const house=houseOf(v.houseId),profiles=tenantProfiles(house);
    v.tenant=F.sp.p.tenant&&profiles.some(t=>t.name===F.sp.p.tenant)?F.sp.p.tenant:(profiles.length===1?profiles[0].name:'');
    const source=profiles.find(t=>t.name===v.tenant)||house||{};
    v.dueBy=source.dueBy||'first';v.dueDay=source.dueDay||'';
    const last=house&&S.records.filter(r=>r.cat==='rent'&&r.dir===F.sp.p.dir&&r.houseId===house.id&&(F.sp.p.dir==='paid'||r.tenant===v.tenant)).sort((a,b)=>a.date<b.date?1:-1)[0];
    const amount=source.rentAmountP||last&&last.amountP;
    v.amount=amount?rs(amount):'';
    v.agStart=source.agStart||'';v.agEnd=source.agEnd||'';
    draw(true);
  }
  if(k==='houseDir'&&F.sp.cat==='rent'&&F.vals.addHouse)draw(true);
  if(k==='houseDueBy'&&F.sp.cat==='rent'&&F.vals.addHouse)draw(true);
}
function applyTenant(name){
  if(!F)return;
  const v=F.vals;v.tenant=name;
  if(F.sp.cat!=='rent'||F.p.id)return;
  const house=v.addHouse?null:houseOf(v.houseId),profiles=v.addHouse?v.newTenants:tenantProfiles(house);
  const tenant=profiles.find(t=>t.name===name);
  if(!tenant)return;
  v.amount=v.addHouse?(tenant.rentAmount||''):(tenant.rentAmountP==null?'':rs(tenant.rentAmountP));
  v.agStart=tenant.agStart||'';v.agEnd=tenant.agEnd||'';
  const amount=$('#f_amount'),start=$('#f_agStart'),end=$('#f_agEnd');
  if(amount)amount.value=v.amount;if(start)start.value=v.agStart;if(end)end.value=v.agEnd;
}
export function validate(){
  const sp=F.sp,v=F.vals,e={};
  sp.fields.forEach(f=>{
    if(f.show&&!f.show(v))return;const val=v[f.k];
    if(f.t==='date'){if(f.opt&&!val)return;if(!validDate(val))e[f.k]='Enter a valid date.';}
    else if(f.t==='month'){if(!validMonth(val))e[f.k]='Choose a month.';}
    else if(f.t==='money'&&f.k!=='unit'){const m=parseMoney(val);if(f.opt&&!val)return;if(m==null||m<=0)e[f.k]='Enter an amount above 0, with up to 2 decimals.';else if(m>MAX_MONEY)e[f.k]='That amount looks too large.';}
    else if(f.t==='money'){const m=parseMoney(val);if(m==null||m<=0)e[f.k]='Enter a price above 0, with up to 2 decimals.';else if(m>MAX_UNIT)e[f.k]='That price looks too large.';}
    else if(f.t==='qty'){const q=parseQty(val);if(q==null||q<=0)e[f.k]='Enter a quantity above 0 (up to 3 decimals).';else if(q>MAX_QTY)e[f.k]='That quantity looks too large.';}
    else if(f.t==='hsel'){if(!houseOf(val))e[f.k]='Choose a house.';}
    else if((f.t==='text'||f.t==='tenant'||f.t==='tenantSelect')&&f.req&&!String(val||'').trim())e[f.k]='This field is required.';
  });
  if(sp.calc&&(!sp.calcIf||sp.calcIf(v)||true)){
    const needTotal=!sp.calcIf||!sp.calcIf(v)||F.manual||sp.edit==='toggle';
    const m=parseMoney(v.total);if((!sp.calcIf||!sp.calcIf(v)||F.manual)&&(m==null||m<=0))e.total='Enter a total above 0.';
  }
  if(sp.check)Object.assign(e,sp.check(v));
  return e;
}
export function showErrors(e){
  $$('.fld').forEach(f=>f.classList.remove('bad'));$$('[data-err]').forEach(x=>x.textContent='');
  let first=null;
  Object.keys(e).forEach(k=>{const el=$('[data-err="'+k+'"]');if(el){el.textContent=e[k];const f=el.closest('.fld');if(f)f.classList.add('bad');if(!first)first=f;}});
  if(first){first.scrollIntoView({block:'center'});const i=$('input,select,textarea,button.tenant-picker',first);if(i)try{i.focus({preventScroll:true});}catch(x){}}
}
export function upsert(a,o){const i=a.findIndex(x=>x.id===o.id);if(i>=0)a[i]=o;else a.push(o);}
export function saveForm(){
  if(!F||F.saving)return;const sp=F.sp,v=F.vals;
  const e=validate();showErrors(e);if(Object.keys(e).length){toast('Check the highlighted fields','bad');return;}
  if(v.date&&sp.fields.some(f=>f.k==='date')&&!validDate(v.date)){return;}
  const base=sp.build(v);
  const old=(sp.store==='dist'?S.dist:sp.store==='houses'?S.houses:S.records).find(x=>x.id===F.id),rec=Object.assign({id:F.id,ts:(old&&old.ts)?old.ts:Date.now()},base);if(old)rec.es=Date.now();
  if(sp.dup&&!F.dupAck){const m=sp.dup(rec);if(m){F.dupAck=true;const w=$('#warn');w.textContent=m;w.hidden=false;$('#saveBtn').lastChild.textContent='Save anyway';w.scrollIntoView({block:'center'});return;}}
  if(sp.cat==='rent'&&v.addHouse){
    const h={id:uid(),name:v.houseName.trim(),rentDir:v.houseDir,addr:v.houseAddr.trim(),meter:v.houseMeter.trim(),rentAmountP:v.houseDir==='paid'?parseMoney(v.houseRentAmount):null,dueBy:v.houseDir==='paid'?v.houseDueBy:'first',dueDay:v.houseDir==='paid'&&v.houseDueBy==='custom'?Number(v.houseDueDay):null,tenants:v.houseDir==='received'?(v.newTenants||[]).filter(t=>t.name.trim()).map(t=>({name:t.name.trim(),agStart:t.agStart,agEnd:t.agEnd,rentAmountP:parseMoney(t.rentAmount),dueBy:t.dueBy||'first',dueDay:t.dueBy==='custom'?Number(t.dueDay):null})):[]};
    S.houses.push(h);base.houseId=h.id;base.party=h.name;rec.houseId=h.id;rec.party=h.name;
  }
  F.saving=true;const b=$('#saveBtn');if(b)b.disabled=true;
  upsert(sp.store==='dist'?S.dist:sp.store==='houses'?S.houses:S.records,rec);
  if(sp.cat==='rent'){
    const house=houseOf(rec.houseId);
    if(house){
      if(rec.dir==='paid'){if(!Number.isInteger(house.rentAmountP))house.rentAmountP=rec.amountP;house.dueBy=v.dueBy;house.dueDay=v.dueBy==='custom'?Number(v.dueDay):null;}
      else{
        const tenants=Array.isArray(house.tenants)?house.tenants:[];
        const index=tenants.findIndex(t=>(typeof t==='string'?t:t&&t.name)===rec.tenant);
        if(index>=0){const profile=typeof tenants[index]==='string'?{name:tenants[index],agStart:'',agEnd:'',rentAmountP:null}:tenants[index];house.tenants[index]=Object.assign({},profile,{rentAmountP:Number.isInteger(profile.rentAmountP)?profile.rentAmountP:rec.amountP,dueBy:v.dueBy,dueDay:v.dueBy==='custom'?Number(v.dueDay):null});}
      }
    }
  }
  if(sp.after)sp.after(rec,v);
  persist();const wasWater=sp.cat==='water',wasRent=sp.cat==='rent';F=null;
  stack.pop();
  if(wasWater){UI.wTab='hist';S.mon=recMonth(rec);}
  if(wasRent||(sp.cat==='electricity'&&rec.period)){S.mon=recMonth(rec);}
  draw();toast('Saved');
}

Object.assign(A,{
 saveForm:saveForm,
 tenantPicker:()=>{if(!F)return;const v=F.vals,house=houseOf(v.houseId),profiles=v.addHouse?(v.newTenants||[]).filter(t=>t.name.trim()):tenantProfiles(house);sheet('<h2>Choose a tenant</h2>'+tenantOptions(profiles,v.tenant,'tenantPick'));},
 tenantPick:el=>{if(!F)return;applyTenant(el.dataset.value||'');closeL();draw(true);},
 tenantAdd:el=>{if(!F)return;const group=el.dataset.group,rows=group==='tenants'?F.vals.tenants:F.vals.newTenants;if(rows&&rows.length<100){rows.push(emptyTenant());draw(true);}},
 tenantRemove:el=>{if(!F)return;const group=el.dataset.group,rows=group==='tenants'?F.vals.tenants:F.vals.newTenants;if(rows&&rows.length>1){rows.splice(+el.dataset.index,1);draw(true);}},
 seg:el=>{if(!F)return;F.vals[el.dataset.k]=el.dataset.v;const f=F.sp.fields.find(x=>x.k===el.dataset.k),old=el.closest('.fld');old.outerHTML=fieldHtml(f);recalc();syncShow();},
 step:el=>{if(!F)return;const k=el.dataset.k,cur=parseQty(F.vals[k])||0;let n=Math.max(1,Math.round(cur/1000)+(+el.dataset.d));n=Math.min(n,10000);F.vals[k]=String(n);const i=$('#f_'+k);i.value=F.vals[k];onField(i);},
 editTotal:()=>{if(!F)return;F.manual=!F.manual;recalc();if(F.manual){const t=$('#f_total');t.focus();t.select();}}
});
