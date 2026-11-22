import test from 'node:test';
import assert from 'node:assert/strict';
import {httpBackend} from '../../src/sync/backend.js';

function setup(handler,t0=1000000){
  const calls=[],m=new Map();let clock=t0;
  const fetchImpl=async(url,o)=>{calls.push({url,method:o.method||'GET',headers:o.headers,body:o.body?JSON.parse(o.body):undefined});const r=await handler(url,o,calls);return{ok:r.status<400,status:r.status,text:async()=>r.body===undefined?'':JSON.stringify(r.body)};};
  const be=httpBackend({url:'https://p.supabase.co/',anonKey:'ANON',store:{get:async k=>m.has(k)?m.get(k):null,set:async(k,v)=>{m.set(k,v);}},fetchImpl,now:()=>clock});
  return{be,calls,m,tick:ms=>{clock+=ms;}};
}
const sessBody=(n=1)=>({access_token:'AT'+n,refresh_token:'RT'+n,expires_in:3600,user:{id:'u1',email:'a@x.com'}});

test('sign in stores the session and later calls carry the access token',async()=>{
  const s=setup(url=>url.includes('/auth/v1/token')?{status:200,body:sessBody()}:{status:200,body:[]});
  await s.be.signIn('a@x.com','pw');
  assert.equal(s.calls[0].url,'https://p.supabase.co/auth/v1/token?grant_type=password');assert.equal(s.calls[0].headers.apikey,'ANON');
  await s.be.select('items',{eq:{profile_id:'p1'},gte:{updated_at:'2026-01-01T00:00:00Z'},order:['updated_at','kid'],limit:5,offset:10});
  const c=s.calls[1];assert.equal(c.headers.Authorization,'Bearer AT1');
  assert.equal(c.url,'https://p.supabase.co/rest/v1/items?profile_id=eq.p1&updated_at=gte.2026-01-01T00%3A00%3A00Z&order=updated_at.asc,kid.asc&limit=5&offset=10');
  assert.equal((await s.be.session()).user.email,'a@x.com');
});
test('an expired token is refreshed once, and the new session is kept',async()=>{
  const s=setup(url=>url.includes('/auth/v1/token')?{status:200,body:sessBody(url.includes('refresh')?2:1)}:{status:200,body:[]});
  await s.be.signIn('a@x.com','pw');s.tick(4000*1000);await s.be.rpc('list_members',{p_profile:'x'});
  assert.ok(s.calls.some(c=>c.url.includes('grant_type=refresh_token')&&c.body.refresh_token==='RT1'));
  assert.equal(s.calls.at(-1).headers.Authorization,'Bearer AT2');
});
test('a refused refresh signs the person out',async()=>{
  const s=setup(url=>url.includes('refresh')?{status:400,body:{error_code:'refresh_token_not_found',msg:'x'}}:{status:200,body:sessBody()});
  await s.be.signIn('a@x.com','pw');s.tick(4000*1000);
  await assert.rejects(()=>s.be.rpc('f',{}),{code:'auth'});assert.equal(await s.be.session(),null);
});
test('errors are mapped to short codes',async()=>{
  const cases=[[400,{error_code:'invalid_credentials',msg:'Invalid login credentials'},'credentials'],[400,{error_code:'email_not_confirmed',msg:'Email not confirmed'},'unconfirmed'],
    [422,{error_code:'user_already_exists',msg:'User already registered'},'exists'],[422,{error_code:'weak_password',msg:'Password should be at least 6 characters'},'weak'],[429,{msg:'slow down'},'rate']];
  for(const [st,body,code] of cases){const s=setup(()=>({status:st,body}));await assert.rejects(()=>s.be.signIn('a','b'),{code});}
});
test('a rule raised by the database comes through as its code; unknown errors become "server"',async()=>{
  const s=setup(url=>url.includes('/auth/v1/token')?{status:200,body:sessBody()}:{status:400,body:{code:'P0001',message:'device_limit'}});
  await s.be.signIn('a','b');await assert.rejects(()=>s.be.insert('devices',{}),{code:'device_limit'});
  const s2=setup(url=>url.includes('/auth/v1/token')?{status:200,body:sessBody()}:{status:500,body:{message:'relation "x" does not exist: details'}});
  await s2.be.signIn('a','b');await assert.rejects(()=>s2.be.rpc('f',{}),{code:'server'});
});
test('no network gives the code "offline"',async()=>{
  const be=httpBackend({url:'https://p.supabase.co',anonKey:'A',store:{get:async()=>null,set:async()=>{}},fetchImpl:async()=>{throw new TypeError('fetch failed');}});
  await assert.rejects(()=>be.signIn('a','b'),{code:'offline'});
});
test('sign-up reports whether email confirmation is still needed',async()=>{
  const s=setup(()=>({status:200,body:{id:'u1',email:'a@x.com'}}));assert.deepEqual(await s.be.signUp('a@x.com','pw123456'),{confirmed:false});
  const s2=setup(()=>({status:200,body:sessBody()}));assert.deepEqual(await s2.be.signUp('a@x.com','pw123456'),{confirmed:true});
});
test('a publishable key is sent only in the apikey header; a legacy JWT key also as Bearer; user calls use the user token',async()=>{
  const mk=key=>{const calls=[];const be=httpBackend({url:'https://p.supabase.co',anonKey:key,store:(m=>({get:async k=>m.has(k)?m.get(k):null,set:async(k,v)=>{m.set(k,v);}}))(new Map()),fetchImpl:async(u,o)=>{calls.push({u,h:o.headers});return{ok:true,status:200,text:async()=>JSON.stringify(sessBody())};}});return{be,calls};};
  const a=mk('sb_publishable_abc123');await a.be.signIn('a@x.com','pw123456');
  assert.equal(a.calls[0].h.apikey,'sb_publishable_abc123');assert.equal(a.calls[0].h.Authorization,undefined);
  const jwt='eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2ln';const l=mk(jwt);await l.be.signIn('a@x.com','pw123456');
  assert.equal(l.calls[0].h.Authorization,'Bearer '+jwt);
  await a.be.rpc('f',{});assert.equal(a.calls[1].h.Authorization,'Bearer AT1');assert.equal(a.calls[1].h.apikey,'sb_publishable_abc123');
});
test('forgot password: code is verified, then the new password is set with the new session',async()=>{
  const s=setup((url,o)=>url.includes('/auth/v1/verify')?{status:200,body:sessBody()}:{status:200,body:{}});
  await s.be.recover('a@x.com');assert.equal(s.calls[0].url.endsWith('/auth/v1/recover'),true);
  const r=await s.be.resetPassword('a@x.com','123 456','newpassword1');
  assert.deepEqual(s.calls[1].body,{type:'recovery',email:'a@x.com',token:'123456'});
  assert.equal(s.calls[2].method,'PUT');assert.deepEqual(s.calls[2].body,{password:'newpassword1'});assert.equal(s.calls[2].headers.Authorization,'Bearer AT1');
  assert.equal(r.user.email,'a@x.com');
});
test('forgot password: wrong code and reused password give readable codes, and no session is kept after a failed set',async()=>{
  const s=setup(url=>url.includes('/auth/v1/verify')?{status:403,body:{error_code:'otp_expired',msg:'Token has expired or is invalid'}}:{status:200,body:{}});
  await assert.rejects(()=>s.be.resetPassword('a@x.com','000000','newpassword1'),{code:'badcode'});
  const s2=setup(url=>url.includes('/auth/v1/verify')?{status:200,body:sessBody()}:{status:422,body:{error_code:'same_password',msg:'New password should be different from the old password.'}});
  await assert.rejects(()=>s2.be.resetPassword('a@x.com','123456','oldpassword1'),{code:'samepw'});
  assert.equal(await s2.be.session(),null);
});
test('sign-up sends a cleaned display name and the session carries it',async()=>{
  const s=setup(()=>({status:200,body:Object.assign(sessBody(),{user:{id:'u1',email:'a@x.com',user_metadata:{name:'Akshat'}}})}));
  await s.be.signUp('a@x.com','pw123456','  Aks\u0007hat ');
  assert.deepEqual(s.calls[0].body.data,{name:'Akshat'});
  assert.equal((await s.be.session()).user.name,'Akshat');
});
test('only known tables and function names are reachable; deletes need a filter',async()=>{
  const s=setup(url=>url.includes('/auth/v1/token')?{status:200,body:sessBody()}:{status:200,body:[]});await s.be.signIn('a','b');
  await assert.rejects(()=>s.be.select('auth.users',{}),{code:'table'});await assert.rejects(()=>s.be.rpc('x;drop',{}),{code:'table'});
  await assert.rejects(()=>s.be.remove('devices',{}),{code:'table'});await s.be.remove('devices',{eq:{device_id:'d1'}});
  assert.equal(s.calls.at(-1).method,'DELETE');assert.ok(s.calls.at(-1).url.endsWith('/rest/v1/devices?device_id=eq.d1'));
});
test('sign out forgets the session even when the network is down',async()=>{
  const s=setup(url=>url.includes('/auth/v1/token')?{status:200,body:sessBody()}:{status:200,body:null});await s.be.signIn('a','b');
  await s.be.signOut();assert.equal(await s.be.session(),null);assert.equal(s.m.get('sync.session'),'');
});
