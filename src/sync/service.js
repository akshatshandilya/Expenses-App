/* App-side glue for cloud sync: who is signed in, a lock so a sync never lands in the wrong profile, background sync, and the
   profile flows (create shared, join by invite, sign out). The cryptography and server rules live in engine.js and the schema. */
import {S,persist} from '../data/state.js';
import {platform} from '../native/platform.js';
import {REG,activeProfile,byRemote,createProfile,addSharedEntry,dropLocalProfile,peekProfile,activateProfile,saveRegistry,setSwitchGuard,uniqueName,nameError} from '../data/profiles.js';
import * as E from './engine.js';
import {httpBackend} from './backend.js';
import {SUPABASE_URL,SUPABASE_ANON_KEY} from './config.js';

export const SYNC={user:null,status:'idle',last:0,members:[],pending:[],error:''};
const subs=new Set();
export const onSync=f=>{subs.add(f);return()=>subs.delete(f);};
const notify=()=>{for(const f of subs)try{f();}catch(e){}};
const store={get:n=>platform.getSecret(n),set:(n,v)=>platform.setSecret(n,v)};
let be=null;
export const setBackend=b=>{be=b;};
export const configured=()=>!!be||!!(SUPABASE_URL&&SUPABASE_ANON_KEY);
const backend=()=>{if(!be&&SUPABASE_URL&&SUPABASE_ANON_KEY)be=httpBackend({url:SUPABASE_URL,anonKey:SUPABASE_ANON_KEY,store});return be;};
export const nameOf=email=>{const w=String(email||'').split('@')[0].split(/[^A-Za-z]+/).filter(Boolean)[0]||'Someone';return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase();};
export const displayName=u=>(u&&u.name)||nameOf(u&&u.email);
const ctx=()=>({be:backend(),store,state:S,by:SYNC.user?displayName(SYNC.user):undefined});

/* One thing at a time: a sync, a switch of profile, an invite. */
let chain=Promise.resolve();
const exclusive=f=>{const p=chain.then(()=>f());chain=p.then(()=>{},()=>{});return p;};
export const whenIdle=()=>chain;
let redraw=()=>{};export const setRedraw=f=>{redraw=f;};

export const errText=e=>({
  offline:'No internet connection. Your changes are saved and will sync later.',credentials:'That email and password do not match.',unconfirmed:'Confirm your email first. Open the link we sent you, then sign in.',
  exists:'An account with this email already exists. Sign in instead.',weak:'Use a password of at least 8 characters.',badcode:'That code is wrong or has expired. Request a new one.',samepw:'Choose a password you have not used before.',rate:'Too many attempts. Wait a minute and try again.',auth:'Please sign in again.',
  device_limit:'This account is already on 2 phones. Remove one in Account, then try again.',invite_invalid:'This invite link was already used or has expired. Ask for a new one.',
  invite_format:'That does not look like an invite link.',invite_partial:'This invite link is incomplete. Copy the whole link and try again.',already_member:'You are already in this profile.',
  gone:'You no longer have access to this profile.',wrong_phrase:'Those words do not match the recovery key for this account.',check:'One of the words is wrong. Check the spelling and order.',
  word:'One of the words is not in the list. Check the spelling.',count:'Enter all 12 words.',no_recovery:'This account has no recovery key yet.',owner_only:'Only the person who created the profile can do this.',
  profile_limit:'You can have up to 12 shared profiles.',limit:'You can have up to 12 profiles.',registry:'The profile list could not be read, so nothing was changed.'
}[e&&e.code])||'Something went wrong. Please try again.';

export async function init(){
  setSwitchGuard(()=>chain);
  if(!configured())return;
  try{const s=await backend().session();SYNC.user=s?s.user:null;}catch(e){SYNC.user=null;}
  notify();
  if(typeof document!=='undefined'){document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleSync(500);});setInterval(()=>{if(!document.hidden)scheduleSync(0);},60000);}
  scheduleSync(800);
}
const isShared=()=>{const p=activeProfile();return !!(p&&p.shared);};

/* ---- background sync ---- */
let timer=null,again=false,running=false;
export function scheduleSync(ms=2500){
  if(!configured()||!SYNC.user||!isShared())return;
  if(running){again=true;return;}
  clearTimeout(timer);timer=setTimeout(()=>{syncNow().catch(()=>{});},ms);
}
export function syncNow(){
  return exclusive(async()=>{
    const p=activeProfile();if(!configured()||!SYNC.user||!p||!p.shared)return null;
    running=true;SYNC.status='syncing';SYNC.error='';notify();
    try{
      const r=await E.syncProfile(ctx(),p.remote);
      if(r.needsKey){SYNC.status='needsKey';}
      else{
        if(r.pulled>0||r.pushed>0)persist();
        if(r.name&&r.name!==p.name&&!nameError(r.name,p.id)){p.name=r.name;try{await saveRegistry();}catch(e){}}
        try{SYNC.members=await E.listMembers(ctx(),p.remote);SYNC.pending=await E.pendingPhones(ctx(),p.remote);}catch(e){}
        SYNC.status='idle';SYNC.last=Date.now();
        if(r.pulled>0||r.name)redraw();
      }
      return r;
    }catch(e){
      if(e.code==='offline')SYNC.status='offline';
      else if(e.code==='gone')SYNC.status='gone';
      else if(e.code==='auth'){SYNC.status='idle';SYNC.user=null;}
      else{SYNC.status='error';SYNC.error=e.code||'';}
      return null;
    }finally{running=false;notify();if(again){again=false;scheduleSync(1500);}}
  });
}

/* ---- account ---- */
export async function signUp(email,password,name){const r=await backend().signUp(email,password,name);if(r.confirmed){const s=await backend().session();SYNC.user=s.user;notify();}return r;}
export const sendResetCode=email=>backend().recover(email);
export async function resetPassword(email,code,password){
  const r=await backend().resetPassword(email,code,password);SYNC.user=r.user;notify();
  try{await refreshSharedProfiles();}catch(e){}
  return r;
}
export async function signIn(email,password){
  const r=await backend().signIn(email,password);SYNC.user=r.user;notify();
  try{await refreshSharedProfiles();}catch(e){}
  return r;
}
/* Add every shared profile this person belongs to that this phone can open. */
export function refreshSharedProfiles(){
  return exclusive(async()=>{
    const added=[];
    for(const rp of await E.listRemoteProfiles(ctx())){
      if(byRemote(rp.id))continue;
      if(!(await E.tryKey(ctx(),rp.id)))continue;
      const name=(await E.remoteName(ctx(),rp.id))||'Shared';
      added.push(await addSharedEntry(name,rp.id));
    }
    return added;
  });
}
export function signOut(){
  return exclusive(async()=>{
    try{await backend().signOut();}catch(e){}
    SYNC.user=null;SYNC.members=[];SYNC.pending=[];SYNC.status='idle';
    for(const p of REG.profiles.filter(x=>x.shared))await dropLocalProfileSafe(p.id);
    notify();
  });
}
async function dropLocalProfileSafe(id){
  /* If every profile is shared, keep the phone usable by opening a fresh local one first. */
  if(REG.profiles.every(p=>p.shared)){const q=await createProfile(uniqueName('Personal'),{noGuard:true});await activateProfile(q.id,{noGuard:true});}
  if(REG.active===id){const other=REG.profiles.find(x=>!x.shared);await activateProfile(other.id,{noGuard:true});}
  await dropLocalProfile(id);
}

/* ---- shared profiles ---- */
const COPY=['records','dist','houses','cats','routes','mobileBills','prices','kmCost'];
export const countOf=d=>d?(d.records||[]).length:0;
/* Create a shared profile. `importFrom` is the id of a local profile to copy records, houses and prices from. */
export async function createShared(name,importFrom){
  const err=nameError(name);if(err)throw Object.assign(new Error(err),{code:'name'});
  const src=importFrom?await peekProfile(importFrom):null;
  const {remoteId}=await E.createSharedProfile(ctx(),name.trim());
  let p;
  try{p=await createProfile(name,{remote:remoteId,init:next=>{if(src)for(const k of COPY)if(src[k]!==undefined)next[k]=JSON.parse(JSON.stringify(src[k]));}});}
  catch(e){try{await E.deleteSharedProfile(ctx(),remoteId);}catch(x){}throw e;}
  const r=await syncNow();
  return{profile:p,imported:src?countOf(src):0,pushed:r?r.pushed:0,synced:!!r&&!r.needsKey};
}
/* After an import has been uploaded, check the cloud copy has everything before offering to clear the original. */
export function importVerified(srcData){const d=S;return !!srcData&&COPY.every(k=>srcData[k]===undefined||(Array.isArray(srcData[k])?(d[k]||[]).length>=srcData[k].length:true));}
export async function joinInvite(code){
  const j=await E.redeemInvite(ctx(),code);
  let p=byRemote(j.remoteId);
  if(!p)p=await createProfile(uniqueName(j.name),{remote:j.remoteId});
  else await activateProfile(p.id);
  await syncNow();return{profile:p};
}

/* ---- people and phones ---- */
export const inviteLink=async()=>{const p=activeProfile();const r=await E.createInvite(ctx(),p.remote);return 'expenses://join/'+r.code;};
export const parseInvite=E.parseInvite;
export const isOwner=()=>{const u=SYNC.user,m=SYNC.members.find(x=>u&&x.user_id===u.id);return !!m&&m.role==='owner';};
export const removeMember=userId=>exclusive(async()=>{await E.removeMember(ctx(),activeProfile().remote,userId);SYNC.members=await E.listMembers(ctx(),activeProfile().remote);notify();});
export const approvePhone=phone=>exclusive(async()=>{await E.approvePhone(ctx(),activeProfile().remote,phone);SYNC.pending=await E.pendingPhones(ctx(),activeProfile().remote);notify();});
export const renameShared=name=>exclusive(async()=>{const p=activeProfile();await E.renameSharedProfile(ctx(),p.remote,name);});
export const leaveShared=()=>exclusive(async()=>{const p=activeProfile();await E.leaveProfile(ctx(),p.remote);await dropLocalProfileSafe(p.id);});
export const deleteSharedEverywhere=()=>exclusive(async()=>{const p=activeProfile();await E.deleteSharedProfile(ctx(),p.remote);await dropLocalProfileSafe(p.id);});
export const forgetLocal=id=>exclusive(()=>dropLocalProfileSafe(id));
export const devices=()=>E.listDevices(ctx());
export const removeDevice=id=>E.removeDevice(ctx(),id);
export const fingerprintOf=E.fingerprint;

/* ---- recovery key ---- */
export const hasRecovery=()=>E.hasRecovery(ctx());
export const prepareRecovery=()=>E.prepareRecovery();
export const saveRecovery=(phrase,replace)=>exclusive(()=>E.setupRecovery(ctx(),phrase,replace));
export async function restore(phrase){const r=await E.restoreWithRecovery(ctx(),phrase);const added=await refreshSharedProfiles();return{...r,added};}
