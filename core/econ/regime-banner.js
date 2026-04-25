// Compute the current macro regime and stamp a banner at the top of /core/econ/.
//
// Uses the same classifier and inputs as /core/macro/ — INDPRO + payrolls +
// real retail sales for growth, Core CPI for inflation, trailing 120-month
// z-window. Runs once at page load. The banner links to /core/macro/ for the
// full regime trajectory + sector-returns view.

import { buildRegimeMap, smoothCurrentRegime, REGIMES } from '/core/macro/regimes.js';

async function fetchRaw(id, start) {
  const res = await fetch(`/api/fred?series=${id}&start=${start}`);
  if (!res.ok) throw new Error(`FRED ${id} ${res.status}`);
  const j = await res.json();
  return j.series[0]?.observations || [];
}

export async function renderRegimeBanner(targetSelector = '.eyebrow') {
  const target = document.querySelector(targetSelector);
  if (!target) return;

  // Inject placeholder pill so page doesn't reflow when banner data loads.
  const banner = document.createElement('a');
  banner.className = 'regime-banner-pill loading';
  banner.href = '/core/macro/';
  banner.title = 'Open the macro dashboard for full trajectory + regime returns';
  banner.innerHTML = '<span class="rbp-label">Regime</span> <span class="rbp-name">loading…</span>';
  target.parentElement.insertBefore(banner, target.nextSibling);

  try {
    const start = `${new Date().getFullYear() - 40}-01-01`;
    const [cpi, indpro, payems, rrsfs] = await Promise.all([
      fetchRaw('CPILFESL', start),
      fetchRaw('INDPRO',   start),
      fetchRaw('PAYEMS',   start),
      fetchRaw('RRSFS',    start),
    ]);
    const regimeMap = buildRegimeMap({ cpi, indpro, payems, rrsfs });
    const smoothed = smoothCurrentRegime(regimeMap, 3);
    if (!smoothed) {
      banner.classList.remove('loading');
      banner.innerHTML = '<span class="rbp-label">Regime</span> <span class="rbp-name">unavailable</span>';
      return;
    }
    const meta = REGIMES[smoothed.regime];
    banner.classList.remove('loading');
    banner.style.setProperty('--rbp-color', meta.color);
    banner.innerHTML = `
      <span class="rbp-dot" style="background:${meta.color}"></span>
      <span class="rbp-label">Currently</span>
      <span class="rbp-name" style="color:${meta.color}">${meta.label}</span>
      <span class="rbp-arrow">→ open macro dashboard</span>
    `;
  } catch (err) {
    console.warn('regime banner fetch failed:', err);
    banner.classList.remove('loading');
    banner.innerHTML = '<span class="rbp-label">Regime</span> <span class="rbp-name">unavailable</span>';
  }
}

// Auto-init when imported as a module script.
renderRegimeBanner('.eyebrow').catch(e => console.warn(e));
