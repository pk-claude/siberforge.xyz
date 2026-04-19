// Drill-down controller — runs on indicator.html.
//
// URL form: ./indicator.html?id=GDPC1
//
// Flow:
//   1. Parse ?id= and resolve against INDICATORS registry.
//   2. Fetch full history from /api/fred (source=fred) OR fetch deps + compute (source=derived).
//   3. Apply the indicator's transform (same transforms as the dashboard cards).
//   4. Render uPlot chart with 1Y / 5Y / Max range toggle.
//   5. Populate metadata + methodology panels.
//   6. If hasVintages: fetch the series at 4 quarterly realtime_end snapshots,
//      render each as a faded overlay on the chart, and show a revision table.
//
// Transforms are inlined rather than imported from dashboard.js — dashboard.js
// is a controller, not a module. If transform logic grows, extract to
// ./transforms.js and import from both places.

import { INDICATORS, INDICATORS_BY_ID, CATEGORIES } from './indicators.js';

// Wide start — enough for "Max" range on monthly series. Daily series get
// capped by FRED's own history.
const HISTORY_START = '1980-01-01';

// How many vintage snapshots to pull for hasVintages series. Each call is a
// separate FRED fetch against /api/fred with realtime_end=.
// 4 snapshots at ~90-day spacing covers the last year of revisions — which is
// where ~all movement happens for GDP/NFP/Retail.
const VINTAGE_SNAPSHOTS = 4;
const VINTAGE_SPACING_DAYS = 90;

// ============================================================================
// DOM helpers
// ============================================================================
const $ = (id) => document.getElementById(id);

function setStatus(cls, text) {
  const dot = $('status-dot');
  if (dot) {
    dot.classList.remove('live', 'stale', 'error');
    if (cls) dot.classList.add(cls);
  }
  const t = $('status-text');
  if (t) t.textContent = text;
}

// ============================================================================
// Formatters (shared shape with dashboard.js)
// ============================================================================
function fmt(value, decimals = 1) {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtSigned(value, decimals = 1) {
  if (!Number.isFinite(value)) return '—';
  const s = fmt(Math.abs(value), decimals);
  return value >= 0 ? `+${s}` : `−${s}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(String(iso).trim());
  if (m) {
    const y = m[1];
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return `${months[mo - 1]} ${y}`;
  }
  return String(iso);
}

function fmtDateLong(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00Z');
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
  });
}

// ============================================================================
// Transforms (inlined — mirror of dashboard.js)
// ============================================================================
function transformLevel(obs)     { return obs.map(o => ({ date: o.date, value: o.value })); }
function transformLevelK(obs)    { return obs.map(o => ({ date: o.date, value: o.value / 1000 })); }
function transformLevelBps(obs)  { return obs.map(o => ({ date: o.date, value: o.value * 100 })); }
function transformLevelM(obs)    { return obs.map(o => ({ date: o.date, value: o.value / 1_000_000 })); }

function transformYoy(obs) {
  const dates = obs.map(o => new Date(o.date).getTime());
  const out = [];
  for (let i = 0; i < obs.length; i++) {
    const target = dates[i] - 365 * 24 * 3600 * 1000;
    let j = -1;
    for (let k = i - 1; k >= 0; k--) {
      if (dates[k] <= target) { j = k; break; }
    }
    if (j < 0) continue;
    const prior = obs[j].value;
    if (prior === 0 || !Number.isFinite(prior)) continue;
    const v = (obs[i].value / prior - 1) * 100;
    out.push({ date: obs[i].date, value: v });
  }
  return out;
}

function transformMomDiff(obs) {
  const out = [];
  for (let i = 1; i < obs.length; i++) {
    out.push({ date: obs[i].date, value: obs[i].value - obs[i - 1].value });
  }
  return out;
}

const TRANSFORMS = {
  'level':        transformLevel,
  'level_k':      transformLevelK,
  'level_bps':    transformLevelBps,
  'level_m':      transformLevelM,
  'yoy':          transformYoy,
  'mom_diff':     transformMomDiff,
  'mom_diff_k':   transformMomDiff,
};

function applyTransform(obs, transform) {
  const fn = TRANSFORMS[transform];
  if (!fn) {
    console.warn(`Unknown transform: ${transform}`);
    return obs;
  }
  return fn(obs);
}

// ============================================================================
// Data fetching
// ============================================================================
async function fetchFredSeries(fredId, { realtimeEnd } = {}) {
  const url = new URL('/api/fred', window.location.origin);
  url.searchParams.set('series', fredId);
  url.searchParams.set('start', HISTORY_START);
  if (realtimeEnd) {
    url.searchParams.set('realtime_start', realtimeEnd);
    url.searchParams.set('realtime_end', realtimeEnd);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`FRED ${fredId} HTTP ${res.status}`);
  const body = await res.json();
  const series = body.series?.[0];
  if (!series) throw new Error(`FRED ${fredId}: no series in response`);
  return series.observations || [];
}

// For derived indicators: fetch each dependency (transformed), return map.
async function fetchDerivedDependencies(ind) {
  const deps = ind.dependsOn || [];
  const depMap = {};
  await Promise.all(deps.map(async (depId) => {
    const depInd = INDICATORS_BY_ID[depId];
    if (!depInd) throw new Error(`dependsOn references unknown indicator ${depId}`);
    let obs;
    if (depInd.source === 'fred') {
      const raw = await fetchFredSeries(depInd.fredId);
      obs = applyTransform(raw, depInd.transform);
    } else {
      throw new Error(`derived → derived not supported (dep ${depId})`);
    }
    depMap[depId] = obs;
  }));
  return depMap;
}

// ============================================================================
// Range filtering
// ============================================================================
function sliceToRange(obs, range) {
  if (!obs.length || range === 'MAX') return obs;
  const lastDate = new Date(obs[obs.length - 1].date).getTime();
  const years = range === '1Y' ? 1 : range === '5Y' ? 5 : null;
  if (!years) return obs;
  const cutoff = lastDate - years * 365 * 24 * 3600 * 1000;
  return obs.filter(o => new Date(o.date).getTime() >= cutoff);
}

// ============================================================================
// uPlot rendering
// ============================================================================
let chartInstance = null;

// Convert observations ({date, value}) → uPlot-shaped [xs, ys] (xs are unix ms/1000).
function obsToUplotArrays(obs) {
  const xs = obs.map(o => Math.floor(new Date(o.date + 'T00:00:00Z').getTime() / 1000));
  const ys = obs.map(o => o.value);
  return [xs, ys];
}

// For vintages, align each vintage's x-axis onto the current series' x-axis.
// Each vintage may have a different endpoint / history.
function alignVintageToMaster(masterXs, vintageObs) {
  const map = new Map();
  for (const o of vintageObs) {
    const t = Math.floor(new Date(o.date + 'T00:00:00Z').getTime() / 1000);
    map.set(t, o.value);
  }
  return masterXs.map(t => {
    const v = map.get(t);
    return Number.isFinite(v) ? v : null;
  });
}

function buildUplotOpts(ind, range, hasVintages, vintageLabels = []) {
  const wrap = $('chart-wrap');
  const width = wrap.clientWidth || 800;
  const height = 360;

  const unitSuffix = ind.unit || '';
  const decimals = Number.isInteger(ind.decimals) ? ind.decimals : 1;

  // Series: [x, current, ...vintages]
  const series = [
    {},
    {
      label: 'Current',
      stroke: accentForCategory(ind.category),
      width: 2,
      points: { show: false },
      value: (u, v) => (v == null ? '—' : fmt(v, decimals) + unitSuffix),
    },
    ...vintageLabels.map((label, i) => ({
      label,
      // Faded palette for vintages — oldest-to-newest alpha ramp.
      stroke: `rgba(148, 163, 184, ${0.35 + i * 0.12})`,
      width: 1,
      dash: [3, 3],
      points: { show: false },
      value: (u, v) => (v == null ? '—' : fmt(v, decimals) + unitSuffix),
    })),
  ];

  return {
    width,
    height,
    title: '',
    scales: { x: { time: true } },
    axes: [
      {
        stroke: '#94a3b8',
        grid:  { stroke: 'rgba(148, 163, 184, 0.08)' },
        ticks: { stroke: 'rgba(148, 163, 184, 0.15)' },
      },
      {
        stroke: '#94a3b8',
        grid:  { stroke: 'rgba(148, 163, 184, 0.08)' },
        ticks: { stroke: 'rgba(148, 163, 184, 0.15)' },
        values: (u, splits) => splits.map(v => fmt(v, decimals) + unitSuffix),
      },
    ],
    cursor: {
      drag:  { x: true, y: false },
      focus: { prox: 16 },
    },
    legend: { show: false }, // we render our own below the chart
    series,
  };
}

function accentForCategory(cat) {
  return (CATEGORIES[cat] && CATEGORIES[cat].accent) || '#60a5fa';
}

function renderChart(ind, transformed, range, vintageSets = []) {
  const wrap = $('chart-wrap');
  const placeholder = $('chart-placeholder');
  if (placeholder) placeholder.remove();

  const sliced = sliceToRange(transformed, range);
  const [xs, ys] = obsToUplotArrays(sliced);

  // Build data matrix: [xs, current_ys, vintage1_ys, vintage2_ys, ...]
  const vintageRows = vintageSets.map(v => alignVintageToMaster(xs, v.observations));
  const data = [xs, ys, ...vintageRows];

  const opts = buildUplotOpts(ind, range, vintageSets.length > 0, vintageSets.map(v => v.label));

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (typeof uPlot === 'undefined') {
    wrap.innerHTML = '<div class="chart-error">Chart library failed to load.</div>';
    return;
  }

  chartInstance = new uPlot(opts, data, wrap);
  renderLegend(ind, vintageSets);
}

function renderLegend(ind, vintageSets) {
  const el = $('chart-legend');
  const items = [
    `<span class="legend-item"><span class="legend-swatch" style="background:${accentForCategory(ind.category)}"></span>Current</span>`,
    ...vintageSets.map((v, i) =>
      `<span class="legend-item vintage"><span class="legend-swatch dashed" style="background:rgba(148,163,184,${0.35 + i * 0.12})"></span>${v.label}</span>`
    ),
  ];
  el.innerHTML = items.join('');
}

// ============================================================================
// Metadata + methodology population
// ============================================================================
function populateHeader(ind, transformed) {
  const catMeta = CATEGORIES[ind.category] || { label: ind.category, accent: '#94a3b8' };
  $('crumb-category').textContent = catMeta.label;
  $('crumb-indicator').textContent = ind.shortLabel;
  $('drill-category-label').textContent = catMeta.label;
  $('drill-swatch').style.background = catMeta.accent;
  $('drill-title').textContent = ind.label;
  $('drill-context').textContent = ind.context || '';
  document.title = `${ind.shortLabel} — Siberforge`;

  if (!transformed.length) {
    $('drill-value').textContent = '—';
    $('drill-delta').textContent = 'No data';
    return;
  }

  const last = transformed[transformed.length - 1];
  const prev = transformed[transformed.length - 2];
  const decimals = Number.isInteger(ind.decimals) ? ind.decimals : 1;

  $('drill-value').textContent = fmt(last.value, decimals);
  $('drill-value-unit').textContent = ind.unit || '';
  $('drill-as-of').textContent = fmtDate(last.date);

  if (prev && Number.isFinite(prev.value)) {
    const delta = last.value - prev.value;
    const sentiment = sentimentOf(delta, ind.direction);
    const deltaEl = $('drill-delta');
    deltaEl.textContent = `${fmtSigned(delta, decimals)}${ind.unit || ''} vs prior`;
    deltaEl.classList.remove('up', 'down', 'neutral');
    deltaEl.classList.add(sentiment);
  } else {
    $('drill-delta').textContent = '';
  }
}

function sentimentOf(delta, direction) {
  if (!Number.isFinite(delta) || delta === 0) return 'neutral';
  if (direction === 'neutral' || direction === 'target_band') return 'neutral';
  if (direction === 'higher_better') return delta > 0 ? 'up' : 'down';
  if (direction === 'lower_better')  return delta > 0 ? 'down' : 'up';
  return 'neutral';
}

function populateMetadata(ind) {
  $('methodology-text').textContent = ind.methodology || '—';

  const fredUrl = ind.source === 'fred' && ind.fredId
    ? `https://fred.stlouisfed.org/series/${ind.fredId}`
    : null;

  const rows = [
    ['Source',       ind.source === 'fred' ? 'FRED (St. Louis Fed)' : 'Derived'],
    ['Series ID',    ind.fredId || (ind.dependsOn ? ind.dependsOn.join(' + ') : ind.id)],
    ['Category',     (CATEGORIES[ind.category] || {}).label || ind.category],
    ['Frequency',    (ind.freq || '').charAt(0).toUpperCase() + (ind.freq || '').slice(1)],
    ['Transform',    humanizeTransform(ind.transform)],
    ['Release',      ind.release || '—'],
    ['Direction',    humanizeDirection(ind.direction)],
  ];
  if (fredUrl) {
    rows.push(['FRED link', `<a href="${fredUrl}" target="_blank" rel="noopener">${ind.fredId}</a>`]);
  }

  const dl = $('metadata-grid');
  dl.innerHTML = rows.map(([k, v]) =>
    `<dt>${k}</dt><dd>${v == null ? '—' : v}</dd>`
  ).join('');
}

function humanizeTransform(t) {
  return {
    'level':      'Level (as reported)',
    'level_k':    'Level (thousands)',
    'level_m':    'Level (millions)',
    'level_bps':  'Level (basis points)',
    'yoy':        'Year-over-year % change',
    'mom_diff':   'Month-over-month diff',
    'mom_diff_k': 'Month-over-month diff (thousands)',
  }[t] || t || '—';
}

function humanizeDirection(d) {
  return {
    'higher_better': 'Higher is better',
    'lower_better':  'Lower is better',
    'target_band':   'Target band',
    'neutral':       'Directional — context dependent',
  }[d] || d || '—';
}

// ============================================================================
// Vintage logic (Phase 3 MVP)
// ============================================================================
function vintageDateStrings(snapshots, spacingDays) {
  // Start from today and step back. Return oldest → newest for rendering.
  const out = [];
  const now = Date.now();
  for (let i = snapshots; i >= 1; i--) {
    const t = now - i * spacingDays * 86400000;
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

async function fetchVintages(ind) {
  if (ind.source !== 'fred') return [];
  const dates = vintageDateStrings(VINTAGE_SNAPSHOTS, VINTAGE_SPACING_DAYS);
  const results = await Promise.allSettled(dates.map(async (d) => {
    const raw = await fetchFredSeries(ind.fredId, { realtimeEnd: d });
    const transformed = applyTransform(raw, ind.transform);
    return { label: `As of ${fmtDateLong(d)}`, date: d, observations: transformed };
  }));
  // Drop failed; return in oldest-first order so opacity ramps up through current.
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
}

function populateVintageTable(ind, current, vintages) {
  const section = $('vintage-section');
  const thead = $('vintage-thead');
  const tbody = $('vintage-tbody');
  if (!section || !thead || !tbody) return;

  // Take the most recent N periods of the current series.
  const N = 8;
  const recent = current.slice(-N);
  const decimals = Number.isInteger(ind.decimals) ? ind.decimals : 1;

  // Columns: observation date, each vintage, current
  const cols = [...vintages, { label: 'Current', observations: current }];
  const colHeader = cols.map(c => `<th>${c.label}</th>`).join('');
  thead.innerHTML = `<tr><th>Observation</th>${colHeader}</tr>`;

  const rows = recent.map(obs => {
    const cells = cols.map(col => {
      const match = col.observations.find(o => o.date === obs.date);
      const v = match ? match.value : null;
      return `<td>${v == null ? '—' : fmt(v, decimals) + (ind.unit || '')}</td>`;
    }).join('');
    return `<tr><td>${fmtDate(obs.date)}</td>${cells}</tr>`;
  }).join('');

  tbody.innerHTML = rows;
  section.hidden = false;
}

// ============================================================================
// Range toggle wiring
// ============================================================================
function wireRangeToggle(ind, transformed, vintageSets) {
  const buttons = document.querySelectorAll('.range-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => {
        b.classList.remove('active');
        b.removeAttribute('aria-selected');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      renderChart(ind, transformed, btn.dataset.range, vintageSets);
    });
  });
}

// ============================================================================
// Error page
// ============================================================================
function renderError(title, detail) {
  setStatus('error', title);
  $('drill-title').textContent = title;
  $('drill-context').textContent = detail || '';
  const wrap = $('chart-wrap');
  if (wrap) wrap.innerHTML = `<div class="chart-error">${detail || title}</div>`;
}

// ============================================================================
// Bootstrap
// ============================================================================
async function main() {
  const params = new URLSearchParams(window.location.search);
  const id = (params.get('id') || '').trim();

  if (!id) {
    renderError('No indicator selected', 'Append ?id=<INDICATOR_ID> to the URL or return to the dashboard.');
    return;
  }

  const ind = INDICATORS_BY_ID[id];
  if (!ind) {
    renderError(`Unknown indicator: ${id}`, 'This ID is not in the registry.');
    return;
  }

  // Paint metadata + methodology immediately from the registry — no waiting.
  populateMetadata(ind);
  // Placeholder header — gets overwritten once data arrives.
  $('drill-title').textContent = ind.label;
  $('drill-context').textContent = ind.context || '';
  $('crumb-indicator').textContent = ind.shortLabel;
  $('crumb-category').textContent = (CATEGORIES[ind.category] || {}).label || ind.category;
  $('drill-category-label').textContent = (CATEGORIES[ind.category] || {}).label || ind.category;
  $('drill-swatch').style.background = accentForCategory(ind.category);

  setStatus('stale', 'Loading…');

  // Fetch the primary series.
  let transformed;
  try {
    if (ind.source === 'fred') {
      const raw = await fetchFredSeries(ind.fredId);
      transformed = applyTransform(raw, ind.transform);
    } else if (ind.source === 'derived') {
      const depMap = await fetchDerivedDependencies(ind);
      transformed = ind.deriveFn(depMap) || [];
    } else {
      throw new Error(`Unsupported source: ${ind.source}`);
    }
  } catch (err) {
    console.error(err);
    renderError('Fetch failed', String(err.message || err));
    return;
  }

  if (!transformed.length) {
    renderError('No data', 'Series returned no transformable observations.');
    return;
  }

  populateHeader(ind, transformed);

  // Vintages, if applicable. We do this in parallel with the initial render —
  // the chart paints first, and we re-render with overlays when vintages arrive.
  let vintageSets = [];
  if (ind.hasVintages) {
    // Paint the base chart immediately at 5Y.
    renderChart(ind, transformed, '5Y', []);
    wireRangeToggle(ind, transformed, []);
    setStatus('stale', 'Loading vintages…');

    try {
      vintageSets = await fetchVintages(ind);
    } catch (err) {
      console.warn('Vintage fetch failed:', err);
      vintageSets = [];
    }

    // Re-wire with vintages included so range-toggle redraws with overlays.
    const activeRange = document.querySelector('.range-btn.active')?.dataset.range || '5Y';
    renderChart(ind, transformed, activeRange, vintageSets);
    wireRangeToggle(ind, transformed, vintageSets);

    if (vintageSets.length > 0) {
      populateVintageTable(ind, transformed, vintageSets);
    }
  } else {
    renderChart(ind, transformed, '5Y', []);
    wireRangeToggle(ind, transformed, []);
  }

  setStatus('live', 'Live');
}

// Re-draw chart on window resize (uPlot does not auto-resize).
let resizeTimer = null;
window.addEventListener('resize', () => {
  if (!chartInstance) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const wrap = $('chart-wrap');
    const w = wrap?.clientWidth;
    if (w && chartInstance) chartInstance.setSize({ width: w, height: 360 });
  }, 150);
});

main();
