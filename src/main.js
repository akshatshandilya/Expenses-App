import {S,blank,replaceState,setPersistHook,flags,migrateState} from './data/state.js';
import {$} from './core/util.js';
import {curMonth} from './core/dates.js';
import {loadState,saveState} from './data/storage.js';
import {platform} from './native/platform.js';
import {stack,setStack,draw,back,closeL,sheet,tab,layer} from './ui/nav.js';
import {applyTheme} from './ui/actions.js';
import {bindEvents} from './ui/events.js';
import {tick} from './ui/clock.js';
import {showLock,unlock,onAppState,applyLockEffects,isLocked} from './native/lock.js';
import {playLaunch} from './ui/launch.js';
import './ui/views-home.js';import './ui/views-bills.js';import './ui/views-water.js';import './ui/views-travel-rent.js';
import './ui/views-reports.js';import './ui/views-settings.js';import './ui/entry.js';import './ui/quick.js';
import './ui/actions.js';import './ui/data-actions.js';

export function unreadableScreen(){
  $('#screen').innerHTML='';
  sheet('<h2>Your records could not be opened</h2><p class="sub">The saved data is still on this phone but cannot be read, for example after the phone’s security storage was reset. Nothing has been changed or deleted. You can restore an encrypted backup, or start again with an empty app.</p><div class="row2"><button class="btn" data-act="startFresh">Start empty</button><button class="btn pri" data-act="restoreFirst">Restore a backup</button></div>',true);
}
export async function boot(){
  applyTheme();
  let loaded=null,bad=false;
  try{loaded=(await loadState()).state;}catch(e){bad=true;}
  const first=!loaded;
  if(bad){replaceState(blank());S.onboarded=true;}
  else if(loaded&&loaded.v===1&&Array.isArray(loaded.records)){if(!Array.isArray(loaded.houses))loaded.houses=[];if(!loaded.lock)loaded.lock={on:false,timeout:30};migrateState(loaded);replaceState(loaded);}
  else replaceState(blank());
  S.mon=curMonth();
  flags.readOnly=bad;
  setPersistHook(()=>{if(!flags.readOnly)saveState(S);});
  applyTheme();applyLockEffects();
  bindEvents();
  setStack([{n:S.onboarded?'home':'welcome',p:{}}]);
  platform.onAppState(onAppState);
  platform.onBack(()=>{if(isLocked()){platform.minimize();return;}if(!layer.hidden){closeL();return;}if(stack.length>1){back();return;}if(stack[0].n!=='home'&&S.onboarded){tab('home');return;}platform.minimize();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!isLocked())tick();});
  setInterval(tick,1000);
  if(window.matchMedia)matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>applyTheme());
  platform.cleanTemp();
  const reduced=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  const lockOn=S.lock.on&&S.onboarded&&!bad;
  if(lockOn){showLock(false);}else{draw();}
  const blocks=lockOn?Array.from($('#lockl').children):Array.from($('#screen').children).concat(Array.from($('#nav').hidden?[]:[$('#nav')]));
  if(bad)unreadableScreen();
  await playLaunch(first?'cold':'returning',blocks,reduced);
  if(lockOn)unlock();
  document.documentElement.classList.add('ready');
}
boot();
