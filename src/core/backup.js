/* @auto-imports */
import {validDate,validMonth} from './dates.js';
import {MAX_MONEY} from './money.js';
import {S} from '../data/state.js';
import {ICONS} from '../ui/icons.js';
/* @end-imports */
export function b64e(u8){let s='';for(let i=0;i<u8.length;i+=8192)s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));return btoa(s);}
export function b64d(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
export async function deriveKey(pass,salt,iter){const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:iter,hash:'SHA-256'},km,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
export async function encryptBackup(pass){
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12)),iter=200000;
  const data=JSON.parse(JSON.stringify(S));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},await deriveKey(pass,salt,iter),new TextEncoder().encode(JSON.stringify({app:'expenses',v:1,data:data})));
  return JSON.stringify({fmt:'expenses-backup',v:1,kdf:'PBKDF2-SHA256',iter:iter,salt:b64e(salt),iv:b64e(iv),ct:b64e(new Uint8Array(ct))});
}
export function validateData(d){
  if(!d||typeof d!=='object'||d.app!=='expenses'||d.v!==1||!d.data)return 'This is not an Expenses backup.';
  const x=d.data;if(!Array.isArray(x.records)||!Array.isArray(x.dist)||!Array.isArray(x.cats)||typeof x.prices!=='object')return 'The backup is missing required sections.';
  if(x.records.length>50000||x.dist.length>50000||x.cats.length>200)return 'The backup is larger than expected.';
  const ids=new Set(x.cats.map(c=>c&&c.id));
  for(const c of x.cats){if(!c||typeof c.id!=='string'||typeof c.name!=='string'||c.name.length>60||!/^#[0-9a-fA-F]{6}$/.test(c.color||'')||!ICONS[c.icon])return 'A category in the backup is not valid.';}
  if(x.houses!==undefined&&(!Array.isArray(x.houses)||x.houses.length>200||x.houses.some(h=>!h||typeof h.id!=='string'||typeof h.name!=='string'||h.name.length>80)))return 'A house in the backup is not valid.';
  for(const r of x.records){if(!r||typeof r.id!=='string'||!validDate(r.date)||!Number.isInteger(r.amountP)||r.amountP<0||r.amountP>MAX_MONEY*10||!ids.has(r.cat)||(r.period&&!validMonth(r.period)))return 'A record in the backup is not valid.';}
  for(const r of x.dist){if(!r||typeof r.id!=='string'||!validDate(r.date)||!Number.isInteger(r.kmM)||r.kmM<0)return 'A journey in the backup is not valid.';}
  return null;
}

/* Opens a backup file's text with a passphrase. Throws Error(message) with a plain-language reason. */
export async function decryptBackup(text,pass){
  let env;try{env=JSON.parse(String(text||'').trim());}catch(x){throw new Error('That file is not a valid backup.');}
  if(!env||env.fmt!=='expenses-backup'||env.v!==1||typeof env.salt!=='string'||typeof env.iv!=='string'||typeof env.ct!=='string'||!Number.isInteger(env.iter)||env.iter<100000||env.iter>1000000)throw new Error('That file is not a valid backup.');
  let d;try{const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64d(env.iv)},await deriveKey(pass||'',b64d(env.salt),env.iter),b64d(env.ct));d=JSON.parse(new TextDecoder().decode(pt));}
  catch(x){throw new Error('Wrong passphrase, or the backup is damaged.');}
  const m=validateData(d);if(m)throw new Error(m);
  return d.data;
}
