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
  const state=mkState(5);state.routes=blank().routes;state.features={autoCabs:1};replaceState(state);
  const text=await encryptBackup('correct horse');
  assert.ok(!text.includes('"water"'));
  const data=await decryptBackup(text,'correct horse');assert.equal(data.records.length,5);assert.deepEqual(data.routes,state.routes);
  await assert.rejects(decryptBackup(text,'wrong'),/Wrong passphrase/);
  const env=JSON.parse(text);env.ct=env.ct.slice(0,-4)+'AAAA';await assert.rejects(decryptBackup(JSON.stringify(env),'correct horse'),/Wrong passphrase|damaged/);
  for(const bad of ['','not json','{}','{"fmt":"expenses-backup","v":1}','[]','null'])await assert.rejects(decryptBackup(bad,'x'),/not a valid backup/);
  env.iter=1;await assert.rejects(decryptBackup(JSON.stringify(env),'x'),/not a valid backup/);
});
test('validateData rejects malformed or oversized content',()=>{
  assert.ok(validateData(null));assert.ok(validateData({app:'expenses',v:1,data:{records:'x'}}));
  assert.ok(validateData({app:'expenses',v:1,data:{records:new Array(50001).fill({}),dist:[],cats:[],prices:{}}}));
});
test('backup routes are optional for legacy files but validated when present',()=>{
  const data={app:'expenses',v:1,data:Object.assign(blank(),{records:[],dist:[]})};
  assert.equal(validateData(data),null);
  data.data.routes=[{id:'rt1',name:'Route 1'},{id:'others',name:'Others',fixed:1}];
  assert.equal(validateData(data),null);
  data.data.routes[0].name=' others ';
  assert.match(validateData(data),/route in the backup is not valid/);
  data.data.routes=[{id:'rt1',name:'Route 1'}];
  assert.match(validateData(data),/fixed Others route/);
});
test('backup validation accepts tenant rosters and rejects malformed tenant data',()=>{
  const data={app:'expenses',v:1,data:Object.assign(blank(),{houses:[{id:'h1',name:'Main house',rentDir:'received',tenants:[{name:'Asha Rao',agStart:'2026-01-01',agEnd:'2026-12-31',rentAmountP:12000000,dueBy:'custom',dueDay:12},{name:'Ben Singh',rentAmountP:7000000,dueBy:'seventh'}]},{id:'h2',name:'Paying house',rentDir:'paid',rentAmountP:1500000,dueBy:'first'}],records:[{id:'r1',cat:'rent',dir:'received',date:'2026-10-01',period:'2026-10',amountP:120000,tenant:'Asha Rao'}]})};
  assert.equal(validateData(data),null);
  data.data.houses[0].tenants=['Legacy tenant'];
  assert.equal(validateData(data),null);
  data.data.houses[0].tenants=[{name:''}];
  assert.match(validateData(data),/house in the backup is not valid/);
  data.data.houses[0].tenants=[{name:'Asha Rao',dueBy:'custom',dueDay:32}];
  assert.match(validateData(data),/payment due day/);
  data.data.houses[0].tenants=['Asha Rao'];
  data.data.records[0].tenant={name:'Asha Rao'};
  assert.match(validateData(data),/record in the backup is not valid/);
});
