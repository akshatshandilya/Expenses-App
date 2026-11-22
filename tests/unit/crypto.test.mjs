import test from 'node:test';
import assert from 'node:assert/strict';
import {newProfileKey,subkeys,encryptItem,decryptItem,encryptName,decryptName,newDeviceKeys,wrapForDevice,unwrapForDevice,makeInvite,openInvite,newRecoveryPhrase,parseRecoveryPhrase,wrapForRecovery,unwrapFromRecovery,b64u,unb64u} from '../../src/sync/crypto.js';
const item={key:'records:r1',t:1700000000000,deleted:false,list:'records',id:'r1',data:{id:'r1',cat:'rent',amountP:1200000,notes:'secret landlord note'}};
const P='3f2c1d0e-1111-4222-8333-444455556666';

test('base64url round trips and rejects junk',()=>{const u=new Uint8Array([0,255,1,254,7]);assert.deepEqual(unb64u(b64u(u)),u);assert.throws(()=>unb64u('a+b'),{code:'format'});});
test('an item round trips, and the server-visible row hides everything',async()=>{
  const sub=await subkeys(newProfileKey()),row=await encryptItem(sub,P,item);
  assert.deepEqual(Object.keys(row).sort(),['ct','iv','kid','t']);
  assert.ok(!JSON.stringify(row).includes('records')&&!JSON.stringify(row).includes('landlord'));
  assert.deepEqual(await decryptItem(sub,P,row),item);
});
test('the same item gets a stable opaque id and fresh ciphertext each time',async()=>{
  const sub=await subkeys(newProfileKey()),a=await encryptItem(sub,P,item),b=await encryptItem(sub,P,item);
  assert.equal(a.kid,b.kid);assert.notEqual(a.ct,b.ct);
});
test('deletions travel as sealed markers',async()=>{
  const sub=await subkeys(newProfileKey()),d={...item,deleted:true,data:null},out=await decryptItem(sub,P,await encryptItem(sub,P,d));
  assert.equal(out.deleted,true);assert.equal(out.data,null);
});
test('tampering is detected: wrong key, other profile, changed time, swapped id, flipped byte',async()=>{
  const sub=await subkeys(newProfileKey()),row=await encryptItem(sub,P,item);
  await assert.rejects(async()=>decryptItem(await subkeys(newProfileKey()),P,row),{code:'open'});
  await assert.rejects(()=>decryptItem(sub,'other-profile',row),{code:'open'});
  await assert.rejects(()=>decryptItem(sub,P,{...row,t:row.t+1}),{code:'open'});
  const other=await encryptItem(sub,P,{...item,key:'records:r2',data:{...item.data,id:'r2'}});
  await assert.rejects(()=>decryptItem(sub,P,{...row,kid:other.kid}),{code:'open'});
  const ct=unb64u(row.ct);ct[0]^=1;await assert.rejects(()=>decryptItem(sub,P,{...row,ct:b64u(ct)}),{code:'open'});
});
test('profile names are sealed too',async()=>{
  const sub=await subkeys(newProfileKey()),box=await encryptName(sub,P,'Home');
  assert.equal(await decryptName(sub,P,box),'Home');await assert.rejects(()=>decryptName(sub,'x',box),{code:'open'});
});
test('profile key reaches only the intended device',async()=>{
  const a=await newDeviceKeys(),b=await newDeviceKeys(),key=newProfileKey(),ctx=P+'|dev1';
  const w=await wrapForDevice(a.pub,key,ctx);
  assert.deepEqual(await unwrapForDevice(a.priv,w,ctx),key);
  await assert.rejects(()=>unwrapForDevice(b.priv,w,ctx),{code:'open'});
  await assert.rejects(()=>unwrapForDevice(a.priv,w,P+'|dev2'),{code:'open'});
});
test('invite: opens with the secret from the link, not without or with a wrong one',async()=>{
  const key=newProfileKey(),inv=await makeInvite(key,P);
  assert.deepEqual(await openInvite(inv.secret,inv.wrapped,P),key);
  await assert.rejects(async()=>openInvite((await makeInvite(key,P)).secret,inv.wrapped,P),{code:'open'});
  await assert.rejects(()=>openInvite(inv.secret,inv.wrapped,'other'),{code:'open'});
});
test('recovery phrase: 12 words, round trips, catches typos and wrong counts',async()=>{
  const p=await newRecoveryPhrase();assert.equal(p.split(' ').length,12);
  const ent=await parseRecoveryPhrase('  '+p.toUpperCase()+' ');assert.equal(ent.length,16);
  const w=p.split(' ');let caught=0;
  for(const alt of ['zoo','abandon','ability','able','about','above','absent','absorb']){const t=[...w];t[3]=alt;if(t.join(' ')===p)continue;try{await parseRecoveryPhrase(t.join(' '));}catch(e){if(e.code==='check')caught++;}}
  assert.ok(caught>=5,'the 4-bit check should catch most single-word typos');
  await assert.rejects(()=>parseRecoveryPhrase(p+' abandon'),{code:'count'});
  await assert.rejects(()=>parseRecoveryPhrase(p.replace(w[0],'notaword')),{code:'word'});
});
test('recovery key unlocks the saved profile keys only with the right phrase',async()=>{
  const p=await newRecoveryPhrase(),ent=await parseRecoveryPhrase(p),keys={[P]:b64u(newProfileKey())};
  const box=await wrapForRecovery(ent,keys);assert.deepEqual(await unwrapFromRecovery(ent,box),keys);
  await assert.rejects(async()=>unwrapFromRecovery(await parseRecoveryPhrase(await newRecoveryPhrase()),box),{code:'open'});
});
