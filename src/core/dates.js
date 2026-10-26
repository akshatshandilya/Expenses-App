export const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
export const pad=n=>String(n).padStart(2,'0');
export const ymd=(y,m,d)=>y+'-'+pad(m)+'-'+pad(d);
export const today=()=>{const d=new Date();return ymd(d.getFullYear(),d.getMonth()+1,d.getDate());};
export const curMonth=()=>today().slice(0,7);
export function addMonths(mk,n){const a=mk.split('-').map(Number);const d=new Date(a[0],a[1]-1+n,1);return d.getFullYear()+'-'+pad(d.getMonth()+1);}
export function monthDate(mk,day){const a=mk.split('-').map(Number),last=new Date(a[0],a[1],0).getDate();return ymd(a[0],a[1],Math.min(day,last));}
export const monLabel=mk=>{const a=mk.split('-').map(Number);return MONTHS[a[1]-1]+' '+a[0];};
export const monShort=mk=>{const a=mk.split('-').map(Number);return MONTHS[a[1]-1].slice(0,3)+' '+a[0];};
export const validMonth=s=>/^\d{4}-(0[1-9]|1[0-2])$/.test(s||'')&&+s.slice(0,4)>=2000;
export function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const a=s.split('-').map(Number);const t=new Date(a[0],a[1]-1,a[2]);return t.getFullYear()===a[0]&&t.getMonth()===a[1]-1&&t.getDate()===a[2]&&a[0]>=2000&&a[0]<=2100;}
export const fmtDate=s=>validDate(s)?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'';
export const weekday=s=>{const a=s.split('-').map(Number);return new Date(a[0],a[1]-1,a[2]).toLocaleDateString('en-IN',{weekday:'long'});};
/* Date and time a log was added, in the device's time zone, e.g. 15/10/2026, 10:12 am */
export function fmtStamp(ts){if(!ts)return '';const d=new Date(ts);if(isNaN(d))return '';return ymd(d.getFullYear(),d.getMonth()+1,d.getDate()).split('-').reverse().join('/')+', '+d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',hour12:true});}
export const daysBetween=(a,b)=>{const x=a.split('-').map(Number),y=b.split('-').map(Number);return Math.round((Date.UTC(y[0],y[1]-1,y[2])-Date.UTC(x[0],x[1]-1,x[2]))/86400000);};
/* Time left until an agreement ends: whole months when a month or more remains, otherwise days. */
export function leftInfo(end){
  const t=today(),d=daysBetween(t,end);
  if(d<0)return{t:'Expired '+(-d)+(d===-1?' day':' days')+' ago',tone:'bad'};
  if(d===0)return{t:'Expires today',tone:'warn'};
  const a=t.split('-').map(Number),b=end.split('-').map(Number);let m=(b[0]-a[0])*12+(b[1]-a[1]);if(b[2]<a[2])m--;
  if(m<1)return{t:d+(d===1?' day':' days')+' left',tone:'warn'};
  return{t:m+(m===1?' month':' months')+' left',tone:m<=2?'warn':'good'};
}
export const fmtClock=()=>new Date().toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true});
export const dayLine=()=>weekday(today()).slice(0,3)+', '+fmtDate(today());
