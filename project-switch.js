/* Scroll-driven drawers: each new card pulls up while earlier cards contract.
 * All five share one sticky parent and leave together, preserving the top stack. */
(() => {
  'use strict';
  const root = document.querySelector('#systems.project-showcase');
  const list = root?.querySelector('.projects-list');
  const shells = list ? [...list.querySelectorAll(':scope > .project-shell')] : [];
  if (!root || !list || shells.length < 2 || root.dataset.switchReady) return;
  root.dataset.switchReady = 'true';

  const stage = document.createElement('div');
  stage.className = 'project-stage';
  list.append(stage);
  shells.forEach((shell, index) => {
    stage.append(shell);
    shell.style.zIndex = String(index + 1);
  });
  const reduce = (window.PortfolioMotion?.preference || matchMedia('(prefers-reduced-motion: reduce)'));
  let raf = 0, enabled = false, step = 1, stageTop = 32, stageHeight = 1;
  let gap = 23, cardHeight = 1, target = 0, depth = 0, lastStamp = 0;
  let targetDirty = true, nearViewport = false, modalOpen = false;
  let activeSystem = -1, paintedDepth = '';
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const motion = shells.map(() => ({ y: 0, scale: 1, visible: null, active: null, transform: '' }));

  function setInteractive(shell, state, active) {
    if (state.active === active) return;
    state.active = active;
    shell.inert = !active;
    if (active) shell.removeAttribute('aria-hidden');
    else shell.setAttribute('aria-hidden', 'true');
    shell.dataset.stageActive = String(active);
  }

  function measure() {
    cancelAnimationFrame(raf); raf = 0; lastStamp = 0;
    // Small screens and reduced-motion preferences keep a fully usable list.
    enabled = innerWidth >= 768 && innerHeight >= 620 && !reduce.matches;
    root.classList.toggle('has-project-switch', enabled);
    if (!enabled) {
      root.dataset.activeSystem = 'all';
      delete root.dataset.stackPosition;
      for (const property of ['--switch-track-height', '--switch-stage-top', '--switch-stage-height', '--switch-card-height']) {
        list.style.removeProperty(property);
      }
      for (const shell of shells) {
        shell.style.removeProperty('transform');
        shell.removeAttribute('data-stage-visible');
        shell.removeAttribute('data-stage-active');
        shell.removeAttribute('aria-hidden');
        shell.inert = false;
      }
      motion.forEach(state => { state.visible = state.active = null; state.transform = ''; });
      activeSystem = -1; paintedDepth = '';
      return;
    }
    stageTop = Math.round(clamp(innerHeight * .045, 24, 44));
    stageHeight = Math.round(Math.min(830, innerHeight - stageTop - 28));
    gap = Math.round(clamp(innerHeight * .027, 18, 25));
    // Reserve room for every stepped edge, so the last card closes the bottom
    // cleanly rather than projecting beyond previous cards or the viewport.
    cardHeight = stageHeight - 24 - gap * (shells.length - 1);
    step = Math.round(clamp(innerHeight * .78, 480, 850));
    const hold = Math.round(step * .55);
    const trackHeight = stageHeight + step * (shells.length - 1) + hold;
    list.style.setProperty('--switch-stage-top', `${stageTop}px`);
    list.style.setProperty('--switch-stage-height', `${stageHeight}px`);
    list.style.setProperty('--switch-card-height', `${cardHeight}px`);
    list.style.setProperty('--switch-track-height', `${trackHeight}px`);
    // Recompute on resize/font layout changes, without animating old geometry.
    readTarget();
    snap();
  }

  function readTarget() {
    const rect = list.getBoundingClientRect();
    target = clamp((stageTop - rect.top) / step, 0, shells.length - 1);
    nearViewport = rect.top < innerHeight + 160 && rect.bottom > -160;
    targetDirty = false;
  }

  function desired(item, position) {
    const y = item * gap;
    return {
      // A continuous scroll mapping has no per-card dead zone or easing reset.
      y: y + (stageHeight - y + 20) * clamp(item - position),
      scale: 1 - Math.min(shells.length - 1, Math.max(0, position - item)) * .024
    };
  }

  function paint() {
    const active = Math.min(shells.length - 1, Math.floor(depth + .5));
    if (activeSystem !== active) {
      activeSystem = active;
      root.dataset.activeSystem = String(active + 1);
    }
    const position = depth.toFixed(4);
    if (paintedDepth !== position) {
      paintedDepth = position;
      root.dataset.stackPosition = position;
    }
    shells.forEach((shell, item) => {
      const state = motion[item];
      const visible = item === 0 || state.y < stageHeight + 19.9;
      if (state.visible !== visible) {
        state.visible = visible;
        shell.dataset.stageVisible = String(visible);
      }
      const transform = `translate3d(0,${state.y.toFixed(3)}px,0) scale(${state.scale.toFixed(5)})`;
      if (state.transform !== transform) {
        state.transform = transform;
        shell.style.transform = transform;
      }
      setInteractive(shell, state, item === active);
    });
  }

  function snap() {
    depth = target;
    motion.forEach((state, item) => Object.assign(state, desired(item, target)));
    paint();
  }

  function render(stamp) {
    raf = 0;
    if (!enabled || document.hidden || modalOpen) { lastStamp = 0; return; }
    if (targetDirty) readTarget();
    // No animation loop is kept alive outside the showcase or after it settles.
    if (!nearViewport) { snap(); lastStamp = 0; return; }
    const dt = lastStamp ? Math.min(64, stamp - lastStamp) : 1000 / 60;
    lastStamp = stamp;
    const distance = Math.abs(target - depth);
    // Time-based damping treats wheel/trackpad events uniformly at 60/120 Hz.
    // A quicker catch-up for large scrolls avoids a long queue of old drawers.
    const timeConstant = Math.max(32, 76 / (1 + distance * .65));
    const alpha = 1 - Math.exp(-dt / timeConstant);
    depth += (target - depth) * alpha;
    let moving = Math.abs(target - depth) > .0001;
    motion.forEach((state, item) => {
      const next = desired(item, target);
      // Damp actual card positions as well as progress. This preserves velocity
      // continuity when one drawer docks and the following drawer starts.
      state.y += (next.y - state.y) * alpha;
      state.scale += (next.scale - state.scale) * alpha;
      if (Math.abs(next.y - state.y) > .04 || Math.abs(next.scale - state.scale) > .00001) moving = true;
    });
    if (!moving) { snap(); lastStamp = 0; return; }
    paint();
    raf = requestAnimationFrame(render);
  }

  function schedule() {
    targetDirty = true;
    if (!raf && enabled && !document.hidden && !modalOpen) raf = requestAnimationFrame(render);
  }
  function modalChanged() {
    modalOpen = document.body.classList.contains('modal-open') || !!document.querySelector('dialog[open]');
    if (modalOpen) { cancelAnimationFrame(raf); raf = 0; lastStamp = 0; }
    else schedule();
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', measure, { passive: true });
  addEventListener('pageshow', measure);
  addEventListener('hashchange', schedule);
  reduce.addEventListener('change', measure);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; lastStamp = 0; }
    else schedule();
  });
  const modalObserver = new MutationObserver(modalChanged);
  modalObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.querySelectorAll('dialog').forEach(dialog => {
    modalObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  });
  if (document.fonts?.ready) document.fonts.ready.then(measure);
  modalChanged();
  measure();
})();
