/* Continuous-time input for the wool portrait. The renderer owns all pixels;
 * this controller only supplies a continuous pose coordinate in [-1, 1]. */
(() => {
  'use strict';
  const holder = document.getElementById('head-float');
  const button = document.getElementById('head-magnet');
  const hero = document.querySelector('.yarn-hero');
  if (!holder || !button || !hero || holder.dataset.smoothInitialized) return;
  holder.dataset.smoothInitialized = 'true';
  holder.dataset.position = '0.00000';
  holder.dataset.motionState = 'loading';
  holder.dataset.ready = 'false';
  holder.dataset.availableSourceCount = String(holder.querySelectorAll('img[data-motion-source]').length);

  const reduced = (window.PortfolioMotion?.preference || matchMedia('(prefers-reduced-motion: reduce)'));
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const clamp = value => Math.min(1, Math.max(-1, value));
  const EPSILON = 0.00012, VELOCITY_EPSILON = 0.002, OMEGA = 17;
  const POINTER_DEADZONE = 3;
  let renderer = null, ready = false, failed = false;
  let position = 0, velocity = 0, target = 0, mode = 'idle';
  let raf = 0, previousTime = null, paused = true;
  let acceptedPointer = null;
  let visible = (() => {
    const rect = hero.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight;
  })();

  function blocked() {
    return !ready || failed || reduced.matches || document.hidden || !visible ||
      Boolean(document.querySelector('dialog[open]')) ||
      document.body.classList.contains('hero-menu-open');
  }
  function hasMotion() {
    return Math.abs(position - target) > EPSILON || Math.abs(velocity) > VELOCITY_EPSILON;
  }
  function state() {
    holder.dataset.motionState = failed ? 'fallback' : !ready ? 'loading' :
      reduced.matches ? 'reduced' : paused ? 'paused' : hasMotion() ? mode : 'idle';
  }
  function display(value) {
    position = clamp(value);
    holder.dataset.position = position.toFixed(5);
    try {
      renderer.render(position);
    } catch (error) {
      failed = true;
      holder.dataset.ready = 'false';
      stop();
      state();
      console.warn('The wool portrait has returned to its static fallback.', error);
    }
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    previousTime = null;
  }
  function schedule() {
    state();
    if (!paused && !raf && hasMotion()) raf = requestAnimationFrame(tick);
  }
  function advanceSpring(seconds) {
    // Analytic critical damping is independent of the monitor refresh rate.
    // Changing target immediately redirects the motion, rather than queueing poses.
    const offset = position - target;
    const coefficient = velocity + OMEGA * offset;
    const decay = Math.exp(-OMEGA * seconds);
    const next = target + (offset + coefficient * seconds) * decay;
    velocity = (velocity - OMEGA * coefficient * seconds) * decay;
    display(next);
    if (Math.abs(position - target) <= EPSILON && Math.abs(velocity) <= VELOCITY_EPSILON) {
      velocity = 0;
      display(target);
      mode = 'idle';
    }
  }
  function tick(timestamp) {
    raf = 0;
    if (blocked()) { refreshActivity(); return; }
    // Reset the clock when paused, and cap main-thread stalls so reentry cannot jump.
    const dt = previousTime === null ? 0 : Math.min(0.05, Math.max(0, (timestamp - previousTime) / 1000));
    previousTime = timestamp;
    if (dt > 0) advanceSpring(dt);
    if (!hasMotion()) previousTime = null;
    schedule();
  }
  function refreshActivity() {
    const nextPaused = blocked();
    if (nextPaused !== paused) {
      paused = nextPaused;
      stop();
    }
    if (reduced.matches && ready) {
      velocity = 0;
      target = 0;
      mode = 'idle';
      stop();
      display(0);
    }
    state();
    if (!paused) schedule();
  }
  function aim(value, nextMode = 'pointer') {
    if (blocked()) return;
    target = clamp(value);
    mode = nextMode;
    // Preserve current velocity when retargeting for a continuous change of direction.
    schedule();
  }
  function recenter(event) {
    if (event && event.pointerType && event.pointerType !== 'mouse') return;
    acceptedPointer = null;
    aim(0, 'returning');
  }
  hero.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !fine.matches || blocked()) return;
    const point = { x: event.clientX, y: event.clientY };
    if (acceptedPointer &&
      Math.hypot(point.x - acceptedPointer.x, point.y - acceptedPointer.y) < POINTER_DEADZONE) return;
    acceptedPointer = point;
    const bounds = hero.getBoundingClientRect();
    const portrait = holder.getBoundingClientRect();
    const center = portrait.left + portrait.width / 2;
    const distance = point.x - center;
    const reach = distance < 0 ? Math.max(1, center - bounds.left) : Math.max(1, bounds.right - center);
    aim(Math.abs(distance) <= POINTER_DEADZONE ? 0 : distance / reach);
  }, { passive: true });
  hero.addEventListener('pointerleave', recenter, { passive: true });
  button.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
    event.preventDefault();
    acceptedPointer = null;
    aim(event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0, 'keyboard');
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      refreshActivity();
    }, { threshold: 0 }).observe(hero);
  } else {
    const checkVisible = () => {
      const rect = hero.getBoundingClientRect();
      visible = rect.bottom > 0 && rect.top < innerHeight;
      refreshActivity();
    };
    addEventListener('scroll', checkVisible, { passive: true });
    addEventListener('resize', checkVisible, { passive: true });
  }
  document.addEventListener('visibilitychange', refreshActivity);
  reduced.addEventListener('change', refreshActivity);
  fine.addEventListener('change', () => {
    if (!fine.matches) recenter();
    refreshActivity();
  });
  for (const dialog of document.querySelectorAll('dialog')) {
    new MutationObserver(refreshActivity).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    dialog.addEventListener('close', refreshActivity);
  }
  new MutationObserver(refreshActivity).observe(document.body,
    { attributes: true, attributeFilter: ['class'] });

  Promise.resolve().then(() => {
    if (typeof window.createWoolMotionRenderer !== 'function') throw new Error('Character renderer is unavailable');
    return window.createWoolMotionRenderer(holder);
  }).then(result => {
    if (!result || typeof result.render !== 'function') throw new Error('Character renderer is incomplete');
    renderer = result;
    holder.dataset.rendererMode = String(result.mode || 'continuous');
    ready = true;
    holder.dataset.ready = 'true';
    display(0);
    refreshActivity();
  }).catch(error => {
    failed = true;
    holder.dataset.ready = 'false';
    holder.dataset.rendererMode = 'static-fallback';
    stop();
    state();
    console.warn('The wool portrait remains available as a static image.', error);
  });
})();
