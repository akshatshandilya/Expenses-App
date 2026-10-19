/* @auto-imports */
import {addMonths,curMonth,monLabel,today} from '../core/dates.js';
import {MAX_MONEY,parseMoney,rs} from '../core/money.js';
import {recMonth} from '../core/rules.js';
import {$,esc,uid} from '../core/util.js';
import {S,UI,catOf,houseOf,persist} from '../data/state.js';
import {openEntry} from './entry.js';
import {ic} from './icons.js';
import {closeL,draw,sheet,toast} from './nav.js';
import {A} from './registry.js';
/* @end-imports */
/* ---------- quick log for recurring payments ---------- */
export let QA=null;
export function lastOf(f){return S.records.filter(f).sort((x,y)=>x.date<y.date?1:x.date>y.date?-1:(y.ts||0)-(x.ts||0))[0]||null;}
export function qaMatch(r){
  if(QA.cat==='rent'){
    if(r.cat!=='rent'||r.dir!==QA.dir)return false;
    if(QA.addHouse)return(r.party||'').trim().toLowerCase()===(QA.houseName||'').trim().toLowerCase();
    const h=houseOf(QA.houseId);
    return !!h&&(r.houseId===h.id||(!r.houseId&&(r.party||'').trim().toLowerCase()===h.name.trim().toLowerCase()));
  }
  return r.cat===QA.cat&&(QA.cat!=='electricity'||r.houseId===QA.houseId);
}
export function qaGuess(){const r=lastOf(qaMatch)||(QA.cat==='rent'?lastOf(x=>x.cat==='rent'&&x.dir===QA.dir):null);return r?rs(r.amountP):'';}
export const qaDup=()=>S.records.some(r=>qaMatch(r)&&recMonth(r)===QA.period);
export function qaName(){return QA.cat==='electricity'&&houseOf(QA.houseId)?houseOf(QA.houseId).name:(QA.cat==='rent'?(QA.addHouse?(QA.houseName||'this house'):(houseOf(QA.houseId)?houseOf(QA.houseId).name:'this house')):catOf(QA.cat).name);}
export function qaHtml(){
  const c=catOf(QA.cat),rent=QA.cat==='rent',el=QA.cat==='electricity';
  const title=rent?'Log rent '+(QA.dir==='paid'?'paid':'received'):'Add '+c.name.toLowerCase()+(el?' bill':'');
  const d=qaDup();
  return '<h2>'+esc(title)+'</h2>'+
   '<div class="mnav" style="margin:8px 0 12px"><button class="ib" data-act="qaMon" data-d="-1" aria-label="Previous month">'+ic('chevL')+'</button><div class="mlabel">'+monLabel(QA.period)+'</div><button class="ib" data-act="qaMon" data-d="1" aria-label="Next month">'+ic('chevR')+'</button></div>'+
   (el?'<div class="fld"><div class="lb">House</div><div class="seg" role="radiogroup" aria-label="House" style="flex-wrap:wrap">'+S.houses.map(h=>'<button type="button" role="radio" aria-checked="'+(QA.houseId===h.id)+'" class="'+(QA.houseId===h.id?'on':'')+'" data-act="qaHouse" data-id="'+esc(h.id)+'" style="flex:1 1 auto">'+esc(h.name)+'</button>').join('')+'</div><p class="err" id="qaErrH" role="alert"></p></div>':'')+
   (rent?'<div class="fld"><div class="lb">House</div><div class="house-options" role="radiogroup" aria-label="House">'+S.houses.map(h=>'<label class="radio house-option"><input type="radio" name="qaHouse" data-qa="houseId" value="'+esc(h.id)+'"'+(QA.houseId===h.id?' checked':'')+'><span><b>'+esc(h.name)+'</b><small>'+esc([h.addr,h.meter].filter(Boolean).join(' · ')||'No additional details')+'</small></span></label>').join('')+'</div><button type="button" class="btn soft block" data-act="qaRentAddHouse">'+ic('plus',18)+'Add a house</button>'+
      (QA.addHouse?'<div class="rent-house-new"><div class="fld"><label for="qaHouseName">House name</label><input id="qaHouseName" type="text" maxlength="80" autocomplete="off" data-qa="houseName" value="'+esc(QA.houseName)+'" placeholder="e.g. Main home"><p class="err" id="qaHouseErr" role="alert"></p></div><div class="fld"><label for="qaHouseAddr">Address or area <small>optional</small></label><input id="qaHouseAddr" type="text" maxlength="80" autocomplete="off" data-qa="houseAddr" value="'+esc(QA.houseAddr)+'" placeholder="e.g. Flat 4B"></div><div class="fld"><label for="qaHouseMeter">Consumer or meter number <small>optional</small></label><input id="qaHouseMeter" type="text" maxlength="80" autocomplete="off" data-qa="houseMeter" value="'+esc(QA.houseMeter)+'"></div></div>':'')+'<p class="err" id="qaErrH" role="alert"></p></div>':'')+
   '<div class="fld" style="margin-bottom:8px"><label for="qaAmt">Amount'+(QA.touched||!QA.amount?'':'<small>from your last log</small>')+'</label><div class="pre"><span>₹</span><input id="qaAmt" inputmode="decimal" autocomplete="off" data-qa="amount" value="'+esc(QA.amount)+'" placeholder="0"></div><p class="err" id="qaErrA" role="alert"></p></div>'+
   '<button type="button" class="paidbtn'+(QA.paid?' on':'')+'" role="switch" aria-checked="'+QA.paid+'" data-act="qaPaid"><span class="bx">'+ic('check',20)+'</span><span><b>'+(rent&&QA.dir==='received'?'Received':'Paid')+'</b><small>'+(QA.paid?(rent&&QA.dir==='received'?'Marked as received. Rent is not counted as spending.':'Marked as paid and counted in spending.'):(rent&&QA.dir==='received'?'Shows as Due until you mark it Received.':'Shows as Due until you tick this.'))+'</small></span></button>'+
   '<div class="warnbox" id="qaWarn"'+(d?'':' hidden')+'>'+(d?esc('A log for '+qaName()+' in '+monLabel(QA.period)+' already exists. You can still save this one.'):'')+'</div>'+
   '<div class="row2" style="margin-top:0"><button class="btn pri" id="qaSave" data-act="qaSave" style="min-height:54px">'+ic('check',20)+(d?'Save anyway':'Save')+'</button></div>'+
   '<div style="text-align:center;margin-top:6px"><button class="link" data-act="qaMore">More details</button></div>';
}
export const qaRender=()=>{const r=$('#qaRoot');if(r)r.innerHTML=qaHtml();};
export function qaWarn(){const w=$('#qaWarn'),b=$('#qaSave'),d=qaDup();if(w){w.hidden=!d;w.textContent=d?'A log for '+qaName()+' in '+monLabel(QA.period)+' already exists. You can still save this one.':'';}if(b)b.lastChild.textContent=d?'Save anyway':'Save';}
export function openQuick(o){
  if(o.cat==='electricity'&&!S.houses.length){openEntry({spec:'house'});return;}
  QA={cat:o.cat,dir:o.dir||null,period:S.mon,paid:false,touched:false,saving:false,houseId:'',houseName:'',houseAddr:'',houseMeter:'',addHouse:false,party:'',amount:''};
  if(o.cat==='electricity'){
    const missing=S.houses.find(h=>!S.records.some(r=>r.cat==='electricity'&&r.houseId===h.id&&recMonth(r)===QA.period));
    const lr=lastOf(r=>r.cat==='electricity'&&houseOf(r.houseId));
    QA.houseId=houseOf(UI.eh)?UI.eh:(missing?missing.id:(lr?lr.houseId:S.houses[0].id));
  }
  if(o.cat==='rent'){
    const lr=lastOf(r=>r.cat==='rent'&&r.dir===QA.dir);
    const match=lr&&(houseOf(lr.houseId)||S.houses.find(h=>h.name.trim().toLowerCase()===(lr.party||'').trim().toLowerCase()));
    QA.houseId=match?match.id:(S.houses.length===1?S.houses[0].id:'');
  }
  QA.amount=qaGuess();
  sheet('<div id="qaRoot">'+qaHtml()+'</div>');
  setTimeout(()=>{const i=$('#qaAmt');if(i){i.focus();i.select();}},60);
}

Object.assign(A,{
 qaMon:el=>{QA.period=addMonths(QA.period,+el.dataset.d);qaRender();},
 qaHouse:el=>{QA.houseId=el.dataset.id;if(!QA.touched)QA.amount=qaGuess();qaRender();},
 qaRentAddHouse:()=>{if(!QA)return;QA.addHouse=!QA.addHouse;if(!QA.touched)QA.amount=qaGuess();qaRender();},
 qaPaid:()=>{QA.paid=!QA.paid;qaRender();},
 qaMore:()=>{const q=QA;closeL();QA=null;
   const pre={period:q.period,amount:q.amount,paid:q.paid};
   if(q.cat==='rent'){pre.houseId=q.houseId;pre.addHouse=q.addHouse;pre.houseName=q.houseName;pre.houseAddr=q.houseAddr;pre.houseMeter=q.houseMeter;openEntry({spec:'rent',dir:q.dir,pre:pre});}
   else{if(q.cat==='electricity')pre.houseId=q.houseId;openEntry({spec:'bill',cat:q.cat,pre:pre});}},
 qaSave:()=>{if(!QA||QA.saving)return;
   const m=parseMoney(QA.amount),ea=$('#qaErrA'),eh=$('#qaErrH');ea.textContent='';if(eh)eh.textContent='';
   if(m==null||m<=0||m>MAX_MONEY){ea.textContent='Enter an amount above 0, with up to 2 decimals.';$('#qaAmt').focus();return;}
   if(QA.cat==='electricity'&&!houseOf(QA.houseId)){eh.textContent='Choose a house.';return;}
   if(QA.cat==='rent'){
     const hErr=$('#qaHouseErr');
     if(QA.addHouse){
       if(!QA.houseName.trim()){if(hErr)hErr.textContent='Enter a house name.';return;}
       if(S.houses.some(h=>h.name.trim().toLowerCase()===QA.houseName.trim().toLowerCase())){if(hErr)hErr.textContent='A house with this name already exists. Select it from the list.';return;}
     }else if(!houseOf(QA.houseId)){eh.textContent='Choose a house or add a new one.';return;}
   }
   QA.saving=true;
   const last=lastOf(qaMatch),lx=(last&&last.x)||{};
   const rec={id:uid(),ts:Date.now(),cat:QA.cat,date:QA.period===curMonth()?today():QA.period+'-01',period:QA.period,amountP:m,status:QA.paid?'paid':'due',notes:'',party:last?(last.party||''):''};
   if(QA.cat==='electricity'){rec.houseId=QA.houseId;rec.x={due:''};}
   else if(QA.cat==='rent'){
     const house=QA.addHouse?{id:uid(),name:QA.houseName.trim(),addr:QA.houseAddr.trim(),meter:QA.houseMeter.trim()}:houseOf(QA.houseId);
     if(QA.addHouse)S.houses.push(house);
     rec.dir=QA.dir;rec.houseId=house.id;rec.party=house.name;rec.x={method:lx.method||'',agStart:lx.agStart||'',agEnd:lx.agEnd||''};
   }
   else rec.x={due:''};
   S.records.push(rec);S.mon=rec.period;persist();QA=null;closeL();draw(true);toast(rec.status==='paid'?(rec.cat==='rent'&&rec.dir==='received'?'Saved as received':'Saved as paid'):'Saved as due');}
});

/* Typing in the quick-log sheet (called from the global input handler). Returns true when the event was ours. */
export function onQuickInput(el,eventType){
  if(!(el.dataset.qa&&QA))return false;
  QA[el.dataset.qa]=el.value;
  if(el.dataset.qa==='amount')QA.touched=true;
  else if(el.dataset.qa==='houseId'){if(!QA.touched)QA.amount=qaGuess();if(eventType==='change')qaRender();return true;}
  else if(el.dataset.qa==='houseName'&&!QA.touched){QA.amount=qaGuess();const a=$('#qaAmt');if(a)a.value=QA.amount;}
  const ea=$('#qaErrA');if(ea)ea.textContent='';qaWarn();return true;
}
