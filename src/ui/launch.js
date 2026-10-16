/* @auto-imports */
import {A} from './registry.js';
/* @end-imports */
/* Launch animation (approved motion spec v2: the icon draws itself). Silent, no network, honours reduced motion.
   First ever launch ~2.6 s, returning user ~1.5 s, reduced motion ~0.9 s. The app is already drawn underneath;
   the overlay fades away and the screen's blocks fade up in turn. When app lock is on the sequence ends on the lock screen. */
import {$} from '../core/util.js';

export const E_OUT='cubic-bezier(.16,1,.3,1)',E_IO='cubic-bezier(.65,0,.35,1)',E_DRAW='cubic-bezier(.5,0,.2,1)';
export const PRESETS={
  cold:{bgDur:300,iconStart:250,iconDur:450,iconFrom:94,iconRise:8,drawOn:1,roofStart:400,roofDur:300,wallsStart:520,wallsDur:380,rupeeStart:850,rupeeDur:260,legStart:960,legDur:280,wordStart:1000,wordDur:500,wordRise:10,haloOn:1,ruleOn:1,ruleStart:1250,ruleDur:600,transStart:1800,transDur:400,stagger:40},
  returning:{bgDur:150,iconStart:0,iconDur:250,iconFrom:96,iconRise:4,drawOn:1,roofStart:60,roofDur:180,wallsStart:130,wallsDur:200,rupeeStart:290,rupeeDur:160,legStart:340,legDur:170,wordStart:300,wordDur:260,wordRise:6,haloOn:0,ruleOn:0,ruleStart:0,ruleDur:0,transStart:760,transDur:340,stagger:35}
};
export function launchHtml(){
  return '<div class="haloWrap" id="haloWrap"><div class="halo" id="halo"></div></div><div class="group" id="group"><div class="tilewrap" id="tile"><svg xmlns="http://www.w3.org/2000/svg" viewBox="21 21 66 66"><rect x="21" y="21" width="66" height="66" rx="15" fill="#0E6B58"/><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path pathLength="1" data-part="roof" d="M32 53 L54 33 L76 53" stroke="#FFFFFF" stroke-width="4.5"/><path pathLength="1" data-part="walls" d="M37 48.5 V76 H71 V48.5" stroke="#FFFFFF" stroke-width="4.5"/><path pathLength="1" data-part="bars" d="M45.5 52.2 H62 M45.5 58.2 H62" stroke="#F2C766" stroke-width="3.5"/><path pathLength="1" data-part="leg" d="M46 52.2 H52.7 A5.6 5.6 0 0 1 52.7 63.4 H46 L58.3 70.8" stroke="#F2C766" stroke-width="3.5"/></g></svg></div><div class="word" id="word">Expenses</div><div class="rule" id="rule"></div></div>';
}
export function effective(preset,reduced){
  const c=Object.assign({},PRESETS[preset]);
  if(reduced)Object.assign(c,{iconFrom:100,iconRise:0,drawOn:0,wordRise:0,haloOn:0,ruleOn:0,iconStart:0,iconDur:250,wordStart:80,wordDur:250,transStart:550,transDur:200,stagger:0});
  return c;
}
/* blocks: the elements of the finished screen that fade up. Resolves when everything has finished. */
export function playLaunch(preset,blocks,reduced){
  const host=$('#launch');
  if(!host||!host.animate){if(host)host.hidden=true;return Promise.resolve();}
  host.innerHTML=launchHtml();host.hidden=false;
  const c=effective(preset,reduced),anims=[],ends=[];
  const A=(el,kf,o)=>{if(!el)return;const a=el.animate(kf,Object.assign({fill:'both'},o));anims.push(a);return a;};
  const tile=$('#tile',host),word=$('#word',host),rule=$('#rule',host),halo=$('#halo',host),group=$('#group',host),wrap=$('#haloWrap',host);
  if(c.haloOn){const hEnd=c.iconStart+c.iconDur+300;A(halo,[{opacity:0,transform:'scale(.92)',offset:0},{opacity:.55,transform:'scale(.94)',offset:Math.min(.9,c.bgDur/hEnd),easing:E_OUT},{opacity:1,transform:'scale(1)',offset:1}],{duration:hEnd,easing:E_OUT});ends.push(hEnd);}
  A(tile,[{opacity:0,transform:'translateY('+c.iconRise+'px) scale('+c.iconFrom/100+')'},{opacity:1,offset:.7},{opacity:1,transform:'translateY(0) scale(1)'}],{delay:c.iconStart,duration:c.iconDur,easing:E_OUT});
  ends.push(c.iconStart+c.iconDur);
  const parts={roof:[c.roofStart,c.roofDur],walls:[c.wallsStart,c.wallsDur],bars:[c.rupeeStart,c.rupeeDur],leg:[c.legStart,c.legDur]};
  Object.keys(parts).forEach(k=>{
    const el=tile.querySelector('[data-part="'+k+'"]');if(!el)return;
    if(c.drawOn){const endOff=k==='bars'?.5:0;
      A(el,[{strokeDasharray:'1 2',strokeDashoffset:1,opacity:0,offset:0},{strokeDasharray:'1 2',strokeDashoffset:1,opacity:1,offset:.02},{strokeDasharray:'1 2',strokeDashoffset:endOff,opacity:1,offset:.999},{strokeDasharray:'none',strokeDashoffset:endOff,opacity:1,offset:1}],{delay:parts[k][0],duration:parts[k][1],easing:E_DRAW});
      ends.push(parts[k][0]+parts[k][1]);
    }else A(el,[{strokeDasharray:'none',opacity:1},{strokeDasharray:'none',opacity:1}],{duration:1});
  });
  A(word,[{opacity:0,transform:'translateY('+c.wordRise+'px)'},{opacity:1,transform:'translateY(0)'}],{delay:c.wordStart,duration:c.wordDur,easing:E_OUT});ends.push(c.wordStart+c.wordDur);
  if(c.ruleOn){A(rule,[{opacity:0,transform:'scaleX(0)',offset:0},{opacity:.9,transform:'scaleX(1)',offset:.55,easing:E_IO},{opacity:.9,transform:'scaleX(1)',offset:.7},{opacity:0,transform:'scaleX(1)',offset:1}],{delay:c.ruleStart,duration:c.ruleDur,easing:E_IO});ends.push(c.ruleStart+c.ruleDur);}
  else if(rule)rule.style.opacity=0;
  A(group,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale('+(reduced?1:.985)+')'}],{delay:c.transStart,duration:Math.round(c.transDur*.7),easing:E_IO});
  A(wrap,[{opacity:1},{opacity:0}],{delay:c.transStart,duration:c.transDur,easing:E_IO});
  A(host,[{opacity:1},{opacity:1,offset:.0},{opacity:0}],{delay:c.transStart,duration:c.transDur,easing:E_IO});
  ends.push(c.transStart+c.transDur);
  (blocks||[]).forEach((el,i)=>{const d=c.transStart+90+i*c.stagger,dur=c.transDur+80;
    A(el,[{opacity:0,transform:'translateY('+(reduced?0:10)+'px)'},{opacity:1,transform:'none'}],{delay:d,duration:dur,easing:E_IO});ends.push(d+dur);});
  const total=Math.max.apply(null,ends);
  return new Promise(res=>{
    let done=false;const fin=()=>{if(done)return;done=true;anims.forEach(a=>{try{a.cancel();}catch(e){}});host.hidden=true;host.innerHTML='';res();};
    setTimeout(fin,total+80);
  });
}
