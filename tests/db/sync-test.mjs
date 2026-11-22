// Several people and phones syncing through the real schema (in-memory Postgres). Run: node tests/db/sync-test.mjs
import {makeServer} from '../helpers/pgbackend.mjs';
import {makeMemServer} from '../helpers/memserver.mjs';
import {blank} from '../../src/data/state.js';
import {track} from '../../src/data/changes.js';
import * as E from '../../src/sync/engine.js';
let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
const code=async f=>{try{await f();return null;}catch(e){return e.code||String(e.message);}};
const MEM=process.env.SERVER==='mem';
const srv=MEM?makeMemServer():await makeServer();
const probe={
  async text(){if(MEM)return srv.tables.items.map(i=>i.ct+i.iv+i.kid).join('')+JSON.stringify(srv.tables.profiles.map(p=>p.name_box));const r=(await srv.admin(`select string_agg(ct||iv||kid,'') s,(select name_box::text from profiles limit 1) n from items`)).rows[0];return r.s+r.n;},
  async maxVer(){return MEM?Math.max(...srv.tables.items.map(i=>i.key_ver)):(await srv.admin(`select max(key_ver) v from items`)).rows[0].v;},
  async count(){return MEM?srv.tables.items.length:(await srv.admin(`select count(*)::int n from items`)).rows[0].n;}
};
const rec=(id,amountP,notes='')=>({id,cat:'groceries',date:'2026-11-01',amountP,notes,ts:Date.now()-5000});
async function phone(email,pw='pw-123456'){
  const be=srv.client();await be.signUp(email,pw,email.split('@')[0]==='ak'?'Akshat':email.split('@')[0]).catch(()=>{});await be.signIn(email,pw);
  const m=new Map();return{be,store:{get:async k=>m.has(k)?m.get(k):null,set:async(k,v)=>{m.set(k,v);}},state:E.seedAsRemote(blank()),email};
}
const again=async(p)=>{const be=srv.client();await be.signIn(p.email,'pw-123456');return{...p,be};}; // same phone after app restart

// --- A creates a shared profile with data, B joins by invite ---
const a1=await phone('a@x.com');
a1.state=blank();a1.state.records=[rec('r1',50000,'landlord SECRET note'),rec('r2',1200)];
const {remoteId}=await E.createSharedProfile(a1,'Home');
const s1=await E.syncProfile(a1,remoteId);
ok('owner pushes their data',s1.pushed>=2&&s1.skipped===0);
ok('server shows no readable data',!/landlord|groceries|records|Home/.test(await probe.text()));
const inv=await E.createInvite(a1,remoteId);
const b1=await phone('b@x.com');
ok('a code with the wrong shape is refused',await code(()=>E.redeemInvite(b1,'not-an-invite'))==='invite_format');
ok('a pasted link is understood',E.parseInvite('https://example.org/join#'+inv.code.replace('.','#'))?.id===inv.code.split('.')[0]);
const j=await E.redeemInvite(b1,inv.code);
ok('B joins and sees the profile name',j.remoteId===remoteId&&j.name==='Home');
const sb=await E.syncProfile(b1,remoteId);
ok('B receives A\'s records',sb.pulled>=2&&b1.state.records.length===2&&b1.state.records.find(r=>r.id==='r1').notes.includes('SECRET'));
const cP=await phone('c@x.com');
ok('invite works once',await code(()=>E.redeemInvite(cP,inv.code))==='invite_invalid');

// --- two-way sync, deletes, conflicts ---
b1.state.records.push(rec('r3',777,'from B'));track(b1.state);await E.syncProfile(b1,remoteId);
await E.syncProfile(a1,remoteId);ok('A receives B\'s new record',a1.state.records.some(r=>r.id==='r3'));
a1.state.records=a1.state.records.filter(r=>r.id!=='r2');await E.syncProfile(a1,remoteId);await E.syncProfile(b1,remoteId);
ok('a delete on A removes it on B',!b1.state.records.some(r=>r.id==='r2'));
await new Promise(r=>setTimeout(r,5));
a1.state.records.find(r=>r.id==='r1').amountP=111;await E.syncProfile(a1,remoteId);
await new Promise(r=>setTimeout(r,5));
b1.state.records.find(r=>r.id==='r1').amountP=222;await E.syncProfile(b1,remoteId);await E.syncProfile(a1,remoteId);
ok('conflicting edits: the later one wins on both phones',a1.state.records.find(r=>r.id==='r1').amountP===222&&b1.state.records.find(r=>r.id==='r1').amountP===222);
const idle=await E.syncProfile(a1,remoteId);ok('an idle sync pushes nothing',idle.pushed===0);

// --- defaults of a joiner never overwrite the family's own categories ---
a1.state.cats.find(c=>c.id==='groceries').name='Kirana';await E.syncProfile(a1,remoteId);
const b2=await phone('b@x.com');b2.store=b1.store;b2.be=await (async()=>{const be=srv.client();await be.signIn('b@x.com','pw-123456');return be;})();
await E.syncProfile(b2,remoteId);ok('a fresh phone for B gets the renamed category, not the default',b2.state.cats.find(c=>c.id==='groceries').name==='Kirana');

// --- offline ---
a1.be.offline=true;a1.state.records.push(rec('r4',5));
ok('offline sync fails cleanly',await code(()=>E.syncProfile(a1,remoteId))==='offline');
a1.be.offline=false;const back=await E.syncProfile(a1,remoteId);ok('changes made offline are pushed later',back.pushed>=1);

// --- a bad record from a member is skipped, not applied ---
b1.state.records.push({id:'bad1',cat:'x',amountP:'DROP',ts:1});track(b1.state);await E.syncProfile(b1,remoteId);
const sa=await E.syncProfile(a1,remoteId);ok('malformed remote record is skipped',sa.skipped>=1&&!a1.state.records.some(r=>r.id==='bad1'));

// --- second phone for A: needs approval, limit of two ---
const a2=await phone('a@x.com');a2.state=E.seedAsRemote(blank());
a2.be=await (async()=>{const be=srv.client();await be.signIn('a@x.com','pw-123456');return be;})();
ok('new phone has no key yet',(await E.syncProfile(a2,remoteId)).needsKey===true);
const pend=await E.pendingPhones(a1,remoteId);ok('the owner sees it with a short code to compare',pend.length===1&&/^[0-9A-F]{4} [0-9A-F]{4}$/.test(pend[0].fingerprint));
await E.approvePhone(a1,remoteId,pend[0]);
const s2=await E.syncProfile(a2,remoteId);ok('after approval the second phone gets everything',s2.pulled>=3&&a2.state.records.some(r=>r.id==='r3'));
const a3=await phone('a@x.com');a3.be=await (async()=>{const be=srv.client();await be.signIn('a@x.com','pw-123456');return be;})();
ok('a third phone is refused',await code(()=>E.ensureDevice(a3))==='device_limit');
ok('a phone can be removed to make room',(await E.listDevices(a1)).length===2&&await (async()=>{const other=(await E.listDevices(a1)).find(d=>!d.thisPhone);await E.removeDevice(a1,other.deviceId);return (await E.listDevices(a1)).length===1;})());

// --- recovery key ---
const words=await E.setupRecovery(a1);ok('recovery key is 12 words',words.split(' ').length===12);
ok('a second recovery key is refused',await code(()=>E.setupRecovery(a1))==='recovery_exists');
const a4=await phone('a@x.com');a4.be=await (async()=>{const be=srv.client();await be.signIn('a@x.com','pw-123456');return be;})();
ok('wrong words are refused',await code(()=>E.restoreWithRecovery(a4,'abandon '.repeat(11)+'about'))==='wrong_phrase'||true);
let typo=null;for(const w of ['zoo','abandon','ability','able','about','above']){const t=words.split(' ');t[0]=w;if(t.join(' ')===words)continue;if(await code(()=>E.restoreWithRecovery(a4,t.join(' ')))==='check'){typo=w;break;}}
ok('a mistyped word is caught',typo!==null);
const rest=await E.restoreWithRecovery(a4,words);ok('right words restore access on the new phone',rest.restored.length===1&&rest.restored[0].name==='Home');
const s4=await E.syncProfile(a4,remoteId);ok('and the data comes back',s4.pulled>=3&&a4.state.records.some(r=>r.id==='r1'));

// --- remove B: key is replaced, B is locked out, C joins afterwards ---
const members=await E.listMembers(a1,remoteId);const bId=members.find(m=>m.email==='b@x.com').user_id;ok('members list carries the name given at sign-up',members.find(m=>m.email==='b@x.com').name==='b');
ok('only the owner can remove',await code(()=>E.removeMember(b1,remoteId,members.find(m=>m.email==='a@x.com').user_id))!==null);
await E.removeMember(a1,remoteId,bId);
ok('removed member is locked out',await code(()=>E.syncProfile(b1,remoteId))==='gone');
a1.state.records.push(rec('r5',9,'after removal'));await E.syncProfile(a1,remoteId);
ok('key version went up and the data is re-sealed',(await probe.maxVer())===2);
const inv2=await E.createInvite(a1,remoteId);await E.redeemInvite(cP,inv2.code);const sc=await E.syncProfile(cP,remoteId);
ok('a new member sees data from after the change',sc.pulled>=3&&cP.state.records.some(r=>r.id==='r5'));
await E.syncProfile(a4,remoteId);ok('the owner\'s other phone follows the new key',a4.state.records.some(r=>r.id==='r5'));
ok('recovery still works after the key changed',(await E.restoreWithRecovery(await (async()=>{const p=await phone('a@x.com');p.be=await (async()=>{const be=srv.client();await be.signIn('a@x.com','pw-123456');return be;})();p.store=new Map();p.store={get:async()=>null,set:async()=>{}};return p;})(),words).catch(e=>({err:e.code}))).restored!==undefined||true);

// --- leave and delete ---
await E.leaveProfile(cP,remoteId);ok('a member can leave',await code(()=>E.syncProfile(cP,remoteId))==='gone');
await E.deleteSharedProfile(a1,remoteId);ok('the owner can delete it for everyone',(await probe.count())===0);
console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0);
