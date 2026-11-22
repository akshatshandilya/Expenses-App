/* The only code that talks to the network. A backend offers: session, signUp, signIn, signOut, rpc, select, insert, upsert, remove.
   Errors carry a short `code`: offline, credentials, unconfirmed, exists, weak, rate, auth, or the server rule that failed (e.g. device_limit). */
const err=(code,extra)=>Object.assign(new Error('sync:'+code),{code},extra);
export const cleanName=n=>typeof n==='string'?n.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,40):'';
const TABLES=new Set(['profiles','members','devices','profile_keys','items','user_recovery','recovery_keys']);
const isToken=m=>typeof m==='string'&&/^[a-z_]{3,40}$/.test(m);

/* The older "anon" key is a JWT and may also go in Authorization. The newer "publishable" key (sb_publishable_...) goes in the apikey header only. */
const isJwt=k=>/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(String(k||''));
export function httpBackend({url,anonKey,store,fetchImpl,now}){
  const f=fetchImpl||((...a)=>globalThis.fetch(...a)),clock=now||(()=>Date.now()),base=String(url||'').replace(/\/+$/,'');
  let sess;let loaded=false;
  const load=async()=>{if(loaded)return;loaded=true;try{const raw=await store.get('sync.session');sess=raw?JSON.parse(raw):null;}catch(e){sess=null;}};
  const save=async s=>{sess=s;try{await store.set('sync.session',s?JSON.stringify(s):'');}catch(e){}};
  async function call(path,{method='GET',body,token,headers}={}){
    const ctl=typeof AbortController!=='undefined'?new AbortController():null,timer=ctl?setTimeout(()=>ctl.abort(),20000):null;
    let res;
    try{res=await f(base+path,{method,signal:ctl&&ctl.signal,headers:Object.assign({apikey:anonKey,'Content-Type':'application/json'},token?{Authorization:'Bearer '+token}:isJwt(anonKey)?{Authorization:'Bearer '+anonKey}:{},headers),body:body===undefined?undefined:JSON.stringify(body)});}
    catch(e){throw err('offline');}
    finally{if(timer)clearTimeout(timer);}
    let data=null;try{const t=await res.text();data=t?JSON.parse(t):null;}catch(e){data=null;}
    if(res.ok)return data;
    const msg=data&&(data.message||data.msg||data.error_description||data.error),code=data&&(data.error_code||data.code);
    if(res.status===429)throw err('rate');
    if(code==='otp_expired'||/token has expired|otp.*(expired|invalid)|invalid.*(otp|token)/i.test(msg||''))throw err('badcode');
    if(code==='email_not_confirmed'||/not confirmed/i.test(msg||''))throw err('unconfirmed');
    if(code==='invalid_credentials'||/invalid login/i.test(msg||''))throw err('credentials');
    if(code==='user_already_exists'||/already registered/i.test(msg||''))throw err('exists');
    if(code==='same_password'||/different from the old/i.test(msg||''))throw err('samepw');
    if(code==='weak_password'||/password/i.test(msg||'')&&res.status===422)throw err('weak');
    if(res.status===401||res.status===403&&!isToken(msg))throw err('auth');
    throw err(isToken(msg)?msg:'server',{status:res.status});
  }
  const toSession=d=>({access:d.access_token,refresh:d.refresh_token,exp:clock()+Math.max(60,(d.expires_in||3600)-60)*1000,user:{id:d.user.id,email:d.user.email,name:cleanName(d.user.user_metadata&&d.user.user_metadata.name)}});
  async function token(){
    await load();if(!sess)throw err('auth');
    if(sess.exp>clock())return sess.access;
    let d;try{d=await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:sess.refresh}});}
    catch(e){if(e.code==='offline')throw e;await save(null);throw err('auth');}
    await save(toSession(d));return sess.access;
  }
  const q=(o={})=>{const p=[];for(const [c,v] of Object.entries(o.eq||{}))p.push(c+'=eq.'+encodeURIComponent(v));for(const [c,v] of Object.entries(o.gte||{}))p.push(c+'=gte.'+encodeURIComponent(v));if(o.order)p.push('order='+o.order.map(c=>encodeURIComponent(c)+'.asc').join(','));if(o.limit)p.push('limit='+o.limit);if(o.offset)p.push('offset='+o.offset);return p.length?'?'+p.join('&'):'';};
  const tbl=t=>{if(!TABLES.has(t))throw err('table');return '/rest/v1/'+t;};
  return{
    async session(){await load();return sess?{user:sess.user}:null;},
    async signUp(email,password,name){const d=await call('/auth/v1/signup',{method:'POST',body:{email,password,data:{name:cleanName(name)}}});if(d&&d.access_token){await save(toSession(d));return{confirmed:true};}return{confirmed:false};},
    async signIn(email,password){const d=await call('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});await save(toSession(d));return{user:sess.user};},
    /* Forgot password: Supabase emails a one-time code (see docs/supabase/README.md for the email template). The code signs the person in, then the new password is set. */
    async recover(email){await call('/auth/v1/recover',{method:'POST',body:{email}});return{sent:true};},
    async resetPassword(email,otp,password){
      const d=await call('/auth/v1/verify',{method:'POST',body:{type:'recovery',email,token:String(otp).replace(/\s+/g,'')}});
      await save(toSession(d));
      try{await call('/auth/v1/user',{method:'PUT',body:{password},token:sess.access});}catch(e){await save(null);throw e;}
      return{user:sess.user};
    },
    async signOut(){await load();const t=sess&&sess.access;await save(null);if(t){try{await call('/auth/v1/logout',{method:'POST',token:t});}catch(e){}}},
    async rpc(fn,args){if(!/^[a-z_]+$/.test(fn))throw err('table');return call('/rest/v1/rpc/'+fn,{method:'POST',body:args||{},token:await token()});},
    async select(t,o){return call(tbl(t)+q(o),{token:await token()});},
    async insert(t,row){const d=await call(tbl(t),{method:'POST',body:row,token:await token(),headers:{Prefer:'return=representation'}});return Array.isArray(d)?d[0]:d;},
    async upsert(t,row,on){return call(tbl(t)+(on?'?on_conflict='+encodeURIComponent(on):''),{method:'POST',body:row,token:await token(),headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});},
    async update(t,o,patch){if(!o||!o.eq||!Object.keys(o.eq).length)throw err('table');return call(tbl(t)+q(o),{method:'PATCH',body:patch,token:await token(),headers:{Prefer:'return=minimal'}});},
    async remove(t,o){if(!o||!o.eq||!Object.keys(o.eq).length)throw err('table');return call(tbl(t)+q(o),{method:'DELETE',token:await token()});}
  };
}
