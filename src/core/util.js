export const $=(s,r)=>(r||document).querySelector(s);
export const $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
export const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const uid=()=>'r'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
