/* Export, backup, restore and the lock screen buttons. */
import {A} from './registry.js';
import {S,DLG,persist,replaceState,blank,migrateState} from '../data/state.js';
import {$} from '../core/util.js';
import {sheet,closeL,ask,toast,tab} from './nav.js';
import {buildCsv} from '../core/csv.js';
import {encryptBackup,decryptBackup} from '../core/backup.js';
import {platform} from '../native/platform.js';
import {withoutLock,showLock,unlock,applyLockEffects} from '../native/lock.js';
import {applyTheme} from './actions.js';
import {today,curMonth} from '../core/dates.js';
import {esc} from '../core/util.js';

export const MAX_BACKUP_BYTES=30*1024*1024;
Object.assign(A,{
  lockNow:()=>showLock(false),
  unlock:()=>unlock(),
  exportCsv:()=>sheet('<h2>Export to CSV</h2><p class="sub" style="margin-bottom:10px">Cells that start with a formula character are made safe for spreadsheets. The file is made on this phone and handed to the Android share sheet, where you choose where to save it.</p><div class="row2"><button class="btn" data-act="closeL">Close</button><button class="btn pri" data-act="saveCsv">Save CSV</button></div>'),
  saveCsv:async()=>{
    try{const ok=await withoutLock(platform.shareTempFile('Expenses-'+today()+'.csv','\uFEFF'+buildCsv(),'Export to CSV'));closeL();if(ok)toast('CSV ready');}
    catch(e){toast('Could not create the file','bad');}
  },
  mkBackup:async()=>{
    const e=$('#bErr'),a=DLG.bp1||'',b=DLG.bp2||'';
    if(a.length<8){e.textContent='Use at least 8 characters.';return;}
    if(a!==b){e.textContent='The passphrases do not match.';return;}
    e.textContent='';
    try{
      const t=await encryptBackup(a);
      const ok=await withoutLock(platform.shareTempFile('Expenses-backup-'+today()+'.expbk',t,'Save encrypted backup'));
      DLG.bp1=DLG.bp2='';
      if(ok)sheet('<h2>Backup created</h2><p class="sub" style="margin-bottom:10px">Your encrypted backup was handed to the share sheet. Keep the file and the passphrase somewhere safe. Without the passphrase it cannot be opened.</p><div class="row2"><button class="btn pri" data-act="closeL">Done</button></div>');
    }catch(x){e.textContent='Could not create the backup.';}
  },
  pickBackup:()=>{const i=$('#rbFile');if(i){withoutLock(new Promise(res=>{i.addEventListener('change',res,{once:true});i.addEventListener('cancel',res,{once:true});setTimeout(res,120000);}));i.click();}},
  chkRestore:async()=>{
    const e=$('#rErr');e.textContent='';
    if(!DLG.rbText){e.textContent='Choose a backup file first.';return;}
    let data;try{data=await decryptBackup(DLG.rbText,DLG.rp||'');}catch(x){e.textContent=x.message;return;}
    ask({title:'Replace everything with this backup?',msg:'It contains '+data.records.length+' records and '+data.dist.length+' journeys. Your current data on this device will be replaced.',ok:'Restore',danger:true,fn:()=>{
      const t=S.theme;const n=data;n.v=1;if(!Array.isArray(n.houses))n.houses=[];migrateState(n);n.onboarded=true;n.theme=n.theme||t;n.mon=curMonth();if(!n.lock)n.lock={on:false,timeout:30};
      flags.readOnly=false;replaceState(n);persist();DLG.rbText='';DLG.rbName='';DLG.rp='';applyTheme();applyLockEffects();closeL();tab('home');toast('Backup restored');}});
  }
});
/* A file was chosen in the restore card. */
export function onBackupFile(el){
  const f=el.files&&el.files[0];const e=$('#rErr');
  if(!f)return;
  if(f.size>MAX_BACKUP_BYTES){DLG.rbText='';if(e)e.textContent='That file is too large to be an Expenses backup.';return;}
  f.text().then(t=>{DLG.rbText=t;DLG.rbName=f.name;const n=$('#rbName');if(n)n.textContent=f.name;if(e)e.textContent='';}).catch(()=>{if(e)e.textContent='Could not read that file.';});
}

/* Recovery after unreadable data (see main.js) */
import {flags} from '../data/state.js';
import {go} from './nav.js';
Object.assign(A,{
  restoreFirst:()=>{closeL();go('backup');},
  startFresh:()=>ask({title:'Start with an empty app?',msg:'The unreadable data stays on the phone until it is overwritten by your next change. Only do this if you have no backup to restore.',ok:'Start empty',danger:true,fn:()=>{flags.readOnly=false;replaceState(blank());S.onboarded=true;S.mon=curMonth();persist();closeL();tab('home');}})
});
