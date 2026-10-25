(() => {
  'use strict';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  let sequence = 0;

  function mountJourneyRope(root) {
    if (!root || root.journeyRope) return root?.journeyRope;
    const cards = [...root.querySelectorAll('.journey-rope__card')];
    if (!cards.length) return null;
    let line = root.querySelector('.journey-rope__line');
    if (!line) {
      line = document.createElement('div');
      line.className = 'journey-rope__line';
      line.setAttribute('aria-hidden', 'true');
      root.prepend(line);
    }
    const id = `journey-cord-${++sequence}`;
    const media = (window.PortfolioMotion?.preference || matchMedia('(prefers-reduced-motion: reduce)'));
    let frame = 0, last = 0, visible = true, disposed = false;
    const cleanups = [];
    const states = cards.map((card, i) => ({
      card, angle: [-3.7, 3.2, -3.1][i % 3], velocity: 0,
      rest: [-1.2, .9, -.75][i % 3], target: null, focused: false,
      phase: i * 2.15
    }));
    cards.forEach(card => {
      ['eyelet', 'thread'].forEach(part => {
        if (card.querySelector(`.journey-rope__${part}`)) return;
        const node = document.createElement('span');
        node.className = `journey-rope__${part}`;
        node.setAttribute('aria-hidden', 'true');
        card.prepend(node);
      });
    });

    function listen(target, event, callback, options) {
      target.addEventListener(event, callback, options);
      cleanups.push(() => target.removeEventListener(event, callback, options));
    }

    const textMeter = document.createElement('canvas').getContext('2d');
    function fitRoleType() {
      if (!textMeter) return;
      const maximum = matchMedia('(max-width: 700px)').matches ? 14 : 16;
      let common = maximum;
      cards.forEach(card => {
        const role = card.querySelector('.journey-rope__role');
        if (!role) return;
        const style = getComputedStyle(role);
        textMeter.font = `${style.fontStyle} ${style.fontWeight} ${maximum}px ${style.fontFamily}`;
        const width = textMeter.measureText(role.textContent.trim()).width;
        if (width) common = Math.min(common, maximum * (role.clientWidth - 3) / width);
      });
      root.style.setProperty('--journey-role-font', `${Math.max(12, Math.min(maximum, common)).toFixed(2)}px`);
    }
    let material = null;
    try { material = JSON.parse(document.getElementById('journey-material-data')?.textContent || 'null'); } catch (_) {}
    function drawCord() {
      if (disposed) return;
      fitRoleType();
      const r = root.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const mobile = matchMedia('(max-width: 1050px)').matches;
      const source = document.getElementById('journey-wool-source');
      if (!material || !source) return;
      const hole = material.paper.hole;
      const anchors = states.map(({ card }) => {
        const item = card.closest('.journey-rope__item') || card.parentElement;
        const rect = item.getBoundingClientRect();
        const pad = parseFloat(getComputedStyle(item).paddingTop) || 0;
        return { x: rect.left - r.left + card.offsetWidth * hole[0],
          y: rect.top - r.top + pad + card.offsetHeight * hole[1] };
      });
      const wool = material.wool;
      const imageHeight = Math.min(154, r.width * .125);
      const centre = x => {
        const nx = Math.max(0, Math.min(1, x / r.width));
        const samples = wool.centerline;
        let j = samples.findIndex(p => p[0] >= nx);
        if (j < 1) j = 1;
        const left = samples[j - 1], right = samples[j];
        const mix = Math.max(0, Math.min(1, (nx - left[0]) / (right[0] - left[0])));
        return (left[1] + (right[1] - left[1]) * mix) * imageHeight;
      };
      const ties = anchors.map(a => mobile
        ? `M 12 ${a.y - 35} C 38 ${a.y - 51}, ${a.x - 34} ${a.y - 27}, ${a.x} ${a.y}`
        : `M ${a.x} ${centre(a.x)} C ${a.x - 4} ${a.y - 46}, ${a.x - 3} ${a.y - 15}, ${a.x} ${a.y}`);
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      const defs = document.createElementNS(SVG_NS, 'defs');
      const bitmap = document.createElementNS(SVG_NS, 'image');
      bitmap.setAttribute('id', `${id}-bitmap`);
      bitmap.setAttribute('href', source.currentSrc || source.src);
      bitmap.setAttribute('width', wool.width); bitmap.setAttribute('height', wool.height);
      defs.append(bitmap);
      ['horizontal', 'vertical'].forEach(direction => {
        const pattern = document.createElementNS(SVG_NS, 'pattern');
        pattern.setAttribute('id', `${id}-${direction}`);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        pattern.setAttribute('width', '75'); pattern.setAttribute('height', '16');
        pattern.setAttribute('viewBox', wool.tileViewBox.join(' '));
        pattern.setAttribute('preserveAspectRatio', 'none');
        if (direction === 'vertical') pattern.setAttribute('patternTransform', 'rotate(90)');
        const use = document.createElementNS(SVG_NS, 'use'); use.setAttribute('href', `#${id}-bitmap`);
        pattern.append(use); defs.append(pattern);
      });
      const shadow = document.createElementNS(SVG_NS, 'filter');
      shadow.setAttribute('id', `${id}-shadow`);
      shadow.setAttribute('x', '-20%'); shadow.setAttribute('y', '-30%');
      shadow.setAttribute('width', '140%'); shadow.setAttribute('height', '170%');
      shadow.innerHTML = '<feDropShadow dx="1" dy="4" stdDeviation="2.5" flood-color="#63452e" flood-opacity=".2"/>';
      defs.append(shadow); svg.append(defs);
      const group = document.createElementNS(SVG_NS, 'g');
      group.setAttribute('filter', `url(#${id}-shadow)`);
      group.setAttribute('stroke-linecap', 'round'); group.setAttribute('stroke-linejoin', 'round');
      svg.append(group);
      function ropePath(d, width, direction) {
        const path = document.createElementNS(SVG_NS, 'path'); path.setAttribute('d', d);
        path.setAttribute('fill', 'none'); path.setAttribute('stroke', `url(#${id}-${direction})`);
        path.setAttribute('stroke-width', width); group.append(path);
      }
      if (mobile) {
        ropePath(`M 12 2 C 7 ${r.height * .3}, 18 ${r.height * .66}, 12 ${r.height - 14}`, 16, 'vertical');
      } else {
        const main = document.createElementNS(SVG_NS, 'use'); main.setAttribute('href', `#${id}-bitmap`);
        main.setAttribute('transform', `scale(${r.width / wool.width} ${imageHeight / wool.height})`);
        group.append(main);
      }
      ties.forEach(d => ropePath(d, 8.5, mobile ? 'horizontal' : 'vertical'));
      anchors.forEach(a => {
        ropePath(`M ${a.x} ${a.y - 3} C ${a.x + 11} ${a.y - 5}, ${a.x + 10} ${a.y + 10}, ${a.x + 2} ${a.y + 9} C ${a.x - 5} ${a.y + 8}, ${a.x - 4} ${a.y + 1}, ${a.x} ${a.y - 1}`, 5.5, 'vertical');
        ropePath(`M ${a.x + 2} ${a.y + 7} Q ${a.x - 2} ${a.y + 16}, ${a.x + 4} ${a.y + 21}`, 5, 'vertical');
      });
      line.replaceChildren(svg);
    }

    function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; }
    function tick(now) {
      frame = 0;
      if (disposed || media.matches || !visible || document.hidden) return;
      const dt = last ? Math.min((now - last) / 1000, .04) : 1 / 60;
      last = now;
      states.forEach(s => {
        const target = s.focused ? 0 : (s.target ?? s.rest);
        const breeze = s.focused || s.target !== null ? 0 : Math.sin(now * .0011 + s.phase) * 3.5;
        const acceleration = (target + breeze - s.angle) * 10 - s.velocity * 2.8;
        s.velocity += acceleration * dt;
        s.angle = Math.max(-6.8, Math.min(6.8, s.angle + s.velocity * dt));
        s.card.style.setProperty('--journey-angle', `${s.angle.toFixed(3)}deg`);
      });
      frame = requestAnimationFrame(tick);
    }
    function start() {
      if (!frame && !disposed && !media.matches && visible && !document.hidden) frame = requestAnimationFrame(tick);
    }
    states.forEach(s => {
      listen(s.card, 'pointerenter', event => {
        if (event.pointerType !== 'mouse' || s.focused || media.matches) return;
        s.target = s.rest; s.velocity += (s.phase % 2 > 1 ? -1 : 1) * 8.5; start();
      });
      listen(s.card, 'pointermove', event => {
        if (event.pointerType !== 'mouse' || s.focused || media.matches) return;
        const rect = s.card.getBoundingClientRect();
        s.target = Math.max(-4.8, Math.min(4.8, (event.clientX - rect.left - rect.width / 2) / rect.width * 8));
      });
      listen(s.card, 'pointerleave', () => { s.target = null; });
      listen(s.card, 'pointerdown', event => {
        if (s.focused || media.matches) return;
        const rect = s.card.getBoundingClientRect();
        s.velocity += (event.clientX < rect.left + rect.width / 2 ? -1 : 1) * 10;
        start();
      }, { passive: true });
      listen(s.card, 'focusin', () => { s.focused = true; s.target = 0; s.velocity = 0; start(); });
      listen(s.card, 'focusout', () => { s.focused = false; s.target = null; start(); });
    });
    const resize = new ResizeObserver(drawCord);
    resize.observe(root);
    const intersection = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      if (visible) start(); else stop();
    }, { rootMargin: '80px' });
    intersection.observe(root);
    listen(document, 'visibilitychange', () => document.hidden ? stop() : start());
    listen(media, 'change', () => {
      if (media.matches) {
        stop(); states.forEach(s => s.card.style.setProperty('--journey-angle', '0deg'));
      } else start();
    });
    const api = { redraw: drawCord, getState: () => ({ reducedMotion: media.matches, visible, cards: states.map(s => ({ angle: s.angle, velocity: s.velocity, focused: s.focused })) }), dispose() {
      disposed = true; stop(); resize.disconnect(); intersection.disconnect();
      cleanups.forEach(fn => fn()); states.forEach(s => s.card.style.removeProperty('--journey-angle'));
      delete root.journeyRope;
    } };
    root.journeyRope = api;
    drawCord(); start();
    document.fonts?.ready.then(() => { if (!disposed) drawCord(); });
    return api;
  }
  window.mountJourneyRope = mountJourneyRope;
  const init = () => document.querySelectorAll('[data-journey-rope]').forEach(mountJourneyRope);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
