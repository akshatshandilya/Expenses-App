// Shared profiles end to end in a real browser engine: account, create with import, invite, second person, removal, sign out.
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {mkdirSync,cpSync,readFileSync,existsSync} from 'node:fs';
import http from 'node:http';import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const CHROME=process.env.CHROME_PATH||'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const OUT='tests/.tmp';mkdirSync(OUT+'/www',{recursive:true});
await build({entryPoints:['tests/browser/harness.js'],bundle:true,format:'iife',outfile:OUT+'/www/app.js',logLevel:'error'});
for(const f of ['app.css','index.html','fonts'])cpSync('www/'+f,OUT+'/www/'+f,{recursive:true});
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0];const f=path.join(OUT,'www',u==='/'?'index.html':u);if(!existsSync(f)){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.woff2')?'font/woff2':'text/html'});r.end(readFileSync(f));}).listen(0);
const browser=await chromium.launch({executablePath:CHROME,args:['--no-sandbox']});
const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'en-IN'});
const page=await ctx.newPage();page.setDefaultTimeout(6000);
const errs=[];page.on('pageerror',e=>errs.push(String(e)));
let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
const sel=a=>`[data-act="${a}"]`;
const click=async(a,extra='')=>{await page.click(sel(a)+extra);await page.waitForTimeout(250);};
const text=async(s='#screen')=>page.innerText(s);
const settle=async()=>{await page.waitForTimeout(700);};
await page.goto(`http://localhost:${srv.address().port}/`);
await page.waitForSelector('html.ready',{timeout:8000});
await page.evaluate(()=>{
  const T=window.__t;T.srv=T.makeMem({autoConfirm:true});T.beA=T.srv.client();T.sync.setBackend(T.beA);
  T.replaceState(T.blank());T.seedDemo(T.S);T.S.onboarded=true;T.persist();T.setStack([{n:'home',p:{}}]);T.draw();
});
ok('Home shows the profile name with the local pill',await page.evaluate(()=>document.querySelector('.pft button').innerText.trim()==='Personal'&&document.querySelector('.pills').innerText.includes('This phone only')));
const nRec=await page.evaluate(()=>window.__t.S.records.length);
// --- new shared profile -> sign in first ---
await page.evaluate(()=>{window.__t.setStack([{n:'profiles',p:{}}]);window.__t.draw();});
await click('profNew');await page.fill('#pfName','Home');
await page.click('label.sw:has(#pfShared)');await page.waitForTimeout(150);
ok('Shared switch shows the import option with the record count',await page.evaluate(()=>!document.getElementById('pfImpCard').hidden&&document.getElementById('pfImpHint').innerText.includes('Copies')));
ok('button says Continue to sign in',(await page.innerText('#pfSave')).includes('Continue to sign in'));
await click('pfSave');
ok('sign in screen opens with the create tab and a note about the profile',(await text()).includes('Sign in to create the shared profile')&&(await page.innerText('h1')).includes('Create account'));
await page.fill('#acName','Akshat');await page.fill('#acEmail','akshat@example.com');await page.fill('#acPass','longpassword1');await page.fill('#acPass2','different');await click('acGo');
ok('mismatched passwords are explained',(await page.innerText('#acErr')).includes('do not match'));
await page.fill('#acPass2','longpassword1');await click('acGo');await settle();
ok('recovery key screen shows 12 words',await page.evaluate(()=>document.querySelectorAll('.words span').length===12));
ok('Done stays disabled until the words are confirmed',await page.evaluate(()=>document.querySelector('[data-act=rcDone]').disabled));
await page.click('label.sw:has([data-act=rcSaved])');await page.waitForTimeout(150);await click('rcDone');await settle();
ok('profile is created and opened, with the shared pills',await page.evaluate(()=>document.querySelector('.pft button').innerText.trim()==='Home'&&document.querySelector('.pills').innerText.includes('End to end encrypted')));
ok('records were copied into the shared profile',await page.evaluate(n=>window.__t.S.records.length===n,nRec));
ok('the app offers to clear them from Personal',(await text('#layer')).includes('Clear the records from'));
await page.click('#layer .btn:not(.pri):not(.dan)');await page.waitForTimeout(200);
await settle();ok('status pill says Synced',(await text()).includes('Synced'));
ok('server holds only ciphertext',await page.evaluate(()=>{const t=JSON.stringify(window.__t.srv.tables.items)+JSON.stringify(window.__t.srv.tables.profiles);return !/groceries|Home|amountP/i.test(t)&&window.__t.srv.tables.items.length>=1;}));
// --- invite ---
await page.evaluate(()=>{window.__t.setStack([{n:'settings',p:{}}]);window.__t.draw();});
ok('settings shows the shared profile section',(await text()).includes('Shared profile: Home')&&(await text()).includes('Share invite link'));
await click('pfInvite');await page.waitForSelector('#invLink');
const link=await page.innerText('#invLink');ok('invite is a link to copy, with no share button',link.startsWith('expenses://join/')&&!(await text('#layer')).includes('Share link'));
await page.click('.sheet .btn[data-act="closeL"]');await page.waitForTimeout(200);
// --- a second person joins with that link and edits ---
const bResult=await page.evaluate(async link=>{
  const T=window.__t,E=T.E,m=new Map(),beB=T.srv.client();await beB.signUp('priya@example.com','longpassword1','Priya');
  const c={be:beB,store:{get:async k=>m.has(k)?m.get(k):null,set:async(k,v)=>{m.set(k,v);}},state:E.seedAsRemote(T.blank()),by:'Priya'};T.B=c;
  const j=await E.redeemInvite(c,link);const s1=await E.syncProfile(c,j.remoteId);T.remoteId=j.remoteId;
  c.state.records.push({id:'prya1',cat:'groceries',date:'2026-11-05',amountP:123400,notes:'from Priya',ts:Date.now()});await E.syncProfile(c,j.remoteId);
  return{name:j.name,pulled:s1.pulled,mine:T.S.records.length};
},link);
ok('second person joins and receives the records',bResult.name==='Home'&&bResult.pulled>=bResult.mine);
await page.evaluate(()=>{window.__t.setStack([{n:'home',p:{}}]);window.__t.draw();});
await click('profSync');await settle();
ok('the new record arrives on the first phone',await page.evaluate(()=>window.__t.S.records.some(r=>r.id==='prya1')));
ok('and is credited to the person who added it',await page.evaluate(()=>window.__t.S.records.find(r=>r.id==='prya1').by==='Priya'));
ok('members count shows 2',(await text()).includes('2 members'));
// --- members screen and removal ---
await page.evaluate(()=>{window.__t.setStack([{n:'settings',p:{}}]);window.__t.draw();});
await click('pfMembersS');await settle();
ok('members list shows both people, creator tagged',(await text()).includes('priya@example.com')&&(await text()).includes('CREATOR'));
ok('members are shown by name, not email',await page.evaluate(()=>[...document.querySelectorAll('.rec .rt b')].map(b=>b.firstChild.textContent.trim()).join('|')==='Akshat|Priya'));
await page.click('[data-act="pfRemove"]');await page.waitForTimeout(250);
ok('removal explains the new key',(await text('#layer')).includes('new key'));
await page.click('#layer .btn.dan');await settle();
ok('removed person is locked out',await page.evaluate(async()=>{try{await window.__t.E.syncProfile(window.__t.B,window.__t.remoteId);return false;}catch(e){return e.code==='gone';}}));
ok('owner keeps working after the key change',await page.evaluate(async()=>{window.__t.S.records.push({id:'late1',cat:'groceries',date:'2026-11-06',amountP:100,notes:'',ts:Date.now()});window.__t.sync.scheduleSync(0);await new Promise(r=>setTimeout(r,1200));return window.__t.srv.tables.items.length>0&&window.__t.srv.tables.profiles[0].key_ver===2;}));
// --- offline ---
await page.evaluate(()=>{window.__t.beA.offline=true;window.__t.S.records.push({id:'off1',cat:'groceries',date:'2026-11-07',amountP:1,notes:'',ts:Date.now()});});
await page.evaluate(()=>{window.__t.setStack([{n:'home',p:{}}]);window.__t.draw();});
await click('profSync');await settle();
ok('offline is shown calmly',(await text()).includes('Offline'));
await page.evaluate(()=>{window.__t.beA.offline=false;});await click('profSync');await settle();ok('and recovers',(await text()).includes('Synced'));
// --- sign out ---
await page.evaluate(()=>{window.__t.setStack([{n:'settings',p:{}}]);window.__t.draw();});
await click('profAccount');await click('acOut');await page.click('#layer .btn.pri');await settle();
const after=await page.evaluate(()=>({profiles:window.__t.sync.SYNC.user,rec:window.__t.S.records.length,name:document.querySelector('.pft button')?document.querySelector('.pft button').innerText.trim():''}));
ok('sign out removes the shared profile from the phone',after.profiles===null);
await page.evaluate(()=>{window.__t.setStack([{n:'home',p:{}}]);window.__t.draw();});
ok('Personal is back with its records',(await page.innerText('.pft button')).trim()==='Personal'&&await page.evaluate(n=>window.__t.S.records.length===n,nRec));
// --- sign back in: the shared profile returns ---
await page.evaluate(()=>{window.__t.setStack([{n:'settings',p:{}}]);window.__t.draw();});
await click('profAccount');await click('acOpen');await page.fill('#acEmail','akshat@example.com');await page.fill('#acPass','longpassword1');await click('acGo');await settle();
await page.evaluate(()=>{window.__t.setStack([{n:'profiles',p:{}}]);window.__t.draw();});
ok('signing in again brings the shared profile back',(await text()).includes('Home')&&(await text()).includes('Shared'));
// --- forgot password ---
await page.evaluate(()=>{window.__t.setStack([{n:'settings',p:{}}]);window.__t.draw();});
await click('profAccount');await click('acOut');await page.click('#layer .btn.pri');await settle();
await page.evaluate(()=>{window.__t.setStack([{n:'settings',p:{}}]);window.__t.draw();});
await click('profAccount');await click('acOpen');
ok('sign in has a Forgot password link',(await text()).includes('Forgot password?'));
await page.fill('#acEmail','akshat@example.com');await click('rsOpen');
ok('reset screen starts with the email',(await page.innerText('h1')).includes('Reset password'));
await click('rsSend');await settle();
ok('then asks for the code and a new password',await page.evaluate(()=>!!document.getElementById('rsCode')&&!!document.getElementById('rsPass')));
await page.fill('#rsCode','999999');await page.fill('#rsPass','brandnewpass1');await page.fill('#rsPass2','brandnewpass1');await click('rsDone');await settle();
ok('a wrong code is explained',(await page.innerText('#rsErr')).includes('wrong or has expired'));
await page.fill('#rsPass2','mismatch');await click('rsDone');
ok('mismatched passwords are explained',(await page.innerText('#rsErr')).includes('do not match'));
await page.fill('#rsPass2','brandnewpass1');await page.fill('#rsCode','123456');await click('rsDone');await settle();
ok('the right code signs in with the new password',await page.evaluate(()=>!!window.__t.sync.SYNC.user&&window.__t.sync.SYNC.user.email==='akshat@example.com'));
ok('the old password no longer works',await page.evaluate(async()=>{const b=window.__t.srv.client();try{await b.signIn('akshat@example.com','longpassword1');return false;}catch(e){return e.code==='credentials';}}));
ok('no page errors',errs.length===0);if(errs.length)console.log(errs);
await browser.close();srv.close();process.exit(fails?1:0);
