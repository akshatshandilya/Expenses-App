/* Export, backup, restore and the lock screen buttons. */
import {A} from './registry.js';
import {S,DLG,persist,replaceState,blank,migrateState} from '../data/state.js';
import {$} from '../core/util.js';
import {sheet,closeL,ask,toast,tab} from './nav.js';
import {buildCsv,csvMonths,csvCount} from '../core/csv.js';
import {encryptBackup,decryptBackup} from '../core/backup.js';
import {platform} from '../native/platform.js';
import {activeProfile,markMoved} from '../data/profiles.js';
import {withoutLock,showLock,unlock,applyLockEffects} from '../native/lock.js';
import {applyTheme} from './actions.js';
import {today,curMonth,monLabel} from '../core/dates.js';
import {esc} from '../core/util.js';

export const MAX_BACKUP_BYTES=30*1024*1024;
function csvSheet(){
  const m=DLG.csvMode,ms=csvMonths(),rev=ms,opt=(v,sel)=>rev.map(x=>'<option value="'+x+'"'+(x===sel?' selected':'')+'>'+esc(monLabel(x))+'</option>').join('');
  const tab=(v,l)=>'<button role="tab" aria-selected="'+(m===v)+'" class="'+(m===v?'on':'')+'" data-act="csvMode" data-v="'+v+'">'+l+'</button>';
  const body=m==='month'?'<div class="fld"><label for="csvMonth">Month</label><select id="csvMonth" data-d="csvMonth">'+opt('',DLG.csvMonth)+'</select></div>'
   :m==='custom'?'<div class="fld"><label for="csvFrom">From</label><select id="csvFrom" data-d="csvFrom">'+opt('',DLG.csvFrom)+'</select></div><div class="fld"><label for="csvTo">To</label><select id="csvTo" data-d="csvTo">'+opt('',DLG.csvTo)+'</select></div>'
   :'<p class="sub" style="margin:0 0 10px">Every expense, rent entry and distance record in this profile.</p>';
  sheet('<h2>Export to CSV</h2><div class="seg" role="tablist" style="margin:10px 0 12px">'+tab('all','All')+tab('month','Month')+tab('custom','Custom')+'</div>'+body+'<p class="err" id="csvErr" role="alert"></p><p class="sub" style="margin-bottom:10px">'+(m==='all'?'':'Months run from when you first added data. ')+'Cells that start with a formula character are made safe for spreadsheets. The file is made on this phone and handed to the Android share sheet, where you choose where to save it.</p><div class="row2"><button class="btn" data-act="closeL">Close</button><button class="btn pri" data-act="saveCsv">Save CSV</button></div>');
}
Object.assign(A,{
  lockNow:()=>showLock(false),
  unlock:()=>unlock(),
  exportCsv:()=>{DLG.csvMode='all';const ms=csvMonths();DLG.csvMonth=ms[ms.length-1];DLG.csvFrom=ms[0];DLG.csvTo=ms[ms.length-1];csvSheet();},
  csvMode:el=>{DLG.csvMode=el.dataset.v;csvSheet();},
  saveCsv:async()=>{
    const m=DLG.csvMode,o=m==='month'?{from:DLG.csvMonth,to:DLG.csvMonth}:m==='custom'?{from:DLG.csvFrom,to:DLG.csvTo}:{};
    const err=document.getElementById('csvErr');
    if(m==='custom'&&o.from>o.to){err.textContent='"From" must not be after "To".';return;}
    if(!csvCount(o)){err.textContent='There are no records in this period.';return;}
    const tag=m==='month'?o.from:m==='custom'?o.from+'_to_'+o.to:'all';
    try{const ok=await withoutLock(platform.shareTempFile('Expenses-'+tag+'-'+today()+'.csv','\uFEFF'+buildCsv(o),'Export to CSV'));closeL();if(ok)toast('CSV ready');}
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
      /* Sync bookkeeping belongs to the profile that is open, not to the file: a restore into a shared profile is sent as ordinary edits; into a personal one it carries no sync identity. */
      if(!activeProfile().shared)markMoved(activeProfile().id,false);
      if(activeProfile().shared&&S.sync)n.sync=S.sync;else delete n.sync;
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
