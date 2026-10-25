/* A static, font-matched stitch outline. Original HTML text remains untouched. */
(function () {
  'use strict';

  if (window.PortfolioEmbroidery) {
    window.PortfolioEmbroidery.refresh();
    return;
  }

  const NS = 'http://www.w3.org/2000/svg';
  const SELECTOR = '.mega-title, .footer-name';
  const OVERLAY_CLASS = 'embroidery-stitch-overlay';
  const records = new Map();
  let queued = 0;
  let started = false;
  let destroyed = false;
  let observer = null;

  const fontProperties = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch',
    'fontVariant', 'fontVariantLigatures', 'fontVariantNumeric', 'fontKerning',
    'fontFeatureSettings', 'fontVariationSettings', 'fontOpticalSizing',
    'letterSpacing', 'wordSpacing', 'lineHeight', 'textTransform', 'textRendering',
    'direction'
  ];

  const styleSheet = document.createElement('style');
  styleSheet.dataset.embroideryStitch = '';
  styleSheet.textContent = `
    .${OVERLAY_CLASS}, .${OVERLAY_CLASS} * {
      pointer-events:none !important;
      user-select:none !important;
      -webkit-user-select:none !important;
      -webkit-touch-callout:none;
    }
    @media print, (forced-colors:active), (prefers-contrast:more) {
      .${OVERLAY_CLASS} { display:none !important; }
    }
  `;

  function copyFont(source, target) {
    for (const property of fontProperties) {
      if (source[property]) target.style[property] = source[property];
    }
  }

  function restorePosition(element, record) {
    if (!record.ownsPosition || element.style.position !== 'relative') return;
    if (record.previousPosition) {
      element.style.setProperty('position', record.previousPosition, record.previousPriority);
    } else {
      element.style.removeProperty('position');
    }
    record.ownsPosition = false;
  }

  function clear(element, restore) {
    const record = records.get(element);
    if (!record) return;
    if (record.svg) record.svg.remove();
    record.svg = null;
    if (restore) restorePosition(element, record);
  }

  // Only original text nodes are measured. No spans are inserted into the title,
  // and the decorative SVG is excluded on subsequent refreshes.
  function originalRange(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest('.' + OVERLAY_CLASS)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    if (!nodes.length) return null;
    const range = document.createRange();
    range.setStart(nodes[0], 0);
    range.setEnd(nodes[nodes.length - 1], nodes[nodes.length - 1].length);
    return { range, text: nodes.map(node => node.nodeValue).join('') };
  }

  function baselineFor(style, text) {
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;left:-20000px;top:0;display:inline-block;visibility:hidden;pointer-events:none;white-space:pre;width:max-content;max-width:none;padding:0;border:0;margin:0;transform:none;filter:none;';
    copyFont(style, probe);
    probe.appendChild(document.createTextNode(text));
    const marker = document.createElement('span');
    marker.style.cssText = 'display:inline-block;vertical-align:baseline;width:0;height:0;margin:0;padding:0;border:0;';
    probe.appendChild(marker);
    document.body.appendChild(probe);
    try {
      return marker.getBoundingClientRect().top - probe.getBoundingClientRect().top;
    } finally {
      probe.remove();
    }
  }

  function measure(element) {
    clear(element, false);
    let record = records.get(element);
    if (!record) {
      record = { svg:null, ownsPosition:false, previousPosition:'', previousPriority:'' };
      records.set(element, record);
      if (observer) observer.observe(element);
    }

    const original = originalRange(element);
    const style = getComputedStyle(element);
    const fontSize = parseFloat(style.fontSize) || 0;
    if (!original || fontSize < 40 || style.display === 'none' ||
        style.writingMode !== 'horizontal-tb' ||
        /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(original.text)) {
      restorePosition(element, record);
      return;
    }

    const rect = element.getBoundingClientRect();
    const width = element.clientWidth || rect.width;
    const height = element.clientHeight || rect.height;
    const textRects = Array.from(original.range.getClientRects()).filter(box => box.width > 0 && box.height > 0);
    if (!width || !height || !textRects.length) {
      restorePosition(element, record);
      return;
    }

    // Wrapped titles keep their existing design and receive no overlay.
    const firstTop = textRects[0].top;
    const tolerance = Math.max(1, fontSize * 0.06);
    if (textRects.some(box => Math.abs(box.top - firstTop) > tolerance)) {
      restorePosition(element, record);
      return;
    }

    if (style.position === 'static') {
      record.previousPosition = element.style.getPropertyValue('position');
      record.previousPriority = element.style.getPropertyPriority('position');
      element.style.position = 'relative';
      record.ownsPosition = true;
    }

    const scaleX = element.offsetWidth ? rect.width / element.offsetWidth : 1;
    const textRect = original.range.getBoundingClientRect();
    const x = (textRect.left - rect.left) / (scaleX || 1) - element.clientLeft;
    const y = (parseFloat(style.paddingTop) || 0) + baselineFor(style, original.text);
    const svg = document.createElementNS(NS, 'svg');
    svg.classList.add(OVERLAY_CLASS);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('role', 'presentation');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('tabindex', '-1');
    svg.setAttribute('unselectable', 'on');
    svg.style.cssText = 'position:absolute;left:0;top:0;display:block;width:100%;height:100%;overflow:visible;pointer-events:none;user-select:none;-webkit-user-select:none;';

    const outline = document.createElementNS(NS, 'text');
    copyFont(style, outline);
    outline.textContent = original.text;
    outline.setAttribute('x', String(x));
    outline.setAttribute('y', String(y));
    outline.setAttribute('text-anchor', 'start');
    outline.setAttribute('dominant-baseline', 'alphabetic');
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', '#f0d8b3');
    outline.setAttribute('stroke-opacity', '0.32');
    outline.setAttribute('stroke-width', String(Math.min(1.2, Math.max(0.8, fontSize / 150))));
    outline.setAttribute('stroke-dasharray', '1.4 3.5');
    outline.setAttribute('stroke-linecap', 'round');
    outline.setAttribute('stroke-linejoin', 'round');
    outline.setAttribute('paint-order', 'stroke');
    outline.setAttribute('xml:space', 'preserve');
    outline.style.fill = 'none';
    outline.style.whiteSpace = 'pre';
    outline.style.webkitTextFillColor = 'transparent';
    outline.style.webkitTextStroke = '0';
    svg.appendChild(outline);
    element.appendChild(svg);
    record.svg = svg;
  }

  function rebuild() {
    queued = 0;
    if (destroyed) return;
    for (const [element] of records) {
      if (!element.isConnected || !element.matches(SELECTOR)) {
        clear(element, true);
        if (observer) observer.unobserve(element);
        records.delete(element);
      }
    }
    for (const element of document.querySelectorAll(SELECTOR)) measure(element);
  }

  function refresh() {
    if (destroyed || !started || queued) return;
    // One coalesced measurement per change, never a running animation loop.
    queued = window.requestAnimationFrame(rebuild);
  }

  function start() {
    if (started || destroyed) return;
    started = true;
    document.head.appendChild(styleSheet);
    if (typeof ResizeObserver === 'function') observer = new ResizeObserver(refresh);
    window.addEventListener('resize', refresh, {passive:true});
    if (document.fonts) {
      document.fonts.ready.then(refresh, refresh);
      document.fonts.addEventListener?.('loadingdone', refresh);
    } else {
      refresh();
    }
  }

  function destroy() {
    destroyed = true;
    if (queued) window.cancelAnimationFrame(queued);
    queued = 0;
    observer?.disconnect();
    window.removeEventListener('resize', refresh);
    document.removeEventListener('DOMContentLoaded', start);
    document.fonts?.removeEventListener?.('loadingdone', refresh);
    for (const [element] of records) clear(element, true);
    records.clear();
    styleSheet.remove();
  }

  window.PortfolioEmbroidery = Object.freeze({refresh, destroy});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
