// Comparison view controller.
//
// Responsibilities:
//   1. Parse ?a and ?b indicator IDs from the URL, with sensible defaults.
//   2. Populate A/B dropdowns with the full INDICATORS registry.
//   3. Fetch both series (full history), apply each indicator's transform.
//   4. Render an overlay uPlot chart with dual axes (levels mode) OR a single
//      axis with z-score-normalized values (zscore mode).
//   5. Align the two series by date and compute a 60-observation rolling
//      Pearson correlation, rendered in a secondary uPlot chart below.
//   6. Wire the range / mode / swap / copy-link controls.
//
// Transforms, FRED fetch, and chart helpers come from core/lib/ now.

import { INDICATORS, INDICATORS_BY_ID, CATEGORIES } from './indicators.js';
import { applyTransform } from '../lib/transforms.js';
import { fetchFredObs } from '../lib/fred-client.js';
import { dateToTs, obsToXs, DARK_AXIS_BASE } from '../lib/charts.js';

const HISTORY_START = '1980-01-01';
const CORR_WINDOW = 60; // rolling correlation window in aligned observations

// Defaults when ?a= / ?b= are absent. CPI vs UNRATE is a canonical macro pair.
const DEFAULT_A = 'CPILFESL';
const DEFAULT_B = 'UNRATE';

// Distinct colors for A and B — finance-ish red/blue so they're easy to tell apart.
const COLOR_A = '#5a9cff'; // blue
const COLOR_B = '#f7a700'; // amber (matches accent)
const COLOR_CORR = '#3ecf8e'; // green when positive, red when negative — rendered via fill

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
// Formatters
// ============================================================================
function fmt(v, d = 2) {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ============================================================================
// Fetching
// ============================================================================
async function fetchIndicatorSeries(ind) {
  if (ind.source === 'fred') {
    const raw = await fetchFredObs(ind.fredId, { start: HISTORY_START });
    return applyTransform(raw, ind.transform);
  }
  if (ind.source === 'derived') {
    // Fetch + transform each dependency, then run deriveFn.
    const depMap = {};
    await Promise.all((ind.dependsOn || []).map(async (dep) => {
      const depInd = INDICATORS_BY_ID[dep];
      if (!depInd) throw new Error(`missing dep ${dep}`);
      const raw = await fetchFredObs(depInd.fredId, { start: HISTORY_START });
      depMap[dep] = applyTransform(raw, depInd.transform);
    }));
    return ind.deriveFn(depMap) || [];
  }
  throw new Error(`Unsupported source: ${ind.source}`);
}

// ============================================================================
// Alignment (for rolling correlation)
// ============================================================================
// Align series B to series A's dates by taking the most recent B observation
// on-or-before each A date ("forward-fill" / as-of join).
// Returns array of { date, a, b } tuples.
function alignByForwardFill(seriesA, seriesB) {
  if (!seriesA.length || !seriesB.length) return [];

  // Ensure B is sorted ascending (FRED returns ascending by default).
  const bDates = seriesB.map(o => new Date(o.date).getTime());

  // Picking the lower-frequency series as the "driver" (typically monthly
  // vs daily) keeps the output a manageable size. Default: use A as driver.
  // If B is lower frequency, caller should swap.
  const out = [];
  let j = 0; // pointer into B

  for (const pointA of seriesA) {
    const tA = new Date(pointA.date).getTime();

    // Advance j while B[j+1] <= tA (keep the latest B <= tA)
    while (j + 1 < bDates.length && bDates[j + 1] <= tA) j++;

    if (bDates[j] > tA) continue; // no B observation <= this A date yet

    out.push({ date: pointA.date, a: pointA.value, b: seriesB[j].value });
  }
  return out;
}

// Heuristic: pick the lower-frequency (fewer observations over same span) as
// the driver. This keeps alignment sane when comparing e.g. daily rates to
// quarterly GDP.
function pickDriver(a, b) {
  return a.length <= b.length ? { driver: a, other: b, swapped: false }
                              : { driver: b, other: a, swapped: true };
}

function alignedPairs(seriesA, seriesB) {
  const { driver, other, swapped } = pickDriver(seriesA, seriesB);
  const aligned = alignByForwardFill(driver, other);
  if (!swapped) return aligned; // driver was A, so {a, b} already correct
  // driver was B, so each row is { date, a: bValue, b: aValue } — swap back.
  return aligned.map(r => ({ date: r.date, a: r.b, b: r.a }));
}

// ============================================================================
// Rolling correlation
// ============================================================================
// Pearson correlation over a sliding window of length `w` over the aligned
// series. Returns array of { date, corr } where `date` is the window's right edge.
function rollingCorrelation(aligned, w) {
  const out = [];
  if (aligned.length < w) return out;

  // Precompute cumulative sums for mean/variance O(1) per step.
  // Simpler (and fast enough at N~5k): recompute each window.
  for (let i = w - 1; i < aligned.length; i++) {
    const slice = aligned.slice(i - w + 1, i + 1);
    const c = pearson(slice.map(r => r.a), slice.map(r => r.b));
    out.push({ date: aligned[i].date, corr: c });
  }
  return out;
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return NaN;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / n;
  const my = sy / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    cov += dx * dy;
    vx  += dx * dx;
    vy  += dy * dy;
  }
  if (vx === 0 || vy === 0) return NaN;
  return cov / Math.sqrt(vx * vy);
}

// ============================================================================
// Z-score normalization
// ============================================================================
function zscoreSeries(obs) {
  if (obs.length === 0) return obs;
  const vals = obs.map(o => o.value);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / vals.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return obs.map(o => ({ date: o.date, value: 0 }));
  return obs.map(o => ({ date: o.date, value: (o.value - mean) / sd }));
}

// ============================================================================
// Range slicing
// ============================================================================
function sliceToRange(obs, range) {
  if (!obs.length || range === 'MAX') return obs;
  const last = new Date(obs[obs.length - 1].date).getTime();
  const years = range === '1Y' ? 1 : range === '5Y' ? 5 : null;
  if (!years) return obs;
  const cutoff = last - years * 365 * 24 * 3600 * 1000;
  return obs.filter(o => new Date(o.date).getTime() >= cutoff);
}

// ============================================================================
// Chart rendering
// ============================================================================
let overlayChart = null;
let corrChart = null;

// obsToXs / dateToTs come from core/lib/charts.js.

// Build a merged x-axis that is the union of A and B dates (sorted, de-duped).
// Then for each merged x, find y-A and y-B (or null if missing on that date).
function mergeForOverlay(obsA, obsB) {
  const mapA = new Map();
  const mapB = new Map();
  for (const o of obsA) mapA.set(o.date, o.value);
  for (const o of obsB) mapB.set(o.date, o.value);
  const allDates = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();
  const xs = allDates.map(dateToTs);
  const ysA = allDates.map(d => mapA.has(d) ? mapA.get(d) : null);
  const ysB = allDates.map(d => mapB.has(d) ? mapB.get(d) : null);
  return { xs, ysA, ysB };
}

function renderOverlay(indA, indB, obsA, obsB, range, mode) {
  const slicedA = sliceToRange(obsA, range);
  const slicedB = sliceToRange(obsB, range);

  let plotA = slicedA, plotB = slicedB;
  if (mode === 'zscore') {
    plotA = zscoreSeries(slicedA);
    plotB = zscoreSeries(slicedB);
  }

  const { xs, ysA, ysB } = mergeForOverlay(plotA, plotB);
  const wrap = $('overlay-chart');
  wrap.querySelector('.chart-placeholder')?.remove();

  const width = wrap.clientWidth || 800;
  const height = 380;

  const unitA = mode === 'zscore' ? 'σ' : (indA.unit || '');
  const unitB = mode === 'zscore' ? 'σ' : (indB.unit || '');
  const decA = Number.isInteger(indA.decimals) ? indA.decimals : 2;
  const decB = Number.isInteger(indB.decimals) ? indB.decimals : 2;

  // In z-score mode: single shared Y axis. In levels: dual axis (A=left, B=right).
  const axes = mode === 'zscore'
    ? [
        { ...DARK_AXIS_BASE },
        { ...DARK_AXIS_BASE,
          values: (u, splits) => splits.map(v => fmt(v, 2) + 'σ') },
      ]
    : [
        { ...DARK_AXIS_BASE },
        { ...DARK_AXIS_BASE,
          stroke: COLOR_A,
          values: (u, splits) => splits.map(v => fmt(v, decA) + unitA) },
        { ...DARK_AXIS_BASE,
          stroke: COLOR_B,
          grid: { show: false },
          side: 1, scale: 'y2',
          values: (u, splits) => splits.map(v => fmt(v, decB) + unitB) },
      ];

  const series = [
    {},
    {
      label: indA.shortLabel,
      stroke: COLOR_A,
      width: 2,
      points: { show: false },
      value: (u, v) => (v == null ? '—' : fmt(v, decA) + unitA),
    },
    {
      label: indB.shortLabel,
      stroke: COLOR_B,
      width: 2,
      points: { show: false },
      scale: mode === 'zscore' ? 'y' : 'y2',
      value: (u, v) => (v == null ? '—' : fmt(v, decB) + unitB),
    },
  ];

  const opts = {
    width, height, title: '',
    scales: mode === 'zscore'
      ? { x: { time: true }, y: {} }
      : { x: { time: true }, y: {}, y2: {} },
    axes,
    cursor: { drag: { x: true, y: false }, focus: { prox: 16 } },
    legend: { show: false },
    series,
  };

  if (overlayChart) { overlayChart.destroy(); overlayChart = null; }
  if (typeof uPlot === 'undefined') {
    wrap.innerHTML = '<div class="chart-error">Chart library failed to load.</div>';
    return;
  }
  overlayChart = new uPlot(opts, [xs, ysA, ysB], wrap);

  renderOverlayLegend(indA, indB, mode);
}

// axisCommonX() removed — use `{ ...DARK_AXIS_BASE }` directly.

function renderOverlayLegend(indA, indB, mode) {
  const el = $('overlay-legend');
  const modeNote = mode === 'zscore'
    ? '<span class="legend-note">Both series z-scored (mean 0, sd 1) over visible range.</span>'
    : '<span class="legend-note">Levels — A on left axis, B on right axis.</span>';
  el.innerHTML = `
    <span class="legend-item">
      <span class="legend-swatch" style="background:${COLOR_A}"></span>
      ${indA.label}
    </span>
    <span class="legend-item">
      <span class="legend-swatch" style="background:${COLOR_B}"></span>
      ${indB.label}
    </span>
    ${modeNote}
  `;
}

// ---------------------- Correlation chart ----------------------
function renderCorrelation(obsA, obsB, range) {
  // Correlation uses transformed values, sliced to the same visible range as
  // the overlay chart. Alignment uses the full sliced series, then rolling.
  const slicedA = sliceToRange(obsA, range);
  const slicedB = sliceToRange(obsB, range);
  const aligned = alignedPairs(slicedA, slicedB);
  const corrObs = rollingCorrelation(aligned, CORR_WINDOW);

  const wrap = $('corr-chart');
  wrap.querySelector('.chart-placeholder')?.remove();
  const meta = $('corr-meta');

  if (corrObs.length === 0) {
    wrap.innerHTML = `<div class="chart-error">Not enough aligned observations for a ${CORR_WINDOW}-period window (${aligned.length} aligned pairs).</div>`;
    if (corrChart) { corrChart.destroy(); corrChart = null; }
    meta.textContent = `${aligned.length} aligned pairs · window ${CORR_WINDOW}`;
    return;
  }

  const width = wrap.clientWidth || 800;
  const height = 180;
  const xs = corrObs.map(o => dateToTs(o.date));
  const ys = corrObs.map(o => Number.isFinite(o.corr) ? o.corr : null);
  const latest = ys[ys.length - 1];

  const opts = {
    width, height, title: '',
    scales: { x: { time: true }, y: { range: [-1, 1] } },
    axes: [
      { ...DARK_AXIS_BASE },
      { ...DARK_AXIS_BASE,
        values: (u, splits) => splits.map(v => fmt(v, 2)),
      },
    ],
    cursor: { drag: { x: true, y: false }, focus: { prox: 16 } },
    legend: { show: false },
    hooks: {
      // Draw zero line horizontally at y=0 for reference.
      draw: [
        (u) => {
          const ctx = u.ctx;
          const y0 = u.valToPos(0, 'y', true);
          ctx.save();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(u.bbox.left, y0);
          ctx.lineTo(u.bbox.left + u.bbox.width, y0);
          ctx.stroke();
          ctx.restore();
        },
      ],
    },
    series: [
      {},
      {
        label: 'corr',
        stroke: COLOR_CORR,
        width: 1.5,
        points: { show: false },
        value: (u, v) => (v == null ? '—' : fmt(v, 2)),
      },
    ],
  };

  if (corrChart) { corrChart.destroy(); corrChart = null; }
  if (typeof uPlot === 'undefined') return;
  corrChart = new uPlot(opts, [xs, ys], wrap);

  const latestStr = Number.isFinite(latest) ? fmt(latest, 2) : '—';
  meta.textContent = `${aligned.length} aligned pairs · ${CORR_WINDOW}-obs window · latest ρ = ${latestStr}`;
}

// ============================================================================
// Pickers + metadata
// ============================================================================
function populateSelects(selectedA, selectedB) {
  const selA = $('select-a');
  const selB = $('select-b');
  selA.innerHTML = '';
  selB.innerHTML = '';

  // Group by category for easier scanning.
  const byCat = {};
  for (const ind of INDICATORS) {
    if (ind.placeholder) continue;
    (byCat[ind.category] ||= []).push(ind);
  }

  for (const [cat, inds] of Object.entries(byCat)) {
    const catLabel = (CATEGORIES[cat] || {}).label || cat;
    const groupA = document.createElement('optgroup');
    const groupB = document.createElement('optgroup');
    groupA.label = catLabel;
    groupB.label = catLabel;
    for (const ind of inds) {
      const optA = new Option(ind.label, ind.id, false, ind.id === selectedA);
      const optB = new Option(ind.label, ind.id, false, ind.id === selectedB);
      groupA.appendChild(optA);
      groupB.appendChild(optB);
    }
    selA.appendChild(groupA);
    selB.appendChild(groupB);
  }
}

function renderMetadataPanel(side, ind) {
  const titleEl = $(`meta-${side}-title`);
  const gridEl = $(`meta-${side}-grid`);
  const ctxEl = $(`meta-${side}-context`);

  titleEl.textContent = ind.label;

  const fredUrl = ind.source === 'fred' && ind.fredId
    ? `<a href="https://fred.stlouisfed.org/series/${ind.fredId}" target="_blank" rel="noopener">${ind.fredId}</a>`
    : (ind.dependsOn ? ind.dependsOn.join(' + ') : ind.id);

  const rows = [
    ['Category',  (CATEGORIES[ind.category] || {}).label || ind.category],
    ['Series',    fredUrl],
    ['Frequency', (ind.freq || '').charAt(0).toUpperCase() + (ind.freq || '').slice(1)],
    ['Transform', humanizeTransform(ind.transform)],
    ['Release',   ind.release || '—'],
  ];
  gridEl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v == null ? '—' : v}</dd>`).join('');
  ctxEl.textContent = ind.context || '';
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

// ============================================================================
// State + rendering
// ============================================================================
const state = {
  indA: null,
  indB: null,
  obsA: null,
  obsB: null,
  range: '5Y',
  mode: 'levels',
};

async function loadPair(aId, bId) {
  state.indA = INDICATORS_BY_ID[aId];
  state.indB = INDICATORS_BY_ID[bId];
  if (!state.indA || !state.indB) {
    setStatus('error', 'Unknown indicator(s) in URL');
    return;
  }

  renderMetadataPanel('a', state.indA);
  renderMetadataPanel('b', state.indB);

  setStatus('stale', 'Loading series…');
  try {
    const [obsA, obsB] = await Promise.all([
      fetchIndicatorSeries(state.indA),
      fetchIndicatorSeries(state.indB),
    ]);
    state.obsA = obsA;
    state.obsB = obsB;
  } catch (err) {
    console.error(err);
    setStatus('error', `Fetch failed: ${err.message || err}`);
    return;
  }

  if (!state.obsA.length || !state.obsB.length) {
    setStatus('error', 'One or both series returned empty');
    return;
  }

  rerender();
  updateShareLink();
  setStatus('live', 'Live');
}

function rerender() {
  if (!state.obsA || !state.obsB) return;
  renderOverlay(state.indA, state.indB, state.obsA, state.obsB, state.range, state.mode);
  renderCorrelation(state.obsA, state.obsB, state.range);
}

function updateShareLink() {
  const a = state.indA?.id;
  const b = state.indB?.id;
  if (!a || !b) return;
  const url = new URL(window.location.href);
  url.searchParams.set('a', a);
  url.searchParams.set('b', b);
  // Don't reload — just update the address bar so copy-url captures current pair.
  window.history.replaceState({}, '', url.toString());
  $('share-link').href = url.toString();
}

// ============================================================================
// Wiring
// ============================================================================
function wireControls() {
  const selA = $('select-a');
  const selB = $('select-b');

  selA.addEventListener('change', () => loadPair(selA.value, selB.value));
  selB.addEventListener('change', () => loadPair(selA.value, selB.value));

  $('swap-btn').addEventListener('click', () => {
    const a = selA.value, b = selB.value;
    selA.value = b; selB.value = a;
    loadPair(b, a);
  });

  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => {
        b.classList.remove('active'); b.removeAttribute('aria-selected');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      state.range = btn.dataset.range;
      rerender();
    });
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('active'); b.removeAttribute('aria-selected');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      state.mode = btn.dataset.mode;
      rerender();
    });
  });

  $('share-link').addEventListener('click', (e) => {
    e.preventDefault();
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href).then(() => {
      const old = $('share-link').textContent;
      $('share-link').textContent = 'Copied!';
      setTimeout(() => { $('share-link').textContent = old; }, 1200);
    });
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (overlayChart) {
        const w = $('overlay-chart').clientWidth;
        if (w) overlayChart.setSize({ width: w, height: 380 });
      }
      if (corrChart) {
        const w = $('corr-chart').clientWidth;
        if (w) corrChart.setSize({ width: w, height: 180 });
      }
    }, 150);
  });
}

// ============================================================================
// Bootstrap
// ============================================================================
function main() {
  const params = new URLSearchParams(window.location.search);
  const a = params.get('a') || DEFAULT_A;
  const b = params.get('b') || DEFAULT_B;

  populateSelects(a, b);
  wireControls();
  loadPair(a, b);
}

main();
