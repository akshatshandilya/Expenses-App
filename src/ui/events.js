import {A} from './registry.js';
import {S,UI,persist} from '../data/state.js';
import {$} from '../core/util.js';
import {layer,closeL} from './nav.js';
import {onField} from './entry.js';
import {onQuickInput} from './quick.js';
import {expListHtml} from './views-home.js';
import {toggleLock} from '../native/lock.js';
import {onBackupFile} from './data-actions.js';
import {DLG} from '../data/state.js';

export function bindEvents(){
  const shell=$('#shell');
  shell.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el||el.disabled)return;const f=A[el.dataset.act];if(f)f(el,e);});
  function onInput(e){
    const el=e.target;
    if(onQuickInput(el))return;
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
