import {A} from './registry.js';
import {S,UI,persist} from '../data/state.js';
import {$} from '../core/util.js';
import {fmtDate} from '../core/dates.js';
import {layer,closeL,draw,toast} from './nav.js';
import {onField,refreshCabRoutes} from './entry.js';
import {onQuickInput} from './quick.js';
import {expListHtml} from './views-home.js';
import {toggleLock} from '../native/lock.js';
import {onBackupFile} from './data-actions.js';
import {DLG} from '../data/state.js';

export function bindEvents(){
  const shell=$('#shell');
  let categoryGesture=null,suppressTileClick=null,suppressClickTimer=0;
  const categoryTiles=()=>Array.from(shell.querySelectorAll('.grid3 .category-item[data-id]'));
  const selectedCategories=()=>Array.isArray(UI.categorySelection)?UI.categorySelection:[];
  function renderCategorySelection(){
    const grid=shell.querySelector('.grid3'),bar=shell.querySelector('[data-category-bulk]');
    if(!grid||!bar)return;
    const selected=selectedCategories(),ids=new Set(selected);
    grid.classList.toggle('category-selection',selected.length>0);
    categoryTiles().forEach(item=>{
      const check=item.querySelector('.category-check'),tile=item.querySelector('.tile');
      if(check){check.hidden=!selected.length;check.checked=ids.has(item.dataset.id);}
      if(tile)tile.setAttribute('aria-pressed',ids.has(item.dataset.id)?'true':'false');
    });
    bar.hidden=!selected.length;
    const heading=bar.querySelector('.category-bulk-heading b');
    if(heading)heading.textContent=selected.length+' selected';
    const dataCount=selected.reduce((total,id)=>total+S.records.filter(r=>r.cat===id).length+(id==='travel'?S.dist.length:0),0);
    const dataAction=bar.querySelector('[data-act="categoryDeleteData"]');
    if(dataAction)dataAction.disabled=!dataCount;
  }
  function setCategorySelection(ids){
    UI.categorySelection=Array.from(new Set(ids)).filter(id=>S.cats.some(c=>c.id===id));
    renderCategorySelection();
  }
  function toggleCategorySelection(id){
    const selected=selectedCategories();
    setCategorySelection(selected.includes(id)?selected.filter(x=>x!==id):selected.concat(id));
  }
  function categoryItemFromTarget(target){return target&&target.closest('.grid3 .category-item[data-id]');}
  function animateCategoryMove(grid,move){
    const items=Array.from(grid.querySelectorAll('.category-item[data-id]'));
    const before=new Map(items.map(item=>[item,item.getBoundingClientRect()]));
    move();
    Array.from(grid.querySelectorAll('.category-item[data-id]')).forEach(item=>{
      const oldRect=before.get(item);if(!oldRect)return;
      const rect=item.getBoundingClientRect(),dx=oldRect.left-rect.left,dy=oldRect.top-rect.top;
      if(!dx&&!dy)return;
      item.style.transition='none';
      item.style.transform='translate3d('+dx+'px,'+dy+'px,0)';
      item.getBoundingClientRect();
      requestAnimationFrame(()=>{item.style.transition='';item.style.transform='';});
    });
  }
  function moveCategoryGhost(gesture,x,y){
    if(gesture.ghost)gesture.ghost.style.transform='translate3d('+(x-gesture.x)+'px,'+(y-gesture.y)+'px,0)';
  }
  function removeCategoryGhost(gesture){
    if(gesture.ghost){gesture.ghost.remove();gesture.ghost=null;}
    categoryTiles().forEach(item=>{item.style.transition='';item.style.transform='';});
  }
  function cancelCategoryGesture(restore){
    const gesture=categoryGesture;if(!gesture)return;
    clearTimeout(gesture.timer);
    gesture.tile.classList.remove('category-held','category-reordering');
    if(restore&&gesture.dragging&&gesture.origin){
      const add=gesture.grid.querySelector('.tile.add');
      animateCategoryMove(gesture.grid,()=>gesture.origin.forEach(tile=>gesture.grid.insertBefore(tile,add||null)));
    }
    removeCategoryGhost(gesture);
    categoryGesture=null;
  }
  function beginCategoryGesture(e){
    const item=categoryItemFromTarget(e.target);
    if(!item||e.target.closest('.category-check')||e.button!==undefined&&e.button!==0)return;
    const tile=item.querySelector('.tile[data-id]');
    const grid=tile.closest('.grid3');
    categoryGesture={item:item,tile:grid?tile:null,grid:grid,pointerId:e.pointerId,x:e.clientX,y:e.clientY,long:false,dragging:false,origin:null,timer:0};
    if(!grid){categoryGesture=null;return;}
    const gesture=categoryGesture;
    gesture.timer=setTimeout(()=>{if(categoryGesture!==gesture)return;gesture.long=true;gesture.tile.classList.add('category-held');},450);
  }
  function moveCategoryGesture(e){
    const gesture=categoryGesture;if(!gesture||gesture.pointerId!==e.pointerId)return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
    if(!gesture.long){
      if(Math.hypot(dx,dy)>10)cancelCategoryGesture(false);
      return;
    }
    if(Math.hypot(dx,dy)>10&&!gesture.dragging){
      gesture.dragging=true;
      gesture.origin=categoryTiles();
      gesture.tile.classList.remove('category-held');
      gesture.tile.classList.add('category-reordering');
      const rect=gesture.tile.getBoundingClientRect(),ghost=gesture.tile.cloneNode(true);
      ghost.classList.remove('category-reordering');
      ghost.classList.add('category-drag-ghost');
      ghost.removeAttribute('data-act');ghost.removeAttribute('data-id');ghost.setAttribute('aria-hidden','true');
      ghost.style.left=rect.left+'px';ghost.style.top=rect.top+'px';ghost.style.width=rect.width+'px';ghost.style.height=rect.height+'px';
      document.body.appendChild(ghost);gesture.ghost=ghost;
    }
    if(!gesture.dragging)return;
    if(e.cancelable)e.preventDefault();
    moveCategoryGhost(gesture,e.clientX,e.clientY);
    const target=categoryItemFromTarget(document.elementFromPoint(e.clientX,e.clientY));
    if(!target||target===gesture.item||target.closest('.grid3')!==gesture.grid)return;
    const rect=target.getBoundingClientRect(),before=e.clientY<rect.top+rect.height/2||
      (e.clientY<=rect.bottom&&e.clientX<rect.left+rect.width/2);
    const nodes=categoryTiles(),from=nodes.indexOf(gesture.item),to=nodes.indexOf(target);
    if(from<to&&!before)animateCategoryMove(gesture.grid,()=>gesture.grid.insertBefore(gesture.item,target.nextSibling));
    else if(from>to&&before)animateCategoryMove(gesture.grid,()=>gesture.grid.insertBefore(gesture.item,target));
  }
  function endCategoryGesture(e,cancelled){
    const gesture=categoryGesture;if(!gesture||gesture.pointerId!==e.pointerId)return;
    if(gesture.long){
      if(!gesture.dragging&&!cancelled)setCategorySelection(selectedCategories().concat(gesture.item.dataset.id));
      suppressTileClick=gesture.tile;
      clearTimeout(suppressClickTimer);
      suppressClickTimer=setTimeout(()=>{suppressTileClick=null;},1000);
      if(gesture.dragging&&!cancelled){
        const order=categoryTiles().map(tile=>tile.dataset.id);
        const original=gesture.origin.map(tile=>tile.dataset.id);
        if(order.some((id,i)=>id!==original[i])){
          S.cats=order.map(id=>S.cats.find(c=>c.id===id)).filter(Boolean);
          persist();
          toast('Category order saved');
        }
      }
      cancelCategoryGesture(cancelled);
      return;
    }
    cancelCategoryGesture(false);
  }
  shell.addEventListener('pointerdown',beginCategoryGesture);
  document.addEventListener('pointermove',moveCategoryGesture);
  document.addEventListener('pointerup',e=>endCategoryGesture(e,false));
  document.addEventListener('pointercancel',e=>endCategoryGesture(e,true));
  document.addEventListener('touchmove',e=>{if(categoryGesture&&categoryGesture.long&&categoryGesture.dragging&&e.cancelable)e.preventDefault();},{passive:false});
  shell.addEventListener('contextmenu',e=>{if(categoryItemFromTarget(e.target))e.preventDefault();});
  shell.addEventListener('click',e=>{
    if(suppressTileClick){
      const tile=e.target.closest('.grid3 .tile[data-id]'),suppress=tile===suppressTileClick;
      suppressTileClick=null;clearTimeout(suppressClickTimer);
      if(suppress){e.preventDefault();return;}
    }
    const item=categoryItemFromTarget(e.target);
    if(item&&selectedCategories().length&&!e.target.closest('.category-check')){
      e.preventDefault();toggleCategorySelection(item.dataset.id);return;
    }
    const el=e.target.closest('[data-act]');if(!el||el.disabled||el.dataset.act==='rentToggle'||el.dataset.act==='mobileToggle')return;const f=A[el.dataset.act];if(f)f(el,e);
  });
  function onInput(e){
    const el=e.target;
    if(el.dataset.act==='categoryCheck'){if(e.type==='change')setCategorySelection(el.checked?selectedCategories().concat(el.dataset.id):selectedCategories().filter(id=>id!==el.dataset.id));return;}
    if(el.dataset.act==='rentToggle'){if(e.type==='change')A.rentToggle(el);return;}
    if(el.dataset.act==='mobileToggle'){if(e.type==='change')A.mobileToggle(el);return;}
    if(el.dataset.act==='rentStatusDate'){
      const display=el.closest('.rent-date-field')?.querySelector('[data-rent-date-display]');
      if(display)display.textContent=fmtDate(el.value);
      return;
    }
    if(el.dataset.act==='mobileStatusDate'){
      const display=el.closest('.rent-date-field')?.querySelector('[data-mobile-date-display]');
      if(display)display.textContent=fmtDate(el.value);
      return;
    }
    if(el.dataset.rt){
      const r=S.routes.find(x=>x.id===el.dataset.rt);if(!r)return;
      const v=el.value.trim(),dup=S.routes.some(x=>x.id!==r.id&&x.name.toLowerCase()===v.toLowerCase());
      if(e.type==='change'){
        if(!v){el.value=r.name;toast('A route needs a name','bad');}
        else if(dup){el.value=r.name;toast('You already have a route with this name','bad');}
        else if(r.name!==v){r.name=v;refreshCabRoutes();persist();draw(true);}
      }else if(v&&!dup&&r.name!==v){r.name=v;refreshCabRoutes();persist();draw(true);}
      return;
    }
    if(onQuickInput(el,e.type))return;
    if(el.id==='rbFile'){if(e.type==='change')onBackupFile(el);return;}
    if(el.dataset.f){onField(el);return;}
    if(el.dataset.d){DLG[el.dataset.d]=el.value;if(el.dataset.d==='ncn'&&DLG.nc)DLG.nc.name=el.value;if(el.dataset.d==='ncu'&&DLG.nc)DLG.nc.unit=el.value;return;}
    if(el.dataset.q){UI.q=el.value;const l=$('#explist');if(l)l.innerHTML=expListHtml();return;}
    if(el.dataset.sort){UI.sort=el.value;const l=$('#explist');if(l)l.innerHTML=expListHtml();return;}
    if(el.dataset.lock){if(e.type==='change')toggleLock(el);return;}
  }
  shell.addEventListener('input',onInput);
  shell.addEventListener('change',onInput);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&categoryGesture&&categoryGesture.dragging){cancelCategoryGesture(true);return;}if(e.key==='Escape'&&!layer.hidden)closeL();});
}
