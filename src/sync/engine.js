/* Sync engine for shared profiles. Pure logic over a `ctx` = {be, store, state}:
     be     a backend (see backend.js)         store  {get(name), set(name,value)} for small device secrets
     state  the profile's data object (the app's S) */
import {track,snapshot,applyRemote,LISTS} from '../data/changes.js';
import {b64u,unb64u,randomBytes,newProfileKey,subkeys,encryptItem,decryptItem,encryptName,decryptName,newDeviceKeys,wrapForDevice,unwrapForDevice,makeInvite,openInvite,newRecoveryPhrase,parseRecoveryPhrase,wrapForRecovery,unwrapFromRecovery} from './crypto.js';

const err=(code,extra)=>Object.assign(new Error('sync:'+code),{code},extra);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const J=async(c,k)=>{try{const r=await c.store.get(k);return r?JSON.parse(r):null;}catch(e){return null;}};
const W=(c,k,v)=>c.store.set(k,JSON.stringify(v));
const me=async c=>{const s=await c.be.session();if(!s)throw err('auth');return s.user;};
const wctx=(pid,dev,ver)=>pid+'|'+dev+'|'+ver;
const rctx=(uid,pid,ver)=>'rec|'+uid+'|'+pid+'|'+ver;
const BATCH=200,PAGE=500;

/* ---- this phone ---- */
export async function ensureDevice(c,name){
  const u=await me(c),k='sync.device.'+u.id;let d=await J(c,k);
  if(d){const rows=await c.be.select('devices',{eq:{user_id:u.id,device_id:d.deviceId}});if(rows.length)return d;}
  const kp=await newDeviceKeys(),row=await c.be.insert('devices',{user_id:u.id,name:(name||'Phone').slice(0,40),pub:kp.pub});
  d={deviceId:row.device_id,pub:kp.pub,priv:kp.priv};await W(c,k,d);return d;
}
export async function listDevices(c){const u=await me(c),mine=await J(c,'sync.device.'+u.id);const rows=await c.be.select('devices',{eq:{user_id:u.id}});return rows.map(r=>({deviceId:r.device_id,name:r.name,createdAt:r.created_at,thisPhone:!!mine&&mine.deviceId===r.device_id}));}
export async function removeDevice(c,deviceId){const u=await me(c);await c.be.remove('devices',{eq:{user_id:u.id,device_id:deviceId}});}
export const fingerprint=async pub=>{const h=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(pub.x+'.'+pub.y)));return Array.from(h.slice(0,4)).map(b=>b.toString(16).padStart(2,'0')).join('').replace(/(.{4})(.{4})/,'$1 $2').toUpperCase();};

/* ---- profile keys held on this phone ---- */
const getKeys=async c=>(await J(c,'sync.keys.'+(await me(c)).id))||{};
async function putKey(c,pid,ver,key){const u=await me(c),k='sync.keys.'+u.id,all=(await J(c,k))||{};all[pid]={ver,key:b64u(key)};await W(c,k,all);}
async function dropKey(c,pid){const u=await me(c),k='sync.keys.'+u.id,all=(await J(c,k))||{};delete all[pid];await W(c,k,all);}
export const hasKey=async(c,pid)=>!!(await getKeys(c))[pid];

/* ---- create ---- */
export async function createSharedProfile(c,name){
  const d=await ensureDevice(c),pid=globalThis.crypto.randomUUID(),key=newProfileKey(),sub=await subkeys(key);
  await c.be.rpc('create_profile',{p_id:pid,p_name_box:await encryptName(sub,pid,name),p_device:d.deviceId,p_wrapped:await wrapForDevice(d.pub,key,wctx(pid,d.deviceId,1))});
  await putKey(c,pid,1,key);await refreshRecovery(c,pid);return{remoteId:pid};
}
export async function remoteName(c,pid){
  const p=(await c.be.select('profiles',{eq:{id:pid}}))[0],h=(await getKeys(c))[pid];if(!p||!h)return null;
  try{return await decryptName(await subkeys(unb64u(h.key)),pid,p.name_box);}catch(e){return null;}
}

export async function renameSharedProfile(c,pid,name){
  const h=(await getKeys(c))[pid];if(!h)throw err('no_key');
  await c.be.update('profiles',{eq:{id:pid}},{name_box:await encryptName(await subkeys(unb64u(h.key)),pid,name)});
}
/* ---- sync one profile ---- */
function accept(item){
  const x=item.data;if(item.deleted)return true;
  if(item.list==='prices')return typeof x==='number'||typeof x==='string'||(x&&typeof x==='object');
  if(item.list==='set')return typeof x==='string'||typeof x==='number';
  if(!LISTS.includes(item.list)||!x||typeof x!=='object'||Array.isArray(x)||x.id!==item.id||typeof x.id!=='string'||x.id.length>80)return false;
  for(const f of ['amountP','kmM','qty'])if(x[f]!==undefined&&typeof x[f]!=='number')return false;
  return true;
}
const syncId=s=>{if(!s.sync||typeof s.sync!=='object')track(s);if(!s.sync.id)s.sync.id=b64u(randomBytes(9));return s.sync.id;};
async function acquireKey(c,pid,ver){
  const d=await ensureDevice(c),rows=await c.be.select('profile_keys',{eq:{profile_id:pid,device_id:d.deviceId,key_ver:ver}});
  if(!rows.length)return null;
  const key=await unwrapForDevice(d.priv,rows[0].wrapped,wctx(pid,d.deviceId,ver));await putKey(c,pid,ver,key);return{ver,key:b64u(key)};
}
async function selfGrant(c,pid,ver,key){
  const u=await me(c),d=await ensureDevice(c);
  if((await c.be.select('profile_keys',{eq:{profile_id:pid,device_id:d.deviceId,key_ver:ver}})).length)return;
  await c.be.rpc('grant_device',{p_profile:pid,p_user:u.id,p_device:d.deviceId,p_ver:ver,p_wrapped:await wrapForDevice(d.pub,unb64u(key),wctx(pid,d.deviceId,ver))});
}
/* Returns {pulled,pushed,skipped} or {needsKey:true} or throws (code 'gone' if this person no longer has access). */
export async function syncProfile(c,pid,attempt=0){
  const d=await ensureDevice(c),prof=(await c.be.select('profiles',{eq:{id:pid}}))[0];
  if(!prof)throw err('gone');
  let held=(await getKeys(c))[pid];
  if(!held||held.ver<prof.key_ver){held=await acquireKey(c,pid,prof.key_ver);if(!held)return{needsKey:true};}
  await selfGrant(c,pid,held.ver,held.key);
  const sub=await subkeys(unb64u(held.key)),sid=syncId(c.state),posK='sync.pos.'+(await me(c)).id+'.'+pid;
  let pos=await J(c,posK);if(!pos||pos.id!==sid||pos.ver!==held.ver)pos={id:sid,ver:held.ver,cur:null,p:{}};
  let pulled=0,skipped=0,cur=pos.cur;
  for(let off=0;;off+=PAGE){
    const rows=await c.be.select('items',{eq:{profile_id:pid},gte:pos.cur?{updated_at:pos.cur}:undefined,order:['updated_at','kid'],limit:PAGE,offset:off});
    for(const r of rows){
      if(!cur||r.updated_at>cur)cur=r.updated_at;
      try{const it=await decryptItem(sub,pid,{kid:r.kid,t:Number(r.t),iv:r.iv,ct:r.ct});
        if(!accept(it)){skipped++;continue;}
        if(applyRemote(c.state,it)){pulled++;pos.p[it.key]=it.t;}}
      catch(e){skipped++;}
    }
    if(rows.length<PAGE)break;
  }
  pos.cur=cur;
  if(c.by&&Array.isArray(c.state.records))for(const r of c.state.records)if(r&&!r.by)r.by=c.by;
  track(c.state);let pushed=0;const todo=snapshot(c.state).filter(x=>pos.p[x.key]!==x.t);
  try{
    for(let i=0;i<todo.length;i+=BATCH){
      const part=todo.slice(i,i+BATCH),rows=await Promise.all(part.map(x=>encryptItem(sub,pid,x)));
      await c.be.rpc('put_items',{p_profile:pid,p_ver:held.ver,p_rows:rows});
      for(const x of part)pos.p[x.key]=x.t;pushed+=part.length;
    }
  }catch(e){
    await W(c,posK,pos);
    if(e.code==='stale_key'&&attempt<2)return syncProfile(c,pid,attempt+1);
    throw e;
  }
  await W(c,posK,pos);await refreshRecovery(c,pid);
  let name=null;try{name=await decryptName(sub,pid,prof.name_box);}catch(e){}
  return{pulled,pushed,skipped,name};
}

/* ---- invites ---- */
export async function createInvite(c,pid){
  const h=(await getKeys(c))[pid];if(!h)throw err('no_key');
  const inv=await makeInvite(unb64u(h.key),pid),id=await c.be.rpc('create_invite',{p_profile:pid,p_wrapped:inv.wrapped});
  return{code:id+'.'+inv.secret,expiresInHours:24};
}
export function parseInvite(code){
  const m=String(code||'').trim().match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[.\/#]([A-Za-z0-9_-]{43})/i);
  return m?{id:m[1].toLowerCase(),secret:m[2]}:null;
}
export async function redeemInvite(c,code){
  const inv=parseInvite(code);if(!inv)throw err('invite_format');
  const u=await me(c),d=await ensureDevice(c),r=await c.be.rpc('redeem_invite',{p_invite:inv.id});
  let key,name;
  try{key=await openInvite(inv.secret,r.wrapped,r.profile_id);name=await decryptName(await subkeys(key),r.profile_id,r.name_box);}
  catch(e){try{await c.be.rpc('remove_member',{p_profile:r.profile_id,p_user:u.id});}catch(x){}throw err('invite_partial');}
  await c.be.rpc('grant_device',{p_profile:r.profile_id,p_user:u.id,p_device:d.deviceId,p_ver:r.key_ver,p_wrapped:await wrapForDevice(d.pub,key,wctx(r.profile_id,d.deviceId,r.key_ver))});
  await putKey(c,r.profile_id,r.key_ver,key);await refreshRecovery(c,r.profile_id);
  return{remoteId:r.profile_id,name};
}

/* ---- members and new phones ---- */
export const listMembers=(c,pid)=>c.be.rpc('list_members',{p_profile:pid});
/* Phones of members that do not hold the key yet, each with a short code both people can compare before approving. */
export async function pendingPhones(c,pid){
  const rows=await c.be.rpc('pending_devices',{p_profile:pid}),out=[];
  for(const r of rows)out.push({userId:r.user_id,deviceId:r.device_id,name:r.name,pub:r.pub,fingerprint:await fingerprint(r.pub)});
  return out;
}
export async function approvePhone(c,pid,phone){
  const h=(await getKeys(c))[pid];if(!h)throw err('no_key');
  await c.be.rpc('grant_device',{p_profile:pid,p_user:phone.userId,p_device:phone.deviceId,p_ver:h.ver,p_wrapped:await wrapForDevice(phone.pub,unb64u(h.key),wctx(pid,phone.deviceId,h.ver))});
}
/* Owner removes a member, then replaces the profile key so the removed person's copy is useless. */
export async function removeMember(c,pid,userId){
  await syncProfile(c,pid);
  await c.be.rpc('remove_member',{p_profile:pid,p_user:userId});
  const held=(await getKeys(c))[pid],ver=held.ver+1,key=newProfileKey(),sub=await subkeys(key);
  track(c.state);
  const rows=await Promise.all(snapshot(c.state).map(x=>encryptItem(sub,pid,x)));
  const members=await c.be.rpc('list_members',{p_profile:pid}),ids=new Set(members.map(m=>m.user_id));
  const devs=(await c.be.select('devices',{})).filter(x=>ids.has(x.user_id));
  const keys=[];for(const x of devs)keys.push({user_id:x.user_id,device_id:x.device_id,wrapped:await wrapForDevice(x.pub,key,wctx(pid,x.device_id,ver))});
  const oldName=await remoteName(c,pid),nameBox=await encryptName(sub,pid,oldName||'Shared');
  await c.be.rpc('rotate_profile',{p_profile:pid,p_new_ver:ver,p_name_box:nameBox,p_rows:rows,p_keys:keys});
  await putKey(c,pid,ver,key);
  const sid=syncId(c.state),u=await me(c),p={};for(const x of snapshot(c.state))p[x.key]=x.t;
  await W(c,'sync.pos.'+u.id+'.'+pid,{id:sid,ver,cur:null,p});
  await refreshRecovery(c,pid);
}
export async function leaveProfile(c,pid){const u=await me(c);await c.be.rpc('remove_member',{p_profile:pid,p_user:u.id});await dropKey(c,pid);}
export async function deleteSharedProfile(c,pid){await c.be.rpc('delete_profile',{p_profile:pid});await dropKey(c,pid);}

/* ---- recovery key ---- */
export async function hasRecovery(c){const u=await me(c);return (await c.be.select('user_recovery',{eq:{user_id:u.id}})).length>0;}
/* Returns the 12 words to show the person once. Only the lock-box and the public key go to the server. */
export const prepareRecovery=()=>newRecoveryPhrase();
/* `phrase` is the one shown to the person; nothing is uploaded until they confirm they wrote it down. replace:true swaps an existing key for a new one. */
export async function setupRecovery(c,phrase,replace){
  const u=await me(c);if(!replace&&await hasRecovery(c))throw err('recovery_exists');
  if(!phrase)phrase=await newRecoveryPhrase();
  const ent=await parseRecoveryPhrase(phrase),kp=await newDeviceKeys();
  if(replace)await c.be.remove('recovery_keys',{eq:{user_id:u.id}});
  await c.be.upsert('user_recovery',{user_id:u.id,pub:kp.pub,priv_box:await wrapForRecovery(ent,kp.priv)},'user_id');
  for(const pid of Object.keys(await getKeys(c)))await refreshRecovery(c,pid);
  return phrase;
}
async function refreshRecovery(c,pid){
  const u=await me(c),rec=(await c.be.select('user_recovery',{eq:{user_id:u.id}}))[0],h=(await getKeys(c))[pid];if(!rec||!h)return;
  if((await c.be.select('recovery_keys',{eq:{user_id:u.id,profile_id:pid,key_ver:h.ver}})).length)return;
  await c.be.upsert('recovery_keys',{user_id:u.id,profile_id:pid,key_ver:h.ver,wrapped:await wrapForDevice(rec.pub,unb64u(h.key),rctx(u.id,pid,h.ver))},'user_id,profile_id,key_ver');
}
/* On a new phone: the 12 words unlock the person's profile keys. Returns {restored:[{remoteId,name}], needApproval:[remoteId]}. */
export async function restoreWithRecovery(c,phrase){
  const u=await me(c),ent=await parseRecoveryPhrase(phrase),rec=(await c.be.select('user_recovery',{eq:{user_id:u.id}}))[0];
  if(!rec)throw err('no_recovery');
  let priv;try{priv=await unwrapFromRecovery(ent,rec.priv_box);}catch(e){throw err('wrong_phrase');}
  const d=await ensureDevice(c),profs=await c.be.select('profiles',{}),rks=await c.be.select('recovery_keys',{eq:{user_id:u.id}}),restored=[],needApproval=[];
  for(const p of profs){
    const rk=rks.find(x=>x.profile_id===p.id&&x.key_ver===p.key_ver);
    if(!rk){needApproval.push(p.id);continue;}
    const key=await unwrapForDevice(priv,rk.wrapped,rctx(u.id,p.id,p.key_ver));
    await c.be.rpc('grant_device',{p_profile:p.id,p_user:u.id,p_device:d.deviceId,p_ver:p.key_ver,p_wrapped:await wrapForDevice(d.pub,key,wctx(p.id,d.deviceId,p.key_ver))});
    await putKey(c,p.id,p.key_ver,key);
    let name=null;try{name=await decryptName(await subkeys(key),p.id,p.name_box);}catch(e){}
    restored.push({remoteId:p.id,name});
  }
  return{restored,needApproval};
}

/* A phone that joins a profile starts from the app's default categories. Mark them as older than anything on the server, so they never overwrite the family's own. */
export const seedAsRemote=s=>{track(s,0);return s;};

/* Shared profiles this person belongs to on the server, and whether this phone can open each one. */
export const listRemoteProfiles=c=>c.be.select('profiles',{});
export async function tryKey(c,pid){
  const prof=(await c.be.select('profiles',{eq:{id:pid}}))[0];if(!prof)return false;
  const h=(await getKeys(c))[pid];if(h&&h.ver>=prof.key_ver)return true;
  return !!(await acquireKey(c,pid,prof.key_ver));
}
