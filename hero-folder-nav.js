/* The folder opens briefly before its real section anchor is followed. */
(() => {
  'use strict';
  const header=document.querySelector('.wool-file-header');
  if(!header)return;
  const menu=document.getElementById('wool-mobile-menu');
  const toggle=document.getElementById('wool-menu-toggle');
  const desktop=matchMedia('(min-width:768px)');
  const reduced=(window.PortfolioMotion?.preference || matchMedia('(prefers-reduced-motion:reduce)'));
  const links=[...document.querySelectorAll('.wool-folder-link')];
  let pending=0,clearOpening=0,opening=null;
  const isOpen=()=>Boolean(menu&&!menu.hidden);
  function closeMenu(returnFocus=false){
    const wasOpen=isOpen();
    if(menu)menu.hidden=true;
    if(toggle){toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','展开作品集目录');}
    document.body.classList.remove('wool-folder-menu-open','hero-menu-open');
    if(wasOpen&&returnFocus)toggle?.focus({preventScroll:true});
  }
  function openMenu(){
    if(!menu||!toggle||desktop.matches)return;
    menu.hidden=false;
    toggle.setAttribute('aria-expanded','true');toggle.setAttribute('aria-label','收起作品集目录');
    document.body.classList.add('wool-folder-menu-open','hero-menu-open');
  }
  function resetOpening(){
    clearTimeout(pending);clearTimeout(clearOpening);pending=clearOpening=0;
    opening?.classList.remove('is-opening');opening=null;
  }
  function navigate(link){
    const id=(link.getAttribute('href')||'').slice(1),target=document.getElementById(id);
    if(!target)return;
    closeMenu();
    try{history.pushState(history.state,'','#'+id);}catch(_){location.hash=id;}
    target.scrollIntoView({behavior:reduced.matches?'auto':'smooth',block:'start'});
    const heading=target.querySelector('h2');
    if(heading){
      const hadTabindex=heading.hasAttribute('tabindex');
      if(!hadTabindex)heading.setAttribute('tabindex','-1');
      heading.focus({preventScroll:true});
      if(!hadTabindex)heading.addEventListener('blur',()=>heading.removeAttribute('tabindex'),{once:true});
    }
    clearOpening=setTimeout(()=>{link.classList.remove('is-opening');opening=null;},600);
  }
  links.forEach(link=>link.addEventListener('click',event=>{
    if(event.button!==0||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
    const id=(link.getAttribute('href')||'').slice(1);
    if(!document.getElementById(id))return;
    event.preventDefault();resetOpening();opening=link;link.classList.add('is-opening');
    if(reduced.matches)navigate(link);
    else pending=setTimeout(()=>{pending=0;navigate(link);},220);
  }));
  toggle?.addEventListener('click',()=>isOpen()?closeMenu():openMenu());
  header.querySelector('.wool-nav-brand')?.addEventListener('click',()=>{resetOpening();closeMenu();});
  document.addEventListener('keydown',event=>{
    if(!isOpen())return;
    if(event.key==='Escape'){event.preventDefault();resetOpening();closeMenu(true);return;}
    if(event.key!=='Tab')return;
    const items=[toggle,...menu.querySelectorAll('a[href]')].filter(Boolean);
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  desktop.addEventListener('change',()=>{if(desktop.matches)closeMenu();});
  addEventListener('pagehide',()=>{resetOpening();closeMenu();});
  closeMenu();
})();
