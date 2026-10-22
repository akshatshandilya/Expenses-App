import {A} from './registry.js';
import {S,UI,persist} from '../data/state.js';
import {$} from '../core/util.js';
import {fmtDate} from '../core/dates.js';
import {layer,closeL,draw,toast} from './nav.js';
import {onField,refreshCabRoutes} from './entry.js';
import {onQuickInput} from './quick.js';
import {expListHtml} from './views-home.js';
import {toggleLock} from '../native/lock.js';
import {onBackupFile} from './data-actions.js';
import {DLG} from '../data/state.js';

export function bindEvents(){
  const shell=$('#shell');
  shell.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el||el.disabled||el.dataset.act==='rentToggle')return;const f=A[el.dataset.act];if(f)f(el,e);});
  function onInput(e){
    const el=e.target;
    if(el.dataset.act==='rentToggle'){if(e.type==='change')A.rentToggle(el);return;}
    if(el.dataset.act==='rentStatusDate'){
      const display=el.closest('.rent-date-field')?.querySelector('[data-rent-date-display]');
      if(display)display.textContent=fmtDate(el.value);
      return;
    }
    if(el.dataset.rt){
      const r=S.routes.find(x=>x.id===el.dataset.rt);if(!r)return;
      const v=el.value.trim(),dup=S.routes.some(x=>x.id!==r.id&&x.name.toLowerCase()===v.toLowerCase());
      if(e.type==='change'){
        if(!v){el.value=r.name;toast('A route needs a name','bad');}
        else if(dup){el.value=r.name;toast('You already have a route with this name','bad');}
        else if(r.name!==v){r.name=v;refreshCabRoutes();persist();draw(true);}
      }else if(v&&!dup&&r.name!==v){r.name=v;refreshCabRoutes();persist();draw(true);}
      return;
    }
    if(onQuickInput(el,e.type))return;
    if(el.id==='rbFile'){if(e.type==='change')onBackupFile(el);return;}
    if(el.dataset.f){onField(el);return;}
    if(el.dataset.d){DLG[el.dataset.d]=el.value;if(el.dataset.d==='ncn'&&DLG.nc)DLG.nc.name=el.value;if(el.dataset.d==='ncu'&&DLG.nc)DLG.nc.unit=el.value;return;}
    if(el.dataset.q){UI.q=el.value;const l=$('#explist');if(l)l.innerHTML=expListHtml();return;}
    if(el.dataset.sort){UI.sort=el.value;const l=$('#explist');if(l)l.innerHTML=expListHtml();return;}
    if(el.dataset.lock){if(e.type==='change')toggleLock(el);return;}
  }
  shell.addEventListener('input',onInput);
  shell.addEventListener('change',onInput);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!layer.hidden)closeL();});
}
