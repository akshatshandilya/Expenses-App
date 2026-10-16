import test from 'node:test';
import assert from 'node:assert/strict';
import {platform} from '../../src/native/platform.js';
import {loadState,saveState,flushState,_resetForTests} from '../../src/data/storage.js';
import {encryptBackup,decryptBackup,validateData} from '../../src/core/backup.js';
import {S,replaceState,blank} from '../../src/data/state.js';

const mkState=n=>({v:1,onboarded:true,theme:'system',houses:[],lock:{on:false,timeout:30},cats:blank().cats,records:Array.from({length:n},(_,i)=>({id:'r'+i,cat:'water',date:'2026-10-01',amountP:6000,notes:'',ts:1})),dist:[],prices:{},kmCost:'',mon:'2026-10'});
async function fresh(){_resetForTests();await platform.setSecret('dk','');}

test('first run: nothing stored',async()=>{_resetForTests();assert.deepEqual(await loadState(),{state:null});});
test('save then load returns the same records, and files are not readable text',async()=>{
  await saveState(mkState(3));await flushState();
  const raw=await platform.readFile('expenses-a.bin')||await platform.readFile('expenses-b.bin');
  assert.ok(raw);assert.ok(!Buffer.from(raw,'base64').toString('latin1').includes('water'),'plaintext leaked');
  _resetForTests();const r=await loadState();assert.equal(r.state.records.length,3);
});
test('alternating slots: a damaged newest file falls back to the previous good copy',async()=>{
  await saveState(mkState(1));await flushState();await saveState(mkState(2));await flushState();await saveState(mkState(3));await flushState();
  // find the newest slot by loading, then corrupt it
  _resetForTests();const newest=(await loadState()).state.records.length;assert.equal(newest,3);
  const bufs={};for(const f of ['expenses-a.bin','expenses-b.bin'])bufs[f]=Buffer.from(await platform.readFile(f),'base64');
  const newestFile=bufs['expenses-a.bin'].readUInt32BE(4)>bufs['expenses-b.bin'].readUInt32BE(4)?'expenses-a.bin':'expenses-b.bin';
  bufs[newestFile][bufs[newestFile].length-1]^=1;await platform.writeFile(newestFile,bufs[newestFile].toString('base64'));
  _resetForTests();assert.equal((await loadState()).state.records.length,2);
});
test('tampered or unreadable files are refused, never silently replaced',async()=>{
  for(const f of ['expenses-a.bin','expenses-b.bin']){const b=Buffer.from(await platform.readFile(f),'base64');b[b.length-2]^=1;await platform.writeFile(f,b.toString('base64'));}
  _resetForTests();await assert.rejects(loadState(),{code:'unreadable'});
});
test('rapid saves collapse and the last one wins',async()=>{
  await platform.writeFile('expenses-a.bin','');await platform.writeFile('expenses-b.bin','');_resetForTests();
  for(let i=1;i<=20;i++)saveState(mkState(i));await flushState();
  _resetForTests();assert.equal((await loadState()).state.records.length,20);
});
test('encrypted backup round trip, wrong passphrase, tampering and malformed input',async()=>{
  replaceState(mkState(5));
  const text=await encryptBackup('correct horse');
  assert.ok(!text.includes('"water"'));
  const data=await decryptBackup(text,'correct horse');assert.equal(data.records.length,5);
  await assert.rejects(decryptBackup(text,'wrong'),/Wrong passphrase/);
  const env=JSON.parse(text);env.ct=env.ct.slice(0,-4)+'AAAA';await assert.rejects(decryptBackup(JSON.stringify(env),'correct horse'),/Wrong passphrase|damaged/);
  for(const bad of ['','not json','{}','{"fmt":"expenses-backup","v":1}','[]','null'])await assert.rejects(decryptBackup(bad,'x'),/not a valid backup/);
  env.iter=1;await assert.rejects(decryptBackup(JSON.stringify(env),'x'),/not a valid backup/);
});
test('validateData rejects malformed or oversized content',()=>{
  assert.ok(validateData(null));assert.ok(validateData({app:'expenses',v:1,data:{records:'x'}}));
  assert.ok(validateData({app:'expenses',v:1,data:{records:new Array(50001).fill({}),dist:[],cats:[],prices:{}}}));
});
