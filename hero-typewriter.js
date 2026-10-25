/* Hero-only typing and mobile menu. The page's scroll animation stays in site.js. */
(() => {
  'use strict';
  if (window.WangYuHeroUI) return;

  const delay = 600;
  const speed = 38;
  const reduced = (window.PortfolioMotion?.preference || matchMedia('(prefers-reduced-motion: reduce)'));
  const desktop = matchMedia('(min-width: 768px)');
  const jobs = [];
  let timer = 0;
  let initialized = false;
  let menuToggle = null;
  let menu = null;

  function graphemes(text) {
    if (typeof Intl.Segmenter === 'function') {
      const segmenter = new Intl.Segmenter('zh', { granularity: 'grapheme' });
      return [...segmenter.segment(text)].map(part => part.segment);
    }
    return Array.from(text);
  }

  function showCaret(job, visible) {
    if (!job.caret) return;
    job.caret.hidden = !visible;
    if (visible) job.caret.style.removeProperty('display');
    else job.caret.style.display = 'none';
  }

  function finish(job) {
    job.index = job.characters.length;
    job.visible.textContent = job.text;
    job.done = true;
    job.remaining = 0;
    job.element.dataset.typing = 'complete';
    showCaret(job, false);
  }

  function finishTyping() {
    clearTimeout(timer);
    timer = 0;
    for (const job of jobs) finish(job);
  }

  function schedule() {
    clearTimeout(timer);
    timer = 0;
    if (document.hidden) return;
    if (reduced.matches) { finishTyping(); return; }
    const pending = jobs.filter(job => !job.done);
    if (!pending.length) return;
    const next = Math.min(...pending.map(job => job.deadline));
    timer = setTimeout(typeStep, Math.max(0, next - performance.now()));
  }

  function typeStep() {
    timer = 0;
    if (document.hidden) return;
    if (reduced.matches) { finishTyping(); return; }
    const now = performance.now();
    for (const job of jobs) {
      if (job.done || job.deadline > now + 1) continue;
      // Never catch up in a burst after a busy frame or a background tab.
      job.index += 1;
      job.visible.textContent = job.characters.slice(0, job.index).join('');
      if (job.index >= job.characters.length) finish(job);
      else { job.remaining = speed; job.deadline = now + speed; }
    }
    schedule();
  }

  function menuIsOpen() {
    return Boolean(menu && !menu.hidden);
  }

  function closeMenu(returnFocus = false) {
    const wasOpen = menuIsOpen();
    if (menu) menu.hidden = true;
    if (menuToggle) { menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', '展开作品集目录'); }
    document.body.classList.remove('hero-menu-open');
    if (returnFocus && wasOpen && menuToggle) menuToggle.focus();
  }

  function openMenu() {
    if (!menu || !menuToggle || desktop.matches) return;
    menu.hidden = false;
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', '收起作品集目录');
    document.body.classList.add('hero-menu-open');
  }

  function initialize() {
    if (initialized) return;
    initialized = true;
    const now = performance.now();
    for (const element of document.querySelectorAll('[data-typewriter]')) {
      const visible = element.querySelector('.typewriter-visible');
      const full = element.querySelector('.typewriter-full');
      if (!visible) continue;
      const text = element.getAttribute('data-text') ?? full?.textContent ?? visible.textContent;
      const job = { element, visible, caret: element.querySelector('.typewriter-caret'),
        text, characters: graphemes(text), index: 0, done: false, remaining: delay, deadline: now + delay };
      jobs.push(job);
      visible.setAttribute('aria-hidden', 'true');
      if (reduced.matches || !job.characters.length) finish(job);
      else {
        visible.textContent = '';
        element.dataset.typing = 'active';
        showCaret(job, true);
      }
    }

    menuToggle = document.getElementById('hero-menu-toggle');
    const menuId = menuToggle?.getAttribute('aria-controls') || 'hero-mobile-menu';
    menu = document.getElementById(menuId);
    closeMenu();
    if (menuToggle && menu) {
      menuToggle.addEventListener('click', () => { if (menuIsOpen()) closeMenu(); else openMenu(); });
      menu.addEventListener('click', event => {
        const target = event.target instanceof Element ? event.target : event.target?.parentElement;
        if (target?.closest('a[href]')) closeMenu();
      });
      document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !menuIsOpen()) return;
        event.preventDefault();
        closeMenu(true);
      });
    }
    schedule();
  }

  document.addEventListener('visibilitychange', () => {
    const now = performance.now();
    if (document.hidden) {
      clearTimeout(timer);
      timer = 0;
      for (const job of jobs) if (!job.done) job.remaining = Math.max(0, job.deadline - now);
    } else {
      for (const job of jobs) if (!job.done) job.deadline = now + job.remaining;
      schedule();
    }
  });
  reduced.addEventListener('change', () => { if (reduced.matches) finishTyping(); });
  desktop.addEventListener('change', () => { if (desktop.matches) closeMenu(); });

  window.WangYuHeroUI = {
    finishTyping,
    closeMenu,
    getState: () => ({ initialized, menuOpen: menuIsOpen(), reducedMotion: reduced.matches,
      typing: jobs.map(job => ({ state: job.element.dataset.typing, index: job.index, total: job.characters.length })) })
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
