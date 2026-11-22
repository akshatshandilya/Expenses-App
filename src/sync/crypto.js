/* End-to-end encryption for shared profiles. Everything here runs on the phone with the WebCrypto API; the server
   only ever receives ciphertext and opaque ids.
   - Each shared profile has one random 256-bit profile key, made on the creator's phone.
   - Every synced item is sealed with AES-GCM under a key derived from the profile key. The profile id, the item id and its
     change time are bound in as authenticated data, so the server cannot move, swap or back-date an item without it failing to open.
   - The profile key is handed to a device by wrapping it with that device's own public key (ECDH P-256), to a new member by an
     invite secret that lives only in the link's # part, and to its owner by a 12-word recovery key.
   - The login password is never used as an encryption key. */
import {WORDS} from './wordlist.js';

const subtle=()=>globalThis.crypto.subtle;
const enc=new TextEncoder(),dec=new TextDecoder();
export const b64u=u8=>{let s='';for(let i=0;i<u8.length;i++)s+=String.fromCharCode(u8[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');};
export const unb64u=s=>{if(typeof s!=='string'||/[^A-Za-z0-9_-]/.test(s))throw fail('format');const p=s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4);const b=atob(p),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;};
const fail=code=>Object.assign(new Error('crypto:'+code),{code});
export const randomBytes=n=>globalThis.crypto.getRandomValues(new Uint8Array(n));
const cat=(...a)=>{const o=new Uint8Array(a.reduce((n,x)=>n+x.length,0));let i=0;for(const x of a){o.set(x,i);i+=x.length;}return o;};

async function hkdf(secret,info,usage,len){
  const base=await subtle().importKey('raw',secret,'HKDF',false,['deriveKey','deriveBits']);
  const params={name:'HKDF',hash:'SHA-256',salt:new Uint8Array(32),info:enc.encode(info)};
  if(usage==='bits')return new Uint8Array(await subtle().deriveBits(params,base,len*8));
  return subtle().deriveKey(params,base,usage==='hmac'?{name:'HMAC',hash:'SHA-256',length:256}:{name:'AES-GCM',length:256},false,usage==='hmac'?['sign']:['encrypt','decrypt']);
}
async function seal(key,plain,aad){const iv=randomBytes(12);const ct=new Uint8Array(await subtle().encrypt({name:'AES-GCM',iv,additionalData:enc.encode(aad)},key,plain));return{iv:b64u(iv),ct:b64u(ct)};}
async function open(key,box,aad){
  try{return new Uint8Array(await subtle().decrypt({name:'AES-GCM',iv:unb64u(box.iv),additionalData:enc.encode(aad)},key,unb64u(box.ct)));}
  catch(e){throw fail('open');}
}

/* ---- profile key and the keys derived from it ---- */
export const newProfileKey=()=>randomBytes(32);
export async function subkeys(profileKey){
  if(!(profileKey instanceof Uint8Array)||profileKey.length!==32)throw fail('key');
  return{enc:await hkdf(profileKey,'expenses/item/v1','aes'),mac:await hkdf(profileKey,'expenses/id/v1','hmac'),name:await hkdf(profileKey,'expenses/name/v1','aes')};
}
/* The server sees only this opaque id, never "records:r123". */
export const itemId=async(sub,key)=>b64u(new Uint8Array(await subtle().sign('HMAC',sub.mac,enc.encode(key))));

/* item = {key,t,deleted,list,id,data} as made by changes.snapshot(). Returns the row to store. */
export async function encryptItem(sub,profileId,item){
  const kid=await itemId(sub,item.key),t=item.t;
  if(!Number.isSafeInteger(t)||t<0)throw fail('time');
  const box=await seal(sub.enc,enc.encode(JSON.stringify({key:item.key,deleted:!!item.deleted,data:item.deleted?null:item.data})),profileId+'|'+kid+'|'+t);
  return{kid,t,iv:box.iv,ct:box.ct};
}
export async function decryptItem(sub,profileId,row){
  const plain=await open(sub.enc,row,profileId+'|'+row.kid+'|'+row.t);
  let o;try{o=JSON.parse(dec.decode(plain));}catch(e){throw fail('open');}
  if(!o||typeof o.key!=='string'||await itemId(sub,o.key)!==row.kid)throw fail('open');
  const i=o.key.indexOf(':');
  return{key:o.key,t:row.t,deleted:!!o.deleted,list:o.key.slice(0,i),id:o.key.slice(i+1),data:o.deleted?null:o.data};
}
export async function encryptName(sub,profileId,name){return seal(sub.name,enc.encode(name),profileId+'|name');}
export async function decryptName(sub,profileId,box){return dec.decode(await open(sub.name,box,profileId+'|name'));}

/* ---- device keys: used to hand the profile key to one specific phone ---- */
export async function newDeviceKeys(){
  const kp=await subtle().generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  return{pub:await subtle().exportKey('jwk',kp.publicKey),priv:await subtle().exportKey('jwk',kp.privateKey)};
}
const importPub=jwk=>subtle().importKey('jwk',{kty:jwk.kty,crv:jwk.crv,x:jwk.x,y:jwk.y,ext:true},{name:'ECDH',namedCurve:'P-256'},false,[]);
async function wrapKey(shared,context){return hkdf(shared,'expenses/wrap/v1|'+context,'aes');}
export async function wrapForDevice(devicePubJwk,secret,context){
  const eph=await subtle().generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const shared=new Uint8Array(await subtle().deriveBits({name:'ECDH',public:await importPub(devicePubJwk)},eph.privateKey,256));
  const box=await seal(await wrapKey(shared,context),secret,context);
  const e=await subtle().exportKey('jwk',eph.publicKey);
  return{epk:{kty:e.kty,crv:e.crv,x:e.x,y:e.y},iv:box.iv,ct:box.ct};
}
export async function unwrapForDevice(devicePrivJwk,wrapped,context){
  let priv;try{priv=await subtle().importKey('jwk',devicePrivJwk,{name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);}catch(e){throw fail('key');}
  let shared;try{shared=new Uint8Array(await subtle().deriveBits({name:'ECDH',public:await importPub(wrapped.epk)},priv,256));}catch(e){throw fail('open');}
  return open(await wrapKey(shared,context),wrapped,context);
}

/* ---- invite links: the secret is in the link's # part and is never sent to the server ---- */
export async function makeInvite(profileKey,profileId){
  const secret=randomBytes(32),box=await seal(await hkdf(secret,'expenses/invite/v1','aes'),profileKey,'invite|'+profileId);
  return{secret:b64u(secret),wrapped:box};
}
export async function openInvite(secretB64u,wrapped,profileId){
  return open(await hkdf(unb64u(secretB64u),'expenses/invite/v1','aes'),wrapped,'invite|'+profileId);
}

/* ---- recovery key: 12 words = 128 bits plus a 4-bit check, so a typo is caught ---- */
export async function newRecoveryPhrase(){return phraseFor(randomBytes(16));}
async function phraseFor(ent){
  const sum=new Uint8Array(await subtle().digest('SHA-256',ent))[0]>>4;
  let bits=0n;for(const b of ent)bits=(bits<<8n)|BigInt(b);bits=(bits<<4n)|BigInt(sum);
  const out=[];for(let i=11;i>=0;i--)out.push(WORDS[Number((bits>>BigInt(i*11))&2047n)]);
  return out.join(' ');
}
/* Returns the 16 secret bytes, or throws with code 'count', 'word' or 'check'. */
export async function parseRecoveryPhrase(text){
  const w=String(text||'').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if(w.length!==12)throw fail('count');
  let bits=0n;for(const x of w){const i=WORDS.indexOf(x);if(i<0)throw fail('word');bits=(bits<<11n)|BigInt(i);}
  const sum=Number(bits&15n);bits>>=4n;const ent=new Uint8Array(16);for(let i=15;i>=0;i--){ent[i]=Number(bits&255n);bits>>=8n;}
  if((new Uint8Array(await subtle().digest('SHA-256',ent))[0]>>4)!==sum)throw fail('check');
  return ent;
}
export async function wrapForRecovery(ent,obj){return seal(await hkdf(ent,'expenses/recovery/v1','aes'),enc.encode(JSON.stringify(obj)),'recovery');}
export async function unwrapFromRecovery(ent,box){return JSON.parse(dec.decode(await open(await hkdf(ent,'expenses/recovery/v1','aes'),box,'recovery')));}
