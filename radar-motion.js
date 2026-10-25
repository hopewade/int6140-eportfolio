/* One entrance per pair: draw the second cloth out, then reveal the original value geometry. */
(() => {
  'use strict';
  const CARD_MS = 1080;
  const VALUE_MS = 1380;
  const VALUE_STAGGER_MS = 150;
  const TOTAL_MS = CARD_MS + VALUE_MS + VALUE_STAGGER_MS;
  const reduced = (window.PortfolioMotion?.preference || window.matchMedia('(prefers-reduced-motion: reduce)'));
  const states = new Set();
  const ease = value => 1 - Math.pow(1 - value, 3);
  let observer;

  function finish(state) {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    state.done = true;
    state.cardAnimation?.cancel();
    state.cardAnimation = null;
    state.layers.forEach(layer => {
      layer.removeAttribute('transform');
      layer.style.removeProperty('opacity');
    });
    state.pair.dataset.radarState = 'complete';
    observer?.unobserve(state.pair);
  }

  function stop(state) {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.raf = 0;
    state.lastTime = null;
  }

  function paint(state) {
    if (state.cardAnimation) state.cardAnimation.currentTime = Math.min(CARD_MS, state.elapsed);
    state.layers.forEach((layer, index) => {
      const progress = Math.max(0, Math.min(1, (state.elapsed - CARD_MS - VALUE_STAGGER_MS * index) / VALUE_MS));
      // SVG user-space matrices keep the actual centre fixed despite nonzero viewBox origins.
      // Only coloured values / yarn / knots move; labels and reference grid remain stable.
      const scale = 0.015 + 0.985 * ease(progress);
      const cx = Number(layer.dataset.radarCx);
      const cy = Number(layer.dataset.radarCy);
      layer.setAttribute('transform', `matrix(${scale} 0 0 ${scale} ${cx * (1 - scale)} ${cy * (1 - scale)})`);
      layer.style.opacity = progress > 0 ? '1' : '0';
    });
  }

  function tick(state, now) {
    state.raf = 0;
    if (state.done || !state.visible || document.hidden) return;
    if (state.lastTime !== null) state.elapsed += now - state.lastTime;
    state.lastTime = now;
    paint(state);
    if (state.elapsed >= TOTAL_MS) {
      finish(state);
      return;
    }
    state.raf = requestAnimationFrame(time => tick(state, time));
  }

  function run(state) {
    if (state.done || state.raf || !state.visible || document.hidden) return;
    if (!state.started) {
      const [first, second] = state.cards.map(card => card.getBoundingClientRect());
      const dx = first.left - second.left + 5;
      const dy = first.top - second.top + 5;
      state.pair.dataset.radarState = 'animating';
      state.started = true;
      // The same geometry supports a sideways draw on desktop and a downward draw on narrow screens.
      state.cardAnimation = state.cards[1].animate([
        { transform: `translate(${dx}px, ${dy}px) rotate(-1.8deg)`, opacity: 0.95 },
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 }
      ], {
        duration: CARD_MS,
        easing: 'cubic-bezier(.22,.7,.25,1)',
        fill: 'both'
      });
      state.cardAnimation.pause();
      state.cardAnimation.currentTime = 0;
      paint(state);
    }
    state.lastTime = null;
    state.raf = requestAnimationFrame(time => tick(state, time));
  }

  function mount(root = document) {
    const pairs = root.querySelectorAll('.imported-research .role-radar-pair:not([data-radar-mounted])');
    if (!pairs.length) return;
    if (!observer && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const state = [...states].find(item => item.pair === entry.target);
          if (!state || state.done) return;
          state.visible = entry.isIntersecting;
          if (state.visible) run(state);
          else stop(state);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    }
    pairs.forEach(pair => {
      pair.dataset.radarMounted = 'true';
      const state = {
        pair, cards: [...pair.querySelectorAll(':scope > .radar-fabric')],
        layers: [...pair.querySelectorAll('.radar-value-layer')],
        elapsed: 0, lastTime: null, raf: 0, started: false, visible: false, done: false, cardAnimation: null
      };
      states.add(state);
      if (reduced.matches || !observer || state.cards.length !== 2 || state.layers.length !== 2 || !state.cards[1].animate) {
        finish(state);
        return;
      }
      pair.dataset.radarState = 'pending';
      observer.observe(pair);
    });
  }

  document.addEventListener('visibilitychange', () => {
    states.forEach(state => document.hidden ? stop(state) : run(state));
  });
  reduced.addEventListener('change', event => {
    if (event.matches) states.forEach(finish);
  });
  window.addEventListener('beforeprint', () => states.forEach(finish));
  // Resizing midway changes the card offset. Finish to the true layout rather than jumping between anchors.
  window.addEventListener('resize', () => states.forEach(state => {
    if (state.started && !state.done) finish(state);
  }), { passive: true });
  window.mountRoleRadarMotion = mount;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount(), { once: true });
  else mount();
})();
