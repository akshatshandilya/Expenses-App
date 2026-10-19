/* @auto-imports */
import {$,esc} from '../core/util.js';
import {DLG,S,catOf} from '../data/state.js';
import {clearF,getF,recalc,syncShow} from './entry.js';
import {ic} from './icons.js';
import {A,V} from './registry.js';
/* @end-imports */
export const TABS=['home','expenses','reports','settings'];
export const stack=[{n:'welcome',p:{}}];
export function setStack(a){stack.length=0;a.forEach(x=>stack.push(x));}
export let ASK=null;
/* ---------- navigation & drawing ---------- */
export const scr=$('#screen'),navEl=$('#nav'),layer=$('#layer'),toastEl=$('#toast'),lockl=$('#lockl');
export function draw(keep){
  const t=stack[stack.length-1],st=scr.scrollTop;
  scr.innerHTML=(V[t.n]||V.home)(t.p||{});
  const root=stack.length===1&&TABS.indexOf(t.n)>=0;
  scr.classList.toggle('nonav',!root);navEl.hidden=!root;
  if(root)navEl.innerHTML=[['home','home','Home'],['expenses','list','Expenses'],['reports','chart','Reports'],['settings','sliders','Settings']].map(a=>'<button data-act="tab" data-t="'+a[0]+'"'+(t.n===a[0]?' aria-current="page"':'')+'>'+ic(a[1],22)+a[2]+'</button>').join('');
  scr.scrollTop=keep?st:0;
  if(t.n==='entry'&&getF()){recalc();syncShow();}
}
export function go(n,p){stack.push({n:n,p:p||{}});draw();}
export function tab(n){setStack([{n:n,p:{}}]);clearF();draw();}
export function back(){if(stack.length>1){stack.pop();clearF();draw();}}
export function openCat(id){const c=catOf(id);if(!c)return;
  if(c.kind==='water'){go(S.prices.water?'water':'wSetup');}
  else if(c.id==='electricity')go('electricity');else if(c.kind==='travel')go('travel');else if(c.kind==='rent')go('rent');else if(c.kind==='cab')go('cab');else go('cat',{id:id});}
export function toast(m,k){toastEl.className='toast'+(k==='bad'?' bad':'');toastEl.innerHTML=(k==='bad'?'':ic('check',18))+esc(m);toastEl.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{toastEl.hidden=true;},2400);}
export function sheet(html,mid){layer.className='layer'+(mid?' mid':'');layer.innerHTML='<div class="scrim" data-act="closeL"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>'+html+'</div>';layer.hidden=false;const f=$('input,textarea,select,button.btn',layer);}
export function closeL(){layer.hidden=true;layer.innerHTML='';}
export function ask(o){ASK=o;sheet('<h2>'+esc(o.title)+'</h2><p class="sub">'+esc(o.msg)+'</p>'+(o.type?'<div class="fld" style="margin:14px 0 0"><label for="typed">Type <b>'+esc(o.type)+'</b> to confirm</label><input id="typed" type="text" data-d="typed" autocomplete="off"><p class="err" id="askErr" role="alert"></p></div>':'')+'<div class="row2"><button class="btn" data-act="closeL">Cancel</button><button class="btn '+(o.danger?'dan':'pri')+'" data-act="askOk">'+esc(o.ok)+'</button></div>',true);}
Object.assign(A,{
 askOk:()=>{if(!ASK)return;if(ASK.type&&(DLG.typed||'').trim()!==ASK.type){$('#askErr').textContent='Type '+ASK.type+' exactly to continue.';return;}const f=ASK.fn;ASK=null;f();}
});
