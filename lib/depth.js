// depth.js -- section banner, pointer light on cards. Pairs with depth.css.
// Loaded with defer on every page; everything here is decorative and fails silent.
(function () {
  'use strict';
  var SECTIONS = ['macro', 'markets', 'regional', 'supply', 'research', 'tools'];
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Section banner: one forged-metal render per section, right of the page title.
  function banner() {
    var seg = (location.pathname.split('/')[1] || '').toLowerCase();
    if (SECTIONS.indexOf(seg) < 0) return;
    var main = document.querySelector('main');
    if (!main || main.querySelector('.sf-banner')) return;
    var h1 = main.querySelector('h1:not(.sr-only)');
    if (!h1 || !h1.offsetHeight) return;
    var img = new Image();
    img.className = 'sf-banner';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.decoding = 'async';
    img.src = '/lib/img/sec-' + seg + '.webp';
    main.classList.add('sf-banner-host');
    // Fit the render to the title block: from just above the h1 to the end of the
    // text that follows it (dek, meta), so it never runs into the first card.
    var TEXT = /^(P|SPAN|SMALL)$/;
    var place = function () {
      var m = main.getBoundingClientRect(), h = h1.getBoundingClientRect();
      var bottom = h.bottom, el = h1.nextElementSibling;
      while (el && (TEXT.test(el.tagName) || /sf-(dek|meta|lede)|subtitle|lede|page-sub/.test(el.className || ''))) {
        bottom = Math.max(bottom, el.getBoundingClientRect().bottom); el = el.nextElementSibling;
      }
      var top = h.top - 34, ht = Math.max(120, Math.min(176, bottom - top + 14));
      img.style.top = Math.round(top - m.top) + 'px';
      img.style.height = Math.round(ht) + 'px';
    };
    main.insertBefore(img, main.firstChild);
    place();
    window.addEventListener('resize', place, { passive: true });
    window.setTimeout(place, 1200); // late content (verdict text) can push the title block
  }

  // ---- Pointer light: a soft spot that follows the cursor across the card under it.
  var CARD = '.sf-dial, .sf-card, .card, .panel, .cycle-tile, .opt-card, .watch-card, .insight-card, .pe-card, .tri-card, .signal-tile, .thesis-box, .sf-hub-card, a[class*="-card"]';
  var current = null;
  function glintOn(el) {
    if (current === el) return;
    if (current) current.classList.remove('sf-glint-on');
    current = el;
    if (!el) return;
    if (!el.querySelector(':scope > .sf-glint')) {
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var g = document.createElement('span');
      g.className = 'sf-glint';
      g.setAttribute('aria-hidden', 'true');
      el.insertBefore(g, el.firstChild);
    }
    el.classList.add('sf-glint-on');
  }
  function wireGlint() {
    if (reduce || !window.matchMedia('(hover: hover)').matches) return;
    document.addEventListener('pointermove', function (e) {
      var el = e.target.closest ? e.target.closest(CARD) : null;
      glintOn(el);
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
    document.addEventListener('pointerleave', function () { glintOn(null); });
  }

  function start() {
    wireGlint();
    // layout.js builds the header and wraps <main> on DOMContentLoaded; run after it.
    window.setTimeout(banner, 0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
