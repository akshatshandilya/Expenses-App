// Visual-source-of-truth check: drives the approved preview and the real app through the same taps and compares the screens they draw.
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {mkdirSync,cpSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const CHROME=process.env.CHROME_PATH||'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
const OUT='tests/.tmp';mkdirSync(OUT+'/www',{recursive:true});
await build({entryPoints:['tests/browser/harness.js'],bundle:true,format:'iife',outfile:OUT+'/www/app.js',logLevel:'error'});
for(const f of ['app.css','index.html','fonts'])if(existsSync('www/'+f))cpSync('www/'+f,OUT+'/www/'+f,{recursive:true});
const proto=readFileSync('design/expenses-prototype-approved.html','utf8').replace(/<link[^>]*googleapis[^>]*>/g,'');
writeFileSync(OUT+'/proto.html','<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">'+proto);
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0];const f=u==='/proto.html'?OUT+'/proto.html':path.join(OUT,'www',u==='/'?'index.html':u);
  if(!existsSync(f)){r.writeHead(404);r.end();return;}
  r.writeHead(200,{'content-type':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.woff2')?'font/woff2':'text/html'});r.end(readFileSync(f));}).listen(0);
const port=srv.address().port;
const FREEZE=`(()=>{const R=Date,F=new R('2026-10-15T10:12:00+05:30').getTime();class D extends R{constructor(...a){if(a.length===0)super(F);else super(...a);}static now(){return F;}}window.Date=D;})();`;
const browser=await chromium.launch({executablePath:CHROME,args:['--no-sandbox']});browser.on('disconnected',()=>console.log('BROWSER GONE'));
async function mk(url,app){
  const ctx=await browser.newContext({viewport:{width:390,height:844},locale:'en-IN',timezoneId:'Asia/Kolkata',reducedMotion:'reduce'});
  await ctx.addInitScript(FREEZE);const page=await ctx.newPage();
  page.setDefaultTimeout(1500);const errs=[];page.on('pageerror',e=>{errs.push(String(e));console.log('pageerror',url,String(e).slice(0,200));});page.on('crash',()=>console.log('CRASH',url));
  await page.goto(`http://localhost:${port}/${url}`);
  if(app){await page.waitForSelector('html.ready',{timeout:15000});
    await page.evaluate(()=>{const t=window.__t;t.replaceState(t.blank());t.seedDemo(t.S);t.setStack([{n:'welcome',p:{}}]);t.draw();});}
  return{page,errs,ctx};
}
const norm=h=>h.replace(/data-id="[^"]*"/g,'data-id="X"').replace(/\s+/g,' ');
async function snap(page){return norm(await page.evaluate(()=>['#screen','#nav','#layer','#toast'].map(s=>{const e=document.querySelector(s);return e&&!e.hidden?e.innerHTML:'';}).join('\n@@\n')));}
const click=(p,s)=>p.click(s);
const act=(n,extra='')=>p=>p.click(`[data-act="${n}"]${extra}`,{force:true});
const fill=(s,v)=>p=>p.fill(s,v);
const steps=[
 ['welcome',null],['start',act('start')],
 ['tab expenses',act('tab','[data-t="expenses"]')],['search rice',fill('#q','rice')],['clear search',fill('#q','')],
 ['sort amount',p=>p.selectOption('#sort','amtDesc')],['filter travel',act('cf','[data-id="travel"]')],
 ['tab reports',act('tab','[data-t="reports"]')],['year view',act('repView','[data-v="year"]')],['prev year',act('yr','[data-d="-1"]')],['month view',act('repView','[data-v="month"]')],
 ['tab home',act('tab','[data-t="home"]')],['pick',act('pick')],['pick water',act('pickGo','[data-id="water"]')],
 ['water price 60',fill('#wsp','60')],['save price',act('wSetupSave')],
 ['cal tab first',act('wTab','[data-v="cal"]')],['select day',act('wDay','[data-date="2026-10-15"]')],['add delivery',act('wAdd')],['qty 3',fill('#f_qty','3')],['save delivery',act('saveForm')],
 ['change price',act('wPrice')],['new price 65',fill('[data-d="np"]','65')],['save new price',act('savePrice')],
 ['calendar tab',act('wTab','[data-v="cal"]')],['select 12th',act('wDay','[data-date="2026-10-12"]')],['add again',act('wAdd')],['back',act('back')],
 ['back home',act('back')],
 ['open travel',act('openCat','[data-id="travel"]')],['dist tab',act('tTab','[data-v="distance"]')],['toll tab',act('tTab','[data-v="toll"]')],['fuel tab',act('tTab','[data-v="fuel"]')],
 ['add fuel',act('tAdd','[data-s="fuel"]')],['fuel qty',fill('#f_qty','10')],['fuel unit',fill('#f_unit','105')],['save fuel',act('saveForm')],
 ['back2',act('back')],
 ['open rent',act('openCat','[data-id="rent"]')],['rent paid',act('rentPick','[data-v="paid"]')],['rent add',act('rentAdd')],['quick amount',fill('#qaAmt','14000')],['quick paid',act('qaPaid')],['quick save',act('qaSave')],
 ['back3',act('back')],['back4',act('back')],
 ['open electricity',act('openCat','[data-id="electricity"]')],['elec add',act('elecAdd')],['houses',p=>p.keyboard.press('Escape')],['houses page',act('houses')],['add house',act('addHouse')],['house name',fill('#f_name','Farm')],['save house',act('saveForm')],
 ['back5',act('back')],['back6',act('back')],
 ['open groceries',act('openCat','[data-id="groceries"]')],['grocery add',act('catAdd','[data-id="groceries"]')],['detail switch',p=>p.check('[data-f="det"]')],['g title',fill('#f_title','Rice')],['g qty',fill('#f_qty','5')],['g uLabel',fill('#f_uLabel','kg')],['g unit',fill('#f_unit','60')],['g save',act('saveForm')],
 ['record sheet',p=>p.click('.rec[data-act="rec"] >> nth=0')],['delete ask',act('del')],['cancel',act('closeL')],['close',p=>p.keyboard.press('Escape')],
 ['back7',act('back')],
 ['new category',act('newCat')],['cat name',fill('#ncn','Internet')],['cat unit kind',act('ncKind','[data-v="unit"]')],['cat unit',fill('#ncu','month')],['save cat',act('saveCat')],
 ['tab settings',act('tab','[data-t="settings"]')],['theme dark',act('theme','[data-v="dark"]')],['theme light',act('theme','[data-v="light"]')],
 ['lock setup',act('lockSetup')],['lock timeout',act('lockTO','[data-v="60"]')],['back8',act('back')],['privacy',act('privacy')],['back9',act('back')],['backup',act('backup')],['back10',act('back')],
 ['today sheet',null]
];
console.log('launching');const A=await mk('proto.html',false);console.log('A ok');try{await A.page.waitForTimeout(50);console.log('A alive after wait');}catch(e){console.log('A dead',e.message.slice(0,80));}const B=await mk('index.html',true);console.log('B ok');for(const [n,x] of [['A',A],['B',B]]){try{await x.page.waitForTimeout(20);console.log(n,'alive');}catch(e){console.log(n,'dead',e.message.slice(0,60));}}
let diffs=0;const out=[];
for(const [name,fn] of steps){
  console.log('step',name);
  for(const x of [A,B]){if(fn)await fn(x.page).catch(e=>{console.log('STEP FAIL',name,x===A?'proto':'app',e.message.split('\n').slice(0,6).join(' | ').slice(0,400));});await x.page.waitForTimeout(30);}
  const a=await snap(A.page),b=await snap(B.page);
  if(a!==b){diffs++;let i=0;while(i<a.length&&a[i]===b[i])i++;out.push(`DIFF @ "${name}"\n  proto: ...${a.slice(Math.max(0,i-60),i+120)}\n  app:   ...${b.slice(Math.max(0,i-60),i+120)}`);}
}
console.log(`${steps.length} steps compared, ${diffs} differ`);console.log(out.join('\n'));
if(A.err||B.err)console.log('step errors',A.err,B.err);
console.log('page errors proto:',A.errs.slice(0,3),'app:',B.errs.slice(0,3));
await browser.close();srv.close();
process.exit(diffs?1:0);
