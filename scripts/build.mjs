// Builds the web part of the app into www/ (bundles src/main.js, joins the CSS, copies fonts and index.html).
import {build} from 'esbuild';
import {cpSync,mkdirSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
const out='www';
rmSync(out,{recursive:true,force:true});mkdirSync(out+'/fonts',{recursive:true});
await build({entryPoints:['src/main.js'],bundle:true,format:'iife',target:['chrome100'],outfile:out+'/app.js',legalComments:'none',logLevel:'info'});
const css=['fonts','app','launch'].map(n=>readFileSync(`src/styles/${n}.css`,'utf8')).join('\n');
writeFileSync(out+'/app.css',css);
/* The page may only talk to its own files and, when cloud sync is configured, to that one https host. */
const cfg=readFileSync('src/sync/config.js','utf8'),m=cfg.match(/SUPABASE_URL\s*=\s*'(https:\/\/[A-Za-z0-9.-]+)\/?'/);
writeFileSync(out+'/index.html',readFileSync('src/index.html','utf8').replace("connect-src 'self'","connect-src 'self'"+(m?' '+m[1]:'')));
const F='node_modules/@fontsource-variable/';
for(const [d,f] of [['bricolage-grotesque','bricolage-grotesque-latin-ext-opsz-normal.woff2'],['bricolage-grotesque','bricolage-grotesque-latin-opsz-normal.woff2'],['figtree','figtree-latin-ext-wght-normal.woff2'],['figtree','figtree-latin-wght-normal.woff2']])
  cpSync(`${F}${d}/files/${f}`,`${out}/fonts/${f}`);
console.log('web build ready in www/');
