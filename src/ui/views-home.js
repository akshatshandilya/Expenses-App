/* @auto-imports */
import {MONTHS,addMonths,dayLine,fmtClock,fmtDate,monLabel,weekday} from '../core/dates.js';
import {fmt} from '../core/money.js';
import {catSpent,counted,isIncome,recsIn,spent,sum} from '../core/rules.js';
import {esc} from '../core/util.js';
import {S,UI} from '../data/state.js';
import {chipOf,empty,hd,monNav,recList,recRow,recTitle} from './components.js';
import {ic} from './icons.js';
import {V} from './registry.js';
/* @end-imports */
V.welcome=()=>'<div class="welcome"><div class="brand"><span class="logo">'+ic('wallet',28)+'</span><h1>Expenses</h1></div>'+
 '<p class="lead">A private monthly log for your household spending. It works offline and keeps everything on your phone.</p>'+
 '<ul class="pts"><li>'+ic('shield',22)+'<div><b>No account, no tracking</b><span>No sign-up, ads or analytics. Nothing is sent to a server.</span></div></li>'+
 '<li>'+ic('lock',22)+'<div><b>Yours alone</b><span>Optional app lock with your fingerprint or screen lock.</span></div></li>'+
 '<li>'+ic('download',22)+'<div><b>You stay in control</b><span>Export, back up or delete your records any time.</span></div></li></ul>'+
 '<button class="btn pri block" data-act="start">Get started</button></div>';

V.home=()=>{
  const mk=S.mon,tot=spent(mk),prev=spent(addMonths(mk,-1));
  const recv=sum(recsIn(mk,r=>isIncome(r)&&r.status!=='due'));
  const due=sum(recsIn(mk,r=>r.status==='due'&&!isIncome(r)));
  const h=new Date().getHours(),g=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  let delta;
  if(!prev&&!tot)delta='Nothing recorded for this month yet.';
  else if(!prev)delta='No spending recorded in '+MONTHS[+addMonths(mk,-1).slice(5)-1]+'.';
  else{const pc=Math.round((tot-prev)/prev*100);delta=(pc===0?'Same as ':Math.abs(pc)+'% '+(pc>0?'more':'less')+' than ')+MONTHS[+addMonths(mk,-1).slice(5)-1]+' ('+fmt(prev)+')';}
  const tiles=S.cats.map(c=>{const t=catSpent(mk,c.id);const rv=c.kind==='rent'?sum(recsIn(mk,r=>isIncome(r)&&r.status!=='due')):0;
    return '<button class="tile" data-act="openCat" data-id="'+esc(c.id)+'">'+chipOf(c)+'<b>'+esc(c.name)+'</b><span class="num">'+fmt(t)+'</span>'+(rv?'<small>+'+fmt(rv)+' received</small>':'')+'</button>';}).join('')+
    '<button class="tile add" data-act="newCat" aria-label="Add a custom category">'+ic('plus',24)+'<b>New category</b></button>';
  const recent=S.records.slice().sort((a,b)=>(b.ts||0)-(a.ts||0)||(a.date<b.date?1:-1)).slice(0,5);
  return '<header class="th"><div><div class="eyebrow">'+g+'</div><h1>Expenses</h1></div><button class="clockb" data-act="todaySheet" aria-label="Open today and calendar"><span class="clkd">'+ic('calendar',16)+'<span id="clkDate">'+dayLine()+'</span></span><span class="clkt" id="clkTime">'+fmtClock()+'</span></button></header>'+monNav()+
   '<section class="card hero" aria-label="Month summary"><div class="eyebrow">Spent in '+monLabel(mk)+'</div><div class="num big">'+fmt(tot)+'</div><div class="delta">'+delta+'</div>'+
   ((recv||due)?'<div class="pills">'+(recv?'<span class="pill good">'+ic('arrIn',14)+'Rent received '+fmt(recv)+' (not counted)</span>':'')+(due?'<span class="pill warn">Due '+fmt(due)+' (not counted yet)</span>':'')+'</div>':'')+'</section>'+
   '<button class="btn pri block" data-act="pick" style="min-height:54px;font-size:16px">'+ic('plus',22)+'Add expense</button>'+
   '<div class="sech"><h2>Categories</h2></div><div class="grid3">'+tiles+'</div>'+
   '<div class="sech"><h2>Recently added</h2><button class="link" data-act="tab" data-t="expenses">See all</button></div>'+
   (recent.length?recList(recent):empty('wallet','No expenses yet','Add your first expense and it will show up here.','<button class="btn pri" data-act="pick">Add expense</button>'));
};

V.pick=()=>hd('Add expense')+'<p class="sub" style="margin:-4px 2px 12px">Choose a category.</p><div class="list">'+S.cats.map(c=>{
  const d={water:'Pick a delivery date on the calendar',travel:'Distance, fuel and toll',rent:'Rent paid or received',cab:'Auto-rickshaw and cab rides',gas:'Cylinders × price',groceries:'Items or a simple total',electricity:'Bills for one or more houses',waterbill:'Monthly bill'}[c.id]||(c.kind==='unit'?'Quantity × price':'Amount and notes');
  return '<button class="rec" data-act="pickGo" data-id="'+esc(c.id)+'">'+chipOf(c)+'<span class="rt"><b>'+esc(c.name)+'</b><small>'+d+'</small></span>'+ic('chevR',18)+'</button>';}).join('')+
  '<button class="rec" data-act="newCat"><span class="ci">'+ic('plus',22)+'</span><span class="rt"><b>New category</b><small>Create your own, such as Internet or School fees</small></span>'+ic('chevR',18)+'</button></div>';

export function filteredRecords(){
  const mk=S.mon,q=UI.q.trim().toLowerCase();
  let a=recsIn(mk).filter(r=>(UI.cf==='all'||r.cat===UI.cf));
  if(q)a=a.filter(r=>(recTitle(r)+' '+(r.notes||'')+' '+(r.party||'')+' '+(r.title||'')).toLowerCase().indexOf(q)>=0);
  const s=UI.sort;
  a.sort((x,y)=>s==='dateDesc'?(x.date<y.date?1:-1):s==='dateAsc'?(x.date<y.date?-1:1):s==='amtDesc'?y.amountP-x.amountP:x.amountP-y.amountP);
  return a;
}
export function expListHtml(){
  const a=filteredRecords();
  if(!a.length)return empty('search',UI.q||UI.cf!=='all'?'No matching records':'No expenses in '+monLabel(S.mon),UI.q||UI.cf!=='all'?'Try a different search or category.':'Records you add for this month will appear here.');
  const tot=sum(a.filter(counted));
  let h='<div class="note" aria-live="polite">'+a.length+' record'+(a.length===1?'':'s')+' · <b>'+fmt(tot)+'</b> counted as spending'+(a.some(isIncome)?' (rent received is income and is excluded)':'')+'</div>';
  if(UI.sort.indexOf('date')===0){
    const g={};a.forEach(r=>{(g[r.date]=g[r.date]||[]).push(r);});
    Object.keys(g).sort().reverse().forEach(d=>{});
    const keys=Object.keys(g).sort();if(UI.sort==='dateDesc')keys.reverse();
    h+=keys.map(d=>'<div class="list"><div class="daylab">'+weekday(d)+', '+fmtDate(d)+'</div>'+g[d].map(recRow).join('')+'</div>').join('');
  }else h+=recList(a);
  return h;
}
V.expenses=()=>{
  const chips='<div class="seg" style="overflow-x:auto;gap:4px"><button class="'+(UI.cf==='all'?'on':'')+'" data-act="cf" data-id="all" style="flex:none">All</button>'+S.cats.map(c=>'<button class="'+(UI.cf===c.id?'on':'')+'" data-act="cf" data-id="'+esc(c.id)+'" style="flex:none;white-space:nowrap">'+esc(c.name)+'</button>').join('')+'</div>';
  return '<header class="th"><h1>Expenses</h1></header>'+monNav()+
   '<div class="fld"><label for="q" class="lb">Search notes and descriptions</label><input id="q" type="search" data-q="1" placeholder="e.g. rice, pharmacy" value="'+esc(UI.q)+'" maxlength="60" autocomplete="off"></div>'+chips+
   '<div class="fld"><label for="sort" class="lb">Sort by</label><select id="sort" data-sort="1"><option value="dateDesc"'+(UI.sort==='dateDesc'?' selected':'')+'>Date, newest first</option><option value="dateAsc"'+(UI.sort==='dateAsc'?' selected':'')+'>Date, oldest first</option><option value="amtDesc"'+(UI.sort==='amtDesc'?' selected':'')+'>Amount, high to low</option><option value="amtAsc"'+(UI.sort==='amtAsc'?' selected':'')+'>Amount, low to high</option></select></div>'+
   '<div id="explist">'+expListHtml()+'</div>';
};

