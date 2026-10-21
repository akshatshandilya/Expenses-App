/* @auto-imports */
import {addMonths,curMonth,monLabel,today,validDate} from '../core/dates.js';
import {MAX_MONEY,parseMoney,rs} from '../core/money.js';
import {recMonth} from '../core/rules.js';
import {$,esc,uid} from '../core/util.js';
import {S,UI,catOf,houseOf,houseRentDir,tenantProfiles,persist} from '../data/state.js';
import {tenantOptions,tenantPicker} from './components.js';
import {openEntry} from './entry.js';
import {ic} from './icons.js';
import {closeL,draw,sheet,toast} from './nav.js';
import {A} from './registry.js';
/* @end-imports */
/* ---------- quick log for recurring payments ---------- */
export let QA=null;
export function lastOf(f){return S.records.filter(f).sort((x,y)=>x.date<y.date?1:x.date>y.date?-1:(y.ts||0)-(x.ts||0))[0]||null;}
const emptyTenant=()=>({name:'',agStart:'',agEnd:'',rentAmount:''});
function quickTenantRows(rows){
  return rows.map((t,i)=>'<div class="rent-house-new"><div class="fld"><label for="qaTenantName'+i+'">Tenant name</label><input id="qaTenantName'+i+'" type="text" maxlength="80" autocomplete="off" data-qa="tenantName'+i+'" value="'+esc(t.name||'')+'" placeholder="Tenant name"></div>'+
    '<div class="fld"><label for="qaTenantStart'+i+'">Agreement start date <small>optional</small></label><input id="qaTenantStart'+i+'" type="date" min="2000-01-01" max="2100-12-31" data-qa="tenantStart'+i+'" value="'+esc(t.agStart||'')+'"></div>'+
    '<div class="fld"><label for="qaTenantEnd'+i+'">Agreement end date <small>optional</small></label><input id="qaTenantEnd'+i+'" type="date" min="2000-01-01" max="2100-12-31" data-qa="tenantEnd'+i+'" value="'+esc(t.agEnd||'')+'"></div>'+
    '<div class="fld"><label for="qaTenantRent'+i+'">Monthly rent</label><div class="pre"><span>₹</span><input id="qaTenantRent'+i+'" inputmode="decimal" autocomplete="off" data-qa="tenantRent'+i+'" value="'+esc(t.rentAmount||'')+'" placeholder="0"></div></div>'+
    (rows.length>1?'<button type="button" class="link" data-act="qaTenantRemove" data-index="'+i+'">Remove tenant</button>':'')+'</div>').join('');
}
export function qaMatch(r){
  if(QA.cat==='rent'){
    if(r.cat!=='rent'||r.dir!==QA.dir)return false;
    if(QA.addHouse)return(r.party||'').trim().toLowerCase()===(QA.houseName||'').trim().toLowerCase();
    const h=houseOf(QA.houseId);
    return !!h&&(r.houseId===h.id||(!r.houseId&&(r.party||'').trim().toLowerCase()===h.name.trim().toLowerCase()))&&(!QA.tenant||(r.tenant||'').trim().toLowerCase()===QA.tenant.trim().toLowerCase());
  }
  return r.cat===QA.cat&&(!isHouseBill(QA.cat)||r.houseId===QA.houseId);
}
const isHouseBill=cat=>cat==='electricity'||cat==='waterbill';
export function qaGuess(){
  if(QA.cat==='rent'&&QA.dir==='received'){
    const profile=(QA.addHouse?QA.newTenants||[]:tenantProfiles(houseOf(QA.houseId))).find(x=>x.name===QA.tenant);
    if(profile&&profile.rentAmountP!=null)return rs(profile.rentAmountP);
    if(profile&&profile.rentAmount)return profile.rentAmount;
  }
  const r=lastOf(qaMatch)||(QA.cat==='rent'&&QA.dir==='paid'?lastOf(x=>x.cat==='rent'&&x.dir===QA.dir):null);
  if(r)return rs(r.amountP);
  return '';
}
export const qaDup=()=>S.records.some(r=>qaMatch(r)&&recMonth(r)===QA.period);
export function qaName(){return isHouseBill(QA.cat)&&houseOf(QA.houseId)?houseOf(QA.houseId).name:(QA.cat==='rent'?(QA.addHouse?(QA.houseName||'this house'):(houseOf(QA.houseId)?houseOf(QA.houseId).name:'this house')):catOf(QA.cat).name);}
export function qaHtml(){
  const c=catOf(QA.cat),rent=QA.cat==='rent',el=isHouseBill(QA.cat);
  const title=rent?'Log rent '+(QA.dir==='paid'?'paid':'received'):'Add '+c.name.toLowerCase()+(QA.cat==='electricity'?' bill':'');
  const d=qaDup();
  const target=qaName()+(rent&&QA.dir==='received'&&QA.tenant?' · '+QA.tenant:'');
  return '<h2>'+esc(title)+'</h2>'+
   '<div class="mnav" style="margin:8px 0 12px"><button class="ib" data-act="qaMon" data-d="-1" aria-label="Previous month">'+ic('chevL')+'</button><div class="mlabel">'+monLabel(QA.period)+'</div><button class="ib" data-act="qaMon" data-d="1" aria-label="Next month">'+ic('chevR')+'</button></div>'+
   (el?'<div class="fld"><div class="lb">House</div><div class="seg" role="radiogroup" aria-label="House" style="flex-wrap:wrap">'+S.houses.map(h=>'<button type="button" role="radio" aria-checked="'+(QA.houseId===h.id)+'" class="'+(QA.houseId===h.id?'on':'')+'" data-act="qaHouse" data-id="'+esc(h.id)+'" style="flex:1 1 auto">'+esc(h.name)+'</button>').join('')+'</div><p class="err" id="qaErrH" role="alert"></p></div>':'')+
   (rent?'<div class="fld"><div class="lb">House</div><div class="house-options" role="radiogroup" aria-label="House">'+S.houses.filter(h=>houseRentDir(h)===QA.dir).map(h=>'<label class="radio house-option"><input type="radio" name="qaHouse" data-qa="houseId" value="'+esc(h.id)+'"'+(QA.houseId===h.id?' checked':'')+'><span><b>'+esc(h.name)+'</b><small>'+esc([h.addr,h.meter].filter(Boolean).join(' · ')||'No additional details')+'</small></span></label>').join('')+'</div><button type="button" class="btn soft block" data-act="qaRentAddHouse">'+ic('plus',18)+'Add a house</button>'+
      (QA.addHouse?'<div class="rent-house-new"><div class="fld"><label for="qaHouseName">House name</label><input id="qaHouseName" type="text" maxlength="80" autocomplete="off" data-qa="houseName" value="'+esc(QA.houseName)+'" placeholder="e.g. Main home"><p class="err" id="qaHouseErr" role="alert"></p></div><div class="fld"><label for="qaHouseAddr">Address or area <small>optional</small></label><input id="qaHouseAddr" type="text" maxlength="80" autocomplete="off" data-qa="houseAddr" value="'+esc(QA.houseAddr)+'" placeholder="e.g. Flat 4B"></div><div class="fld"><label for="qaHouseMeter">Consumer or meter number <small>optional</small></label><input id="qaHouseMeter" type="text" maxlength="80" autocomplete="off" data-qa="houseMeter" value="'+esc(QA.houseMeter)+'"></div><div class="fld"><div class="lb">Rent type</div><div class="rgrp"><label class="radio"><input type="radio" name="qaHouseDir" data-qa="houseDir" value="paid"'+(QA.houseDir==='paid'?' checked':'')+'><span><b>Paying</b><span>Rent paid to a landlord</span></span></label><label class="radio"><input type="radio" name="qaHouseDir" data-qa="houseDir" value="received"'+(QA.houseDir==='received'?' checked':'')+'><span><b>Receiving</b><span>Rent collected from a tenant</span></span></label></div></div>'+(QA.houseDir==='received'?'<div class="fld"><div class="lb">Tenant details</div>'+quickTenantRows(QA.newTenants||[emptyTenant()])+'<button type="button" class="btn soft block" data-act="qaTenantAdd">'+ic('plus',18)+'Add another tenant</button><p class="err" id="qaTenantErr" role="alert"></p></div>':'')+'</div>':'')+'<p class="err" id="qaErrH" role="alert"></p></div>':'')+
   (rent&&QA.dir==='received'?'<div class="fld"><label for="qaTenant">Tenant</label>'+tenantPicker(QA.tenant,QA.addHouse?QA.newTenants||[]:tenantProfiles(houseOf(QA.houseId)),'qaTenant','qaTenantPicker')+'<p class="hint">Choose a tenant registered to this house.</p>'+(!QA.addHouse&&!tenantProfiles(houseOf(QA.houseId)).length?'<button type="button" class="link" data-act="qaManageTenants">Add tenant details in house settings</button>':'')+'<p class="err" id="qaErrTenant" role="alert"></p></div>':'')+
   (rent?'<div class="fld"><label for="qaDate">'+(QA.dir==='paid'?'Date paid':'Date received')+'</label><input id="qaDate" type="date" min="2000-01-01" max="2100-12-31" data-qa="date" value="'+esc(QA.date)+'"><p class="err" id="qaErrDate" role="alert"></p></div>':'')+
   '<div class="fld" style="margin-bottom:8px"><label for="qaAmt">Amount'+(QA.touched||!QA.amount?'':'<small>from your last log</small>')+'</label><div class="pre"><span>₹</span><input id="qaAmt" inputmode="decimal" autocomplete="off" data-qa="amount" value="'+esc(QA.amount)+'" placeholder="0"></div><p class="err" id="qaErrA" role="alert"></p></div>'+
   '<button type="button" class="paidbtn'+(QA.paid?' on':'')+'" role="switch" aria-checked="'+QA.paid+'" data-act="qaPaid"><span class="bx">'+ic('check',20)+'</span><span><b>'+(rent&&QA.dir==='received'?'Received':'Paid')+'</b><small>'+(QA.paid?(rent&&QA.dir==='received'?'Marked as received. Rent is not counted as spending.':'Marked as paid and counted in spending.'):(rent&&QA.dir==='received'?'Shows as Due until you mark it Received.':'Shows as Due until you tick this.'))+'</small></span></button>'+
   '<div class="warnbox" id="qaWarn"'+(d?'':' hidden')+'>'+(d?esc('A log for '+target+' in '+monLabel(QA.period)+' already exists. You can still save this one.'):'')+'</div>'+
   '<div class="row2" style="margin-top:0"><button class="btn pri" id="qaSave" data-act="qaSave" style="min-height:54px">'+ic('check',20)+(d?'Save anyway':'Save')+'</button></div>'+
   '<div style="text-align:center;margin-top:6px"><button class="link" data-act="qaMore">More details</button></div>';
}
export const qaRender=()=>{const r=$('#qaRoot');if(r)r.innerHTML=qaHtml();else if(QA)sheet('<div id="qaRoot">'+qaHtml()+'</div>');};
export function qaWarn(){const w=$('#qaWarn'),b=$('#qaSave'),d=qaDup(),target=qaName()+(QA.cat==='rent'&&QA.dir==='received'&&QA.tenant?' · '+QA.tenant:'');if(w){w.hidden=!d;w.textContent=d?'A log for '+target+' in '+monLabel(QA.period)+' already exists. You can still save this one.':'';}if(b)b.lastChild.textContent=d?'Save anyway':'Save';}
export function openQuick(o){
  if(isHouseBill(o.cat)&&!S.houses.length){openEntry({spec:'house',utility:true});return;}
  QA={cat:o.cat,dir:o.dir||null,period:S.mon,date:S.mon===curMonth()?today():S.mon+'-01',dateTouched:false,tenant:'',newTenants:[emptyTenant()],paid:false,touched:false,saving:false,houseId:'',houseName:'',houseAddr:'',houseMeter:'',houseDir:o.dir||'paid',addHouse:false,party:'',amount:''};
  if(isHouseBill(o.cat)){
    const missing=S.houses.find(h=>!S.records.some(r=>r.cat===o.cat&&r.houseId===h.id&&recMonth(r)===QA.period));
    const lr=lastOf(r=>r.cat===o.cat&&houseOf(r.houseId));
    const selected=o.cat==='electricity'?UI.eh:UI.wbh;
    QA.houseId=houseOf(selected)?selected:(missing?missing.id:(lr?lr.houseId:S.houses[0].id));
  }
  if(o.cat==='rent'){
    const lr=lastOf(r=>r.cat==='rent'&&r.dir===QA.dir);
    const match=lr&&(houseOf(lr.houseId)||S.houses.find(h=>h.name.trim().toLowerCase()===(lr.party||'').trim().toLowerCase()));
    const dirHouses=S.houses.filter(h=>houseRentDir(h)===QA.dir);
    QA.houseId=match?match.id:(dirHouses.length===1?dirHouses[0].id:'');
    const tenantLast=lastOf(r=>r.cat==='rent'&&r.dir===QA.dir&&r.houseId===QA.houseId&&r.tenant);
    QA.tenant=tenantLast?tenantLast.tenant:'';
  }
  QA.amount=qaGuess();
  sheet('<div id="qaRoot">'+qaHtml()+'</div>');
  setTimeout(()=>{const i=$('#qaAmt');if(i){i.focus();i.select();}},60);
}

Object.assign(A,{
 qaMon:el=>{QA.period=addMonths(QA.period,+el.dataset.d);if(!QA.dateTouched)QA.date=QA.period===curMonth()?today():QA.period+'-01';qaRender();},
 qaHouse:el=>{QA.houseId=el.dataset.id;const last=lastOf(r=>r.cat==='rent'&&r.dir===QA.dir&&r.houseId===QA.houseId);QA.tenant=last&&last.tenant||'';if(!QA.touched)QA.amount=qaGuess();qaRender();},
 qaRentAddHouse:()=>{if(!QA)return;QA.addHouse=!QA.addHouse;QA.tenant='';if(!QA.newTenants||!QA.newTenants.length)QA.newTenants=[emptyTenant()];if(!QA.touched)QA.amount=qaGuess();qaRender();},
 qaTenantAdd:()=>{if(!QA||QA.newTenants.length>=100)return;QA.newTenants.push(emptyTenant());qaRender();},
 qaTenantRemove:el=>{if(!QA||QA.newTenants.length<=1)return;QA.newTenants.splice(+el.dataset.index,1);qaRender();},
 qaManageTenants:()=>{const h=houseOf(QA.houseId);if(!h)return;QA=null;closeL();openEntry({spec:'house',id:h.id});},
 qaTenantPicker:()=>{if(!QA)return;const profiles=QA.addHouse?QA.newTenants||[]:tenantProfiles(houseOf(QA.houseId));sheet('<h2>Choose a tenant</h2>'+tenantOptions(profiles,QA.tenant,'qaTenantPick'));},
 qaTenantPick:el=>{if(!QA)return;QA.tenant=el.dataset.value||'';const t=(QA.addHouse?QA.newTenants:tenantProfiles(houseOf(QA.houseId))).find(x=>x.name===QA.tenant);if(!QA.touched)QA.amount=t?(t.rentAmountP==null?(t.rentAmount||''):rs(t.rentAmountP)):qaGuess();qaRender();},
 qaPaid:()=>{QA.paid=!QA.paid;qaRender();},
 qaMore:()=>{const q=QA;closeL();QA=null;
   const pre={period:q.period,amount:q.amount,paid:q.paid};
 if(q.cat==='rent'){pre.houseId=q.houseId;pre.tenant=q.tenant;pre.date=q.date;pre.addHouse=q.addHouse;pre.newTenants=q.newTenants;pre.houseDir=q.houseDir;pre.houseName=q.houseName;pre.houseAddr=q.houseAddr;pre.houseMeter=q.houseMeter;openEntry({spec:'rent',dir:q.dir,pre:pre});}
 else{if(isHouseBill(q.cat))pre.houseId=q.houseId;openEntry({spec:'bill',cat:q.cat,pre:pre});}},
 qaSave:()=>{if(!QA||QA.saving)return;
   const m=parseMoney(QA.amount),ea=$('#qaErrA'),eh=$('#qaErrH');ea.textContent='';if(eh)eh.textContent='';const ed=$('#qaErrDate'),et=$('#qaErrTenant');if(ed)ed.textContent='';if(et)et.textContent='';
   if(QA.cat==='rent'&&!validDate(QA.date)){if(ed)ed.textContent='Enter a valid date.';return;}
   if(m==null||m<=0||m>MAX_MONEY){ea.textContent='Enter an amount above 0, with up to 2 decimals.';$('#qaAmt').focus();return;}
   if(isHouseBill(QA.cat)&&!houseOf(QA.houseId)){eh.textContent='Choose a house.';return;}
   if(QA.cat==='rent'){
     const hErr=$('#qaHouseErr');
     if(QA.addHouse){
       if(!QA.houseName.trim()){if(hErr)hErr.textContent='Enter a house name.';return;}
       if(S.houses.some(h=>h.name.trim().toLowerCase()===QA.houseName.trim().toLowerCase())){if(hErr)hErr.textContent='A house with this name already exists. Select it from the list.';return;}
       if(QA.houseDir!==QA.dir){if(hErr)hErr.textContent='Choose '+(QA.dir==='paid'?'Paying Rent':'Receiving Rent')+' for this rent log.';return;}
     }else if(!houseOf(QA.houseId)){eh.textContent='Choose a house or add a new one.';return;}
     if(QA.dir==='received'){
       const profiles=QA.addHouse?(QA.newTenants||[]).filter(t=>t.name.trim()):tenantProfiles(houseOf(QA.houseId));
       const tenant=profiles.find(t=>t.name===QA.tenant);
       if(!tenant){if(et)et.textContent=profiles.length?'Choose a tenant.':'Add tenant details to this receiving-rent house first.';return;}
       if(QA.addHouse&&(profiles.length>100||profiles.some(t=>t.rentAmount&&(parseMoney(t.rentAmount)==null||parseMoney(t.rentAmount)<=0||parseMoney(t.rentAmount)>MAX_MONEY))||new Set(profiles.map(t=>t.name.trim().toLowerCase())).size!==profiles.length)){const err=$('#qaTenantErr');if(err)err.textContent='Check tenant names and any monthly rent amounts.';return;}
       if(QA.addHouse&&QA.newTenants.some(t=>!t.name.trim()&&(t.agStart||t.agEnd||t.rentAmount))){const err=$('#qaTenantErr');if(err)err.textContent='Enter a tenant name or clear the incomplete tenant details.';return;}
       if(QA.addHouse&&profiles.some(t=>t.agStart&&!validDate(t.agStart)||t.agEnd&&!validDate(t.agEnd)||t.agStart&&t.agEnd&&t.agEnd<=t.agStart)){const err=$('#qaTenantErr');if(err)err.textContent='Check the tenant agreement dates.';return;}
     }
     if(QA.dir==='received'&&!QA.addHouse){
       const house=houseOf(QA.houseId),tenants=Array.isArray(house&&house.tenants)?house.tenants.filter(t=>typeof t==='string'):[];
       if(house&&!tenants.some(t=>t.trim().toLowerCase()===QA.tenant.trim().toLowerCase())&&tenants.length>=100){if(et)et.textContent='This house already has 100 tenants. Manage the tenant list in Settings → Houses.';return;}
     }
   }
   QA.saving=true;
   const last=lastOf(qaMatch),lx=(last&&last.x)||{};
   const rec={id:uid(),ts:Date.now(),cat:QA.cat,date:QA.cat==='rent'?QA.date:(QA.period===curMonth()?today():QA.period+'-01'),period:QA.period,amountP:m,status:QA.paid?'paid':'due',notes:'',party:last?(last.party||''):''};
   if(isHouseBill(QA.cat)){rec.houseId=QA.houseId;rec.x={due:''};}
   else if(QA.cat==='rent'){
     const house=QA.addHouse?{id:uid(),name:QA.houseName.trim(),rentDir:QA.houseDir,addr:QA.houseAddr.trim(),meter:QA.houseMeter.trim(),tenants:QA.houseDir==='received'?QA.newTenants.filter(t=>t.name.trim()).map(t=>({name:t.name.trim(),agStart:t.agStart,agEnd:t.agEnd,rentAmountP:parseMoney(t.rentAmount)})):[]}:houseOf(QA.houseId);
     if(QA.addHouse)S.houses.push(house);
     rec.dir=QA.dir;rec.houseId=house.id;rec.party=house.name;rec.tenant=QA.dir==='received'?QA.tenant.trim():'';rec.x={method:lx.method||'',agStart:lx.agStart||'',agEnd:lx.agEnd||''};
     if(rec.tenant){const profile=tenantProfiles(house).find(t=>t.name===rec.tenant);rec.x.agStart=profile&&profile.agStart||'';rec.x.agEnd=profile&&profile.agEnd||'';}
   }
   else rec.x={due:''};
   S.records.push(rec);S.mon=rec.period;persist();QA=null;closeL();draw(true);toast(rec.status==='paid'?(rec.cat==='rent'&&rec.dir==='received'?'Saved as received':'Saved as paid'):'Saved as due');}
});

/* Typing in the quick-log sheet (called from the global input handler). Returns true when the event was ours. */
export function onQuickInput(el,eventType){
  if(!(el.dataset.qa&&QA))return false;
  const profileMatch=el.dataset.qa.match(/^(tenantName|tenantStart|tenantEnd|tenantRent)(\d+)$/);
  if(profileMatch){
    const i=+profileMatch[2],key={tenantName:'name',tenantStart:'agStart',tenantEnd:'agEnd',tenantRent:'rentAmount'}[profileMatch[1]];
    if(QA.newTenants[i])QA.newTenants[i][key]=el.value;
    if(key==='name'&&(!QA.tenant||QA.tenant===QA.newTenants[i].name)){
      QA.tenant=el.value;
      if(!QA.touched)QA.amount=QA.newTenants[i].rentAmount;
    }
    if(eventType==='change')qaRender();
    return true;
  }
  QA[el.dataset.qa]=el.value;
  if(el.dataset.qa==='amount')QA.touched=true;
  else if(el.dataset.qa==='date')QA.dateTouched=true;
  else if(el.dataset.qa==='houseId'){const last=lastOf(r=>r.cat==='rent'&&r.dir===QA.dir&&r.houseId===QA.houseId);QA.tenant=last&&last.tenant||'';if(!QA.touched)QA.amount=qaGuess();if(eventType==='change')qaRender();return true;}
  else if(el.dataset.qa==='tenant'){
    const t=(QA.addHouse?QA.newTenants:tenantProfiles(houseOf(QA.houseId))).find(x=>x.name===QA.tenant);
    if(!QA.touched)QA.amount=t?(t.rentAmountP==null?(t.rentAmount||''):rs(t.rentAmountP)):'';
    const e=$('#qaErrTenant');if(e)e.textContent='';
    if(eventType==='change')qaRender();
    qaWarn();return true;
  }
  else if(el.dataset.qa==='houseDir'){const e=$('#qaErrH');if(e)e.textContent='';if(eventType==='change')qaRender();return true;}
  else if(el.dataset.qa==='houseName'&&!QA.touched){QA.amount=qaGuess();const a=$('#qaAmt');if(a)a.value=QA.amount;}
  const ea=$('#qaErrA');if(ea)ea.textContent='';
  if(el.dataset.qa==='date'){const e=$('#qaErrDate');if(e)e.textContent='';}
  if(el.dataset.qa==='tenant'){const e=$('#qaErrTenant');if(e)e.textContent='';qaWarn();return true;}
  qaWarn();return true;
}
