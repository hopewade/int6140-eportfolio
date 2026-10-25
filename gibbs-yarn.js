/* Layout only: the diagram text stays in semantic HTML and the arrows follow it. */
(() => {
 'use strict';
 const diagrams=[...document.querySelectorAll('[data-gibbs-yarn]')];
 if(!diagrams.length)return;
 const NS='http://www.w3.org/2000/svg';
 const reduce=(window.PortfolioMotion?.preference || matchMedia('(prefers-reduced-motion: reduce)'));
 const visible=new WeakMap();
 let layoutFrame=0;
 function svgNode(tag,attrs={}){const node=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;}
 function pathBetween(a,b,index){
   // Each curved quadrant stays outside the central circle and the stage cards.
   if(index===0)return `M ${a.right+8} ${a.cy} C ${b.cx} ${a.cy} ${b.cx} ${b.top-52} ${b.cx} ${b.top-9}`;
   if(index===1)return `M ${a.cx} ${a.bottom+8} V ${b.top-10}`;
   if(index===2)return `M ${a.cx} ${a.bottom+8} C ${a.cx} ${b.cy} ${b.right+54} ${b.cy} ${b.right+9} ${b.cy}`;
   if(index===3)return `M ${a.left-8} ${a.cy} C ${b.cx} ${a.cy} ${b.cx} ${b.bottom+52} ${b.cx} ${b.bottom+9}`;
   if(index===4)return `M ${a.cx} ${a.top-8} V ${b.bottom+10}`;
   return `M ${a.cx} ${a.top-8} C ${a.cx} ${b.cy} ${b.left-54} ${b.cy} ${b.left-9} ${b.cy}`;
 }
 function draw(diagram){
   const holder=diagram.querySelector('.gibbs-yarn__cycle'),svg=diagram.querySelector('.gibbs-yarn__connections');
   const cards=[...diagram.querySelectorAll('.gibbs-yarn__stage')];
   if(!holder||!svg||cards.length!==6)return;
   const bounds=holder.getBoundingClientRect();if(bounds.width<1||bounds.height<1)return;
   const boxes=cards.map(card=>{const r=card.getBoundingClientRect();return {left:r.left-bounds.left,right:r.right-bounds.left,top:r.top-bounds.top,bottom:r.bottom-bounds.top,cx:r.left-bounds.left+r.width/2,cy:r.top-bounds.top+r.height/2}});
   svg.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);svg.replaceChildren();
   const defs=svgNode('defs');const marker=svgNode('marker',{id:'gibbs-yarn-arrowhead',viewBox:'0 0 16 16',markerWidth:13,markerHeight:13,refX:12,refY:8,orient:'auto',markerUnits:'userSpaceOnUse'});
   marker.append(svgNode('path',{d:'M 3 2 L 12 8 L 3 14',class:'gibbs-yarn__arrow'}));defs.append(marker);svg.append(defs);
   boxes.forEach((a,i)=>{const b=boxes[(i+1)%6],d=pathBetween(a,b,i),group=svgNode('g',{'data-gibbs-connection':`${i+1}-${i===5?1:i+2}`});group.append(svgNode('path',{d,class:'gibbs-yarn__rope','marker-end':'url(#gibbs-yarn-arrowhead)'}),svgNode('path',{d,class:'gibbs-yarn__twist'}),svgNode('path',{d,class:'gibbs-yarn__flow'}));svg.append(group);});
   const viewport=diagram.querySelector('.gibbs-yarn__viewport');
   if(viewport&&!viewport.dataset.gibbsCentered){viewport.scrollLeft=Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2);viewport.dataset.gibbsCentered='true';}
   diagram.dataset.gibbsReady='true';
 }
 function scheduleLayout(){if(layoutFrame)return;layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;diagrams.forEach(draw);});}
 function syncMotion(){diagrams.forEach(el=>{el.dataset.gibbsActive=String(!reduce.matches&&!document.hidden&&visible.get(el)!==false&&!document.querySelector('dialog[open]'));});}
 const resize=new ResizeObserver(scheduleLayout);diagrams.forEach(el=>{resize.observe(el);visible.set(el,true);});
 if('IntersectionObserver'in window){const intersection=new IntersectionObserver(entries=>{entries.forEach(e=>visible.set(e.target,e.isIntersecting));syncMotion();},{rootMargin:'80px'});diagrams.forEach(el=>intersection.observe(el));}
 if('MutationObserver'in window){const modals=new MutationObserver(syncMotion);document.querySelectorAll('dialog').forEach(el=>modals.observe(el,{attributes:true,attributeFilter:['open']}));}
 addEventListener('resize',scheduleLayout,{passive:true});document.addEventListener('visibilitychange',syncMotion);reduce.addEventListener('change',syncMotion);
 document.fonts?.ready.then(scheduleLayout);scheduleLayout();syncMotion();
})();
