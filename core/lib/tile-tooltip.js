// Tile-tooltip — global hover/click popup for the metric tiles on every
// deep-dive page. Auto-attaches via document-level event delegation. Any
// element with `data-tile-metric="<id>"` will surface the corresponding
// entry from metric-context on hover (desktop) or tap (mobile).
//
// Usage: include with
//   <script type="module" src="/core/lib/tile-tooltip.js"></script>
// and tag tiles with the data attribute.
//
// Modes:
//   - Hover (desktop): tooltip follows the cursor, dismisses on mouseout.
//     If you move the cursor INTO the tooltip itself, it pins so you can
//     click the source links.
//   - Click (any device): clicking a tile pins the popup; click outside or
//     press ESC to dismiss. Also fixes mobile/touch-only devices that have
//     no hover.

import { getMetricContext, CATALOG_AS_OF } from '/core/lib/metric-context.js';

(function () {
  // Build the popup element once.
  let popup = document.getElementById('tile-tooltip');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'tile-tooltip';
    popup.className = 'tile-tooltip';
    popup.style.display = 'none';
    document.body.appendChild(popup);
  }

  // State
  let pinned = false;        // user clicked, popup stays until dismissed
  let pointerInPopup = false; // cursor is over the popup (so links are usable)

  // Mobile detection — used to avoid double-firing of hover+tap.
  const supportsHover = window.matchMedia('(hover: hover)').matches;

  // Render the entry into HTML.
  function renderEntry(entry, opts = {}) {
    const linksHtml = (entry.links || []).map(l =>
      `<a class="tt-link" href="${l.url}" target="_blank" rel="noopener noreferrer">${l.label} &rarr;</a>`
    ).join('');
    const closeBtn = opts.pinned
      ? `<button class="tt-close" aria-label="Close">&times;</button>`
      : '';
    return `
      ${closeBtn}
      <div class="tt-title">${entry.label}</div>
      ${entry.unit ? `<div class="tt-unit">${entry.unit}</div>` : ''}
      <div class="tt-section"><span class="tt-key">What it measures</span>${entry.what}</div>
      <div class="tt-section"><span class="tt-key">Why it matters</span>${entry.why}</div>
      ${entry.context ? `<div class="tt-section tt-context"><span class="tt-key">Recent context</span>${entry.context}</div>` : ''}
      ${entry.thresholds ? `<div class="tt-section tt-thresholds"><span class="tt-key">Thresholds</span>${entry.thresholds}</div>` : ''}
      ${linksHtml ? `<div class="tt-links"><span class="tt-key">Sources &amp; further reading</span>${linksHtml}</div>` : ''}
      <div class="tt-asof">Context reviewed: ${CATALOG_AS_OF}</div>
      ${opts.pinned ? `<div class="tt-pin-hint">Click outside or press ESC to close</div>` : ''}
    `;
  }

  function position(e) {
    const PAD = 14;
    const w = popup.offsetWidth;
    const h = popup.offsetHeight;
    let x = (e.clientX != null ? e.clientX : window.innerWidth / 2) + PAD;
    let y = (e.clientY != null ? e.clientY : window.innerHeight / 2) + PAD;
    if (x + w + 8 > window.innerWidth)  x = e.clientX - w - PAD;
    if (y + h + 8 > window.innerHeight) y = e.clientY - h - PAD;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    popup.style.left = x + 'px';
    popup.style.top  = y + 'px';
  }

  // Pin/unpin logic
  function show(entry, e, opts = {}) {
    popup.innerHTML = renderEntry(entry, opts);
    popup.style.display = 'block';
    popup.classList.toggle('tt-pinned', !!opts.pinned);
    if (e) position(e);
  }
  function hide() {
    if (pinned) return; // never auto-hide a pinned popup
    popup.style.display = 'none';
  }
  function unpin() {
    pinned = false;
    popup.classList.remove('tt-pinned');
    popup.style.display = 'none';
  }

  // Allow links to be clicked while the popup is open.
  popup.addEventListener('mouseenter', () => { pointerInPopup = true; popup.style.pointerEvents = 'auto'; });
  popup.addEventListener('mouseleave', () => { pointerInPopup = false; if (!pinned) popup.style.display = 'none'; });

  // Close button (only present in pinned state).
  popup.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('tt-close')) {
      unpin();
    }
  });

  // ESC dismisses pinned tooltip.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pinned) unpin();
  });

  // Hover (desktop only).
  document.addEventListener('mouseover', (e) => {
    if (!supportsHover) return;
    if (pinned) return;
    const tile = e.target.closest('[data-tile-metric]');
    if (!tile) return;
    const id = tile.dataset.tileMetric;
    const entry = getMetricContext(id);
    if (!entry) return;
    show(entry, e, { pinned: false });
  });
  document.addEventListener('mousemove', (e) => {
    if (!supportsHover) return;
    if (pinned) return;
    if (popup.style.display !== 'block') return;
    if (pointerInPopup) return;
    const tile = e.target.closest('[data-tile-metric]');
    if (!tile) return;
    position(e);
  });
  document.addEventListener('mouseout', (e) => {
    if (!supportsHover) return;
    if (pinned) return;
    const tile = e.target.closest('[data-tile-metric]');
    if (!tile) return;
    const next = e.relatedTarget && e.relatedTarget.closest;
    if (next) {
      if (next.call(e.relatedTarget, '[data-tile-metric]')) return;
      if (next.call(e.relatedTarget, '#tile-tooltip')) return;
    }
    hide();
  });

  // Click — pins the popup. Works on touch (no hover) too.
  document.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-tile-metric]');
    // Click inside popup: don't dismiss.
    if (popup.contains(e.target)) return;
    if (tile) {
      // If clicking the same pinned tile, unpin.
      const id = tile.dataset.tileMetric;
      const entry = getMetricContext(id);
      if (!entry) return;
      // For anchors (e.g., outlier links), don't intercept — allow navigation.
      if (tile.tagName === 'A' && tile.getAttribute('href')) return;
      pinned = true;
      show(entry, e, { pinned: true });
      e.stopPropagation();
    } else if (pinned) {
      unpin();
    }
  });
})();
