/* Change tracking for sync. Every saved item (record, journey, house, category, route, mobile bill, price, per-km cost)
   gets a key like "records:r123", a last-changed time and, if deleted, a deletion marker.
   Nothing here changes how the app's screens read or write data: the tracker compares the data with what it saw last
   time, whenever the app saves. Device settings (theme, app lock) are never tracked, so they never sync.
   Layout, kept in S.sync:  m[key]={t:changedAt,h:hash}   d[key]=deletedAt */
export const LISTS=['records','dist','houses','cats','routes','mobileBills'];
const SETTINGS=['kmCost'];

function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36)+str.length.toString(36);}
const strip=o=>JSON.stringify(o);

/* All syncable items in the state as {key:{kind,id,data}}. */
export function entities(S){
  const out={};
  for(const k of LISTS)for(const x of (Array.isArray(S[k])?S[k]:[]))if(x&&typeof x.id==='string')out[k+':'+x.id]={list:k,id:x.id,data:x};
  for(const id of Object.keys(S.prices||{}))out['prices:'+id]={list:'prices',id,data:S.prices[id]};
  for(const f of SETTINGS)if(S[f]!==undefined)out['set:'+f]={list:'set',id:f,data:S[f]};
  return out;
}
export const ensure=S=>{if(!S.sync||typeof S.sync!=='object'||!S.sync.m||!S.sync.d)S.sync={v:1,m:{},d:{}};return S.sync;};

/* Bring the tracking data up to date. Returns true if anything was stamped. `now` is injectable for tests. */
export function track(S,now){
  const t=now==null?Date.now():now,sy=ensure(S),ents=entities(S);let changed=false;
  const fresh=Object.keys(sy.m).length===0&&Object.keys(sy.d).length===0;
  for(const key of Object.keys(ents)){
    const h=hash(strip(ents[key].data)),cur=sy.m[key];
    if(!cur){
      /* First time this tracker sees existing data: use the record's own add time so old data is not newer than edits made elsewhere. */
      const own=fresh&&ents[key].data&&typeof ents[key].data.ts==='number'?ents[key].data.ts:t;
      sy.m[key]={t:fresh?own:t,h};delete sy.d[key];changed=true;
    }else if(cur.h!==h){sy.m[key]={t,h};changed=true;}
  }
  for(const key of Object.keys(sy.m))if(!ents[key]){delete sy.m[key];sy.d[key]=t;changed=true;}
  return changed;
}

/* Everything to send: live items and deletion markers, as {key,t,deleted,list,id,data}. */
export function snapshot(S){
  track(S);const sy=S.sync,ents=entities(S),out=[];
  for(const key of Object.keys(sy.m))out.push({key,t:sy.m[key].t,deleted:false,list:ents[key].list,id:ents[key].id,data:ents[key].data});
  for(const key of Object.keys(sy.d)){const i=key.indexOf(':');out.push({key,t:sy.d[key],deleted:true,list:key.slice(0,i),id:key.slice(i+1),data:null});}
  return out;
}

/* Merge one item from elsewhere. Newest change wins; on an exact tie a deletion wins. Returns true if the state changed. */
export function applyRemote(S,item){
  track(S);const sy=S.sync,key=item.key,i=key.indexOf(':'),list=key.slice(0,i),id=key.slice(i+1);
  if(list!==item.list&&item.list!==undefined)return false;
  const localT=sy.m[key]?sy.m[key].t:sy.d[key]!=null?sy.d[key]:-1;
  const localDel=!sy.m[key]&&sy.d[key]!=null;
  if(item.t<localT||(item.t===localT&&!(item.deleted&&!localDel)))return false;
  if(LISTS.includes(list)){
    if(!Array.isArray(S[list]))S[list]=[];
    const idx=S[list].findIndex(x=>x.id===id);
    if(item.deleted){if(idx>=0)S[list].splice(idx,1);delete sy.m[key];sy.d[key]=item.t;return true;}
    if(!item.data||item.data.id!==id)return false;
    if(idx>=0)S[list][idx]=item.data;else S[list].push(item.data);
  }else if(list==='prices'){
    if(!S.prices)S.prices={};
    if(item.deleted){delete S.prices[id];delete sy.m[key];sy.d[key]=item.t;return true;}
    S.prices[id]=item.data;
  }else if(list==='set'&&SETTINGS.includes(id)){
    if(item.deleted){delete S[id];delete sy.m[key];sy.d[key]=item.t;return true;}
    S[id]=item.data;
  }else return false;
  sy.m[key]={t:item.t,h:hash(strip(item.data))};delete sy.d[key];return true;
}
