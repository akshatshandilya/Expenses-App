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
let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
const clickAt=async locator=>{const box=await locator.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);};
await page.goto(`http://localhost:${srv.address().port}/`);await page.waitForSelector('html.ready');await page.click('[data-act=start]');
await page.evaluate(()=>window.__t.S.records.push(
  {id:'bulk-groceries',cat:'groceries',date:window.__t.S.mon+'-01',amountP:100,status:'paid'},
  {id:'bulk-water',cat:'water',date:window.__t.S.mon+'-01',amountP:200,status:'paid'}
));
let tile=page.locator('.grid3 .tile[data-id="groceries"]'),box=await tile.boundingBox();
await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(550);await page.mouse.up();
ok('long press enters selection mode, checks the held category, and shows bottom actions',
  await page.locator('[data-category-bulk]').isVisible()&&
  await page.locator('.category-check[data-id="groceries"]').isChecked()&&
  await page.locator('[data-category-bulk]').innerText().then(t=>t.includes('1 selected')&&t.includes('Delete selected category data')&&t.includes('Delete selected categories'))&&
  await page.locator('[role=dialog]').count()===0);
await page.locator('.grid3 .tile[data-id="water"]').click();
ok('tapping another card adds it to the multi-selection',await page.locator('.category-check:checked').count()===2&&await page.locator('.category-bulk-heading').innerText()==='2 selected');
await clickAt(page.locator('.category-check[data-id="gas"]'));
ok('visible checkboxes can add categories to the selection',await page.locator('.category-check:checked').count()===3);
await clickAt(page.locator('.category-check[data-id="gas"]'));
const before=await page.evaluate(()=>window.__t.S.cats.map(c=>c.id));
tile=page.locator('.grid3 .tile[data-id="groceries"]');const target=page.locator('.grid3 .tile[data-id="water"]');
const from=await tile.boundingBox(),to=await target.boundingBox();
await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.waitForTimeout(550);
await page.mouse.move(to.x+to.width*.8,to.y+to.height*.75,{steps:8});await page.mouse.up();
const after=await page.evaluate(()=>window.__t.S.cats.map(c=>c.id));
ok('dragging while held reorders the category cards without changing their selection',after.indexOf('groceries')>after.indexOf('water')&&before.indexOf('groceries')<before.indexOf('water')&&await page.locator('.grid3 .tile[data-id]').evaluateAll(nodes=>nodes.map(n=>n.dataset.id).join(','))===after.join(',')&&await page.locator('.category-check:checked').count()===2);
await clickAt(page.locator('[data-act="categoryDeleteData"]'));
ok('bulk data deletion requests confirmation with the category and record counts',await page.locator('[role=dialog]').innerText().then(t=>t.includes('Groceries')&&t.includes('Water Bottles')&&t.includes('2 expense records')));
await page.locator('[role=dialog] button[data-act=closeL]').click();
ok('cancelling preserves selected categories and their records',await page.locator('.category-check:checked').count()===2&&await page.evaluate(()=>window.__t.S.records.filter(r=>r.id.startsWith('bulk-')).length)===2);
await clickAt(page.locator('[data-act="categoryDeleteData"]'));await page.locator('[role=dialog] button[data-act=askOk]').click();
ok('confirmed bulk data deletion removes records but keeps categories',await page.evaluate(()=>window.__t.S.records.filter(r=>r.id.startsWith('bulk-')).length===0&&window.__t.S.cats.some(c=>c.id==='groceries')&&window.__t.S.cats.some(c=>c.id==='water')));
tile=page.locator('.grid3 .tile[data-id="groceries"]');box=await tile.boundingBox();
await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(550);await page.mouse.up();
await page.locator('.grid3 .tile[data-id="water"]').click();await clickAt(page.locator('[data-act="categoryDeleteSelected"]'));
ok('bulk category deletion also requires confirmation',await page.locator('[role=dialog]').innerText().then(t=>t.includes('Groceries')&&t.includes('Water Bottles')&&t.includes('Delete categories')));
await page.locator('[role=dialog] button[data-act=askOk]').click();
ok('confirmed bulk category deletion removes the selected categories and exits selection mode',
  await page.evaluate(()=>!window.__t.S.cats.some(c=>c.id==='groceries'||c.id==='water'))&&
  await page.locator('[data-category-bulk]').count()===1&&await page.locator('[data-category-bulk]').isHidden());
await browser.close();srv.close();process.exit(fails?1:0);
