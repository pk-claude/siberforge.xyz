// Recession-risk composite controller.
//
// Flow:
//   1. Fetch 5 FRED series in parallel (Sahm, T10Y3M, HY OAS, UNRATE, PAYEMS).
//   2. For each signal, compute current value and classify vs threshold.
//   3. Render 5 signal tiles (each with sparkline + trigger-zone shading).
//   4. Compute historical composite score month-by-month (aligned to monthly
//      grid so all 5 signals can be summed per period).
//   5. Render timeline uPlot chart with NBER recessions shaded.
//   6. Render big headline gauge (N of 5 triggered, risk tier label).
//
// Signals:
//   SAHMCURRENT       — direct level, trigger >= 0.50
//   T10Y3M            — direct level, trigger < 0
//   BAMLH0A0HYM2      — direct level, trigger >= 6.0
//   UNRATE 6mo diff   — derived (current minus value 6 months ago), trigger >= 0.5
//   PAYEMS 3mo avg    — derived (mean of last 3 MoM diffs), trigger < 50 (in thousands)
//
// All signals are aligned to a monthly grid for the composite timeline.
// Daily/weekly series are resampled to month-end by taking the last observation
// in each calendar month.

import { fetchFred } from '../lib/fred-client.js';
import { dateToTs, DARK_AXIS_BASE } from '../lib/charts.js';

// ============================================================================
// Config
// ============================================================================

const SERIES = ['SAHMCURRENT', 'T10Y3M', 'BAMLH0A0HYM2', 'UNRATE', 'PAYEMS'];
const HISTORY_START = '1975-01-01';

// Signal metadata — order here = render order.
const SIGNALS = [
  {
    id: 'sahm',
    label: 'Sahm Rule',
    short: 'Sahm',
    source: 'SAHMCURRENT',
    unit: 'pp',
    decimals: 2,
    threshold: 0.50,
    direction: 'above',          // trigger when value >= threshold
    axisMin: -0.5,
    axisMax: 3.0,
    description: 'UNRATE 3mo avg − its 12mo prior min. Trigger ≥ 0.50.',
  },
  {
    id: 'curve',
    label: 'Yield Curve (10Y − 3M)',
    short: '10Y-3M',
    source: 'T10Y3M',
    unit: '%',
    decimals: 2,
    threshold: 0.00,
    direction: 'below',          // trigger when value < threshold
    axisMin: -2.5,
    axisMax: 4.0,
    description: 'Spread between 10-year and 3-month Treasury yields. Trigger < 0 (inversion).',
  },
  {
    id: 'hyoas',
    label: 'High-Yield OAS',
    short: 'HY OAS',
    source: 'BAMLH0A0HYM2',
    unit: '%',
    decimals: 2,
    threshold: 6.00,
    direction: 'above',
    axisMin: 2.0,
    axisMax: 22.0,
    description: 'ICE BofA US HY option-adjusted spread. Trigger ≥ 6.00%.',
  },
  {
    id: 'unchg6',
    label: 'Unemployment 6mo Change',
    short: 'UNRATE Δ6m',
    source: 'derived',
    unit: 'pp',
    decimals: 2,
    threshold: 0.50,
    direction: 'above',
    axisMin: -2.0,
    axisMax: 4.0,
    description: 'Current UNRATE minus UNRATE 6 months ago. Trigger ≥ +0.5 pp.',
  },
  {
    id: 'nfp3',
    label: 'Payrolls 3mo Avg',
    short: 'NFP 3mo',
    source: 'derived',
    unit: 'k/mo',
    decimals: 0,
    threshold: 50,
    direction: 'below',
    axisMin: -500,
    axisMax: 600,
    description: 'Average monthly change in nonfarm payrolls over last 3 months. Trigger < 50k/mo.',
  },
];

// NBER US recessions. Dates from NBER Business Cycle Dating Committee.
// Format: [peak_month, trough_month] as "YYYY-MM" — peak is first month of
// recession in NBER parlance, trough is last month before expansion resumes.
const NBER_RECESSIONS = [
  ['1973-11', '1975-03'],
  ['1980-01', '1980-07'],
  ['1981-07', '1982-11'],
  ['1990-07', '1991-03'],
  ['2001-03', '2001-11'],
  ['2007-12', '2009-06'],
  ['2020-02', '2020-04'],
];

// Tier thresholds
function tierOf(count) {
  if (count >= 3) return { label: 'HIGH',      cls: 'tier-high',     sub: 'Multiple signals agree — historically rare outside of or just before recessions.' };
  if (count >= 2) return { label: 'ELEVATED',  cls: 'tier-elevated', sub: 'Two signals triggered. Worth watching, not yet a consensus alarm.' };
  if (count >= 1) return { label: 'LOW',       cls: 'tier-low',      sub: 'One signal triggered. Common during late-cycle conditions without a recession following.' };
  return            { label: 'BENIGN',    cls: 'tier-benign',   sub: 'No signals triggered.' };
}

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

function fmt(v, d = 2) {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtDate(iso) {
  if (!iso) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = /^(\d{4})-(\d{1,2})/.exec(String(iso).trim());
  if (m) {
    const y = m[1];
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) return `${months[mo - 1]} ${y}`;
  }
  return String(iso);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
  }[c]));
}

// ============================================================================
// Fetching
// ============================================================================
async function fetchAll() {
  const map = await fetchFred(SERIES, { start: HISTORY_START });
  const out = {};
  for (const id of SERIES) out[id] = (map[id] && map[id].observations) || [];
  return out;
}

// ============================================================================
// Derived signals
// ============================================================================

// For a monthly series, return the nth-prior observation by index.
// Assumes obs are ascending by date. Returns NaN if unavailable.
function priorN(obs, i, n) {
  const j = i - n;
  if (j < 0 || j >= obs.length) return NaN;
  return obs[j].value;
}

// Compute UNRATE 6-month change series: for each month, value = UNRATE[i] - UNRATE[i-6].
function unrateChange6m(unrate) {
  const out = [];
  for (let i = 6; i < unrate.length; i++) {
    out.push({ date: unrate[i].date, value: unrate[i].value - unrate[i - 6].value });
  }
  return out;
}

// PAYEMS comes in levels (thousands of persons). Convert to MoM diff (new jobs)
// then take 3-month rolling average of those diffs. Output units: thousands / month.
function payemsAvg3mo(payems) {
  const diffs = [];
  for (let i = 1; i < payems.length; i++) {
    diffs.push({ date: payems[i].date, value: payems[i].value - payems[i - 1].value });
  }
  const out = [];
  for (let i = 2; i < diffs.length; i++) {
    const avg = (diffs[i].value + diffs[i - 1].value + diffs[i - 2].value) / 3;
    out.push({ date: diffs[i].date, value: avg });
  }
  return out;
}

// Resample a daily/weekly series to monthly (last observation of each month).
function resampleToMonthly(obs) {
  const byMonth = new Map(); // "YYYY-MM" → {date, value} (keeps last seen)
  for (const o of obs) {
    const key = o.date.slice(0, 7);
    byMonth.set(key, o);
  }
  // Order by YYYY-MM and use a canonical date = YYYY-MM-01 for alignment.
  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, o]) => ({ date: `${key}-01`, value: o.value }));
}

// ============================================================================
// Signal current state
// ============================================================================
function isTriggered(value, sig) {
  if (!Number.isFinite(value)) return false;
  if (sig.direction === 'above') return value >= sig.threshold;
  if (sig.direction === 'below') return value <  sig.threshold;
  return false;
}

// Build per-signal {currentValue, currentDate, triggered, series (monthly)}.
function computeSignals(raw) {
  const sahmMonthly = raw.SAHMCURRENT || [];
  const curveMonthly = resampleToMonthly(raw.T10Y3M || []);
  const hyMonthly = resampleToMonthly(raw.BAMLH0A0HYM2 || []);
  const unchgMonthly = unrateChange6m(raw.UNRATE || []);
  const nfpMonthly = payemsAvg3mo(raw.PAYEMS || []);

  const seriesBySignal = {
    sahm:   sahmMonthly,
    curve:  curveMonthly,
    hyoas:  hyMonthly,
    unchg6: unchgMonthly,
    nfp3:   nfpMonthly,
  };

  const out = SIGNALS.map(sig => {
    const s = seriesBySignal[sig.id];
    const last = s[s.length - 1];
    return {
      ...sig,
      series: s,
      currentValue: last ? last.value : NaN,
      currentDate:  last ? last.date  : null,
      triggered:    last ? isTriggered(last.value, sig) : false,
    };
  });

  return { signals: out, seriesBySignal };
}

// ============================================================================
// Historical composite (how many signals triggered each month)
// ============================================================================
function compositeOverTime(seriesBySignal) {
  // Build a monthly grid = union of all signals' months.
  const monthSet = new Set();
  for (const s of Object.values(seriesBySignal)) {
    for (const o of s) monthSet.add(o.date.slice(0, 7));
  }
  const months = [...monthSet].sort();

  // Map each signal by month for O(1) lookup.
  const lookup = {};
  for (const [k, s] of Object.entries(seriesBySignal)) {
    const m = new Map();
    for (const o of s) m.set(o.date.slice(0, 7), o.value);
    lookup[k] = m;
  }

  const out = [];
  for (const m of months) {
    let count = 0;
    let hasAny = false;
    for (const sig of SIGNALS) {
      const v = lookup[sig.id].get(m);
      if (!Number.isFinite(v)) continue;
      hasAny = true;
      if (isTriggered(v, sig)) count++;
    }
    if (!hasAny) continue;
    out.push({ date: `${m}-01`, count });
  }
  return out;
}

// ============================================================================
// Big gauge / header
// ============================================================================
function renderGauge(signals) {
  const triggeredCount = signals.filter(s => s.triggered).length;
  $('gauge-count').textContent = String(triggeredCount);

  const tier = tierOf(triggeredCount);
  const tierEl = $('gauge-tier');
  tierEl.classList.remove('tier-benign', 'tier-low', 'tier-elevated', 'tier-high');
  tierEl.classList.add(tier.cls);
  $('tier-label').textContent = tier.label;
  $('tier-sub').textContent = tier.sub;

  // Dots = one per signal, colored by state
  const dotsEl = $('gauge-dots');
  dotsEl.innerHTML = signals.map(s =>
    `<span class="gauge-dot ${s.triggered ? 'triggered' : 'ok'}" title="${escapeHtml(s.label)}: ${s.triggered ? 'TRIGGERED' : 'ok'}"></span>`
  ).join('');
}

// ============================================================================
// Signal tiles
// ============================================================================
function renderSignalTiles(signals) {
  const grid = $('signal-grid');
  grid.innerHTML = signals.map(s => {
    const status = s.triggered ? 'triggered' : 'ok';
    const statusLabel = s.triggered ? 'TRIGGERED' : 'OK';
    const valStr = Number.isFinite(s.currentValue)
      ? `${fmt(s.currentValue, s.decimals)}<span class="tile-unit">${s.unit}</span>`
      : '—';
    const threshStr = `${s.direction === 'above' ? '≥' : '<'} ${fmt(s.threshold, s.decimals)}${s.unit}`;
    return `
      <div class="signal-tile ${status}" data-signal="${s.id}">
        <div class="tile-head">
          <span class="tile-label">${escapeHtml(s.label)}</span>
          <span class="tile-status ${status}">${statusLabel}</span>
        </div>
        <div class="tile-value">${valStr}</div>
        <div class="tile-meta">
          <span class="tile-asof">${fmtDate(s.currentDate)}</span>
          <span class="tile-thresh">Trigger: ${threshStr}</span>
        </div>
        <div class="tile-spark" id="spark-${s.id}"></div>
        <div class="tile-desc">${escapeHtml(s.description)}</div>
      </div>
    `;
  }).join('');

  // Draw mini sparklines into each tile.
  for (const s of signals) {
    drawSignalSparkline(s);
  }
}

// Mini sparkline: last ~10 years, with trigger-zone shading and NBER bars.
function drawSignalSparkline(sig) {
  const el = $(`spark-${sig.id}`);
  if (!el || typeof uPlot === 'undefined') return;

  // Last 10 years
  const last = sig.series.slice(-120); // monthly → ~120 = 10 yrs
  if (!last.length) { el.innerHTML = '<div class="spark-empty">no data</div>'; return; }

  const xs = last.map(o => dateToTs(o.date));
  const ys = last.map(o => o.value);

  const width = el.clientWidth || 260;
  const height = 52;

  const strokeColor = sig.triggered ? '#ef4f5a' : '#5a9cff';

  const opts = {
    width, height,
    cursor: { show: false },
    legend: { show: false },
    scales: {
      x: { time: true },
      y: { range: [sig.axisMin, sig.axisMax] },
    },
    axes: [{ show: false }, { show: false }],
    hooks: {
      draw: [
        (u) => {
          // Trigger-zone shading
          const ctx = u.ctx;
          const yThresh = u.valToPos(sig.threshold, 'y', true);
          const left = u.bbox.left;
          const right = u.bbox.left + u.bbox.width;
          ctx.save();
          ctx.fillStyle = 'rgba(239, 79, 90, 0.10)';
          if (sig.direction === 'above') {
            const top = u.bbox.top;
            ctx.fillRect(left, top, right - left, yThresh - top);
          } else {
            const bottom = u.bbox.top + u.bbox.height;
            ctx.fillRect(left, yThresh, right - left, bottom - yThresh);
          }
          // Threshold line
          ctx.strokeStyle = 'rgba(239, 79, 90, 0.4)';
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(left, yThresh);
          ctx.lineTo(right, yThresh);
          ctx.stroke();
          ctx.setLineDash([]);

          // NBER recession bars
          shadeNberRecessions(u);
          ctx.restore();
        },
      ],
    },
    series: [
      {},
      { stroke: strokeColor, width: 1.5, points: { show: false } },
    ],
  };

  // eslint-disable-next-line no-new
  new uPlot(opts, [xs, ys], el);
}

// ============================================================================
// NBER shading helper — shared by sparklines and the timeline chart.
// ============================================================================
function shadeNberRecessions(u) {
  const ctx = u.ctx;
  const top = u.bbox.top;
  const bottom = u.bbox.top + u.bbox.height;
  const leftLim = u.bbox.left;
  const rightLim = u.bbox.left + u.bbox.width;

  ctx.save();
  ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
  for (const [pk, tr] of NBER_RECESSIONS) {
    const xStart = dateToTs(`${pk}-01`);
    const xEnd   = dateToTs(`${tr}-28`);
    const px1 = u.valToPos(xStart, 'x', true);
    const px2 = u.valToPos(xEnd,   'x', true);
    // Clip to the plot area so we don't draw off the edge.
    const left = Math.max(leftLim, Math.min(px1, px2));
    const right = Math.min(rightLim, Math.max(px1, px2));
    if (right > left) ctx.fillRect(left, top, right - left, bottom - top);
  }
  ctx.restore();
}

// ============================================================================
// Timeline chart: count of triggered signals over time
// ============================================================================
function renderTimeline(composite) {
  const el = $('timeline-chart');
  el.querySelector('.chart-placeholder')?.remove();
  if (typeof uPlot === 'undefined') {
    el.innerHTML = '<div class="chart-error">Chart library failed to load.</div>';
    return;
  }
  if (!composite.length) {
    el.innerHTML = '<div class="chart-error">No composite data available.</div>';
    return;
  }

  const xs = composite.map(o => dateToTs(o.date));
  const ys = composite.map(o => o.count);

  const width = el.clientWidth || 800;
  const height = 220;

  const opts = {
    width, height,
    scales: {
      x: { time: true },
      y: { range: [0, 5.5] },
    },
    axes: [
      { ...DARK_AXIS_BASE },
      { ...DARK_AXIS_BASE,
        splits: [0, 1, 2, 3, 4, 5],
        values: (u, splits) => splits.map(v => String(Math.round(v))),
      },
    ],
    cursor: { drag: { x: true, y: false }, focus: { prox: 16 } },
    legend: { show: false },
    hooks: {
      draw: [
        (u) => {
          // 1) NBER shading behind everything
          shadeNberRecessions(u);
          // 2) Risk-tier horizontal bands: 2 (elevated) and 3+ (high)
          const ctx = u.ctx;
          const left = u.bbox.left;
          const right = u.bbox.left + u.bbox.width;

          const y2 = u.valToPos(2, 'y', true);
          const y3 = u.valToPos(3, 'y', true);
          const yTop = u.bbox.top;

          ctx.save();
          ctx.fillStyle = 'rgba(247, 167, 0, 0.08)';
          ctx.fillRect(left, y3, right - left, y2 - y3); // elevated zone (between y=2 and y=3)
          ctx.fillStyle = 'rgba(239, 79, 90, 0.10)';
          ctx.fillRect(left, yTop, right - left, y3 - yTop); // high zone (>= 3)
          ctx.restore();
        },
      ],
    },
    series: [
      {},
      {
        label: 'Triggered',
        stroke: '#ef4f5a',
        width: 1.5,
        fill: 'rgba(239, 79, 90, 0.18)',
        points: { show: false },
        paths: uPlot.paths.stepped({ align: 1 }),
        value: (u, v) => (v == null ? '—' : String(Math.round(v))),
      },
    ],
  };

  new uPlot(opts, [xs, ys], el);

  // Meta line: how often each tier was active historically
  const total = composite.length;
  const elevated = composite.filter(o => o.count === 2).length;
  const high     = composite.filter(o => o.count >= 3).length;
  const pct = (n) => (100 * n / total).toFixed(1) + '%';
  $('timeline-meta').textContent =
    `${total} months · elevated ${pct(elevated)} · high ${pct(high)} of history`;
}

// ============================================================================
// Bootstrap
// ============================================================================
async function main() {
  setStatus('stale', 'Fetching FRED series…');
  let raw;
  try {
    raw = await fetchAll();
  } catch (err) {
    console.error(err);
    setStatus('error', `Fetch failed: ${err.message || err}`);
    return;
  }

  // Sanity
  for (const id of SERIES) {
    if (!raw[id] || !raw[id].length) {
      setStatus('error', `Missing series: ${id}`);
      return;
    }
  }

  const { signals, seriesBySignal } = computeSignals(raw);
  renderGauge(signals);
  renderSignalTiles(signals);

  const composite = compositeOverTime(seriesBySignal);
  renderTimeline(composite);

  setStatus('live', 'Live');
}

// Redraw on resize — re-render timeline only (sparklines are fine at their size).
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  // Simple approach: recursive full re-render would be heavy; skip for now.
  // uPlot charts keep their original size; zoom still works. Users can refresh
  // if they resized dramatically.
});

main();
