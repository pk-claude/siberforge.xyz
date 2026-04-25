// Tile-tooltip — global hover popup for the metric tiles on every deep-dive
// page. Auto-attaches via document-level event delegation. Any element with
// `data-tile-metric="<id>"` will surface the corresponding entry from
// metric-context on hover.
//
// Usage: include with
//   <script type="module" src="/core/lib/tile-tooltip.js"></script>
// and tag tiles with the data attribute.

import { getMetricContext } from '/core/lib/metric-context.js';

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

  // Render the entry into HTML.
  function renderEntry(entry) {
    const linksHtml = (entry.links || []).map(l =>
      `<a class="tt-link" href="${l.url}" target="_blank" rel="noopener noreferrer">${l.label} &rarr;</a>`
    ).join('');
    return `
      <div class="tt-title">${entry.label}</div>
      ${entry.unit ? `<div class="tt-unit">${entry.unit}</div>` : ''}
      <div class="tt-section"><span class="tt-key">What it measures</span>${entry.what}</div>
      <div class="tt-section"><span class="tt-key">Why it matters</span>${entry.why}</div>
      ${entry.context ? `<div class="tt-section tt-context"><span class="tt-key">Recent context</span>${entry.context}</div>` : ''}
      ${entry.thresholds ? `<div class="tt-section tt-thresholds"><span class="tt-key">Thresholds</span>${entry.thresholds}</div>` : ''}
      ${linksHtml ? `<div class="tt-links"><span class="tt-key">Sources &amp; further reading</span>${linksHtml}</div>` : ''}
    `;
  }

  function position(e) {
    const PAD = 14;
    const w = popup.offsetWidth;
    const h = popup.offsetHeight;
    let x = e.clientX + PAD;
    let y = e.clientY + PAD;
    if (x + w + 8 > window.innerWidth)  x = e.clientX - w - PAD;
    if (y + h + 8 > window.innerHeight) y = e.clientY - h - PAD;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    popup.style.left = x + 'px';
    popup.style.top  = y + 'px';
  }

  // While the user hovers over the popup itself we keep it open so they
  // can click the source links.
  let pinnedToPopup = false;
  popup.addEventListener('mouseenter', () => { pinnedToPopup = true; popup.style.pointerEvents = 'auto'; });
  popup.addEventListener('mouseleave', () => { pinnedToPopup = false; popup.style.display = 'none'; });

  document.addEventListener('mouseover', (e) => {
    const tile = e.target.closest('[data-tile-metric]');
    if (!tile) return;
    const id = tile.dataset.tileMetric;
    const entry = getMetricContext(id);
    if (!entry) return;
    popup.innerHTML = renderEntry(entry);
    popup.style.display = 'block';
    position(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (popup.style.display !== 'block') return;
    if (pinnedToPopup) return;
    const tile = e.target.closest('[data-tile-metric]');
    if (!tile) return;
    position(e);
  });

  document.addEventListener('mouseout', (e) => {
    const tile = e.target.closest('[data-tile-metric]');
    if (!tile) return;
    const next = e.relatedTarget && e.relatedTarget.closest;
    if (next) {
      // Moving into another tile keeps the popup open (will be repositioned).
      if (next.call(e.relatedTarget, '[data-tile-metric]')) return;
      // Moving INTO the popup itself keeps it open.
      if (next.call(e.relatedTarget, '#tile-tooltip')) return;
    }
    if (!pinnedToPopup) popup.style.display = 'none';
  });
})();
