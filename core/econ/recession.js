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
import {
  SERIES,
  HISTORY_START,
  NBER_RECESSIONS,
  tierOf,
  computeSignals,
  compositeOverTime,
} from './recession-core.js';

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
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      