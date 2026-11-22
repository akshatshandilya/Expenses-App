import test from 'node:test';
import assert from 'node:assert/strict';
import {blank} from '../../src/data/state.js';
import {track,snapshot,applyRemote,entities} from '../../src/data/changes.js';
const rec=(id,ts=1000)=>({id,cat:'water',date:'2026-10-01',amountP:6000,notes:'',ts});
const mk=()=>{const s=blank();s.records=[rec('a',111),rec('b',222)];s.prices={water:5000};s.kmCost='8';return s;};

test('first run stamps existing data with its own add time and is stable afterwards',()=>{
  const s=mk();assert.equal(track(s,9000),true);
  assert.equal(s.sync.m['records:a'].t,111);assert.equal(s.sync.m['records:b'].t,222);
  assert.equal(track(s,9500),false);assert.equal(s.sync.m['records:a'].t,111);
});
test('edit, add and delete are detected',()=>{
  const s=mk();track(s,9000);
  s.records[0].amountP=7000;s.records.push(rec('c'));s.records=s.records.filter(r=>r.id!=='b');s.prices.water=5500;
  assert.equal(track(s,9100),true);
  assert.equal(s.sync.m['records:a'].t,9100);assert.equal(s.sync.m['records:c'].t,9100);
  assert.equal(s.sync.d['records:b'],9100);assert.ok(!s.sync.m['records:b']);assert.equal(s.sync.m['prices:water'].t,9100);
});
test('device settings are never tracked',()=>{
  const s=mk();s.theme='dark';s.lock={on:true,timeout:0};s.onboarded=true;s.mon='2026-11';track(s,1);
  assert.ok(Object.keys(entities(s)).every(k=>/^(records|prices|set|cats|routes):/.test(k)));
  const before=JSON.stringify(s.sync);s.theme='light';s.mon='2026-12';track(s,2);assert.equal(JSON.stringify(s.sync),before);
});
test('re-creating a deleted id clears its deletion marker',()=>{
  const s=mk();track(s,10);s.records=s.records.filter(r=>r.id!=='a');track(s,20);assert.equal(s.sync.d['records:a'],20);
  s.records.push(rec('a',5));track(s,30);assert.ok(!('records:a' in s.sync.d));assert.equal(s.sync.m['records:a'].t,30);
});
test('snapshot lists live items and deletions',()=>{
  const s=mk();track(s,10);s.records.pop();const snap=snapshot(s);
  assert.ok(snap.find(x=>x.key==='records:b'&&x.deleted&&x.data===null));assert.ok(snap.find(x=>x.key==='records:a'&&!x.deleted));
});
test('merge: newer remote wins, older is ignored, no re-stamp afterwards',()=>{
  const s=mk();track(s,9000);
  assert.equal(applyRemote(s,{key:'records:a',list:'records',t:500,deleted:false,data:{...rec('a'),amountP:1}}),true);
  assert.equal(s.records[0].amountP,1);assert.equal(track(s,9999),false);assert.equal(s.sync.m['records:a'].t,500);
  assert.equal(applyRemote(s,{key:'records:a',list:'records',t:400,deleted:false,data:{...rec('a'),amountP:2}}),false);
  assert.equal(s.records[0].amountP,1);
});
test('merge: remote delete removes the item; stale revival is ignored; new item is added',()=>{
  const s=mk();track(s,9000);
  assert.equal(applyRemote(s,{key:'records:b',list:'records',t:9500,deleted:true,data:null}),true);
  assert.ok(!s.records.some(r=>r.id==='b'));assert.equal(track(s,9600),false);
  assert.equal(applyRemote(s,{key:'records:b',list:'records',t:9400,deleted:false,data:rec('b')}),false);
  assert.equal(applyRemote(s,{key:'records:z',list:'records',t:9700,deleted:false,data:rec('z')}),true);assert.ok(s.records.some(r=>r.id==='z'));
});
test('merge: a delete beats an edit made at the same instant; bad input is refused',()=>{
  const s=mk();track(s,9000);s.records[0].amountP=9;track(s,9100);
  assert.equal(applyRemote(s,{key:'records:a',list:'records',t:9100,deleted:true,data:null}),true);assert.ok(!s.records.some(r=>r.id==='a'));
  assert.equal(applyRemote(s,{key:'records:q',list:'records',t:9800,deleted:false,data:{id:'other'}}),false);
  assert.equal(applyRemote(s,{key:'theme:x',list:'theme',t:9800,deleted:false,data:1}),false);
});
test('prices and per-km cost sync too',()=>{
  const s=mk();track(s,9000);
  applyRemote(s,{key:'prices:water',list:'prices',t:9500,deleted:false,data:6000});applyRemote(s,{key:'set:kmCost',list:'set',t:9500,deleted:false,data:'9'});
  assert.equal(s.prices.water,6000);assert.equal(s.kmCost,'9');assert.equal(track(s,9600),false);
});
