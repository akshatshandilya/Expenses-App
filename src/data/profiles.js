/* Profiles: each profile is a separate set of records kept in its own encrypted files on this phone.
   - The first profile ("Personal") uses the original data files, so existing data opens unchanged and an older
     version of the app can still read it.
   - The list of profiles lives in a small encrypted registry. It is only written the first time a profile is added,
     renamed or switched, so someone who never uses profiles never gets a registry file at all.
   - Theme and app-lock settings belong to the phone, not to a profile, so they are carried across when switching. */
import {platform} from '../native/platform.js';
import {readBest,writeSlots,switchStore,slotsFor,loadState,flushState} from './storage.js';
import {S,UI,replaceState,blank,migrateState,persist,flags} from './state.js';
import {curMonth} from '../core/dates.js';
import {track} from './changes.js';

export const REG_SLOTS=['profiles-a.bin','profiles-b.bin'];
export const MAIN='main';
export const MAX_NAME=40;
export const MAX_PROFILES=12;
const ID_RE=/^[a-z0-9]{1,24}$/;
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/* Something that must finish before the open profile changes (a sync in progress). Set by the sync service. */
let guard=async()=>{};
export const setSwitchGuard=f=>{guard=f||(async()=>{});};

/* The one live copy of the profile list. `stored` is true once it has been written; `bad` means files exist
   but could not be opened, in which case nothing is written so they are never overwritten. */
export const REG={v:1,active:MAIN,profiles:[{id:MAIN,name:'Personal',shared:false}],stored:false,bad:false};

function setReg(r){
  REG.v=1;REG.active=r.active;REG.profiles=r.profiles;REG.stored=!!r.stored;REG.bad=!!r.bad;
}
export function defaultRegistry(){return{v:1,active:MAIN,profiles:[{id:MAIN,name:'Personal',shared:false}],stored:false,bad:false};}

/* Returns a cleaned registry, or null if the document is not a usable one. */
export function validateRegistry(x){
  if(!x||typeof x!=='object'||x.v!==1||!Array.isArray(x.profiles)||typeof x.active!=='string')return null;
  const seen=new Set(),out=[];
  for(const p of x.profiles){
    if(!p||typeof p.id!=='string'||!ID_RE.test(p.id)||seen.has(p.id))return null;
    if(typeof p.name!=='string'||!p.name.trim()||p.name.length>MAX_NAME)return null;
    seen.add(p.id);
    if(p.shared===true){if(typeof p.remote!=='string'||!UUID_RE.test(p.remote))return null;out.push({id:p.id,name:p.name.trim(),shared:true,remote:p.remote});}
    else out.push(p.moved===true?{id:p.id,name:p.name.trim(),shared:false,moved:true}:{id:p.id,name:p.name.trim(),shared:false});
  }
  if(!out.length||out.length>MAX_PROFILES||!seen.has(x.active))return null;
  return{v:1,active:x.active,profiles:out};
}

export async function loadRegistry(){
  let r;
  try{r=await readBest(REG_SLOTS);}catch(e){r={found:0,best:null};}
  if(!r.best){setReg(Object.assign(defaultRegistry(),{bad:r.found>0}));return REG;}
  const v=validateRegistry(r.best.data);
  if(!v){setReg(Object.assign(defaultRegistry(),{bad:true}));return REG;}
  setReg(Object.assign(v,{stored:true,bad:false}));return REG;
}
let saving=Promise.resolve();
export function saveRegistry(){
  if(REG.bad)return Promise.reject(Object.assign(new Error('registry unreadable'),{code:'registry'}));
  const doc={v:1,active:REG.active,profiles:REG.profiles.map(p=>p.shared?{id:p.id,name:p.name,shared:true,remote:p.remote}:p.moved?{id:p.id,name:p.name,shared:false,moved:true}:{id:p.id,name:p.name,shared:false})};
  const run=()=>writeSlots(REG_SLOTS,doc).then(()=>{REG.stored=true;});
  saving=saving.then(run,run);return saving;
}

/* Read a profile's data without opening it (to copy records from it). Returns null if it has none or cannot be opened. */
export async function peekProfile(id){
  if(id===REG.active)return JSON.parse(JSON.stringify(S));
  try{const r=await readBest(slotsFor(id));return r.best?r.best.data:null;}catch(e){return null;}
}
/* Add a shared profile to the list without opening it. Its data is fetched the first time it is opened. */
export async function addSharedEntry(name,remote){
  if(REG.bad)throw Object.assign(new Error('registry unreadable'),{code:'registry'});
  if(REG.profiles.length>=MAX_PROFILES)throw Object.assign(new Error('limit'),{code:'limit'});
  const p={id:newId(),name:uniqueName(name),shared:true,remote};REG.profiles.push(p);
  try{await saveRegistry();}catch(e){REG.profiles=REG.profiles.filter(x=>x!==p);throw e;}return p;
}
/* Remember that a personal profile's records have been copied into a shared profile (hides "Make this a shared profile"), or forget it. */
export async function markMoved(id,on){const p=profileOf(id);if(!p||p.shared||!!p.moved===!!on)return;if(on)p.moved=true;else delete p.moved;try{await saveRegistry();}catch(e){}}
/* Forget a profile on this phone only (used when signing out or leaving). Never touches the cloud. */
export async function dropLocalProfile(id){
  const p=profileOf(id);if(!p)return;
  if(REG.profiles.length<2){const e=Object.assign(new Error('Keep at least one profile.'),{code:'last'});throw e;}
  await deleteProfile(id,{skipShared:true,noGuard:true});
}
export const profileOf=id=>REG.profiles.find(p=>p.id===id);
export const activeProfile=()=>profileOf(REG.active)||REG.profiles[0];
export const hasSeveral=()=>REG.profiles.length>1;
export const sharedProfiles=()=>REG.profiles.filter(p=>p.shared);
export const byRemote=r=>REG.profiles.find(p=>p.shared&&p.remote===r);
/* A name that is not taken yet: "Home", then "Home (2)", ... */
export function uniqueName(name){let n=String(name).trim().slice(0,MAX_NAME),k=2,base=n;while(nameError(n)){n=base.slice(0,MAX_NAME-5)+' ('+k+')';k++;if(k>50)break;}return n;}

/* '' when the name is fine, otherwise a message to show next to the field. */
export function nameError(name,exceptId){
  const n=String(name==null?'':name).trim();
  if(!n)return 'Enter a profile name.';
  if(n.length>MAX_NAME)return 'Use '+MAX_NAME+' characters or fewer.';
  if(/[\u0000-\u001f\u007f]/.test(n))return 'Use letters, numbers and punctuation only.';
  if(REG.profiles.some(p=>p.id!==exceptId&&p.name.trim().toLowerCase()===n.toLowerCase()))return 'You already have a profile with this name.';
  return '';
}
function newId(){let id;do{id='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}while(profileOf(id));return id.slice(0,24);}

/* Fields that belong to the phone and follow the person from profile to profile. */
const deviceFields=()=>({theme:S.theme,lock:S.lock});
export function resetFilters(){
  UI.q='';UI.cf='all';UI.sort='dateDesc';UI.rv='month';UI.rentDir='paid';UI.rentHouse='all';UI.eh='all';UI.wbh='all';UI.wsel=null;UI.categorySelection=[];
}

/* Make another profile the open one: load its data into S. Resolves with {created:true} if the profile had no data yet.
   If its files cannot be opened, the previous profile stays open and an error with code 'unreadable' is thrown. */
export async function activateProfile(id,opts){
  const p=profileOf(id);if(!p)throw Object.assign(new Error('missing'),{code:'missing'});
  if(!(opts&&opts.noGuard))await guard();
  const prev=REG.active,dev=deviceFields();
  await flushState();
  await switchStore(slotsFor(id));
  let loaded=null;
  try{
    loaded=(await loadState()).state;
    if(loaded&&!(loaded.v===1&&Array.isArray(loaded.records)))throw new Error('shape');
  }catch(e){
    await switchStore(slotsFor(prev));
    throw Object.assign(new Error('unreadable'),{code:'unreadable'});
  }
  let next;
  if(loaded){if(!Array.isArray(loaded.houses))loaded.houses=[];if(!loaded.lock)loaded.lock={on:false,timeout:30};migrateState(loaded);next=loaded;}
  else{next=blank();if(p.shared)track(next,0);if(opts&&opts.init)opts.init(next);}
  const changed=!loaded||loaded.theme!==dev.theme||JSON.stringify(loaded.lock)!==JSON.stringify(dev.lock)||!loaded.onboarded;
  next.theme=dev.theme||'system';next.lock=dev.lock||{on:false,timeout:30};next.onboarded=true;next.mon=curMonth();
  replaceState(next);flags.readOnly=false;resetFilters();
  REG.active=id;
  if(prev!==id||!REG.stored){try{await saveRegistry();}catch(e){if(e.code!=='registry')throw e;}}
  if(changed)persist();
  return{created:!loaded};
}

export async function createProfile(name,opts){
  const err=nameError(name);if(err)throw Object.assign(new Error(err),{code:'name'});
  if(REG.bad)throw Object.assign(new Error('registry unreadable'),{code:'registry'});
  if(REG.profiles.length>=MAX_PROFILES)throw Object.assign(new Error('You can have up to '+MAX_PROFILES+' profiles.'),{code:'limit'});
  const p=opts&&opts.remote?{id:newId(),name:String(name).trim(),shared:true,remote:opts.remote}:{id:newId(),name:String(name).trim(),shared:false};
  REG.profiles.push(p);
  try{await activateProfile(p.id,opts);}
  catch(e){REG.profiles=REG.profiles.filter(x=>x.id!==p.id);throw e;}
  return p;
}

export async function renameProfile(id,name){
  const err=nameError(name,id);if(err)throw Object.assign(new Error(err),{code:'name'});
  const p=profileOf(id);if(!p)throw Object.assign(new Error('missing'),{code:'missing'});
  const old=p.name;p.name=String(name).trim();
  try{await saveRegistry();}catch(e){p.name=old;throw e;}
}

/* Remove a profile and its data files. The last remaining profile cannot be removed. */
export async function deleteProfile(id,opts){
  if(REG.bad)throw Object.assign(new Error('registry unreadable'),{code:'registry'});
  const p=profileOf(id);if(!p)throw Object.assign(new Error('missing'),{code:'missing'});
  if(REG.profiles.length<2)throw Object.assign(new Error('Keep at least one profile.'),{code:'last'});
  if(REG.active===id){const other=REG.profiles.find(x=>x.id!==id&&!(opts&&opts.skipShared&&x.shared))||REG.profiles.find(x=>x.id!==id);await activateProfile(other.id,opts&&opts.noGuard?{noGuard:true}:undefined);}
  const before=REG.profiles;
  REG.profiles=REG.profiles.filter(x=>x.id!==id);
  try{await saveRegistry();}catch(e){REG.profiles=before;throw e;}
  for(const f of slotsFor(id))await platform.deleteFile(f);
}

/* Empty a local profile's records (used after its records have been moved into a shared profile), then return to `backId`. */
export async function clearProfileData(id,backId){
  await activateProfile(id);
  const t=S.theme,l=S.lock;replaceState(blank());S.onboarded=true;S.theme=t;S.lock=l;S.mon=curMonth();persist();
  await activateProfile(backId);
}
