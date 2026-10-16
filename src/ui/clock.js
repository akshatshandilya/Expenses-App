/* @auto-imports */
import {dayLine,fmtClock,fmtDate,monLabel,today,ymd} from '../core/dates.js';
import {$} from '../core/util.js';
import {S,UI} from '../data/state.js';
import {closeL,draw,toast} from './nav.js';
/* @end-imports */
export function miniCal(mk){
  const a=mk.split('-').map(Number),y=a[0],m=a[1],first=new Date(y,m-1,1).getDay(),dim=new Date(y,m,0).getDate(),t=today();
  const has=new Set(S.records.map(r=>r.date).concat(S.dist.map(d=>d.date)));
  let h='<div class="cal" role="group" aria-label="'+monLabel(mk)+'">'+['S','M','T','W','T','F','S'].map(d=>'<div class="dw" aria-hidden="true">'+d+'</div>').join('');
  for(let i=0;i<first;i++)h+='<div></div>';
  for(let d=1;d<=dim;d++){const ds=ymd(y,m,d);h+='<div class="day'+(has.has(ds)?' has':'')+(ds===t?' sel':'')+'"'+(ds===t?' aria-current="date"':'')+'>'+d+'<i></i></div>';}
  return h+'</div>';
}
export let lastDay=today();
export function tick(){
  const t=today();
  if(t!==lastDay){
    const prevMon=lastDay.slice(0,7);lastDay=t;UI.wsel=null;
    let msg='New day: '+fmtDate(t);
    if(S.mon===prevMon&&t.slice(0,7)!==prevMon){S.mon=t.slice(0,7);msg='New month: '+monLabel(S.mon);}
    else if(S.mon===prevMon)S.mon=t.slice(0,7);
    if($('#tsDate'))closeL();
    draw(true);toast(msg);
  }
  const a=$('#clkDate');if(a)a.textContent=dayLine();
  const b=$('#clkTime');if(b)b.textContent=fmtClock();
  const c=$('#tsTime');if(c)c.textContent=fmtClock();
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
