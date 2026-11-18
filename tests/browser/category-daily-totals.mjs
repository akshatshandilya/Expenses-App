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
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0],f=path.join(OUT,'www',u==='/'?'index.html':u);if(!existsSync(f)){r.writeHead(404);r.end();return;}r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});r.end(readFileSync(f));}).listen(0);
const browser=await chromium.launch({executablePath:CHROME,args:['--no-sandbox']});
const page=await(await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844},locale:'en-IN'})).newPage();page.setDefaultTimeout(5000);
let fails=0;const ok=(name,condition)=>{console.log((condition?'PASS ':'FAIL ')+name);if(!condition)fails++;};
await page.goto(`http://localhost:${srv.address().port}/`);await page.waitForSelector('html.ready');await page.click('[data-act=start]');
await page.evaluate(()=>{
  const {S,setStack,draw}=window.__t,day=n=>S.mon+'-'+String(n).padStart(2,'0');
  S.records.push(
    {id:'grocery-18a',cat:'groceries',date:day(18),amountP:150000,status:'paid'},
    {id:'grocery-18b',cat:'groceries',date:day(18),amountP:500000,status:'paid'},
    {id:'grocery-07',cat:'groceries',date:day(7),amountP:450000,status:'paid'},
    {id:'other-18',cat:'other',date:day(18),amountP:200000,status:'paid'},
    {id:'other-07',cat:'other',date:day(7),amountP:350000,status:'paid'}
  );
  setStack([{n:'cat',p:{id:'groceries'}}]);draw();
});
const groceryStats=()=>page.locator('.stats .stat b').allTextContents();
ok('Groceries retains the monthly total and record count',JSON.stringify(await groceryStats())===JSON.stringify(['₹11,000','3']));
ok('Groceries shows one subtotal for each transaction date',JSON.stringify(await page.locator('.daytotal').allTextContents())===JSON.stringify(['₹6,500','₹4,500']));
ok('all grocery records remain visible',await page.locator('.list .rec').count()===3);
await page.evaluate(()=>{window.__t.S.records.push({id:'grocery-18c',cat:'groceries',date:window.__t.S.mon+'-18',amountP:250000,status:'paid'});window.__t.draw();});
ok('adding a same-day grocery record recalculates the date and month totals',JSON.stringify(await page.locator('.daytotal').allTextContents())===JSON.stringify(['₹9,000','₹4,500'])&&JSON.stringify(await groceryStats())===JSON.stringify(['₹13,500','4'])&&await page.locator('.list .rec').count()===4);
await page.evaluate(()=>{window.__t.setStack([{n:'cat',p:{id:'other'}}]);window.__t.draw();});
ok('Other Expenses groups records and calculates its daily subtotals',JSON.stringify(await page.locator('.daytotal').allTextContents())===JSON.stringify(['₹2,000','₹3,500'])&&JSON.stringify(await page.locator('.stats .stat b').allTextContents())===JSON.stringify(['₹5,500','2'])&&await page.locator('.list .rec').count()===2);
await browser.close();srv.close();process.exit(fails?1:0);
