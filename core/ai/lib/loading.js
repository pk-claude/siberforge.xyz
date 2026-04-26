// /core/ai/lib/loading.js
// Shared loading-state helpers for AI Beneficiaries pages.
// Surface progress via the top-right status indicator and per-chart overlays
// so pages don't look frozen while live API fetches are in flight.

let _stylesInjected = false;

export function injectLoadingStyles() {
  if (_stylesInjected) return;
  if (document.getElementById('ai-loading-styles')) { _stylesInjected = true; return; }
  const s = document.createElement('style');
  s.id = 'ai-loading-styles';
  s.textContent = '.dot.busy{background:#f7a700;animation:ai-loading-pulse 1.1s ease-in-out infinite}@keyframes ai-loading-pulse{0%,100%{opacity:1}50%{opacity:.3}}.chart-loading-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;color:#9aa0a6;pointer-events:none;z-index:5}.chart-loading-overlay::before{content:"";width:10px;height:10px;border-radius:50%;background:#f7a700;animation:ai-loading-pulse 1.1s ease-in-out infinite}';
  document.head.appendChild(s);
  _stylesInjected = true;
}

/**
 * Update the top-right page status indicator. Pass busy=true to add the
 * pulsing-amber dot styling.
 */
export function setStatus(text, busy) {
  const t = document.getElementById('refresh-text');
  const d = document.getElementById('refresh-indicator');
  if (t) t.textContent = text;
  if (d) d.classList.toggle('busy', !!busy);
}

/**
 * Overlay a "Loading..." message on top of an element by ID. Works for both
 * <canvas> (chart) and <div> (sankey, basket grid) targets — we attach the
 * overlay to the element itself or its parent if it's a canvas.
 */
export function showLoading(targetId, text) {
  const el = document.getElementById(targetId);
  if (!el) return;
  // For canvases, attach to parent wrap; for divs, attach to the element itself.
  const host = el.tagName === 'CANVAS' ? el.parentElement : el;
  if (!host) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  let overlay = host.querySelector(':scope > .chart-loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'chart-loading-overlay';
    host.appendChild(overlay);
  }
  // Replace text content idempotently
  overlay.textContent = '';
  overlay.appendChild(document.createTextNode(text || 'Loading...'));
}

export function hideLoading(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const host = el.tagName === 'CANVAS' ? el.parentElement : el;
  if (!host) return;
  const overlay = host.querySelector(':scope > .chart-loading-overlay');
  if (overlay) overlay.remove();
}

/**
 * Convenience: wrap a render function with show/hide. Returns a function
 * with the same signature that auto-manages the overlay.
 */
export function withLoading(targetId, renderFn, loadingText) {
  return async function (...args) {
    showLoading(targetId, loadingText);
    try {
      return await renderFn.apply(this, args);
    } finally {
      hideLoading(targetId);
    }
  };
}
