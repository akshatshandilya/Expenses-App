/* @auto-imports */
import {MONTHS,addMonths,monLabel,pad} from '../core/dates.js';
import {fmt,fmtK,qtyStr} from '../core/money.js';
import {catSpent,counted,isIncome,recMonth,recsIn,spent,sum} from '../core/rules.js';
import {esc} from '../core/util.js';
import {S,UI,catOf} from '../data/state.js';
import {chipOf,empty,monNav,stats} from './components.js';
import {ic} from './icons.js';
import {V} from './registry.js';
/* @end-imports */
/* reports */
export function barSvg(items,label){
  const W=340,H=172,pl=6,pr=6,pt=22,pb=26,n=items.length,max=Math.max(1,...items.map(i=>i.v)),bw=(W-pl-pr)/n,bar=Math.min(34,bw*.6);
  let s='<svg class="chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(label)+'"><line class="ax" x1="'+pl+'" x2="'+(W-pr)+'" y1="'+(H-pb)+'" y2="'+(H-pb)+'"/>';
  items.forEach((it,i)=>{const h=Math.round((H-pt-pb)*it.v/max),x=pl+i*bw+(bw-bar)/2,y=H-pb-h;
    s+='<rect class="b'+(it.sel?' sel':'')+'" x="'+x.toFixed(1)+'" y="'+y+'" width="'+bar.toFixed(1)+'" height="'+(it.v?Math.max(h,2):0)+'" rx="5"/>';
    if(it.v)s+='<text x="'+(x+bar/2).toFixed(1)+'" y="'+(y-6)+'" text-anchor="middle">'+fmtK(it.v)+'</text>';
    s+='<text x="'+(x+bar/2).toFixed(1)+'" y="'+(H-9)+'" text-anchor="middle">'+it.l+'</text>';});
  return s+'</svg>';
}
export function catBars(rows,total){
  return rows.map(r=>{const c=catOf(r.id)||{name:r.id,icon:'dots',color:'#6F8079'};const pc=total?Math.round(r.v/total*100):0;
   return '<div class="bar">'+chipOf(c)+'<div class="bt"><div class="top"><span>'+esc(c.name)+'</span><span>'+fmt(r.v)+' · '+pc+'%</span></div><div class="track" aria-hidden="true"><div style="width:'+pc+'%;--c:'+esc(c.color)+'"></div></div></div></div>';}).join('');
}
V.reports=()=>{
  const mk=S.mon,y=mk.slice(0,4);
  const head='<header class="th"><h1>Reports</h1></header><div class="seg" role="tablist"><button role="tab" aria-selected="'+(UI.rv==='month')+'" class="'+(UI.rv==='month'?'on':'')+'" data-act="repView" data-v="month">Month</button><button role="tab" aria-selected="'+(UI.rv==='year')+'" class="'+(UI.rv==='year'?'on':'')+'" data-act="repView" data-v="year">Year</button></div>';
  if(UI.rv==='year'){
    const tots=[];for(let m=1;m<=12;m++)tots.push(spent(y+'-'+pad(m)));
    const T=tots.reduce((a,b)=>a+b,0),withData=tots.filter(x=>x>0).length;
    const by={};S.records.filter(r=>recMonth(r).slice(0,4)===y&&counted(r)).forEach(r=>{by[r.cat]=(by[r.cat]||0)+r.amountP;});
    const rows=Object.keys(by).map(k=>({id:k,v:by[k]})).sort((a,b)=>b.v-a.v);
    return head+'<div class="mnav"><button class="ib" data-act="yr" data-d="-1" aria-label="Previous year">'+ic('chevL')+'</button><div class="mlabel">'+y+'</div><button class="ib" data-act="yr" data-d="1" aria-label="Next year">'+ic('chevR')+'</button></div>'+
     (T?stats([['Total for '+y,fmt(T)],['Average per month',fmt(Math.round(T/withData))]])+'<div class="card"><h2>Monthly spending</h2>'+barSvg(tots.map((v,i)=>({v:v,l:MONTHS[i].slice(0,1),sel:y+'-'+pad(i+1)===mk})),'Monthly spending in '+y+': '+tots.map((v,i)=>MONTHS[i].slice(0,3)+' '+fmt(v)).join(', '))+'</div><div class="card"><h2>By category</h2>'+catBars(rows,T)+'</div>':empty('chart','No spending in '+y,'Reports are calculated from the records you add.'));
  }
  const tot=spent(mk),prev=spent(addMonths(mk,-1));
  const by={};recsIn(mk,counted).forEach(r=>{by[r.cat]=(by[r.cat]||0)+r.amountP;});
  const rows=Object.keys(by).map(k=>({id:k,v:by[k]})).sort((a,b)=>b.v-a.v);
  const trend=[];for(let i=-5;i<=0;i++){const m=addMonths(mk,i);trend.push({v:spent(m),l:MONTHS[+m.slice(5)-1].slice(0,3),sel:i===0});}
  const rec3=S.cats.filter(c=>[0,-1,-2].every(i=>recsIn(addMonths(mk,i),r=>r.cat===c.id&&counted(r)).length>0)).map(c=>({c:c,avg:Math.round([0,-1,-2].reduce((a,i)=>a+catSpent(addMonths(mk,i),c.id),0)/3)}));
  const fS=sum(recsIn(mk,r=>r.cat==='travel'&&r.sub==='fuel'&&counted(r))),tS=sum(recsIn(mk,r=>r.cat==='travel'&&r.sub==='toll'&&counted(r))),oS=sum(recsIn(mk,r=>r.cat==='travel'&&r.sub==='other'&&counted(r)));
  const km=S.dist.filter(d=>d.date.slice(0,7)===mk).reduce((a,d)=>a+d.kmM,0);
  const rp=sum(recsIn(mk,r=>r.cat==='rent'&&r.dir==='paid'&&r.status!=='due')),rr=sum(recsIn(mk,r=>isIncome(r)&&r.status!=='due'));
  const cmp=!prev?(tot?'No spending recorded last month to compare.':''):(tot>=prev?'Up ':'Down ')+fmt(Math.abs(tot-prev))+' ('+Math.abs(Math.round((tot-prev)/prev*100))+'%) compared with '+MONTHS[+addMonths(mk,-1).slice(5)-1];
  if(!tot&&!rp&&!rr&&!km)return head+monNav()+empty('chart','No data for '+monLabel(mk),'Add expenses and your report will appear here.','<button class="btn pri" data-act="pick">Add expense</button>');
  return head+monNav()+
   '<section class="card"><div class="eyebrow">Total spent in '+monLabel(mk)+'</div><div class="num" style="font-size:36px;margin:4px 0">'+fmt(tot)+'</div><p class="sub">'+cmp+'</p></section>'+
   '<div class="card"><h2>Where it went</h2>'+(rows.length?catBars(rows,tot):'<p class="sub">No spending recorded.</p>')+'</div>'+
   (rows.length?'<div class="card"><h2>Highest spending</h2>'+rows.slice(0,3).map((r,i)=>'<div class="kv"><span>'+(i+1)+'. '+esc((catOf(r.id)||{name:r.id}).name)+'</span><span>'+fmt(r.v)+'</span></div>').join('')+'</div>':'')+
   '<div class="card"><h2>Six-month trend</h2>'+barSvg(trend,'Spending over six months: '+trend.map(t=>t.l+' '+fmt(t.v)).join(', '))+'</div>'+
   '<div class="card"><h2>Recurring expenses</h2>'+(rec3.length?'<p class="sub" style="margin-bottom:6px">Categories recorded in each of the last 3 months, with the monthly average.</p>'+rec3.map(r=>'<div class="kv"><span>'+esc(r.c.name)+'</span><span>'+fmt(r.avg)+'</span></div>').join(''):'<p class="sub">Nothing has repeated for 3 months in a row yet.</p>')+'</div>'+
   '<div class="card"><h2>Travel</h2><div class="kv"><span>Fuel</span><span>'+fmt(fS)+'</span></div><div class="kv"><span>Toll</span><span>'+fmt(tS)+'</span></div>'+(oS?'<div class="kv"><span>Other travel charges</span><span>'+fmt(oS)+'</span></div>':'')+'<div class="kv"><span>Actual travel spending</span><span>'+fmt(fS+tS+oS)+'</span></div><div class="kv"><span>Distance (not spending)</span><span>'+qtyStr(km)+' km</span></div></div>'+
   (S.houses.length>1?'<div class="card"><h2>Electricity by house</h2>'+S.houses.map(h=>'<div class="kv"><span>'+esc(h.name)+'</span><span>'+fmt(sum(recsIn(mk,r=>r.cat==='electricity'&&r.houseId===h.id&&counted(r))))+'</span></div>').join('')+'</div>':'')+
   '<div class="card"><h2>Rent</h2><div class="kv"><span>Rent paid (counted)</span><span>'+fmt(rp)+'</span></div><div class="kv"><span>Rent received (income)</span><span style="color:var(--good)">'+fmt(rr)+'</span></div><div class="kv"><span>Net rent</span><span>'+fmt(rr-rp)+'</span></div></div>';
};

