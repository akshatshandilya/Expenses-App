/* Encrypted local store.
   - A random 256-bit key is created on first run and kept in the Android Keystore (via platform.setSecret).
   - The records are one JSON document, encrypted with AES-GCM and written to two alternating files (slots).
     A write goes to the slot that is NOT the newest, so a crash or power cut mid-write can never destroy the last good copy.
   - Each file starts with a header (format tag + write counter) that is authenticated, so an old file cannot be swapped in unnoticed. */
import {platform} from '../native/platform.js';

export const SLOTS=['expenses-a.bin','expenses-b.bin'];
export const MAGIC=[0x45,0x58,0x50,0x31];
import {b64e,b64d} from '../core/backup.js';

export let keyPromise=null;
export function getKey(){
  if(!keyPromise)keyPromise=(async()=>{
    let raw=await platform.getSecret('dk');
    if(!raw){raw=b64e(crypto.getRandomValues(new Uint8Array(32)));await platform.setSecret('dk',raw);}
    return crypto.subtle.importKey('raw',b64d(raw),'AES-GCM',false,['encrypt','decrypt']);
  })();
  return keyPromise;
}
export async function seal(obj,seq){
  const key=await getKey(),iv=crypto.getRandomValues(new Uint8Array(12)),head=new Uint8Array(8);
  head.set(MAGIC,0);new DataView(head.buffer).setUint32(4,seq,false);
  const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:iv,additionalData:head},key,new TextEncoder().encode(JSON.stringify(obj))));
  const out=new Uint8Array(8+12+ct.length);out.set(head,0);out.set(iv,8);out.set(ct,20);return b64e(out);
}
export async function open(b64){
  const u=b64d(b64);if(u.length<36)throw new Error('short');
  for(let i=0;i<4;i++)if(u[i]!==MAGIC[i])throw new Error('format');
  const head=u.slice(0,8),seq=new DataView(head.buffer).getUint32(4,false);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:u.slice(8,20),additionalData:head},await getKey(),u.slice(20));
  return{seq:seq,data:JSON.parse(new TextDecoder().decode(pt))};
}

export let seq=0,next=0,queued=null,running=null,failed=false;

/* Resolves to {state} (or {state:null} on a fresh install). Throws {code:'unreadable'} if files exist but cannot be opened. */
export async function loadState(){
  let found=0,best=null;
  for(let i=0;i<SLOTS.length;i++){
    const b=await platform.readFile(SLOTS[i]);if(!b)continue;found++;
    try{const r=await open(b);if(!best||r.seq>best.seq)best={seq:r.seq,slot:i,data:r.data};}catch(e){}
  }
  if(!best){if(found){const e=new Error('unreadable');e.code='unreadable';throw e;}return{state:null};}
  seq=best.seq;next=1-best.slot;return{state:best.data};
}
/* Queue a save of the latest snapshot. Several quick changes collapse into one write. */
export function saveState(obj){
  queued=JSON.stringify(obj);
  if(!running)running=(async()=>{
    try{
      while(queued!==null){
        const snap=JSON.parse(queued);queued=null;
        seq=(seq+1)>>>0;
        await platform.writeFile(SLOTS[next],await seal(snap,seq));
        next=1-next;failed=false;
      }
    }catch(e){failed=true;}finally{running=null;if(queued!==null&&!failed)saveState(JSON.parse(queued));}
  })();
  return running;
}
export function flushState(){return running||Promise.resolve();}
export const saveFailed=()=>failed;
export function _resetForTests(){keyPromise=null;seq=0;next=0;queued=null;running=null;failed=false;}
