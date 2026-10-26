/* @auto-imports */
import {curMonth} from '../core/dates.js';
import {next} from './storage.js';
/* @end-imports */
export function defaultCats(){return[
 {id:'groceries',name:'Groceries',icon:'cart',color:'#4C9A52',kind:'groceries',b:1},
 {id:'water',name:'Water Bottles',icon:'bottle',color:'#2D8FD5',kind:'water',unit:'bottle',units:'bottles',b:1},
 {id:'gas',name:'Gas Cylinders',icon:'flame',color:'#E0762B',kind:'unit',unit:'cylinder',units:'cylinders',b:1},
 {id:'electricity',name:'Electricity',icon:'bolt',color:'#D3A006',kind:'bill',b:1},
 {id:'waterbill',name:'Water Bill',icon:'drop',color:'#16A0B0',kind:'bill',b:1},
 {id:'household',name:'Household Supplies',icon:'box',color:'#8A6FD1',kind:'simple',b:1},
 {id:'medical',name:'Medical',icon:'medical',color:'#D9506B',kind:'simple',b:1},
 {id:'travel',name:'Travel',icon:'car',color:'#4B6CD6',kind:'travel',b:1},
 {id:'rent',name:'Rent',icon:'key',color:'#C0558C',kind:'rent',b:1},
 {id:'cab',name:'Auto and Cabs',icon:'cab',color:'#A8683B',kind:'cab',b:1},
 {id:'other',name:'Other Expenses',icon:'dots',color:'#6F8079',kind:'simple',b:1}];}
export function defaultRoutes(){return[{id:'rt1',name:'Home to Office'},{id:'rt2',name:'Office to Home'},{id:'others',name:'Others',fixed:1}];}
export function migrateState(state){
  let changed=false;
  if(!Array.isArray(state.routes)){state.routes=defaultRoutes();changed=true;}
  if(!Array.isArray(state.cats)){state.cats=defaultCats();changed=true;}
  if(!state.features||typeof state.features!=='object'||Array.isArray(state.features)){state.features={};changed=true;}
  if(state.features.autoCabs!==1){
    if(!state.cats.some(c=>c.id==='cab')){
      const i=state.cats.findIndex(c=>c.id==='other');
      state.cats.splice(i<0?state.cats.length:i,0,defaultCats().find(c=>c.id==='cab'));
    }
    state.features.autoCabs=1;changed=true;
  }
  return changed;
}
export function blank(){return{v:1,onboarded:false,theme:'system',houses:[],lock:{on:false,timeout:30},cats:defaultCats(),routes:defaultRoutes(),features:{autoCabs:1},records:[],dist:[],prices:{},mon:curMonth()};}
export const UI={tt:'fuel',wTab:'cal',wsel:null,q:'',cf:'all',sort:'dateDesc',rv:'month',rentDir:'paid',rentHouse:'all',eh:'all',wbh:'all'};
export const catOf=id=>S.cats.find(c=>c.id===id);
export const houseOf=id=>S.houses.find(h=>h.id===id);
export function tenantProfiles(house){
  if(!Array.isArray(house&&house.tenants))return [];
  return house.tenants.map(t=>typeof t==='string'?{name:t,agStart:'',agEnd:'',rentAmountP:null}:t)
    .filter(t=>t&&typeof t.name==='string'&&t.name.trim())
    .map(t=>({name:t.name,agStart:t.agStart||'',agEnd:t.agEnd||'',rentAmountP:Number.isInteger(t.rentAmountP)?t.rentAmountP:null,dueBy:['first','seventh','custom'].includes(t.dueBy)?t.dueBy:'first',dueDay:Number.isInteger(t.dueDay)&&t.dueDay>=1&&t.dueDay<=31?t.dueDay:null}));
}
export function paymentDueLabel(item){
  const mode=['first','seventh','custom'].includes(item&&item.dueBy)?item.dueBy:'first';
  const day=mode==='first'?1:mode==='seventh'?7:item&&Number.isInteger(item.dueDay)&&item.dueDay>=1&&item.dueDay<=31?item.dueDay:null;
  if(day==null)return 'Set a due day';
  const suffix=day%100>=11&&day%100<=13?'th':({1:'st',2:'nd',3:'rd'}[day%10]||'th');
  return day+suffix+' of every month';
}
export function houseRentDir(house){
  if(house.rentDir==='paid'||house.rentDir==='received')return house.rentDir;
  const linked=S.records.filter(r=>r.cat==='rent'&&(r.houseId===house.id||(!r.houseId&&(r.party||'').trim().toLowerCase()===house.name.trim().toLowerCase())));
  return linked.some(r=>r.dir==='received')&&!linked.some(r=>r.dir==='paid')?'received':'paid';
}

/* The one live copy of the app's data. Other modules import S and mutate it; loading or restoring replaces its contents. */
export const S={};
export function replaceState(next){for(const k of Object.keys(S))delete S[k];Object.assign(S,next);}
/* Short-lived dialog values (typed text in sheets). Never persisted. */
export const DLG={};
/* persist() is called after every change. The storage layer registers the real writer. */
export let persistHook=null;
export function setPersistHook(fn){persistHook=fn;}
export function persist(){if(persistHook)persistHook();}
/* readOnly: the saved data could not be opened, so nothing is written until the person restores or starts again. */
export const flags={readOnly:false};
