/* Enlarge the two new manuscript figures, preserving their original pixels. */
(() => {
  'use strict';
  const dialog=document.querySelector('#source-figure-dialog');
  if (!dialog) return;
  const image=dialog.querySelector('#source-figure-image');
  const viewport=dialog.querySelector('.source-figure-viewport');
  const zoom=dialog.querySelector('[data-source-figure-zoom]');
  let trigger=null;
  function resetZoom(){viewport.classList.remove('is-zoomed');zoom.setAttribute('aria-pressed','false');zoom.textContent='放大查看';viewport.scrollTop=viewport.scrollLeft=0}
  function syncModal(){document.body.classList.toggle('modal-open',Boolean(document.querySelector('dialog[open]')))}
  document.querySelectorAll('[data-source-figure]').forEach(button=>button.addEventListener('click',()=>{
    const source=button.querySelector('img');
    const address=source?.currentSrc||source?.src||button.dataset.sourceFigure;
    if (!address) return;
    trigger=button;resetZoom();
    image.src=address;image.alt=source?.alt||button.dataset.figureTitle||'文稿图示';
    viewport.style.setProperty('--source-image-width',Math.max(source?.naturalWidth||source?.width||1600,source?.width||0)+'px');
    image.onload=()=>viewport.style.setProperty('--source-image-width',image.naturalWidth+'px');
    dialog.querySelector('#source-figure-title').textContent=button.dataset.figureTitle||source?.alt||'文稿图示';
    dialog.showModal();syncModal();
  }));
  zoom.addEventListener('click',()=>{
    const active=viewport.classList.toggle('is-zoomed');zoom.setAttribute('aria-pressed',String(active));zoom.textContent=active?'适应窗口':'放大查看';
    viewport.scrollTop=viewport.scrollLeft=0;
  });
  dialog.querySelector('[data-close-source-figure]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()});
  dialog.addEventListener('close',()=>{syncModal();trigger?.focus({preventScroll:true})});
})();
