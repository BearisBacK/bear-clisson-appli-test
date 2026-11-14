'use strict';
// Carnet en 4 pages (onglets) : OURS, SPOT, HISTOIRE & PATRIMOINE, COMMERÇANTS. Une seule page visible à la fois.
(function(root){
 const doc=root.document;
 if(!doc)return;
 const tabs=[...doc.querySelectorAll('.carnet-tabs [role=tab]')];
 if(!tabs.length)return;
 const dialog=doc.getElementById('rallye');
 function show(name){
  const index=Math.max(0,tabs.findIndex(t=>t.dataset.page===name));
  tabs.forEach((t,k)=>{
   const on=k===index,page=doc.getElementById(t.getAttribute('aria-controls'));
   t.setAttribute('aria-selected',String(on));
   t.tabIndex=on?0:-1;
   t.classList.toggle('is-active',on);
   if(page)page.hidden=!on;
  });
  // Chaque page commence en haut du carnet.
  try{dialog?.scrollTo?.(0,0);}catch{}
  return tabs[index].dataset.page;
 }
 tabs.forEach((t,k)=>{
  t.addEventListener('click',()=>{show(t.dataset.page);t.focus?.();});
  t.addEventListener('keydown',e=>{
   if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft')return;
   e.preventDefault();
   const next=tabs[(k+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];
   show(next.dataset.page);next.focus?.();
  });
 });
 show('ours');
 const api={show,pages:tabs.map(t=>t.dataset.page)};
 root.BearCarnetPages=api;
})(typeof window==='undefined'?globalThis:window);
