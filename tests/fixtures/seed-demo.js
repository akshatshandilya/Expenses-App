/* @auto-imports */
import {addMonths,curMonth,pad,today,ymd} from '../../src/core/dates.js';
import {uid} from '../../src/core/util.js';
/* @end-imports */
export function seedDemo(s){
  const mk0=curMonth(),td=+today().slice(8,10);
  const D=(off,day)=>{const mk=addMonths(mk0,off);return{mk:mk,date:mk+'-'+pad(off===0?Math.min(day,td):day)};};
  s.houses=[{id:'h1',demo:1,name:'Main home',addr:'Demo address',meter:'Meter 1001'},{id:'h2',demo:1,name:'Village house',addr:'',meter:'Meter 2002'}];
  let sn=0;const add=o=>{o.id=uid();o.demo=1;o.notes=o.notes||'';sn++;o.ts=new Date(o.date+'T'+pad(8+sn%11)+':'+pad((sn*17)%60)+':00').getTime();if(o.ts>Date.now())o.ts=Date.now()-sn*60000;s.records.push(o);};
  [0,-1,-2,-3].forEach((off,i)=>{
    let d=D(off,3);add({cat:'groceries',date:d.date,title:'Weekly vegetables and fruit',party:'Local market',amountP:[124000,98000,113000,107500][i]});
    d=D(off,12);add({cat:'groceries',date:d.date,title:'Rice',party:'Kirana store',qtyM:5000,unitP:6000,amountP:30000,x:{unitLabel:'kg'}});
    d=D(off,10);add({cat:'electricity',houseId:'h1',date:d.date,period:d.mk,amountP:[204000,195000,172000,186000][i],status:i===0?'due':'paid',party:'Electricity provider',x:{due:d.mk+'-28'}});
    d=D(off,12);if(i<3)add({cat:'electricity',houseId:'h2',date:d.date,period:d.mk,amountP:[48000,41500,52000][i],status:'paid',party:'Electricity provider',x:{due:''}});
    d=D(off,10);add({cat:'waterbill',date:d.date,period:d.mk,amountP:34000,status:'paid'});
    d=D(off,6);add({cat:'travel',sub:'fuel',date:d.date,qtyM:10000,unitP:10500,amountP:105000,party:'',x:{fuelType:'Petrol',vehicle:'Car',u:'litres'}});
    d=D(off,20);add({cat:'travel',sub:'fuel',date:d.date,qtyM:8500,unitP:10500,amountP:89250,x:{fuelType:'Petrol',vehicle:'Car',u:'litres'}});
    d=D(off,6);add({cat:'travel',sub:'toll',date:d.date,amountP:18000,party:'Expressway toll plaza',x:{vehicle:'Car',method:'FASTag'}});
    d=D(off,20);add({cat:'travel',sub:'toll',date:d.date,amountP:18000,party:'Expressway toll plaza',x:{vehicle:'Car',method:'FASTag'}});
    d=D(off,15);add({cat:'household',date:d.date,title:'Cleaning supplies',amountP:56000});
    d=D(off,1);add({cat:'rent',dir:'paid',date:d.date,period:d.mk,amountP:1400000,status:'paid',party:'Flat 4B',x:{method:'UPI',agStart:addMonths(mk0,-8)+'-01',agEnd:addMonths(mk0,5)+'-15'}});
    d=D(off,2);add({cat:'rent',dir:'received',date:d.date,period:d.mk,amountP:650000,status:'paid',party:'Tenant, Room 1',x:{method:'Bank transfer',agStart:addMonths(mk0,-10)+'-01',agEnd:(()=>{const e=new Date();e.setDate(e.getDate()+20);return ymd(e.getFullYear(),e.getMonth()+1,e.getDate());})()}});
    d=D(off,6);s.dist.push({id:uid(),demo:1,ts:Math.min(new Date(d.date+'T08:15:00').getTime(),Date.now()-60000),date:d.date,from:'Home',to:'Office',kmM:42000,purpose:'Office commute'});
    d=D(off,20);s.dist.push({id:uid(),demo:1,ts:Math.min(new Date(d.date+'T08:15:00').getTime(),Date.now()-60000),date:d.date,from:'Home',to:'Office',kmM:38000,purpose:'Office commute'});
  });
  let d=D(0,5);add({cat:'gas',date:d.date,qtyM:1000,unitP:90000,amountP:90000});
  d=D(-2,9);add({cat:'gas',date:d.date,qtyM:1000,unitP:90000,amountP:90000});
  d=D(0,9);add({cat:'medical',date:d.date,title:'Pharmacy',amountP:45000});
  d=D(-1,18);add({cat:'medical',date:d.date,title:'Clinic visit',amountP:120000});
  s.prices.gas={cur:90000,hist:[{from:'0000-00-00',price:90000}],log:[]};
}
