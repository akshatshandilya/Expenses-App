/* @auto-imports */
import {esc,$} from '../core/util.js';
import {DLG,S} from '../data/state.js';
import {REG,MAX_NAME,MAX_PROFILES,activeProfile,profileOf,createProfile,renameProfile,deleteProfile,activateProfile,nameError,peekProfile,clearProfileData,markMoved} from '../data/profiles.js';
import {SYNC,configured,onSync,setRedraw,errText,signIn,signUp,signOut,createShared,joinInvite,syncNow,inviteLink,parseInvite,isOwner,removeMember,approvePhone,renameShared,leaveShared,deleteSharedEverywhere,forgetLocal,devices,removeDevice,hasRecovery,prepareRecovery,saveRecovery,restore,countOf,displayName,sendResetCode,resetPassword} from '../sync/service.js';
import {applyLockEffects} from '../native/lock.js';
import {hd} from './components.js';
import {ic} from './icons.js';
import {A,V} from './registry.js';
import {row} from './views-settings.js';
import {ask,closeL,draw,go,sheet,stack,tab,toast} from './nav.js';
/* @end-imports */
/* Profiles, account, invites and members. Personal profiles stay on this phone; shared profiles sync, encrypted end to end. */
const P={first:false,rsStep:1,newShared:false,newImport:true,srcId:null,srcCount:0,createAcc:false,pending:null,phrase:'',recSaved:false,recMode:'first',devs:[],code:''};
const val=id=>{const e=document.getElementById(id);return e?e.value:'';};
const bad=e=>toast(errText(e),'bad');
async function busy(el,fn){
  if(el&&el.dataset.busy)return;
  if(el){el.dataset.busy='1';el.disabled=true;}
  try{return await fn();}finally{if(el&&el.isConnected){delete el.dataset.busy;el.disabled=false;}}
}
const redo=n=>{stack.pop();go(n);};
const refresh=()=>{applyLockEffects();closeL();tab('home');};
const cp=p=>'<span class="ci" style="--c:'+(p.shared?'#0E6B58':'#5B6C9D')+'">'+ic(p.shared?'users':'pin',22)+'</span>';
const subOf=p=>p.shared?('Shared'+(p.id===REG.active&&SYNC.members.length?' · '+SYNC.members.length+(SYNC.members.length===1?' member':' members'):'')):'This phone only';
const mname=m=>displayName({name:m.name,email:m.email});
const who=uid=>{const m=SYNC.members.find(x=>x.user_id===uid);return m?mname(m):'a family member';};

/* ---- Home header: where this profile lives and whether it is up to date ---- */
export function homePills(){
  const p=activeProfile();
  if(!p.shared)return '<div class="pills" style="margin:-4px 0 10px"><span class="pill">'+ic('pin',14)+'This phone only</span></div>';
  const st={idle:['good','check','Synced'],syncing:['','upload','Syncing…'],offline:['warn','upload','Offline · will sync later'],needsKey:['warn','lock','Waiting for approval'],error:['warn','upload','Sync problem · tap to retry'],gone:['warn','lock','No access']}[SYNC.status]||['','check','Synced'];
  const n=SYNC.members.length;
  return '<div class="pills" style="margin:-4px 0 10px"><button class="pill pillb '+st[0]+'" data-act="profSync" aria-label="Sync now">'+ic(st[1],14)+st[2]+'</button>'+(n?'<span class="pill">'+ic('users',14)+n+(n===1?' member':' members')+'</span>':'')+'<span class="pill">'+ic('lock',14)+'End to end encrypted</span>'+(SYNC.pending.length?'<button class="pill pillb warn" data-act="pfMembersS">'+ic('pin',14)+'Approve a phone</button>':'')+'</div>';
}

/* ---- profiles list ---- */
const pRow=p=>{
  const on=p.id===REG.active,many=REG.profiles.length>1;
  return '<div class="rec" style="cursor:default">'+cp(p)+'<span class="rt"><b>'+esc(p.name)+(on?'<i class="demo">OPEN</i>':'')+'</b><small>'+esc(subOf(p))+'</small></span>'+
   (on?'':'<button class="ib flat" data-act="profOpen" data-id="'+esc(p.id)+'" aria-label="Open '+esc(p.name)+'">'+ic('chevR',20)+'</button>')+
   (on&&p.shared?'<button class="ib flat" data-act="pfMembersS" aria-label="Members of '+esc(p.name)+'">'+ic('users',20)+'</button>':'')+
   (on||!p.shared?'<button class="ib flat" data-act="profRename" data-id="'+esc(p.id)+'" aria-label="Rename '+esc(p.name)+'">'+ic('edit',20)+'</button>':'')+
   ((on||!p.shared)&&many?'<button class="ib flat" data-act="profDelete" data-id="'+esc(p.id)+'" aria-label="'+(p.shared?(isOwner()?'Delete ':'Leave '):'Delete ')+esc(p.name)+'">'+ic('trash',20)+'</button>':'')+'</div>';
};
V.profiles=()=>hd('Profiles')+'<p class="sub" style="margin:-4px 2px 12px">Each profile keeps its own expenses. Shared profiles sync to your family. Personal profiles stay on this phone.</p>'+
  '<div class="list">'+REG.profiles.map(pRow).join('')+'</div>'+
  (REG.bad?'<p class="note">The profile list could not be read, so profiles cannot be added or removed right now. Your records are untouched.</p>':
   '<div class="cta"><button class="btn pri block" data-act="profNew"'+(REG.profiles.length>=MAX_PROFILES?' disabled':'')+'>'+ic('plus',20)+'Add a profile</button></div><div class="cta"><button class="btn block" data-act="jnOpen">Join with an invite link</button></div>');
export const profileSwitcher=()=>{
  sheet('<h2>Switch profile</h2><div class="list">'+REG.profiles.map(p=>'<button class="rec" data-act="'+(p.id===REG.active?'closeL':'profOpen')+'" data-id="'+esc(p.id)+'">'+cp(p)+'<span class="rt"><b>'+esc(p.name)+'</b><small>'+(p.id===REG.active?'Open now · ':'')+esc(subOf(p))+'</small></span>'+(p.id===REG.active?ic('check',20):'')+'</button>').join('')+'</div><div class="row2" style="margin-top:12px"><button class="btn" data-act="closeL">Close</button><button class="btn soft" data-act="profManage">Manage</button></div>');
};

/* ---- new profile ---- */
V.profileNew=()=>{
  const sh=P.newShared,ready=configured();
  return hd('New profile')+'<div class="card"><div class="fld" style="margin-bottom:12px"><label for="pfName">Profile name</label><input id="pfName" type="text" maxlength="'+MAX_NAME+'" autocomplete="off" placeholder="e.g. Home, Trip to Goa, My spending" value="'+esc(DLG.pn||'')+'" data-d="pn"><p class="err" id="pnErr" role="alert"></p></div>'+
   '<label class="sw"><input type="checkbox" role="switch" id="pfShared" data-act="pfSharedTog"'+(sh?' checked':'')+(ready?'':' disabled')+'><span class="trk"></span><span>Shared</span></label>'+
   '<p class="sub" style="margin-top:8px" id="pfHint">'+(!ready?'Cloud sync is not set up in this version of the app, so only personal profiles can be created.':sh?'Synced to the cloud with end-to-end encryption. You can invite family with a link.':'Stays on this phone only. Nothing is uploaded.')+'</p></div>'+
   '<div class="card"><h2>Where the data lives</h2><div class="kv"><span>Storage</span><span id="pfWhere">'+(sh?'Cloud, encrypted':'This phone only')+'</span></div><div class="kv"><span>Account needed</span><span id="pfAcct">'+(sh?(SYNC.user?'Signed in':'Yes, sign in next'):'No')+'</span></div><div class="kv"><span>Who can see it</span><span id="pfWho">'+(sh?'People you invite':'Only you')+'</span></div></div>'+
   '<div class="card" id="pfImpCard"'+(sh&&P.srcCount?'':' hidden')+'><label class="sw"><input type="checkbox" role="switch" data-act="pfImpTog"'+(P.newImport?' checked':'')+'><span class="trk"></span><span>Start with the records on this phone</span></label><p class="sub" style="margin-top:8px" id="pfImpHint">'+impHint()+'</p></div>'+
   '<div class="cta"><button class="btn pri block" id="pfSave" data-act="pfSave">'+(sh&&!SYNC.user?'Continue to sign in':'Create profile')+'</button></div>';
};
const impHint=()=>P.newImport?'Copies '+P.srcCount+' records, houses and prices from "'+esc((profileOf(P.srcId)||{}).name||'Personal')+'" into this profile. When it is uploaded you can choose to clear them from "'+esc((profileOf(P.srcId)||{}).name||'Personal')+'".':'This profile starts empty.';
async function pickSource(){
  P.srcId=null;P.srcCount=0;
  for(const p of REG.profiles.filter(x=>!x.shared)){const d=await peekProfile(p.id),n=countOf(d);if(n>P.srcCount){P.srcId=p.id;P.srcCount=n;}}
}

/* ---- account ---- */
V.signin=()=>{
  const up=P.createAcc,pend=P.pending;
  const note=pend&&pend.type==='join'?'<p class="sub" style="margin:0 2px 12px">Sign in to join the profile you were invited to.</p>':pend&&pend.type==='newprofile'?'<p class="sub" style="margin:0 2px 12px">Sign in to create the shared profile <b>'+esc(pend.draft.name)+'</b>.</p>':'';
  const head=hd(up?'Create account':'Sign in');
  const intro=P.first?'<p class="sub" style="margin:0 2px 12px">Sign in to use shared profiles with your family. You can also continue without an account and use this phone on its own.</p>':'';
  return (P.first?head.replace(/<button class="ib" data-act="back"[^>]*>.*?<\/button>/,''):head)+intro+'<div class="seg" role="tablist" style="margin-bottom:14px"><button role="tab" class="'+(up?'':'on')+'" aria-selected="'+!up+'" data-act="acTab" data-v="in">Sign in</button><button role="tab" class="'+(up?'on':'')+'" aria-selected="'+up+'" data-act="acTab" data-v="up">Create account</button></div>'+
   '<div class="card">'+(up?'<div class="fld" style="margin-bottom:12px"><label for="acName">Your name</label><input id="acName" type="text" autocomplete="given-name" maxlength="40" placeholder="e.g. Akshat" value="'+esc(DLG.acName||'')+'" data-d="acName"><small class="sub">Family members see this name, not your email.</small></div>':'')+'<div class="fld" style="margin-bottom:12px"><label for="acEmail">Email</label><input id="acEmail" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" value="'+esc(DLG.acEmail||'')+'" data-d="acEmail"></div>'+
   '<div class="fld" style="margin-bottom:'+(up?12:0)+'px"><label for="acPass">Password</label><input id="acPass" type="password" autocomplete="'+(up?'new-password':'current-password')+'" placeholder="'+(up?'At least 8 characters':'Your password')+'"></div>'+
   (up?'<div class="fld" style="margin-bottom:0"><label for="acPass2">Repeat password</label><input id="acPass2" type="password" autocomplete="new-password"></div>':'')+'<p class="err" id="acErr" role="alert"></p></div>'+note+
   '<div class="cta"><button class="btn pri block" data-act="acGo">'+(up?'Create account':'Sign in')+'</button>'+(up?'':'<button class="btn ghost block" style="margin-top:8px" data-act="rsOpen">Forgot password?</button>')+(P.first?'<button class="btn ghost block" style="margin-top:8px" data-act="acSkip">Continue without an account</button>':'')+'</div>'+
   '<p class="sub" style="margin:0 2px">'+(up?'We will email you a link to confirm your address. Your password is for signing in only. It does not unlock your data.':'On a new phone, sign in first, then use Account → Restore with recovery key if your other phone is not available.')+'</p>';
};
V.reset=()=>{
  const s2=P.rsStep===2;
  return hd('Reset password')+(s2?
   '<div class="card"><p class="sub" style="margin:0 0 12px">If <b>'+esc(DLG.acEmail||'that address')+'</b> has an account, we emailed it a code. Enter the code and choose a new password.</p>'+
   '<div class="fld" style="margin-bottom:12px"><label for="rsCode">Code from the email</label><input id="rsCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="123456"></div>'+
   '<div class="fld" style="margin-bottom:12px"><label for="rsPass">New password</label><input id="rsPass" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>'+
   '<div class="fld" style="margin-bottom:0"><label for="rsPass2">Repeat new password</label><input id="rsPass2" type="password" autocomplete="new-password"></div><p class="err" id="rsErr" role="alert"></p></div>'+
   '<div class="cta"><button class="btn pri block" data-act="rsDone">Set new password</button><button class="btn ghost block" style="margin-top:8px" data-act="rsSend">Send a new code</button></div>'+
   '<p class="sub" style="margin:0 2px">Your expenses are not affected. The password only signs you in. It never unlocks your data.</p>':
   '<div class="card"><p class="sub" style="margin:0 0 12px">Enter the email you signed up with. We will send you a code to choose a new password.</p><div class="fld" style="margin-bottom:0"><label for="acEmail">Email</label><input id="acEmail" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" value="'+esc(DLG.acEmail||'')+'" data-d="acEmail"><p class="err" id="rsErr" role="alert"></p></div></div>'+
   '<div class="cta"><button class="btn pri block" data-act="rsSend">Send code</button></div>');
};
V.confirmMail=()=>hd('Check your email')+'<div class="card" style="text-align:center"><span class="ci" style="--c:#0E6B58;margin:4px auto 10px">'+ic('shield',22)+'</span><h2>Confirm your email</h2><p class="sub">We sent a link to <b>'+esc(DLG.acEmail||'your email')+'</b>. Open it, then come back here and sign in.</p></div><div class="cta"><button class="btn pri block" data-act="acToSignin">Go to sign in</button></div>';
V.account=()=>{
  if(!configured())return hd('Account')+'<div class="card"><h2>Cloud sync is not set up</h2><p class="sub">This version of the app works on this phone only. Personal profiles are not affected.</p></div>';
  if(!SYNC.user)return hd('Account')+'<div class="card"><h2>Not signed in</h2><p class="sub">Personal profiles work without an account. Sign in to use shared profiles.</p></div><div class="cta"><button class="btn pri block" data-act="acOpen">Sign in or create account</button></div>';
  return hd('Account')+'<div class="card"><div class="kv"><span>Name</span><span>'+esc(displayName(SYNC.user))+'</span></div><div class="kv"><span>Signed in with</span><span>'+esc(SYNC.user.email)+'</span></div><div class="kv"><span>Phones</span><span>Up to 2</span></div></div><div class="list">'+
   row('key','Recovery key','Set up, or replace it with a new one','acRecovery')+row('pin','My phones','See and remove phones','acDevices')+row('upload','Restore with recovery key','Use on a new phone','acRestore')+'</div>'+
   '<button class="btn soft block" data-act="acOut">Sign out</button><p class="sub" style="margin-top:10px">Signing out removes shared profiles from this phone. They stay safe in the cloud and return when you sign in. Personal profiles stay.</p>';
};
V.devices=()=>hd('My phones')+'<p class="sub" style="margin:-4px 2px 12px">An account can be on 2 phones. Removing a phone signs it out of shared profiles.</p><div class="list">'+
  (P.devs.map(d=>'<div class="rec" style="cursor:default"><span class="ci" style="--c:#5B6C9D">'+ic('pin',22)+'</span><span class="rt"><b>'+esc(d.name)+(d.thisPhone?'<i class="demo">THIS PHONE</i>':'')+'</b><small>Added '+esc(String(d.createdAt||'').slice(0,10))+'</small></span>'+(d.thisPhone?'':'<button class="ib flat" data-act="dvRemove" data-id="'+esc(d.deviceId)+'" aria-label="Remove '+esc(d.name)+'">'+ic('trash',20)+'</button>')+'</div>').join('')||'<p class="note">No phones found.</p>')+'</div>';
V.recovery=()=>hd(P.recMode==='first'?'Save your recovery key':'Recovery key')+'<div class="card"><h2>12 words</h2><p class="sub">Write these down and keep them safe. If you lose every phone, these words bring your shared profiles back. They are not stored anywhere else, and anyone with them can open your shared profiles.</p><div class="words">'+P.phrase.split(' ').map((w,i)=>'<span><i>'+(i+1)+'</i>'+esc(w)+'</span>').join('')+'</div></div>'+
  '<label class="sw" style="margin:4px 2px 12px"><input type="checkbox" role="switch" data-act="rcSaved"'+(P.recSaved?' checked':'')+'><span class="trk"></span><span>I wrote these words down</span></label><div class="cta"><button class="btn pri block" data-act="rcDone"'+(P.recSaved?'':' disabled')+'>Done</button></div>'+
  (P.recMode==='first'?'<div style="margin:2px 2px 0"><button class="link" data-act="rcSkip">Not now</button></div>':'');
V.restore=()=>hd('Restore with recovery key')+'<div class="card"><h2>Recovery key</h2><p class="sub">Enter the 12 words you saved. Your shared profiles are opened on this phone. You can also ask a family member to approve this phone.</p><div class="fld" style="margin:10px 0 0"><label for="rsWords">12 words</label><textarea id="rsWords" rows="3" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="word word word …"></textarea><p class="err" id="rsErr" role="alert"></p></div></div><div class="cta"><button class="btn pri block" data-act="rsGo">Restore</button></div>';

/* ---- members, invites, phones ---- */
V.members=()=>{
  const pf=activeProfile(),owner=isOwner(),meId=SYNC.user&&SYNC.user.id;
  return hd('Members')+'<div class="card"><div class="eyebrow">'+esc(pf.name)+'</div><p class="sub" style="margin-top:6px">Everyone here can add and edit expenses. Records show who added them.</p></div><div class="list">'+
   (SYNC.members.map(m=>'<div class="rec" style="cursor:default"><span class="ci" style="--c:#C0558C"><span style="font:700 17px var(--fd)">'+esc(mname(m).charAt(0).toUpperCase())+'</span></span><span class="rt"><b>'+esc(mname(m))+(m.user_id===meId?'<i class="demo">YOU</i>':'')+(m.role==='owner'?'<i class="demo">CREATOR</i>':'')+'</b><small>'+esc(m.email)+'</small></span>'+(owner&&m.user_id!==meId?'<button class="ib flat" data-act="pfRemove" data-id="'+esc(m.user_id)+'" data-n="'+esc(mname(m))+'" aria-label="Remove '+esc(mname(m))+'">'+ic('trash',20)+'</button>':'')+'</div>').join('')||'<p class="note">Loading members…</p>')+'</div>'+
   (SYNC.pending.length?'<div class="sech"><h2>Phones waiting for approval</h2></div><p class="sub" style="margin:-4px 2px 8px">Check the code matches what the person sees on their phone before you approve.</p><div class="list">'+SYNC.pending.map((x,i)=>'<div class="rec" style="cursor:default"><span class="ci" style="--c:#5B6C9D">'+ic('pin',22)+'</span><span class="rt"><b>'+esc(who(x.userId))+'</b><small>'+esc(x.name)+' · Code '+esc(x.fingerprint)+'</small></span><button class="btn soft" style="width:auto;min-height:40px;padding:0 14px" data-act="phApprove" data-i="'+i+'">Approve</button></div>').join('')+'</div>':'')+
   '<div class="cta"><button class="btn pri block" data-act="pfInvite">'+ic('upload',20)+'Share invite link</button></div>';
};
V.join=()=>hd('Join a profile')+'<div class="card" style="text-align:center"><span class="ci" style="--c:#0E6B58;margin:4px auto 10px">'+ic('users',22)+'</span><h2>Paste your invite link</h2><p class="sub">A family member can copy an invite link from their shared profile and send it to you. Paste it here to join.</p></div><div class="card"><div class="fld" style="margin-bottom:0"><label for="jnCode">Invite link</label><textarea id="jnCode" rows="3" autocapitalize="none" autocomplete="off" spellcheck="false" placeholder="expenses://join/…">'+esc(P.code)+'</textarea><p class="err" id="jnErr" role="alert"></p></div></div>'+
  '<div class="kv" style="margin:0 2px 12px"><span>Invite</span><span>Works once · expires in 24 hours</span></div><div class="cta"><button class="btn pri block" data-act="jnGo">Join</button></div>'+(SYNC.user?'':'<p class="sub" style="margin:0 2px">You need an account to join. Your personal expenses stay on this phone.</p>');

/* ---- actions ---- */
async function afterAuth(){
  let has=true;try{has=await hasRecovery();}catch(e){}
  if(!has){P.phrase=await prepareRecovery();P.recSaved=false;P.recMode='first';redo('recovery');return;}
  stack.pop();await resume('Signed in');
}
async function resume(msg){
  if(!stack.length)stack.push({n:'home',p:{}});
  const pend=P.pending;P.pending=null;
  if(pend&&pend.type==='newprofile'){await finishNew(pend.draft);return;}
  if(pend&&pend.type==='join'){await doJoin(pend.code);return;}
  const first=P.first;P.first=false;
  draw();toast(msg||'Signed in');
  if(first&&!REG.profiles.some(p=>p.shared))go('profiles');
}
async function finishNew(d){
  try{
    if(d.shared){
      toast('Creating shared profile…');
      const r=await createShared(d.name,d.importId||null);
      if(r.imported&&d.importId)await markMoved(d.importId,true);
      refresh();
      toast('Shared profile “'+r.profile.name+'” created'+(r.imported?' with '+r.imported+' records':''));
      if(r.imported&&r.synced&&SYNC.status==='idle'&&d.importId){
        const src=profileOf(d.importId),back=r.profile.id;
        if(src)ask({title:'Clear the records from “'+src.name+'”?',msg:'Your records are now in “'+r.profile.name+'” and synced. Clear the copy in “'+src.name+'” so they are not counted twice? You can cancel to keep both.',ok:'Clear from “'+src.name+'”',danger:true,fn:async()=>{try{await clearProfileData(d.importId,back);closeL();draw(true);toast('Cleared “'+src.name+'”');}catch(e){closeL();bad(e);}}});
      }
    }else{const p=await createProfile(d.name);refresh();toast('Profile “'+p.name+'” created');}
  }catch(e){bad(e);}
}
async function doJoin(code){
  try{toast('Joining…');const r=await joinInvite(code);refresh();toast('Joined “'+r.profile.name+'”');}
  catch(e){go('join');bad(e);}
}
const nameSheet=(title,btn,act,v,id)=>{DLG.pn=v;sheet('<h2>'+title+'</h2><div class="fld"><label for="pnm">Profile name</label><input id="pnm" type="text" maxlength="'+MAX_NAME+'" data-d="pn" value="'+esc(v)+'" placeholder="e.g. Home" autocomplete="off"><p class="err" id="pnErr" role="alert"></p></div><div class="row2"><button class="btn" data-act="closeL">Cancel</button><button class="btn pri" data-act="'+act+'"'+(id?' data-id="'+esc(id)+'"':'')+'>'+btn+'</button></div>',true);};
const errBox=(id,e)=>{const b=document.getElementById(id);if(b)b.textContent=errText(e);else bad(e);};

Object.assign(A,{
 profiles:()=>{go('profiles');},
 profManage:()=>{closeL();go('profiles');},
 profSwitch:profileSwitcher,
 profAccount:()=>go('account'),
 profNew:async()=>{P.newShared=false;P.newImport=true;DLG.pn='';await pickSource();closeL();go('profileNew');},
 pfSharedTog:el=>{
   P.newShared=el.checked;
   const t=(i,x)=>{const e=document.getElementById(i);if(e)e.textContent=x;};
   t('pfHint',P.newShared?'Synced to the cloud with end-to-end encryption. You can invite family with a link.':'Stays on this phone only. Nothing is uploaded.');
   t('pfWhere',P.newShared?'Cloud, encrypted':'This phone only');t('pfAcct',P.newShared?(SYNC.user?'Signed in':'Yes, sign in next'):'No');t('pfWho',P.newShared?'People you invite':'Only you');
   t('pfSave',P.newShared&&!SYNC.user?'Continue to sign in':'Create profile');
   const c=document.getElementById('pfImpCard');if(c)c.hidden=!(P.newShared&&P.srcCount);
 },
 pfImpTog:el=>{P.newImport=el.checked;const h=document.getElementById('pfImpHint');if(h)h.textContent=impHint();},
 pfSave:async el=>{
   const err=nameError(val('pfName'));if(err){errBox('pnErr',{code:'name',message:err});const b=document.getElementById('pnErr');if(b)b.textContent=err;return;}
   const draft={name:val('pfName').trim(),shared:P.newShared,importId:P.newShared&&P.newImport&&P.srcCount?P.srcId:null};
   if(draft.shared&&!SYNC.user){P.pending={type:'newprofile',draft};P.createAcc=true;go('signin');return;}
   await busy(el,()=>finishNew(draft));
 },
 acTab:el=>{P.createAcc=el.dataset.v==='up';DLG.acEmail=val('acEmail')||DLG.acEmail;DLG.acName=val('acName')||DLG.acName;redo('signin');},
 acOpen:()=>{P.createAcc=false;P.pending=null;go('signin');},
 rsOpen:()=>{P.rsStep=1;DLG.acEmail=val('acEmail')||DLG.acEmail;go('reset');},
 firstRun:()=>{if(!configured()||SYNC.user)return false;P.first=true;P.createAcc=false;P.pending=null;stack.length=0;stack.push({n:'signin',p:{}});draw();return true;},
 acSkip:()=>{P.first=false;P.pending=null;tab('home');},
 profShareThis:async()=>{P.newShared=true;P.newImport=true;DLG.pn='';P.srcId=activeProfile().id;P.srcCount=countOf(S);closeL();go('profileNew');},
 acToSignin:()=>{P.createAcc=false;redo('signin');},
 acGo:async el=>{
   const email=val('acEmail').trim().toLowerCase(),pw=val('acPass');DLG.acEmail=email;
   const e=m=>{const b=document.getElementById('acErr');if(b)b.textContent=m;};
   const nm=P.createAcc?val('acName').trim():'';DLG.acName=nm;
   if(P.createAcc&&!nm){e('Enter your name.');return;}
   if(/[\u0000-\u001f\u007f]/.test(nm)){e('Use letters, numbers and punctuation only.');return;}
   if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){e('Enter a valid email address.');return;}
   if(pw.length<8){e('Use a password of at least 8 characters.');return;}
   if(P.createAcc&&pw!==val('acPass2')){e('The two passwords do not match.');return;}
   await busy(el,async()=>{
     try{
       if(P.createAcc){const r=await signUp(email,pw,nm);if(!r.confirmed){redo('confirmMail');return;}}
       else await signIn(email,pw);
       await afterAuth();
     }catch(x){e(errText(x));}
   });
 },
 rsSend:async el=>{
   const email=(P.rsStep===1?val('acEmail'):DLG.acEmail||'').trim().toLowerCase(),e=m=>{const b=document.getElementById('rsErr');if(b)b.textContent=m;};
   if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){e('Enter a valid email address.');return;}
   DLG.acEmail=email;
   await busy(el,async()=>{try{await sendResetCode(email);if(P.rsStep===1){P.rsStep=2;redo('reset');}else toast('New code sent');}catch(x){e(errText(x));}});
 },
 rsDone:async el=>{
   const email=DLG.acEmail||'',code=val('rsCode').trim(),pw=val('rsPass'),e=m=>{const b=document.getElementById('rsErr');if(b)b.textContent=m;};
   if(!/^\d{6,10}$/.test(code.replace(/\s+/g,''))){e('Enter the numeric code from the email.');return;}
   if(pw.length<8){e('Use a password of at least 8 characters.');return;}
   if(pw!==val('rsPass2')){e('The two passwords do not match.');return;}
   await busy(el,async()=>{try{await resetPassword(email,code,pw);P.rsStep=1;P.createAcc=false;stack.pop();await afterAuth();}catch(x){e(errText(x));}});
 },
 rcSaved:el=>{P.recSaved=el.checked;draw(true);},
 rcDone:async el=>{await busy(el,async()=>{try{await saveRecovery(P.phrase,P.recMode==='replace');P.phrase='';stack.pop();if(P.recMode==='first'){await resume('Account ready');}else{draw(true);toast('Recovery key saved');}}catch(e){bad(e);}});},
 rcSkip:async()=>{P.phrase='';stack.pop();await resume('Signed in');},
 acRecovery:async()=>{try{const has=await hasRecovery();P.recMode=has?'replace':'first';if(has){await new Promise(r=>r());}P.phrase=await prepareRecovery();P.recSaved=false;go('recovery');}catch(e){bad(e);}},
 acDevices:async()=>{try{P.devs=await devices();go('devices');}catch(e){bad(e);}},
 dvRemove:el=>ask({title:'Remove this phone?',msg:'It is signed out of shared profiles. You can add it again later if you have a free spot.',ok:'Remove phone',danger:true,fn:async()=>{try{await removeDevice(el.dataset.id);P.devs=await devices();closeL();draw(true);toast('Phone removed');}catch(e){closeL();bad(e);}}}),
 acRestore:()=>go('restore'),
 rsGo:async el=>{await busy(el,async()=>{try{const r=await restore(val('rsWords'));stack.pop();draw();toast(r.restored.length?'Restored '+r.restored.length+(r.restored.length===1?' shared profile':' shared profiles'):'Nothing to restore yet');if(r.needApproval.length)toast('Some profiles need a family member to approve this phone','bad');}catch(e){errBox('rsErr',e);}});},
 acOut:()=>ask({title:'Sign out?',msg:'Shared profiles are removed from this phone. They stay safe in the cloud and return when you sign in. Personal profiles are not affected.',ok:'Sign out',fn:async()=>{try{await signOut();closeL();stack.length=0;stack.push({n:'settings',p:{}});draw();toast('Signed out');}catch(e){closeL();bad(e);}}}),
 profOpen:async el=>{try{const p=profileOf(el.dataset.id);await activateProfile(el.dataset.id);refresh();toast('Opened “'+(p?p.name:'profile')+'”');if(p&&p.shared)syncNow();}catch(x){closeL();bad(x);}},
 profSync:()=>{syncNow().then(()=>{if(SYNC.status==='offline')toast(errText({code:'offline'}),'bad');});},
 profRename:el=>{const p=profileOf(el.dataset.id);if(!p)return;if(p.shared&&!isOwner()){toast('Only the person who created this profile can rename it','bad');return;}nameSheet('Rename profile','Save','profRenameGo',p.name,p.id);},
 profRenameGo:async el=>{
   const err=nameError(DLG.pn,el.dataset.id);if(err){const b=document.getElementById('pnErr');if(b)b.textContent=err;return;}
   await busy(el,async()=>{try{const p=profileOf(el.dataset.id);if(p&&p.shared)await renameShared(DLG.pn.trim());await renameProfile(el.dataset.id,DLG.pn);closeL();draw(true);toast('Profile renamed');}catch(x){errBox('pnErr',x);}});
 },
 profDelete:el=>{
   const p=profileOf(el.dataset.id);if(!p)return;
   if(p.shared){
     if(isOwner())ask({title:'Delete “'+p.name+'” for everyone?',msg:'Every member loses this profile and all its records, in the cloud and on every phone. This cannot be undone.',ok:'Delete for everyone',danger:true,type:'DELETE',fn:async()=>{try{await deleteSharedEverywhere();closeL();stack.length=0;stack.push({n:'home',p:{}},{n:'profiles',p:{}});draw();toast('Profile deleted');}catch(e){closeL();bad(e);}}});
     else ask({title:'Leave “'+p.name+'”?',msg:'It is removed from this phone. Other members keep it. You can rejoin with a new invite link.',ok:'Leave profile',danger:true,fn:async()=>{try{await leaveShared();closeL();stack.length=0;stack.push({n:'home',p:{}},{n:'profiles',p:{}});draw();toast('You left the profile');}catch(e){closeL();bad(e);}}});
     return;
   }
   ask({title:'Delete “'+p.name+'”?',msg:'Every record, price and house in this profile is permanently deleted from this phone. Other profiles are not affected. Consider making a backup first.',ok:'Delete profile',danger:true,type:'DELETE',fn:async()=>{
     try{const was=p.id===REG.active;await deleteProfile(p.id);closeL();if(was)tab('home');else draw(true);toast('Profile deleted');}catch(x){closeL();bad(x);}}});
 },
 pfMembersS:()=>{go('members');syncNow();},
 pfInvite:async el=>{
   await busy(el,async()=>{
     try{
       const link=await inviteLink();
       sheet('<h2>Invite with a link</h2><p class="sub">Copy this link and send it to a family member. When they paste it into the app, they join this profile.</p><div class="linkbox"><code id="invLink">'+esc(link)+'</code></div><button class="btn pri block" data-act="pfCopy" style="margin-bottom:10px">Copy link</button><button class="btn block" data-act="closeL" style="margin-bottom:12px">Done</button><div class="pills" style="margin:0 0 12px"><span class="pill">Works once</span><span class="pill">Expires in 24 hours</span></div><p class="sub">The link carries the key to this profile. Share it only with the person you mean to invite. You can remove anyone later.</p>',true);
     }catch(e){bad(e);}
   });
 },
 pfCopy:async()=>{
   const t=(document.getElementById('invLink')||{}).textContent||'';
   try{await navigator.clipboard.writeText(t);toast('Link copied');}
   catch(e){try{const r=document.createRange();r.selectNodeContents(document.getElementById('invLink'));const s=getSelection();s.removeAllRanges();s.addRange(r);}catch(x){}toast('Select the link and copy it','bad');}
 },
 phApprove:async el=>{const ph=SYNC.pending[Number(el.dataset.i)];if(!ph)return;await busy(el,async()=>{try{await approvePhone(ph);draw(true);toast('Phone approved');}catch(e){bad(e);}});},
 pfRemove:el=>{const n=el.dataset.n,id=el.dataset.id;ask({title:'Remove '+n+'?',msg:'A new key is created for “'+activeProfile().name+'”. '+n+' keeps what was already on their phone but cannot see anything new.',ok:'Remove '+n,danger:true,fn:async()=>{try{toast('Removing…');await removeMember(id);closeL();draw(true);toast(n+' removed');}catch(e){closeL();bad(e);}}});},
 jnOpen:async()=>{try{if(navigator.clipboard&&navigator.clipboard.readText){const t=await navigator.clipboard.readText();if(parseInvite(t))P.code=t;}}catch(e){}go('join');},
 jnGo:async el=>{
   const code=val('jnCode').trim();P.code=code;
   if(!parseInvite(code)){const b=document.getElementById('jnErr');if(b)b.textContent=errText({code:'invite_format'});return;}
   if(!SYNC.user){P.pending={type:'join',code};P.createAcc=false;go('signin');return;}
   await busy(el,()=>doJoin(code));
 }
});
/* Keep the status pills and member lists fresh while a sync runs in the background. */
setRedraw(()=>{const t=stack[stack.length-1];if(t&&['home','members','account','profiles','settings'].includes(t.n)&&!document.querySelector('.sheet'))draw(true);});
onSync(()=>{const t=stack[stack.length-1];if(t&&['home','members'].includes(t.n)&&!document.querySelector('.sheet'))draw(true);});
