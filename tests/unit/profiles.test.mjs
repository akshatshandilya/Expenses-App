import test from 'node:test';
import assert from 'node:assert/strict';
import {platform,mem} from '../../src/native/platform.js';
import {saveState,flushState,loadState,switchStore,slotsFor,_resetForTests,SLOTS} from '../../src/data/storage.js';
import {S,replaceState,blank,setPersistHook} from '../../src/data/state.js';
import {REG,loadRegistry,saveRegistry,createProfile,renameProfile,deleteProfile,activateProfile,nameError,validateRegistry,defaultRegistry,REG_SLOTS,MAIN} from '../../src/data/profiles.js';

const rec=(i,cat='water')=>({id:'r'+i,cat,date:'2026-10-01',amountP:100*i,notes:'',ts:1});
setPersistHook(()=>{saveState(S);});
async function reset(){_resetForTests();mem.files.clear();await loadRegistry();}
async function seedLegacy(n){const s=blank();s.onboarded=true;s.theme='dark';s.lock={on:true,timeout:60};s.records=Array.from({length:n},(_,i)=>rec(i+1));replaceState(s);await saveState(S);await flushState();}
const snap=()=>[...SLOTS].map(f=>mem.files.get(f)||null);

test('legacy data opens unchanged as Personal and no registry file is created',async()=>{
  await reset();await seedLegacy(3);
  await loadRegistry();assert.equal(REG.active,MAIN);assert.equal(REG.profiles.length,1);assert.equal(REG.profiles[0].name,'Personal');
  assert.ok(!mem.files.has(REG_SLOTS[0])&&!mem.files.has(REG_SLOTS[1]));
  _resetForTests();assert.equal((await loadState()).state.records.length,3);
});
test('adding a profile leaves the original data files byte-identical',async()=>{
  await reset();await seedLegacy(3);const before=snap();
  await createProfile('Home');await flushState();
  assert.deepEqual(snap(),before);assert.equal(REG.active,REG.profiles[1].id);assert.equal(S.records.length,0);
});
test('profiles are isolated and device settings carry across',async()=>{
  await reset();await seedLegacy(3);
  const h=await createProfile('Home');S.records.push(rec(9,'rent'));await saveState(S);await flushState();
  assert.equal(S.theme,'dark');assert.equal(S.lock.on,true);
  await activateProfile(MAIN);assert.equal(S.records.length,3);assert.ok(S.records.every(r=>r.cat==='water'));
  await activateProfile(h.id);assert.equal(S.records.length,1);assert.equal(S.records[0].cat,'rent');
});
test('registry survives a restart and keeps the open profile',async()=>{
  await reset();await seedLegacy(2);const h=await createProfile('Home');
  _resetForTests();await loadRegistry();
  assert.equal(REG.active,h.id);assert.deepEqual(REG.profiles.map(p=>p.name),['Personal','Home']);
  await switchStore(slotsFor(REG.active));assert.equal((await loadState()).state.v,1);
});
test('registry files are encrypted',async()=>{
  await reset();await seedLegacy(1);await createProfile('Secret Home');await flushState();
  const raw=Buffer.from(mem.files.get(REG_SLOTS[0])||mem.files.get(REG_SLOTS[1]),'base64').toString('latin1');
  assert.ok(!raw.includes('Secret'));
});
test('a tampered registry is refused, never overwritten, and data stays reachable',async()=>{
  await reset();await seedLegacy(2);await createProfile('Home');
  for(const f of REG_SLOTS){const b=mem.files.get(f);if(b){const x=Buffer.from(b,'base64');x[x.length-1]^=1;mem.files.set(f,x.toString('base64'));}}
  const before=REG_SLOTS.map(f=>mem.files.get(f)||null);
  _resetForTests();await loadRegistry();
  assert.equal(REG.bad,true);assert.equal(REG.active,MAIN);
  await assert.rejects(()=>createProfile('X'),{code:'registry'});
  await assert.rejects(()=>saveRegistry(),{code:'registry'});
  assert.deepEqual(REG_SLOTS.map(f=>mem.files.get(f)||null),before);
});
test('name rules',async()=>{
  await reset();
  assert.ok(nameError(''));assert.ok(nameError('   '));assert.ok(nameError('x'.repeat(41)));assert.ok(nameError('a\u0000b'));
  assert.ok(nameError('personal'));assert.equal(nameError('Home'),'');assert.equal(nameError('Personal',MAIN),'');
  await assert.rejects(()=>createProfile('PERSONAL'),{code:'name'});
});
test('rename works and rejects duplicates',async()=>{
  await reset();await seedLegacy(1);const h=await createProfile('Home');
  await renameProfile(h.id,'Family');assert.equal(REG.profiles[1].name,'Family');
  await assert.rejects(()=>renameProfile(h.id,'personal'),{code:'name'});
  await renameProfile(MAIN,'Mine');_resetForTests();await loadRegistry();assert.deepEqual(REG.profiles.map(p=>p.name),['Mine','Family']);
});
test('delete removes only that profile; last profile cannot be deleted',async()=>{
  await reset();await seedLegacy(2);const h=await createProfile('Home');S.records.push(rec(5));await saveState(S);await flushState();
  await deleteProfile(h.id);
  assert.equal(REG.active,MAIN);assert.equal(S.records.length,2);
  for(const f of slotsFor(h.id))assert.ok(!mem.files.has(f));
  await assert.rejects(()=>deleteProfile(MAIN),{code:'last'});
});
test('deleting the Personal profile removes the original files and keeps the other',async()=>{
  await reset();await seedLegacy(2);const h=await createProfile('Home');S.records.push(rec(7));await saveState(S);await flushState();
  await deleteProfile(MAIN);assert.equal(REG.active,h.id);assert.equal(S.records.length,1);
  for(const f of SLOTS)assert.ok(!mem.files.has(f));
  _resetForTests();await loadRegistry();await switchStore(slotsFor(REG.active));assert.equal((await loadState()).state.records.length,1);
});
test('unreadable profile data keeps the current profile open',async()=>{
  await reset();await seedLegacy(2);const h=await createProfile('Home');await flushState();await activateProfile(MAIN);
  for(const f of slotsFor(h.id)){const b=mem.files.get(f);if(b){const x=Buffer.from(b,'base64');x[x.length-1]^=1;mem.files.set(f,x.toString('base64'));}}
  await assert.rejects(()=>activateProfile(h.id),{code:'unreadable'});
  assert.equal(S.records.length,2);S.records.push(rec(8));await saveState(S);await flushState();
  _resetForTests();await switchStore(slotsFor(MAIN));assert.equal((await loadState()).state.records.length,3);
});
test('limit of profiles and registry validation',async()=>{
  await reset();
  for(let i=0;i<11;i++)await createProfile('P'+i);
  await assert.rejects(()=>createProfile('One too many'),{code:'limit'});
  assert.equal(validateRegistry({v:1,active:'zz',profiles:[{id:'a',name:'A'}]}),null);
  assert.equal(validateRegistry({v:1,active:'a',profiles:[{id:'A/../',name:'A'}]}),null);
  assert.equal(validateRegistry({v:1,active:'a',profiles:[{id:'a',name:'A'},{id:'a',name:'B'}]}),null);
  assert.ok(validateRegistry({v:1,active:'a',profiles:[{id:'a',name:'A'}]}));
  assert.equal(defaultRegistry().profiles[0].id,MAIN);
});

test('a personal profile can be marked as moved to a shared one, the mark is saved and cleared again',async()=>{
  const {markMoved,validateRegistry,REG}=await import('../../src/data/profiles.js');
  const id=REG.profiles.find(p=>!p.shared).id;
  await markMoved(id,true);assert.equal(REG.profiles.find(p=>p.id===id).moved,true);
  const doc=validateRegistry({v:1,active:REG.active,profiles:REG.profiles.map(p=>Object.assign({},p))});assert.equal(doc.profiles.find(p=>p.id===id).moved,true);
  await markMoved(id,false);assert.equal(REG.profiles.find(p=>p.id===id).moved,undefined);
});
