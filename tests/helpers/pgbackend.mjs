// A test double for the sync backend that runs the real schema.sql in an in-memory Postgres, with real row-level security.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const SETS=new Set(['pending_devices','list_members']);
export async function makeServer(){
  const db=new PGlite();let n=0;
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
   create table auth.users(id uuid primary key default gen_random_uuid(), email varchar unique, pw text, raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema public to anon, authenticated; grant usage on schema auth to anon, authenticated;
   alter default privileges in schema public grant all on tables to anon, authenticated;
   alter default privileges in schema public grant execute on functions to anon, authenticated;`);
  await db.exec(readFileSync(new URL('../../docs/supabase/schema.sql',import.meta.url),'utf8'));
  let chain=Promise.resolve();
  const run=(uid,sql,params)=>{const p=chain.then(async()=>{await db.exec(`reset role; set request.jwt.claim.sub='${uid||''}'; set role ${uid?'authenticated':'anon'}`);return db.query(sql,params);});chain=p.catch(()=>{});return p;};
  const admin=async(sql,params)=>{const p=chain.then(async()=>{await db.exec('reset role');return db.query(sql,params);});chain=p.catch(()=>{});return p;};
  const fail=e=>{const m=String(e.message||e);throw Object.assign(new Error('sync:'+(/^[a-z_]{3,40}$/.test(m)?m:'server')),{code:/^[a-z_]{3,40}$/.test(m)?m:'server',raw:m});};
  const cols=r=>Object.keys(r);
  function client(){
    let me=null;
    const need=()=>{if(!me)throw Object.assign(new Error('sync:auth'),{code:'auth'});return me.id;};
    return{
      offline:false,
      async session(){return me?{user:me}:null;},
      async signUp(email,pw,name){const r=await admin(`insert into auth.users(email,pw,raw_user_meta_data) values($1,$2,$3) on conflict do nothing returning id`,[email,pw,JSON.stringify({name:name||''})]);if(!r.rows.length)throw Object.assign(new Error('sync:exists'),{code:'exists'});return{confirmed:false,id:r.rows[0].id};},
      async signIn(email,pw){const r=await admin(`select id,email from auth.users where email=$1 and pw=$2`,[email,pw]);if(!r.rows.length)throw Object.assign(new Error('sync:credentials'),{code:'credentials'});me={id:r.rows[0].id,email};return{user:me};},
      async signOut(){me=null;},
      async rpc(fn,args={}){
        if(this.offline)throw Object.assign(new Error('sync:offline'),{code:'offline'});
        const uid=need(),keys=Object.keys(args),sql=`select * from public.${fn}(${keys.map((k,i)=>k+' := $'+(i+1)).join(',')})`;
        try{const r=await run(uid,sql,keys.map(k=>typeof args[k]==='object'&&args[k]!==null?JSON.stringify(args[k]):args[k]));
          if(SETS.has(fn))return r.rows;const v=r.rows[0]&&r.rows[0][fn];return v===undefined?null:v;}catch(e){fail(e);}
      },
      async select(t,o={}){
        if(this.offline)throw Object.assign(new Error('sync:offline'),{code:'offline'});
        const uid=need(),w=[],p=[];for(const [c,v] of Object.entries(o.eq||{})){p.push(v);w.push(`${c}=$${p.length}`);}for(const [c,v] of Object.entries(o.gte||{})){p.push(v);w.push(`${c}>=$${p.length}`);}
        try{return (await run(uid,`select * from public.${t}${w.length?' where '+w.join(' and '):''}${o.order?' order by '+o.order.join(','):''}${o.limit?' limit '+o.limit:''}${o.offset?' offset '+o.offset:''}`,p)).rows;}catch(e){fail(e);}
      },
      async insert(t,row){need();try{return (await run(me.id,`insert into public.${t} (${cols(row).join(',')}) select ${cols(row).join(',')} from jsonb_populate_record(null::public.${t},$1::jsonb) returning *`,[JSON.stringify(row)])).rows[0];}catch(e){fail(e);}},
      async upsert(t,row,on){need();const c=cols(row),conf=(on||'').split(',');try{await run(me.id,`insert into public.${t} (${c.join(',')}) select ${c.join(',')} from jsonb_populate_record(null::public.${t},$1::jsonb) on conflict (${conf.join(',')}) do update set ${c.filter(x=>!conf.includes(x)).map(x=>x+'=excluded.'+x).join(',')}`,[JSON.stringify(row)]);}catch(e){fail(e);}},
      async update(t,o,patch){need();const w=[],p=[JSON.stringify(patch)];for(const [c,v] of Object.entries(o.eq)){p.push(v);w.push(`${c}=$${p.length}`);}const ks=Object.keys(patch);try{await run(me.id,`update public.${t} set ${ks.map(k=>k+'=(jsonb_populate_record(null::public.'+t+',$1::jsonb)).'+k).join(',')} where ${w.join(' and ')}`,p);}catch(e){fail(e);}},
      async remove(t,o){need();const w=[],p=[];for(const [c,v] of Object.entries(o.eq)){p.push(v);w.push(`${c}=$${p.length}`);}try{await run(me.id,`delete from public.${t} where ${w.join(' and ')}`,p);}catch(e){fail(e);}}
    };
  }
  return{client,admin,db};
}
