/* Run the flowing wool stitches only while the chart is being read. */
(() => {
 'use strict';
 const figures=[...document.querySelectorAll('[data-closed-loop-motion]')];
 if(!figures.length)return;
 const reduce=(window.PortfolioMotion?.preference || matchMedia('(prefers-reduced-motion:reduce)')),visible=new WeakMap();
 function sync(){
  const enabled=!reduce.matches&&!document.hidden&&!document.querySelector('dialog[open]');
  figures.forEach(el=>el.dataset.flowActive=String(enabled&&visible.get(el)===true));
 }
 if('IntersectionObserver'in window){
  const observer=new IntersectionObserver(entries=>{entries.forEach(e=>visible.set(e.target,e.isIntersecting));sync();},{rootMargin:'60px'});
  figures.forEach(el=>observer.observe(el));
 }else figures.forEach(el=>visible.set(el,true));
 const modals=new MutationObserver(sync);
 document.querySelectorAll('dialog').forEach(el=>modals.observe(el,{attributes:true,attributeFilter:['open']}));
 document.addEventListener('visibilitychange',sync);reduce.addEventListener('change',sync);sync();
})();
