// Runs docs/supabase/schema.sql in an in-memory Postgres and checks the security rules as different signed-in people.
// Needs: npm i --no-save @electric-sql/pglite     Run: node tests/db/schema-test.mjs
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const db=new PGlite();let fails=0;
const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++;};
const U={a:'aaaaaaaa-0000-4000-8000-000000000001',b:'bbbbbbbb-0000-4000-8000-000000000002',c:'cccccccc-0000-4000-8000-000000000003',x:'dddddddd-0000-4000-8000-000000000004'};
await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
 create table auth.users(id uuid primary key, email varchar, raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public to anon, authenticated; grant usage on schema auth to anon, authenticated;
 alter default privileges in schema public grant all on tables to anon, authenticated;
 alter default privileges in schema public grant execute on functions to anon, authenticated;`);
for(const [k,id] of Object.entries(U))await db.exec(`insert into auth.users(id,email) values('${id}','${k}@example.com')`);
await db.exec(readFileSync('docs/supabase/schema.sql','utf8'));
await db.exec(readFileSync('docs/supabase/schema.sql','utf8'));ok('schema runs twice without error',true);
const as=async(who,sql,params)=>{await db.exec(`reset role; set request.jwt.claim.sub='${who?U[who]:''}'; set role ${who?'authenticated':'anon'}`);return db.query(sql,params);};
const fails_=async(who,sql,params)=>{try{await as(who,sql,params);return null;}catch(e){return String(e.message);}};
const box=(s)=>JSON.stringify({iv:s,ct:s});
const dev=async(w,name)=>(await as(w,`insert into devices(user_id,name,pub) values($1,$2,'{"kty":"EC"}') returning device_id`,[U[w],name])).rows[0].device_id;

const da=await dev('a','A1'),db1=await dev('b','B1');
await dev('a','A2');ok('third phone for a is refused',/device_limit/.test(await fails_('a',`insert into devices(user_id,pub) values('${U.a}','{}')`)||''));
ok('cannot register a phone for someone else',!!(await fails_('a',`insert into devices(user_id,pub) values('${U.b}','{}')`)));

const pid=(await as('a',`select create_profile(gen_random_uuid(),$1::jsonb,$2::uuid,$3::jsonb) id`,[box('n'),da,box('k')])).rows[0].id;
ok('creator is owner and member',(await as('a',`select role from members where profile_id=$1`,[pid])).rows[0].role==='owner');
ok('stranger sees no profile, no members, no items',(await as('x',`select (select count(*) from profiles)::int p,(select count(*) from members)::int m,(select count(*) from items)::int i`)).rows[0].p===0);
ok('signed-out visitor cannot call functions',!!(await fails_(null,`select create_profile(gen_random_uuid(),'{}'::jsonb,'${da}','{}'::jsonb)`)));
ok('signed-out visitor cannot read tables',!!(await fails_(null,`select * from items`)));

const put=(w,rows,ver=1)=>as(w,`select put_items($1::uuid,$2,$3::jsonb) n`,[pid,ver,JSON.stringify(rows)]);
ok('member can save items',(await put('a',[{kid:'k1',t:100,iv:'i',ct:'c1'},{kid:'k2',t:100,iv:'i',ct:'c2'}])).rows[0].n===2);
ok('older version does not overwrite newer',(await put('a',[{kid:'k1',t:50,iv:'i',ct:'OLD'}])).rows[0].n===0&&(await as('a',`select ct from items where kid='k1'`)).rows[0].ct==='c1');
ok('newer version replaces',(await put('a',[{kid:'k1',t:200,iv:'i',ct:'NEW'}])).rows[0].n===1&&(await as('a',`select ct from items where kid='k1'`)).rows[0].ct==='NEW');
ok('stranger cannot save',/not_a_member/.test(await fails_('x',`select put_items('${pid}',1,'[]')`)||''));
ok('wrong key version is refused',/stale_key/.test(await fails_('a',`select put_items('${pid}',2,'[]')`)||''));
ok('direct writes to items are blocked',!!(await fails_('a',`insert into items(profile_id,kid,key_ver,t,iv,ct) values('${pid}','z',1,1,'i','c')`)));
ok('direct writes to members are blocked',!!(await fails_('a',`insert into members(profile_id,user_id,role) values('${pid}','${U.x}','member')`)));
ok('oversized batch refused',/bad_batch/.test(await fails_('a',`select put_items('${pid}',1,(select jsonb_agg(jsonb_build_object('kid',g::text,'t',1,'iv','i','ct','c')) from generate_series(1,501) g))`)||''));

const inv=(await as('a',`select create_invite($1::uuid,$2::jsonb) id`,[pid,box('w')])).rows[0].id;
ok('stranger cannot read invites directly',!!(await fails_('x',`select * from invites`)));
ok('non-member cannot create an invite',/not_a_member/.test(await fails_('x',`select create_invite('${pid}','{}')`)||''));
const joined=(await as('b',`select redeem_invite($1::uuid) r`,[inv])).rows[0].r;
ok('invite joins instantly and returns the wrapped key',joined.profile_id===pid&&joined.wrapped.iv==='w');
ok('invite is single-use',/invite_invalid/.test(await fails_('c',`select redeem_invite('${inv}')`)||''));
ok('member b can now read items but only b sees own keys',(await as('b',`select count(*)::int n from items`)).rows[0].n===2&&(await as('b',`select count(*)::int n from profile_keys`)).rows[0].n===0);
ok('b cannot read a own keys of a',(await as('b',`select count(*)::int n from profile_keys where user_id='${U.a}'`)).rows[0].n===0);
ok('existing member cannot redeem again',/already_member|invite_invalid/.test(await fails_('b',`select redeem_invite('${inv}')`)||''));
await as('a',`update invites set expires_at=now()-interval '1 minute' where false`).catch(()=>{});
await db.exec(`reset role; update invites set used_by=null; update invites set expires_at=now()-interval '1 hour'`);
ok('expired invite is refused',/invite_invalid/.test(await fails_('c',`select redeem_invite('${inv}')`)||''));
ok('members can invite too',!!(await as('b',`select create_invite($1::uuid,$2::jsonb) id`,[pid,box('w2')])).rows[0].id);

ok('a sees b phone and its own second phone as pending',(await as('a',`select count(*)::int n from pending_devices($1::uuid)`,[pid])).rows[0].n===2);
ok('b cannot give itself a key (no key held)',/no_key/.test(await fails_('b',`select grant_device('${pid}','${U.a}','${da}',1,'{}')`)||''));
await as('a',`select grant_device($1::uuid,$2::uuid,$3::uuid,1,$4::jsonb)`,[pid,U.b,db1,box('kb')]);
ok('a re-adds b phone: it leaves the pending list and b can read its key',(await as('a',`select count(*)::int n from pending_devices('${pid}')`)).rows[0].n===1&&(await as('b',`select count(*)::int n from profile_keys`)).rows[0].n===1);
ok('b cannot grant a key to a phone that is not a member',!!(await fails_('b',`select grant_device('${pid}','${U.x}','${da}',1,'{}')`)));
ok('list_members shows emails to members only',(await as('a',`select count(*)::int n from list_members('${pid}')`)).rows[0].n===2&&(await as('x',`select count(*)::int n from list_members('${pid}')`)).rows[0].n===0);
ok('a can see b public phone key, stranger cannot',(await as('a',`select count(*)::int n from devices where user_id='${U.b}'`)).rows[0].n===1&&(await as('x',`select count(*)::int n from devices where user_id='${U.b}'`)).rows[0].n===0);

ok('member cannot remove others',/owner_only/.test(await fails_('b',`select remove_member('${pid}','${U.a}')`)||'')||/owner_cannot_leave/.test(await fails_('b',`select remove_member('${pid}','${U.a}')`)||''));
ok('owner cannot be removed',/owner_cannot_leave/.test(await fails_('a',`select remove_member('${pid}','${U.a}')`)||''));
await as('a',`select remove_member($1::uuid,$2::uuid)`,[pid,U.b]);
ok('removed member loses all access',(await as('b',`select (select count(*) from items)::int i,(select count(*) from profiles)::int p,(select count(*) from profile_keys)::int k`)).rows[0].i===0);
ok('removed member cannot save',/not_a_member/.test(await fails_('b',`select put_items('${pid}',1,'[]')`)||''));
ok('rotation is owner only',/owner_only/.test(await fails_('b',`select rotate_profile('${pid}',2,'{}','[]','[]')`)||''));
await as('a',`select rotate_profile($1::uuid,2,'{"iv":"n2","ct":"n2"}'::jsonb,$2::jsonb,$3::jsonb)`,[pid,JSON.stringify([{kid:'k1',t:300,iv:'i',ct:'R1'}]),JSON.stringify([{user_id:U.a,device_id:da,wrapped:{iv:'n',ct:'n'}}])]);
ok('rotation swaps items and bumps the key version',(await as('a',`select count(*)::int n,max(ct) c from items`)).rows[0].n===1&&(await as('a',`select key_ver v from profiles`)).rows[0].v===2);
ok('old key version is now refused',/stale_key/.test(await fails_('a',`select put_items('${pid}',1,'[]')`)||''));

await as('a',`insert into user_recovery(user_id,pub,priv_box) values($1,'{}'::jsonb,$2::jsonb)`,[U.a,box('r')]);
ok('recovery box is private to its owner',(await as('b',`select count(*)::int n from user_recovery`)).rows[0].n===0&&(await as('a',`select count(*)::int n from user_recovery`)).rows[0].n===1);
ok('b cannot write a as recovery',!!(await fails_('b',`insert into user_recovery(user_id,pub,priv_box) values('${U.a}','{}','{}')`)));
ok('only the owner can rename',!!(await as('a',`update profiles set name_box=$1::jsonb where id=$2 returning id`,[box('z'),pid])).rows.length);
ok('only the owner can delete the profile',/owner_only/.test(await fails_('b',`select delete_profile('${pid}')`)||''));
await as('a',`select delete_profile($1::uuid)`,[pid]);
ok('delete removes everything for everyone',(await as('a',`select (select count(*) from items)::int i,(select count(*) from members)::int m`)).rows[0].i===0);
console.log(fails?fails+' FAILED':'all passed');process.exit(fails?1:0);
