// An in-memory stand-in for Supabase with the same rules as docs/supabase/schema.sql, small enough to run inside a browser page.
// Used for the HTML preview and the browser tests. Not part of the app.
const code=c=>Object.assign(new Error('sync:'+c),{code:c});
const uuid=()=>globalThis.crypto.randomUUID();
export function makeMemServer({autoConfirm=true}={}){
  const T={users:[],profiles:[],members:[],devices:[],profile_keys:[],items:[],invites:[],user_recovery:[],recovery_keys:[]};
  let tick=0;const stamp=()=>new Date(Date.UTC(2026,0,1)+(++tick)*1000).toISOString();
  const isMember=(pid,u)=>T.members.some(m=>m.profile_id===pid&&m.user_id===u);
  const shares=(a,b)=>T.members.some(x=>x.user_id===a&&T.members.some(y=>y.profile_id===x.profile_id&&y.user_id===b));
  const match=(row,o={})=>Object.entries(o.eq||{}).every(([c,v])=>String(row[c])===String(v))&&Object.entries(o.gte||{}).every(([c,v])=>row[c]>=v);
  const clone=x=>x===undefined?x:JSON.parse(JSON.stringify(x));
  function visible(t,u){
    switch(t){
      case 'profiles':return T.profiles.filter(p=>isMember(p.id,u));
      case 'members':return T.members.filter(m=>isMember(m.profile_id,u));
      case 'devices':return T.devices.filter(d=>d.user_id===u||shares(u,d.user_id));
      case 'profile_keys':return T.profile_keys.filter(k=>k.user_id===u);
      case 'items':return T.items.filter(i=>isMember(i.profile_id,u));
      case 'user_recovery':return T.user_recovery.filter(r=>r.user_id===u);
      case 'recovery_keys':return T.recovery_keys.filter(r=>r.user_id===u&&isMember(r.profile_id,u));
    }throw code('table');
  }
  const curVer=pid=>T.profiles.find(p=>p.id===pid).key_ver;
  const fns={
    create_profile(u,a){
      if(T.profiles.filter(p=>p.owner===u).length>=12)throw code('profile_limit');
      if(!T.devices.some(d=>d.user_id===u&&d.device_id===a.p_device))throw code('unknown_device');
      T.profiles.push({id:a.p_id,owner:u,name_box:a.p_name_box,key_ver:1,created_at:stamp()});
      T.members.push({profile_id:a.p_id,user_id:u,role:'owner',added_by:u,created_at:stamp()});
      T.profile_keys.push({profile_id:a.p_id,user_id:u,device_id:a.p_device,key_ver:1,wrapped:a.p_wrapped});return a.p_id;
    },
    put_items(u,a){
      if(!isMember(a.p_profile,u))throw code('not_a_member');if(a.p_ver!==curVer(a.p_profile))throw code('stale_key');
      if(a.p_rows.length>500)throw code('bad_batch');let n=0;
      for(const r of a.p_rows){const cur=T.items.find(i=>i.profile_id===a.p_profile&&i.kid===r.kid),row={profile_id:a.p_profile,kid:r.kid,key_ver:a.p_ver,t:r.t,iv:r.iv,ct:r.ct,author:u,updated_at:stamp()};
        if(!cur){T.items.push(row);n++;}else if(r.t>=cur.t){Object.assign(cur,row);n++;}}
      return n;
    },
    create_invite(u,a){if(!isMember(a.p_profile,u))throw code('not_a_member');const id=uuid();T.invites.push({id,profile_id:a.p_profile,created_by:u,key_ver:curVer(a.p_profile),wrapped:a.p_wrapped,expires_at:Date.now()+864e5,used_by:null});return id;},
    redeem_invite(u,a){
      const inv=T.invites.find(i=>i.id===a.p_invite);if(!inv)throw code('invite_invalid');
      if(isMember(inv.profile_id,u))throw code('already_member');if(inv.used_by||inv.expires_at<Date.now())throw code('invite_invalid');
      inv.used_by=u;T.members.push({profile_id:inv.profile_id,user_id:u,role:'member',added_by:inv.created_by,created_at:stamp()});
      return{profile_id:inv.profile_id,key_ver:inv.key_ver,wrapped:inv.wrapped,name_box:T.profiles.find(p=>p.id===inv.profile_id).name_box};
    },
    grant_device(u,a){
      if(!isMember(a.p_profile,u)||!isMember(a.p_profile,a.p_user))throw code('not_a_member');
      if(!T.devices.some(d=>d.user_id===a.p_user&&d.device_id===a.p_device))throw code('unknown_device');
      if(a.p_ver!==curVer(a.p_profile))throw code('stale_key');
      if(a.p_user!==u&&!T.profile_keys.some(k=>k.profile_id===a.p_profile&&k.user_id===u&&k.key_ver===a.p_ver))throw code('no_key');
      T.profile_keys=T.profile_keys.filter(k=>!(k.profile_id===a.p_profile&&k.user_id===a.p_user&&k.device_id===a.p_device&&k.key_ver===a.p_ver));
      T.profile_keys.push({profile_id:a.p_profile,user_id:a.p_user,device_id:a.p_device,key_ver:a.p_ver,wrapped:a.p_wrapped});return null;
    },
    pending_devices(u,a){
      if(!isMember(a.p_profile,u))return[];const v=curVer(a.p_profile);
      return T.members.filter(m=>m.profile_id===a.p_profile).flatMap(m=>T.devices.filter(d=>d.user_id===m.user_id))
        .filter(d=>!T.profile_keys.some(k=>k.profile_id===a.p_profile&&k.user_id===d.user_id&&k.device_id===d.device_id&&k.key_ver===v)).map(d=>({user_id:d.user_id,device_id:d.device_id,name:d.name,pub:d.pub}));
    },
    list_members(u,a){if(!isMember(a.p_profile,u))return[];return T.members.filter(m=>m.profile_id===a.p_profile).map(m=>({user_id:m.user_id,email:T.users.find(x=>x.id===m.user_id).email,name:T.users.find(x=>x.id===m.user_id).name||null,role:m.role,created_at:m.created_at}));},
    remove_member(u,a){
      const p=T.profiles.find(x=>x.id===a.p_profile);if(!isMember(a.p_profile,u))throw code('not_a_member');
      if(a.p_user===p.owner)throw code('owner_cannot_leave');if(a.p_user!==u&&u!==p.owner)throw code('owner_only');
      T.profile_keys=T.profile_keys.filter(k=>!(k.profile_id===a.p_profile&&k.user_id===a.p_user));
      T.recovery_keys=T.recovery_keys.filter(k=>!(k.profile_id===a.p_profile&&k.user_id===a.p_user));
      T.members=T.members.filter(m=>!(m.profile_id===a.p_profile&&m.user_id===a.p_user));return null;
    },
    rotate_profile(u,a){
      const p=T.profiles.find(x=>x.id===a.p_profile);if(!p||p.owner!==u)throw code('owner_only');if(a.p_new_ver!==p.key_ver+1)throw code('stale_key');
      T.items=T.items.filter(i=>i.profile_id!==a.p_profile);T.invites=T.invites.filter(i=>i.profile_id!==a.p_profile);
      for(const r of a.p_rows)T.items.push({profile_id:a.p_profile,kid:r.kid,key_ver:a.p_new_ver,t:r.t,iv:r.iv,ct:r.ct,author:u,updated_at:stamp()});
      p.key_ver=a.p_new_ver;p.name_box=a.p_name_box;
      for(const k of a.p_keys){if(!isMember(a.p_profile,k.user_id))throw code('not_a_member');T.profile_keys.push({profile_id:a.p_profile,user_id:k.user_id,device_id:k.device_id,key_ver:a.p_new_ver,wrapped:k.wrapped});}
      return null;
    },
    delete_profile(u,a){const p=T.profiles.find(x=>x.id===a.p_profile);if(!p||p.owner!==u)throw code('owner_only');
      for(const t of ['profiles','members','profile_keys','items','invites','recovery_keys'])T[t]=T[t].filter(r=>(t==='profiles'?r.id:r.profile_id)!==a.p_profile);return null;}
  };
  function client(){
    let me=null;const need=()=>{if(!me)throw code('auth');return me.id;};
    const c={
      offline:false,
      guard(){if(c.offline)throw code('offline');},
      async session(){return me?{user:{id:me.id,email:me.email,name:me.name}}:null;},
      async signUp(email,pw,name){c.guard();if(T.users.some(x=>x.email===email))throw code('exists');if(String(pw).length<6)throw code('weak');
        const u={id:uuid(),email,pw,name:String(name||'').trim().slice(0,40),confirmed:autoConfirm};T.users.push(u);if(autoConfirm){me=u;return{confirmed:true};}return{confirmed:false};},
      async signIn(email,pw){c.guard();const u=T.users.find(x=>x.email===email&&x.pw===pw);if(!u)throw code('credentials');if(!u.confirmed)throw code('unconfirmed');me=u;return{user:{id:u.id,email:u.email,name:u.name}};},
      async recover(email){c.guard();const u=T.users.find(x=>x.email===email);if(u){u.reset='123456';}return{sent:true};},
      async resetPassword(email,otp,pw){c.guard();const u=T.users.find(x=>x.email===email);if(!u||!u.reset||u.reset!==String(otp).replace(/\s+/g,''))throw code('badcode');if(String(pw).length<6)throw code('weak');if(u.pw===pw)throw code('samepw');u.pw=pw;u.reset=null;u.confirmed=true;me=u;return{user:{id:u.id,email:u.email,name:u.name}};},
      async signOut(){me=null;},
      async rpc(fn,args={}){c.guard();const u=need();if(!fns[fn])throw code('table');return clone(fns[fn](u,clone(args)));},
      async select(t,o={}){c.guard();const u=need();let rows=visible(t,u).filter(r=>match(r,o));
        if(o.order)rows=[...rows].sort((a,b)=>{for(const k of o.order){if(a[k]<b[k])return-1;if(a[k]>b[k])return 1;}return 0;});
        if(o.offset)rows=rows.slice(o.offset);if(o.limit)rows=rows.slice(0,o.limit);return clone(rows);},
      async insert(t,row){c.guard();const u=need();
        if(t==='devices'){if(row.user_id!==u)throw code('forbidden');if(T.devices.filter(d=>d.user_id===u).length>=2)throw code('device_limit');const d={user_id:u,device_id:uuid(),name:row.name||'Phone',pub:row.pub,created_at:stamp()};T.devices.push(d);return clone(d);}
        throw code('forbidden');},
      async upsert(t,row,on){c.guard();const u=need();if(row.user_id!==u)throw code('forbidden');
        if(t==='recovery_keys'&&!isMember(row.profile_id,u))throw code('forbidden');
        if(t!=='user_recovery'&&t!=='recovery_keys')throw code('forbidden');
        const keys=(on||'').split(',');const i=T[t].findIndex(r=>keys.every(k=>r[k]===row[k]));if(i>=0)T[t][i]=clone(row);else T[t].push(clone(row));},
      async update(t,o,patch){c.guard();const u=need();if(t!=='profiles'||Object.keys(patch).join()!=='name_box')throw code('forbidden');
        const p=T.profiles.find(x=>x.id===o.eq.id);if(!p||p.owner!==u)throw code('forbidden');p.name_box=patch.name_box;},
      async remove(t,o){c.guard();const u=need();
        if(t==='devices'){T.devices=T.devices.filter(d=>!(d.user_id===u&&String(d.device_id)===String(o.eq.device_id)));T.profile_keys=T.profile_keys.filter(k=>!(k.user_id===u&&String(k.device_id)===String(o.eq.device_id)));return;}
        if(t==='recovery_keys'){T.recovery_keys=T.recovery_keys.filter(r=>!(r.user_id===u&&match(r,o)));return;}
        throw code('forbidden');}
    };
    return c;
  }
  return{client,tables:T,confirm:email=>{const u=T.users.find(x=>x.email===email);if(u)u.confirmed=true;}};
}
