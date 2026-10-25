/* One motion preference shared by the page. System settings stay unchanged;
 * a visitor can explicitly choose a different mode for this portfolio. */
(() => {
  'use strict';
  if (window.PortfolioMotion) return;
  const query = '(prefers-reduced-motion: reduce)';
  const storageKey = 'wangyu.portfolio.motion.v1';
  const system = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
  const root = document.documentElement;
  // Local diagnostics only: no report is sent to a server.
  window.addEventListener('error', event => {
    root.dataset.motionError = String(event.message || '');
    root.dataset.motionErrorSource = String(event.filename || '').split('/').pop() + ':' + String(event.lineno || '');
  });
  let choice = null;
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === 'full' || saved === 'reduced') choice = saved;
  } catch (_) { /* Local HTML can use the in-memory preference without storage. */ }
  const matches = () => choice === 'reduced' || (choice === null && Boolean(system?.matches));

  class MotionPreference extends EventTarget {
    constructor() {
      super();
      this.onchange = null;
      this.addEventListener('change', event => {
        if (typeof this.onchange === 'function') this.onchange.call(this, event);
      });
    }
    get matches() { return matches(); }
    get media() { return query; }
    addListener(listener) { this.addEventListener('change', listener); }
    removeListener(listener) { this.removeEventListener('change', listener); }
  }
  const preference = new MotionPreference();
  let previousMatches = preference.matches;

  function syncControls() {
    const reduced = preference.matches;
    root.dataset.motion = reduced ? 'reduced' : 'full';
    root.dataset.motionSource = choice === null ? 'system' : 'user';
    for (const button of document.querySelectorAll('[data-motion-toggle]')) {
      button.textContent = reduced ? '动效：减少' : '动效：开启';
      button.setAttribute('aria-pressed', String(!reduced));
      button.setAttribute('aria-label', reduced ? '当前减少动效，点击开启动效' : '当前动效开启，点击减少动效');
      button.title = (reduced ? '点击开启动效' : '点击减少动效') + (choice === null ? '；当前跟随系统设置' : '；已使用本页选择');
    }
  }
  function publish() {
    syncControls();
    const next = preference.matches;
    if (previousMatches === next) return;
    previousMatches = next;
    const event = new Event('change');
    Object.defineProperties(event, { matches: { value: next }, media: { value: query } });
    preference.dispatchEvent(event);
  }
  function get() {
    return Object.freeze({ selection: choice || 'system', mode: preference.matches ? 'reduced' : 'full', source: choice === null ? 'system' : 'user' });
  }
  function set(value) {
    if (!['full', 'reduced', 'system'].includes(value)) throw new TypeError('Motion selection must be full, reduced, or system.');
    choice = value === 'system' ? null : value;
    try {
      if (choice === null) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, choice);
    } catch (_) { /* The active in-memory choice still applies. */ }
    publish();
    return get();
  }
  function toggle() { return set(preference.matches ? 'full' : 'reduced'); }
  window.PortfolioMotion = Object.freeze({ preference, get, set, toggle });
  syncControls();
  const systemChanged = () => publish();
  if (system?.addEventListener) system.addEventListener('change', systemChanged);
  else if (system?.addListener) system.addListener(systemChanged);
  window.addEventListener('storage', event => {
    if (event.key !== storageKey && event.key !== null) return;
    choice = event.newValue === 'full' || event.newValue === 'reduced' ? event.newValue : null;
    publish();
  });
  function bindControls() {
    syncControls();
    for (const button of document.querySelectorAll('[data-motion-toggle]')) {
      if (button.dataset.motionBound) continue;
      button.dataset.motionBound = 'true';
      button.addEventListener('click', toggle);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindControls, { once: true });
  else bindControls();
})();
