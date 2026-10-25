/* A new visit opens the cover. Hash navigation after load remains available. */
(() => {
  'use strict';
  // Embedded section previews are allowed to retain their requested section.
  if (window.top !== window) return;
  try { history.scrollRestoration = 'manual'; } catch (_) {}
  try { history.replaceState(history.state, '', '#home'); } catch (_) {}
  document.documentElement.dataset.entryStart = 'home';
  let navigated = false;
  ['wheel', 'touchstart', 'keydown'].forEach(type => {
    addEventListener(type, () => { navigated = true; }, { once: true, passive: true });
  });
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('a[href^="#"]')) navigated = true;
  }, { capture: true });
  addEventListener('hashchange', () => { navigated = true; });
  addEventListener('pageshow', () => {
    if (navigated) return;
    const root = document.documentElement, before = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    requestAnimationFrame(() => { root.style.scrollBehavior = before; });
  }, { once: true });
})();
