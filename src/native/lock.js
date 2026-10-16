/* @auto-imports */
import {lockl,navEl,scr} from '../ui/nav.js';
/* @end-imports */
/* App lock: the phone's own fingerprint / face / screen lock. The app stores no PIN or password of its own. */
import {S,persist} from '../data/state.js';
import {platform} from './platform.js';
import {ic} from '../ui/icons.js';
import {$} from '../core/util.js';
import {draw,toast,closeL} from '../ui/nav.js';
import {tick} from '../ui/clock.js';
import {flushState} from '../data/storage.js';

export let hiddenAt=0,locked=false,busy=false,graceUntil=0,suspended=false;
export const isLocked=()=>locked;

export function applyLockEffects(){platform.setPrivacy(!!(S.lock&&S.lock.on&&S.onboarded));}

export function lockHtml(){
  return '<span class="ci" data-s="1">'+ic('lock',34)+'</span><h1 data-s="2" style="font:700 26px var(--fd)">Expenses is locked</h1><p data-s="3" class="sub" style="max-width:28ch">Unlock with your fingerprint, face or screen lock to see your records.</p><button data-s="4" class="btn pri" data-act="unlock" style="min-width:200px">'+ic('shield',20)+'Unlock</button>';
}
/* Show the lock screen. The page behind it is emptied so no figures stay in the view tree while locked. */
export function showLock(autoPrompt,quiet){
  locked=true;closeL();
  scr.innerHTML='';navEl.hidden=true;
  const l=lockl;l.innerHTML=lockHtml();l.hidden=false;
  if(autoPrompt)setTimeout(()=>{if(locked)unlock();},quiet?0:250);
}
export async function unlock(){
  if(!locked||busy)return;
  busy=true;
  const r=await platform.authenticate('Unlock Expenses');
  busy=false;graceUntil=Date.now()+1500;hiddenAt=0;
  if(r==='ok'){locked=false;lockl.hidden=true;lockl.innerHTML='';draw(true);tick();}
  else if(r==='unavailable'){toast('Set a screen lock in Android settings to unlock','bad');}
  else if(r==='fail'){toast('Could not unlock. Try again.','bad');}
}
/* Switching the lock on or off needs the phone's own confirmation. */
export async function toggleLock(el){
  const want=el.checked;
  if(want&&!(await platform.deviceSecure())){el.checked=false;toast('Set a screen lock or fingerprint in Android settings first','bad');return;}
  busy=true;const r=await platform.authenticate(want?'Turn on app lock':'Turn off app lock');busy=false;graceUntil=Date.now()+1500;
  if(r!=='ok'&&!(r==='unavailable'&&!want)){el.checked=!want;if(r==='fail')toast('Could not confirm. Try again.','bad');return;}
  S.lock.on=want;persist();applyLockEffects();draw(true);
}
/* Android gives the lock no say when it opens its own screens (share sheet, file picker), so wrap those. */
export function withoutLock(promise){
  suspended=true;
  return Promise.resolve(promise).finally(()=>{suspended=false;graceUntil=Date.now()+1500;hiddenAt=0;});
}
export function onAppState(active){
  if(!active){
    flushState();
    if(S.lock&&S.lock.on&&S.onboarded&&!locked&&!busy&&!suspended){hiddenAt=Date.now();if(S.lock.timeout===0)showLock(false);}
    return;
  }
  if(S.lock&&S.lock.on&&S.onboarded&&!locked&&hiddenAt&&!busy&&!suspended&&Date.now()>graceUntil&&(Date.now()-hiddenAt)/1000>=S.lock.timeout)showLock(true);
  hiddenAt=0;
  if(!locked)tick();else if(!lockl.hidden&&!busy&&Date.now()>graceUntil)unlock();
}
