/* Jack-inspired portfolio interactions. No legacy avatar, folder, GSAP or
 * scroll engine is loaded. Scroll animation is owned here; the character and cloth have separate event-driven renderers. */
(() => {
  'use strict';
  if (window.WangYuJackSite) return;
  const clamp = (n, a = 0, b = 1) => Math.max(a, Math.min(b, n));
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const reduce = (window.PortfolioMotion?.preference || matchMedia('(prefers-reduced-motion: reduce)'));
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const hero = document.querySelector('.hero');
  const headMagnet = null; // Head rendering is exclusively owned by keyframe-character.js.
  const headFloat = null;
  const headPosition = headMagnet?.closest('.head-position') || headMagnet?.parentElement;
  // The physical spring is the sole interpolation owner. A simultaneous CSS
  // transform transition would continually chase each new animation frame.
  if (headMagnet) headMagnet.style.transition = 'none';
  if (headFloat) headFloat.style.transition = 'none';
  const marquee = document.getElementById('marquee');
  const tracks = [...document.querySelectorAll('#marquee .marquee-track')];
  const shells = [...document.querySelectorAll('.project-shell')];
  const projectsList = document.querySelector('.projects-list');
  const reveals = [...new Set([...document.querySelectorAll('.reveal'), headMagnet, document.querySelector('.hero-nav')].filter(Boolean))];
  const seen = new WeakSet(), revealQueue = new Set(), revealAnimations = new Set();
  const charParagraphs = [];
  const pointer = { inside: false, x: 0, y: 0, tx: 0, ty: 0, tr: 0, pitch: 0, yaw: 0,
    xNow: 0, yNow: 0, rNow: 0, pitchNow: 0, yawNow: 0, vx: 0, vy: 0, vr: 0, vpitch: 0, vyaw: 0 };
  let raf = 0, lastStamp = 0, layoutDirty = true, scrollDirty = true, pointerDirty = true;
  let heroVisible = false, headClock = 0, clickImpulses = [], modalOpen = false;
  const projectData = shells.map((shell, index) => ({ shell, card: shell.querySelector('.project-card'),
    target: Math.max(.90, 1 - (shells.length - 1 - index) * .025), top: 96 }));

  function requestFrame(options = {}) {
    if (options.layout) layoutDirty = true;
    if (options.scroll) scrollDirty = true;
    if (options.pointer) pointerDirty = true;
    if (!document.hidden && !raf) raf = requestAnimationFrame(tick);
  }

  // Real text remains real text: inline spans do not introduce replacement
  // copy, aria-hidden text or duplicate screen-reader paragraphs. Citation
  // paragraphs containing interactive descendants retain their original DOM.
  for (const paragraph of document.querySelectorAll('[data-character-reveal]')) {
    if (paragraph.querySelector('a,button,input,select,textarea,summary')) continue;
    const nodes = [], walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode);
    const chars = [];
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      const graphemes = typeof Intl.Segmenter === 'function'
        ? [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(node.textContent)].map(part => part.segment)
        : Array.from(node.textContent);
      for (const char of graphemes) {
        if (/^\s+$/.test(char)) { fragment.append(document.createTextNode(char)); continue; }
        const span = document.createElement('span'); span.className = 'char'; span.dataset.revealChar = ''; span.textContent = char;
        span.style.opacity = '1'; fragment.append(span); chars.push(span);
      }
      node.replaceWith(fragment);
    }
    if (chars.length) charParagraphs.push({ paragraph, chars });
  }

  function animateReveal(element) {
    if (seen.has(element)) return;
    seen.add(element);
    // A failed/cancelled animation always falls back to a visible element.
    element.style.opacity = '1'; element.style.visibility = 'visible';
    if (reduce.matches || typeof element.animate !== 'function') return;
    const ownsMotion = element === headMagnet || element === headFloat || element.matches('.project-card,.marquee-track');
    const from = { opacity: 0 }, to = { opacity: 1 };
    if (!ownsMotion) {
      from.translate = `${number(element.dataset.revealX)}px ${number(element.dataset.revealY, element.matches('.hero-nav') ? -20 : 30)}px`;
      to.translate = '0px 0px';
    }
    const heroDelay = element === headMagnet ? .6 : element.matches('.hero-name') ? .15
      : element.matches('.hero-intro') ? .35 : element.matches('.hero .gradient-button') ? .5 : 0;
    const delay = number(element.dataset.revealDelay, heroDelay) * 1000;
    const duration = Math.max(150, number(element.dataset.revealDuration, .7) * 1000);
    try {
      const animation = element.animate([from, to], { duration, delay, easing: 'cubic-bezier(.25,.1,.25,1)', fill: 'backwards' });
      revealAnimations.add(animation);
      const finish = () => revealAnimations.delete(animation);
      animation.onfinish = finish; animation.oncancel = finish;
    } catch (_) { /* Visible base styles are the complete fallback. */ }
  }
  let revealObserver = null;
  if ('IntersectionObserver' in window) {
    revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        revealQueue.add(entry.target); revealObserver.unobserve(entry.target);
      }
      requestFrame();
    }, { threshold: 0, rootMargin: '0px 0px 50px 0px' });
    reveals.forEach(element => revealObserver.observe(element));
  } else reveals.forEach(element => { element.style.opacity = '1'; element.style.visibility = 'visible'; seen.add(element); });

  function updatePageGeometry() {
    const vh = innerHeight;
    if (hero) { const rect = hero.getBoundingClientRect(); heroVisible = rect.bottom > 0 && rect.top < vh; }
    if (layoutDirty) {
      for (const item of projectData) if (item.card) {
        const style = getComputedStyle(item.shell); item.top = number(parseFloat(style.top), 96); item.sticky = style.position === 'sticky';
      }
    }
    if (marquee) {
      const rect = marquee.getBoundingClientRect();
      if (reduce.matches || (rect.bottom > 0 && rect.top < vh)) {
        const offset = reduce.matches ? 0 : (vh - rect.top) * .3 - 200;
        for (const track of tracks) {
          const direction = number(track.dataset.direction, 1) < 0 ? -1 : 1;
          track.style.transform = `translate3d(${(-840 + direction * offset).toFixed(3)}px,0,0)`;
        }
      }
    }
    for (const { paragraph, chars } of charParagraphs) {
      const rect = paragraph.getBoundingClientRect();
      const progress = reduce.matches ? 1 : clamp((vh * .8 - rect.top) / Math.max(1, rect.height + vh * .6));
      for (let i = 0; i < chars.length; i++) chars[i].style.opacity = (.2 + .8 * clamp(progress * chars.length - i)).toFixed(4);
    }
    // A sticky shell's visual rect stops at its top threshold. Derive each
    // shell's unpinned position from the shared list and preceding flow heights
    // so scale progress keeps advancing while the cards genuinely stack.
    const listTop = projectsList?.getBoundingClientRect().top ?? 0;
    let projectOffset = 0;
    for (const item of projectData) {
      // The drawer controller owns this stack's geometry and interpolation.
      if (item.shell.closest('#systems.project-showcase')?.dataset.switchReady === 'true') continue;
      const shellHeight = item.shell.offsetHeight, naturalTop = listTop + projectOffset;
      if (item.card) {
        const progress = reduce.matches || !item.sticky ? 0 : clamp((item.top - naturalTop) / Math.max(1, shellHeight));
        item.card.style.scale = (1 - (1 - item.target) * progress).toFixed(5);
        item.card.style.transformOrigin = '50% 0';
      }
      projectOffset += shellHeight;
    }
    layoutDirty = false; scrollDirty = false; pointerDirty = true;
  }
  function updatePointerTarget() { pointerDirty = false; }
  function updateHead() { return false; }
  function tick(stamp) {
    raf = 0;
    if (document.hidden) { lastStamp = 0; return; }
    const dt = lastStamp ? Math.min(.045, (stamp - lastStamp) / 1000) : 1 / 60;
    lastStamp = stamp;
    if (layoutDirty || scrollDirty) updatePageGeometry();
    if (pointerDirty) updatePointerTarget();
    for (const element of revealQueue) animateReveal(element);
    revealQueue.clear();
    if (updateHead(dt)) requestFrame(); else lastStamp = 0;
  }
  if (hero && headMagnet) {
    hero.addEventListener('pointermove', event => {
      pointer.inside = event.pointerType === 'mouse'; pointer.x = event.clientX; pointer.y = event.clientY;
      requestFrame({ pointer: true });
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { pointer.inside = false; requestFrame({ pointer: true }); }, { passive: true });
    headMagnet.addEventListener('click', () => {
      if (reduce.matches) return;
      clickImpulses.push(headClock); clickImpulses = clickImpulses.slice(-3); requestFrame();
    });
  }

  const dialogs = [...document.querySelectorAll('dialog')];
  function modalChanged() {
    modalOpen = dialogs.some(dialog => dialog.open); pointerDirty = true;
    document.body.classList.toggle('modal-open', modalOpen);
    requestFrame({ layout: true, scroll: true });
  }
  function showDialog(dialog) {
    if (!dialog) return false;
    try {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      }
      modalChanged(); return true;
    } catch (_) { return false; }
  }
  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    modalChanged();
  }
  for (const dialog of dialogs) {
    dialog.addEventListener('close', modalChanged); dialog.addEventListener('cancel', () => queueMicrotask(modalChanged));
    dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(dialog); });
  }

  const systemDialog = document.getElementById('system-dialog');
  const initialFrame = document.getElementById('system-frame');
  const systemTitle = document.getElementById('system-title');
  const systemNames = { quote: '核价系统', people: '人力系统', flow: '跟单系统', finance: '财务系统', production: '产值系统' };
  const frames = new Map(); let systemSources = null;
  try { systemSources = JSON.parse(document.getElementById('system-sources')?.textContent || 'null'); } catch (_) { /* Relative sources remain available. */ }
  function openSystem(key) {
    if (!Object.hasOwn(systemNames, key) || !systemDialog || !initialFrame) return false;
    let frame = frames.get(key);
    if (!frame) {
      frame = frames.size ? initialFrame.cloneNode(false) : initialFrame;
      if (frames.size) frame.id = `system-frame-${key}`;
      frame.removeAttribute('srcdoc'); frame.removeAttribute('src');
      frame.classList.add('system-frame'); frame.title = `${systemNames[key]}演示工作区`;
      Object.assign(frame.style, { width: '100%', flex: '1', minHeight: '0', border: '0', background: '#fff' });
      if (systemSources?.[key]) {
        try {
          frame.srcdoc = new TextDecoder('utf-8').decode(Uint8Array.from(atob(systemSources[key]), c => c.charCodeAt(0)));
        } catch (_) { frame.src = `systems/${key}.html`; }
      } else frame.src = `systems/${key}.html`;
      if (frame !== initialFrame) initialFrame.parentElement.append(frame);
      frames.set(key, frame);
    }
    frames.forEach((item, name) => { item.hidden = name !== key; item.style.display = name === key ? 'block' : 'none'; });
    if (systemTitle) systemTitle.textContent = systemNames[key];
    document.querySelectorAll('[data-switch-system]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.switchSystem === key)));
    return showDialog(systemDialog);
  }
  const imageDialog = document.getElementById('image-dialog');
  const largeImage = document.getElementById('large-image');
  const citationDialog = document.getElementById('citation-dialog');
  const citationContent = document.getElementById('citation-content');
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    if (!target) return;
    const open = target.closest('[data-open-system]');
    const change = target.closest('[data-switch-system]');
    if (open || change) { event.preventDefault(); openSystem(open?.dataset.openSystem || change.dataset.switchSystem); return; }
    if (target.closest('[data-close-system]')) { event.preventDefault(); closeDialog(systemDialog); return; }
    if (target.closest('[data-close-image]')) { event.preventDefault(); closeDialog(imageDialog); return; }
    if (target.closest('[data-close-citation]')) { event.preventDefault(); closeDialog(citationDialog); return; }
    const imageButton = target.closest('[data-open-image]');
    if (imageButton && largeImage) {
      const path = imageButton.dataset.openImage || imageButton.querySelector('img')?.getAttribute('src');
      if (path) {
        event.preventDefault(); largeImage.src = path;
        largeImage.alt = imageButton.dataset.imageAlt || imageButton.querySelector('img')?.alt || '系统界面'; showDialog(imageDialog);
      }
      return;
    }
    const citation = target.closest('a.citation[href^="#ref"]');
    if (!citation || !citationContent || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const id = citation.getAttribute('href').slice(1), source = document.getElementById(id);
    if (!source) return;
    const clone = source.cloneNode(true); clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    const list = document.createElement('ul'); list.className = 'citation-detail-list';
    Object.assign(list.style, { listStyle: 'none', padding: '0', margin: '0' }); list.append(clone);
    citationContent.replaceChildren(list);
    if (showDialog(citationDialog)) event.preventDefault();
  });

  function motionPreferenceChanged() {
    if (reduce.matches) {
      for (const animation of revealAnimations) animation.cancel();
      revealAnimations.clear(); clickImpulses = [];
      for (const element of reveals) { element.style.opacity = '1'; element.style.visibility = 'visible'; }
    }
    requestFrame({ layout: true, scroll: true, pointer: true });
  }
  reduce.addEventListener('change', motionPreferenceChanged);
  finePointer.addEventListener('change', () => requestFrame({ pointer: true }));
  addEventListener('scroll', () => requestFrame({ scroll: true }), { passive: true });
  addEventListener('resize', () => requestFrame({ layout: true, scroll: true, pointer: true }), { passive: true });
  addEventListener('hashchange', () => requestFrame({ scroll: true }));
  addEventListener('pageshow', () => requestFrame({ layout: true, scroll: true }));
  document.addEventListener('visibilitychange', () => {
    lastStamp = 0;
    if (document.hidden) {
      cancelAnimationFrame(raf); raf = 0;
      for (const animation of revealAnimations) if (animation.playState === 'running') { animation.pause(); animation.__pausedByPage = true; }
    } else {
      for (const animation of revealAnimations) if (animation.__pausedByPage && !reduce.matches) { animation.__pausedByPage = false; animation.play(); }
      requestFrame({ layout: true, scroll: true, pointer: true });
    }
  });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => requestFrame({ layout: true, scroll: true })) : null;
  [hero, marquee, ...shells].filter(Boolean).forEach(element => resizeObserver?.observe(element));
  if (document.fonts?.ready) document.fonts.ready.then(() => requestFrame({ layout: true, scroll: true }));
  window.WangYuJackSite = { refresh: () => requestFrame({ layout: true, scroll: true }), openSystem,
    getState: () => ({ reducedMotion: reduce.matches, headVisible: heroVisible, modalOpen, activeRevealAnimations: revealAnimations.size,
      characterParagraphs: charParagraphs.length, projects: projectData.length, cachedSystems: [...frames.keys()] }) };
  motionPreferenceChanged();
})();

/* Verified public reading copies complement, rather than replace, the
 * canonical bibliographic DOI. Citation cards clone these same references. */
(() => {
  'use strict';
  const entries = {
    'ref-bai2025': ['https://www.chinazy.org/info/1006/20473.htm', '期刊网站 · 完整正文', '中国职业技术教育'],
    'ref-nbs2026': ['https://www.stats.gov.cn/sj/zxfb/202604/t20260430_1963472.html', '国家统计局 · 完整报告', '2025年农民工监测调查报告'],
    'ref-chong2026': ['https://onlinelibrary.wiley.com/doi/epdf/10.1111/1748-8583.70012', '出版社 · 开放获取 PDF', 'Human Resource Management Journal, 36'],
    'ref-demerouti2001': ['https://www.wilmarschaufeli.nl/publications/Schaufeli/160.pdf', '作者官网 · 公开全文 PDF', 'Journal of Applied Psychology, 86'],
    'ref-feuerriegel2024': ['https://link.springer.com/content/pdf/10.1007/s12599-023-00834-7.pdf', '出版社 · 开放获取 PDF', 'Business & Information Systems Engineering, 66'],
    'ref-hse': ['https://www.hse.gov.uk/stress/assets/docs/indicatortoolmanual.pdf', 'HSE 官网 · 完整手册 PDF', 'HSE management standards indicator tool: User manual'],
    'ref-nonaka1994': ['https://www.lamsade.dauphine.fr/~giard/Organization_Science_Nonaka94.pdf', '大学网站 · 公开全文 PDF', 'Organization Science, 5'],
    'ref-oecd2025': ['https://www.oecd.org/content/dam/oecd/en/publications/reports/2025/11/generative-ai-and-the-sme-workforce_83bafdfb/2d08b99d-en.pdf', 'OECD 官网 · 完整报告 PDF', 'Generative AI and the SME workforce: New survey evidence'],
    'ref-parker2022': ['https://www.research-collection.ethz.ch/server/api/core/bitstreams/fba8b6bb-b760-432c-869d-7c5db78071c7/content', 'ETH 大学仓储 · 正式全文 PDF', 'Applied Psychology, 71'],
    'ref-rework2026': ['https://rework.withgoogle.com/intl/en/guides/employee-led-learning-principles-and-practice', 'Google re:Work · 完整指南', 'Employee-led learning: Principles and practice'],
    'ref-gibbs2024': ['https://reflection.ed.ac.uk/reflectors-toolkit/reflecting-on-experience/gibbs-reflective-cycle', '爱丁堡大学 · 完整正文', 'Gibbs’ reflective cycle']
  };

  function italicize(reference, phrase) {
    const walker = document.createTreeWalker(reference, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return !node.parentElement.closest('a, em, .reference-reading-access') && node.data.includes(phrase)
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    const node = walker.nextNode();
    if (!node) return;
    const start = node.data.indexOf(phrase);
    const match = node.splitText(start); match.splitText(phrase.length);
    const em = document.createElement('em'); match.replaceWith(em); em.append(match);
  }

  function install() {
    if (document.documentElement.dataset.referenceReadingAccess === 'ready') return;
    const style = document.createElement('style');
    style.id = 'reference-reading-access-style';
    style.textContent = `
      .reference-reading-access{display:flex;align-items:center;gap:12px 16px;flex-wrap:wrap;margin:14px 0 2px;text-indent:0;letter-spacing:.015em;font:400 13px/1.7 "PingFang SC","Microsoft YaHei",Arial,sans-serif}
      .reference-reading-access .reference-reading-source{display:inline;color:inherit;opacity:.78;font:inherit;letter-spacing:inherit}
      #references .reference-reading-access a.reference-reading-link,#citation-content .reference-reading-access a.reference-reading-link{display:inline-flex;align-items:center;justify-content:center;gap:15px;min-height:40px;padding:7px 17px;border:1px solid;border-radius:999px;font:500 14px/1.7 "PingFang SC","Microsoft YaHei",Arial,sans-serif;text-decoration:none;text-indent:0;letter-spacing:.025em;white-space:nowrap;overflow-wrap:normal}
      #references .reference-reading-access a.reference-reading-link{color:#fff0d7;background:#fff5df0b;border-color:#dec09a80}
      #references .reference-reading-access a.reference-reading-link:hover{background:#fff5df20;border-color:#ecd3b2}
      #citation-content .reference-reading-access a.reference-reading-link{color:#68462c;background:#fffaf2b3;border-color:#ad8b6599}
      #citation-content .reference-reading-access a.reference-reading-link:hover{background:#eadcc8a3;border-color:#98704a}
      .reference-reading-access .reference-reading-link:focus-visible{outline:2px solid currentColor;outline-offset:4px}
      .reference-reading-access .reference-reading-arrow{display:inline;font:inherit;font-size:17px;line-height:1}
      @media(max-width:767px){.reference-reading-access{gap:9px 12px;margin-top:12px;font-size:12px}#references .reference-reading-access a.reference-reading-link,#citation-content .reference-reading-access a.reference-reading-link{font-size:13px;min-height:38px;padding:7px 15px}}
      @media print{.reference-reading-access{margin-top:8px}#references .reference-reading-access a.reference-reading-link{color:inherit;background:none;border-color:currentColor}}
    `;
    document.head.append(style);
    let installed = 0;
    for (const [id, [url, label, italic]] of Object.entries(entries)) {
      const reference = document.getElementById(id);
      if (!reference || reference.querySelector('.reference-reading-access')) continue;
      italicize(reference, italic);
      const access = document.createElement('span'); access.className = 'reference-reading-access';
      const link = document.createElement('a'); link.className = 'reference-reading-link';
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', '阅读原文：' + label);
      link.append(document.createTextNode('阅读原文'));
      const arrow = document.createElement('span'); arrow.className = 'reference-reading-arrow';
      arrow.setAttribute('aria-hidden', 'true'); arrow.textContent = '↗'; link.append(arrow);
      const source = document.createElement('span'); source.className = 'reference-reading-source'; source.textContent = label;
      access.append(link, source); reference.append(access); installed++;
    }
    document.documentElement.dataset.referenceReadingAccess = 'ready';
    document.documentElement.dataset.referenceReadingCount = String(installed);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
