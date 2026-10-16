/* @auto-imports */
import {curMonth,fmtDate,leftInfo,monLabel,monShort,today,validDate,validMonth} from '../core/dates.js';
import {MAX_MONEY,MAX_QTY,MAX_UNIT,fmt,mul,parseMoney,parseQty,qtyStr,rs} from '../core/money.js';
import {priceOn,recMonth,setPrice} from '../core/rules.js';
import {$,$$,esc,uid} from '../core/util.js';
import {S,UI,catOf,houseOf,persist} from '../data/state.js';
import {empty,hd} from './components.js';
import {ic} from './icons.js';
import {draw,go,stack,toast} from './nav.js';
import {A,V} from './registry.js';
/* @end-imports */
export let F=null;
export function getF(){return F;}
export function clearF(){F=null;}
/* entry form */
export function fieldHtml(f){
  const v=F.vals,k=f.k,id='f_'+k,val=v[k]==null?'':v[k];
  const show=!f.show||f.show(v);
  const ro=(f.t==='date'||f.t==='month')?'<span class="ro" id="ro_'+k+'">'+(f.t==='date'?fmtDate(val):(validMonth(val)?monShort(val):''))+'</span>':'';
  const lab=f.l&&f.t!=='switch'&&f.t!=='seg'&&f.t!=='calc'?'<label for="'+id+'">'+f.l+(f.opt?'<small>optional</small>':'')+ro+'</label>':(f.t==='seg'?'<div class="lb">'+f.l+'</div>':'');
  let inner='';
  switch(f.t){
    case 'date':inner='<input id="'+id+'" type="date" data-f="'+k+'" value="'+esc(val)+'" min="2000-01-01" max="2100-12-31">';break;
    case 'month':inner='<input id="'+id+'" type="month" data-f="'+k+'" value="'+esc(val)+'" min="2000-01" max="2100-12">';break;
    case 'text':inner='<input id="'+id+'" type="text" data-f="'+k+'" value="'+esc(val)+'" maxlength="80" autocomplete="off" placeholder="'+esc(f.ph||'')+'">';break;
    case 'area':inner='<textarea id="'+id+'" data-f="'+k+'" maxlength="200" placeholder="'+esc(f.ph||'')+'">'+esc(val)+'</textarea>';break;
    case 'money':inner='<div class="pre"><span>₹</span><input id="'+id+'" inputmode="decimal" data-f="'+k+'" value="'+esc(val)+'" placeholder="0" autocomplete="off"></div>';break;
    case 'qty':inner='<div class="qty">'+(f.step?'<button type="button" class="ib" data-act="step" data-k="'+k+'" data-d="-1" aria-label="Decrease">−</button>':'')+'<div class="pre"><input id="'+id+'" inputmode="decimal" data-f="'+k+'" value="'+esc(val)+'" placeholder="0" autocomplete="off"><span class="sfx" style="font:500 13px var(--fb)">'+esc(typeof f.sfx==='function'?f.sfx(v):(f.sfx||''))+'</span></div>'+(f.step?'<button type="button" class="ib" data-act="step" data-k="'+k+'" data-d="1" aria-label="Increase">+</button>':'')+'</div>';break;
    case 'select':inner='<select id="'+id+'" data-f="'+k+'"><option value="">Not specified</option>'+f.opts.map(o=>'<option'+(o===val?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>';break;
    case 'hsel':inner='<select id="'+id+'" data-f="'+k+'"><option value="">Choose a house</option>'+S.houses.map(h=>'<option value="'+esc(h.id)+'"'+(h.id===val?' selected':'')+'>'+esc(h.name)+'</option>').join('')+'</select>';break;
    case 'seg':inner='<div class="seg" role="radiogroup" aria-label="'+esc(f.l)+'">'+f.opts.map(o=>'<button type="button" role="radio" aria-checked="'+(val===o[0])+'" class="'+(val===o[0]?'on':'')+'" data-act="seg" data-k="'+k+'" data-v="'+esc(o[0])+'">'+esc(o[1])+'</button>').join('')+'</div>';break;
    case 'switch':inner='<label class="sw"><input type="checkbox" role="switch" data-f="'+k+'"'+(val?' checked':'')+'><span class="trk"></span><span>'+f.l+'</span></label>';break;
    case 'calc':inner='<div class="calc"><div class="formula" id="formula" aria-live="polite"></div><div class="pre"><span>₹</span><input id="f_total" inputmode="decimal" data-f="total" value="'+esc(val)+'" aria-label="Total amount" readonly></div><div style="display:flex;justify-content:space-between;align-items:center"><span class="sub" id="calcNote"></span><button type="button" class="link" id="editLink" data-act="editTotal" hidden></button></div></div>';break;
  }
  return '<div class="fld" data-fk="'+k+'"'+(show?'':' hidden')+'>'+lab+inner+'<p class="hint" id="hint_'+k+'">'+(f.hint?esc(f.hint(v)):'')+'</p><p class="err" data-err="'+k+'" role="alert"></p></div>';
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
      fields:[{k:'name',t:'text',l:'House name',ph:'e.g. Main home, Flat 4B',req:1},{k:'addr',t:'text',l:'Address or area',opt:1},{k:'meter',t:'text',l:'Consumer or meter number',opt:1}],
      init:()=>({name:'',addr:'',meter:''}),
      fill:r=>({name:r.name,addr:r.addr||'',meter:r.meter||''}),
      build:v=>({name:v.name.trim(),addr:v.addr.trim(),meter:v.meter.trim()}),
      check:v=>S.houses.some(h=>h.id!==F.id&&h.name.toLowerCase()===v.name.trim().toLowerCase())?{name:'You already have a house with this name.'}:{}};
    case 'bill':return{cat:c.id,title:(p.id?'Edit ':'Add ')+c.name.toLowerCase(),save:'Save bill',
      fields:(c.id==='electricity'?[{k:'houseId',t:'hsel',l:'House'}]:[]).concat([{k:'period',t:'month',l:'Billing month'},{k:'date',t:'date',l:'Payment or bill date'},{k:'amount',t:'money',l:'Bill amount'},
       {k:'party',t:'text',l:c.id==='electricity'?'Provider':'Provider or meter number',opt:1},{k:'due',t:'date',l:'Due date',opt:1},{k:'paid',t:'switch',l:'Paid',hint:payHint},{k:'notes',t:'area',l:'Notes',opt:1}]),
      init:()=>({houseId:p.houseId||(houseOf(UI.eh)?UI.eh:(S.houses.length===1?S.houses[0].id:'')),period:S.mon,date:defDate(p),amount:'',party:'',due:'',paid:false,notes:''}),
      fill:r=>({houseId:r.houseId||'',period:r.period||r.date.slice(0,7),date:r.date,amount:rs(r.amountP),party:r.party||'',due:(r.x&&r.x.due)||'',paid:r.status!=='due',notes:r.notes||''}),
      build:v=>Object.assign({cat:c.id,date:v.date,period:v.period,amountP:parseMoney(v.amount),party:v.party.trim(),status:v.paid?'paid':'due',notes:v.notes.trim(),x:{due:v.due}},c.id==='electricity'?{houseId:v.houseId}:{}),
      dup:rec=>{const o=S.records.find(r=>r.cat===c.id&&r.id!==rec.id&&r.period===rec.period&&(c.id!=='electricity'||r.houseId===rec.houseId));return o?'A '+c.name.toLowerCase()+(c.id==='electricity'&&houseOf(rec.houseId)?' for '+houseOf(rec.houseId).name:'')+' for '+monLabel(rec.period)+' is already saved ('+fmt(o.amountP)+'). You can still save this one.':'';}};
    case 'rent':{const pd=(p.dir||'paid')==='paid';
      return{cat:'rent',title:(p.id?'Edit rent ':'Log rent ')+(pd?'paid':'received'),save:pd?'Save rent paid':'Save rent received',
      fields:[{k:'period',t:'month',l:'Rent for month'},{k:'date',t:'date',l:pd?'Date paid':'Date received'},{k:'amount',t:'money',l:'Amount'},
       {k:'party',t:'text',l:pd?'Landlord or property':'Tenant or property',ph:pd?'e.g. Flat 4B':'e.g. Room 1',opt:1},
       {k:'method',t:'select',l:'Payment method',opt:1,opts:['Cash','UPI','Bank transfer','Cheque','Other']},
       {k:'agStart',t:'date',l:'Agreement start date',opt:1},{k:'agEnd',t:'date',l:'Agreement end date',opt:1,hint:agHint},{k:'paid',t:'switch',l:'Paid',hint:v=>v.paid?(pd?'Shown as Paid and counted in this month’s spending.':'Shown as Paid. Rent received is income and is not counted as spending.'):(pd?'Shown as Due. It is not counted in spending until you check Paid.':'Shown as Due. Check Paid when the tenant has paid.')},{k:'notes',t:'area',l:'Notes',opt:1}],
      init:()=>({period:S.mon,date:defDate(p),amount:'',party:'',method:'',agStart:lastAg(pd).s,agEnd:lastAg(pd).e,paid:false,notes:''}),
      fill:r=>({period:r.period||r.date.slice(0,7),date:r.date,amount:rs(r.amountP),party:r.party||'',method:(r.x&&r.x.method)||'',agStart:(r.x&&r.x.agStart)||'',agEnd:(r.x&&r.x.agEnd)||'',paid:r.status!=='due',notes:r.notes||''}),
      build:v=>({cat:'rent',dir:pd?'paid':'received',date:v.date,period:v.period,amountP:parseMoney(v.amount),party:v.party.trim(),status:v.paid?'paid':'due',notes:v.notes.trim(),x:{method:v.method,agStart:v.agStart,agEnd:v.agEnd}}),
      check:v=>(v.agStart&&v.agEnd&&v.agEnd<=v.agStart)?{agEnd:'The end date must be after the start date.'}:{},
      dup:rec=>{const o=S.records.find(r=>r.cat==='rent'&&r.dir===rec.dir&&r.id!==rec.id&&r.period===rec.period&&(r.party||'').toLowerCase()===(rec.party||'').toLowerCase());return o?'Rent '+(pd?'paid':'received')+' for '+monLabel(rec.period)+(rec.party?' ('+rec.party+')':'')+' is already logged ('+fmt(o.amountP)+'). You can still save this one.':'';}};}
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
  v[k]=el.type==='checkbox'?el.checked:el.value;
  if(k==='total'&&!el.readOnly)F.manual=true;
  if(k==='unit')F.unitTouched=true;
  if(k==='date'&&F.sp.unitDate&&!F.unitTouched&&validDate(v.date)){const pr=priceOn(F.sp.cat,v.date);if(pr!=null){v.unit=rs(pr);const ui=$('#f_unit');if(ui)ui.value=v.unit;}}
  const ro=$('#ro_'+k);if(ro){const f=F.sp.fields.find(x=>x.k===k);ro.textContent=f.t==='date'?fmtDate(v[k]):(validMonth(v[k])?monShort(v[k]):'');}
  const fl=el.closest('.fld');if(fl){fl.classList.remove('bad');const e=$('[data-err]',fl);if(e)e.textContent='';}
  recalc();syncShow();
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
    else if(f.t==='text'&&f.req&&!String(val||'').trim())e[f.k]='This field is required.';
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
  if(first){first.scrollIntoView({block:'center'});const i=$('input,select,textarea',first);if(i)try{i.focus({preventScroll:true});}catch(x){}}
}
export function upsert(a,o){const i=a.findIndex(x=>x.id===o.id);if(i>=0)a[i]=o;else a.push(o);}
export function saveForm(){
  if(!F||F.saving)return;const sp=F.sp,v=F.vals;
  const e=validate();showErrors(e);if(Object.keys(e).length){toast('Check the highlighted fields','bad');return;}
  if(v.date&&sp.fields.some(f=>f.k==='date')&&!validDate(v.date)){return;}
  const base=sp.build(v),old=(sp.store==='dist'?S.dist:sp.store==='houses'?S.houses:S.records).find(x=>x.id===F.id),rec=Object.assign({id:F.id,ts:(old&&old.ts)?old.ts:Date.now()},base);if(old)rec.es=Date.now();
  if(sp.dup&&!F.dupAck){const m=sp.dup(rec);if(m){F.dupAck=true;const w=$('#warn');w.textContent=m;w.hidden=false;$('#saveBtn').lastChild.textContent='Save anyway';w.scrollIntoView({block:'center'});return;}}
  F.saving=true;const b=$('#saveBtn');if(b)b.disabled=true;
  upsert(sp.store==='dist'?S.dist:sp.store==='houses'?S.houses:S.records,rec);
  if(sp.after)sp.after(rec,v);
  persist();const wasWater=sp.cat==='water',wasRent=sp.cat==='rent';F=null;
  stack.pop();
  if(wasWater){UI.wTab='hist';S.mon=recMonth(rec);}
  if(wasRent||(sp.cat==='electricity'&&rec.period)){S.mon=recMonth(rec);}
  draw();toast('Saved');
}

Object.assign(A,{
 saveForm:saveForm,
 seg:el=>{if(!F)return;F.vals[el.dataset.k]=el.dataset.v;const f=F.sp.fields.find(x=>x.k===el.dataset.k),old=el.closest('.fld');old.outerHTML=fieldHtml(f);recalc();syncShow();},
 step:el=>{if(!F)return;const k=el.dataset.k,cur=parseQty(F.vals[k])||0;let n=Math.max(1,Math.round(cur/1000)+(+el.dataset.d));n=Math.min(n,10000);F.vals[k]=String(n);const i=$('#f_'+k);i.value=F.vals[k];onField(i);},
 editTotal:()=>{if(!F)return;F.manual=!F.manual;recalc();if(F.manual){const t=$('#f_total');t.focus();t.select();}}
});
