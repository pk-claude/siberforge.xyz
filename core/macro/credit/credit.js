// Credit & Liquidity deep-dive controller.
// Pulls NFCI, ANFCI, HY OAS, IG OAS, 10Y-3M curve, 10Y real yield. Renders
// the composite score, three time-series charts, threshold tiles, and a
// data-driven narrative.

import { computeCreditScore, phaseFor } from '/core/lib/composite-scores.js';

const SERIES = ['NFCI', 'ANFCI', 'BAMLH0A0HYM2', 'BAMLC0A0CM', 'T10Y3M', 'DFII10'];
const state = { data: {}, errors: [] };

const el = id => document.getElementById(id);
const fmt = (n, d = 1) => Number.isFinite(n) ? n.toFixed(d) : '—';

function setStatus(kind, txt) {
  const ind = el('refresh-indicator'), tx = el('refresh-text');
  if (ind) ind.className = `dot ${kind}`;
  if (tx) tx.textContent = txt;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function loadAll() {
  const start = '1990-01-01';
  const j = await fetchJSON(`/api/fred?series=${SERIES.join(',')}&start=${start}`);
  for (const s of j.series) state.data[s.id] = s.observations;
  if (j.errors?.length) state.errors.push(...j.errors);
}

function latest(arr) { return arr && arr.length ? arr[arr.length - 1] : null; }
function valueAt(arr, monthsBack = 0) {
  if (!arr || !arr.length) return null;
  const idx = Math.max(0, arr.length - 1 - monthsBack);
  return arr[idx];
}

// ---- score hero ----
function renderScoreHero() {
  const tgt = el('credit-score-section');
  if (!tgt) return;
  const result = computeCreditScore(state.data);
  if (!result) { tgt.innerHTML = '<div class="cycle-empty">Insufficient data.</div>'; return; }
  const phase = phaseFor('credit', result.score);

  const signalsHtml = result.signals.map(s => `
    <div class="cycle-signal-row">
      <div class="cycle-signal-name">${s.name}</div>
      <div class="cycle-signal-bar"><div class="cycle-signal-fill" style="width:${s.score.toFixed(1)}%; background:${phaseFor('credit', s.score).color}"></div></div>
      <div class="cycle-signal-score">${s.score.toFixed(0)}</div>
      <div class="cycle-signal-raw">${s.raw}</div>
      <div class="cycle-signal-weight">${(s.weight * 100).toFixed(0)}%</div>
    </div>`).join('');

  tgt.innerHTML = `
    <div class="cycle-score-card">
      <div class="cycle-score-left">
        <div class="cycle-score-label">CREDIT &amp; LIQUIDITY COMPOSITE</div>
        <div class="cycle-score-value" style="color:${phase.color}">${result.score.toFixed(0)}<span class="cycle-score-scale">/100</span></div>
        <div class="cycle-score-phase" style="color:${phase.color}">${phase.label}</div>
        <div class="cycle-score-desc">Higher = tighter financial conditions / more credit stress. Below 25 = very accommodative; above 65 = restrictive; above 80 = stress regime.</div>
      </div>
      <div class="cycle-score-right">
        <div class="cycle-signals-head">
          <span>Signal</span><span></span><span>Score</span><span>Now</span><span>Wt</span>
        </div>
        ${signalsHtml}
      </div>
    </div>`;
}

// ---- chart 1: NFCI overlay ----
function renderConditionsChart() {
  const ctx = el('chart-nfci');
  if (!ctx) return;
  const nfci = state.data.NFCI || [];
  const anfci = state.data.ANFCI || [];
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'NFCI', data: nfci.map(o => ({ x: o.date, y: o.value })), borderColor: '#f7a700', backgroundColor: 'rgba(247,167,0,0.10)', borderWidth: 1.6, pointRadius: 0, fill: true, tension: 0.05 },
        { label: 'ANFCI (cycle-adjusted)', data: anfci.map(o => ({ x: o.date, y: o.value })), borderColor: '#5a9cff', borderWidth: 1.4, pointRadius: 0, tension: 0.05 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8a94a3', font: { size: 11 } } } },
      scales: {
        x: { type: 'time', ticks: { color: '#8a94a3' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#8a94a3' }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
  // Tiles
  const tilesHtml = ['NFCI', 'ANFCI'].map(id => {
    const arr = state.data[id] || [];
    const cur = latest(arr); const m12 = valueAt(arr, 52); // weekly so 52
    if (!cur) return '';
    const dz = m12 ? (cur.value - m12.value) : null;
    return `<div class="cycle-tile" data-tile-metric="${id}">
      <div class="cycle-tile-label">${id}</div>
      <div class="cycle-tile-value">${cur.value.toFixed(2)}</div>
      <div class="cycle-tile-sub">${dz != null ? `${dz >= 0 ? '+' : ''}${dz.toFixed(2)} vs 1y` : ''}</div>
    </div>`;
  }).join('');
  el('tiles-conditions').innerHTML = tilesHtml;

  // Note
  const cur = latest(nfci);
  if (cur) {
    const lvl = cur.value;
    let txt = '';
    if (lvl < -0.4) txt = `NFCI at ${lvl.toFixed(2)} — financial conditions decisively easy. Accommodative for cyclical/credit-sensitive sectors.`;
    else if (lvl < 0) txt = `NFCI at ${lvl.toFixed(2)} — slightly looser than average. Default credit-friendly stance still intact.`;
    else if (lvl < 0.5) txt = `NFCI at ${lvl.toFixed(2)} — tighter than average but below the 0.5 stress threshold. Watch.`;
    else txt = `NFCI at ${lvl.toFixed(2)} — above 0.5 stress threshold; historically precedes recessions by 6-9 months.`;
    el('note-conditions').textContent = txt;
  }
}

// ---- chart 2: spreads ----
function renderSpreadsChart() {
  const ctx = el('chart-spreads');
  if (!ctx) return;
  const hy = state.data.BAMLH0A0HYM2 || [];
  const ig = state.data.BAMLC0A0CM || [];
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'HY OAS (bps)', data: hy.map(o => ({ x: o.date, y: o.value * 100 })), borderColor: '#ef4f5a', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.05 },
        { label: 'IG OAS (bps)', data: ig.map(o => ({ x: o.date, y: o.value * 100 })), borderColor: '#5a9cff', borderWidth: 1.4, pointRadius: 0, tension: 0.05 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8a94a3', font: { size: 11 } } } },
      scales: {
        x: { type: 'time', ticks: { color: '#8a94a3' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#8a94a3', callback: v => `${v.toFixed(0)}bp` }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });

  const hyL = latest(hy), igL = latest(ig);
  const tilesHtml = `
    <div class="cycle-tile" data-tile-metric="HY_OAS"><div class="cycle-tile-label">HY OAS</div><div class="cycle-tile-value">${hyL ? (hyL.value * 100).toFixed(0) + 'bp' : '—'}</div><div class="cycle-tile-sub">stress &gt; 800bp</div></div>
    <div class="cycle-tile" data-tile-metric="IG_OAS"><div class="cycle-tile-label">IG OAS</div><div class="cycle-tile-value">${igL ? (igL.value * 100).toFixed(0) + 'bp' : '—'}</div><div class="cycle-tile-sub">stress &gt; 250bp</div></div>
    <div class="cycle-tile" data-tile-metric="HY_IG_RATIO"><div class="cycle-tile-label">HY-IG ratio</div><div class="cycle-tile-value">${hyL && igL ? (hyL.value / igL.value).toFixed(1) + 'x' : '—'}</div><div class="cycle-tile-sub">historical avg ≈ 4x</div></div>`;
  el('tiles-spreads').innerHTML = tilesHtml;

  if (hyL && igL) {
    const hyBps = hyL.value * 100, igBps = igL.value * 100;
    let txt = '';
    if (hyBps > 800) txt = `HY OAS at ${hyBps.toFixed(0)}bp — credit stress regime. Historically: equity drawdown probabilities elevated and credit-sensitive sectors should be reduced.`;
    else if (hyBps > 500) txt = `HY OAS at ${hyBps.toFixed(0)}bp — elevated but pre-stress. Watch the trajectory: a continued widening above 600 confirms tightening cycle.`;
    else if (hyBps > 350) txt = `HY OAS at ${hyBps.toFixed(0)}bp — normal-range; complacency risk if it drops below 300.`;
    else txt = `HY OAS at ${hyBps.toFixed(0)}bp — historically tight; suggests credit complacency / late-cycle risk-on regime.`;
    el('note-spreads').textContent = txt;
  }
}

// ---- chart 3: curve + real yields ----
function renderCurveChart() {
  const ctx = el('chart-curve');
  if (!ctx) return;
  const curve = state.data.T10Y3M || [];
  const ry = state.data.DFII10 || [];
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: '10Y-3M curve (bp)', data: curve.map(o => ({ x: o.date, y: o.value * 100 })), borderColor: '#3ecf8e', borderWidth: 1.6, pointRadius: 0, tension: 0.05, yAxisID: 'y' },
        { label: '10Y real yield (%)', data: ry.map(o => ({ x: o.date, y: o.value })), borderColor: '#f7a700', borderWidth: 1.4, pointRadius: 0, tension: 0.05, yAxisID: 'y2' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8a94a3', font: { size: 11 } } } },
      scales: {
        x: { type: 'time', ticks: { color: '#8a94a3' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { position: 'left', ticks: { color: '#3ecf8e', callback: v => `${v.toFixed(0)}bp` }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y2: { position: 'right', ticks: { color: '#f7a700', callback: v => `${v.toFixed(1)}%` }, grid: { display: false } },
      },
    },
  });

  const cv = latest(curve), rv = latest(ry);
  const cBps = cv ? cv.value * 100 : null;
  const tiles = `
    <div class="cycle-tile" data-tile-metric="T10Y3M"><div class="cycle-tile-label">10Y-3M</div><div class="cycle-tile-value">${cBps != null ? (cBps >= 0 ? '+' : '') + cBps.toFixed(0) + 'bp' : '—'}</div><div class="cycle-tile-sub">${cBps != null && cBps < 0 ? 'inverted' : 'positive'}</div></div>
    <div class="cycle-tile" data-tile-metric="DFII10"><div class="cycle-tile-label">10Y real</div><div class="cycle-tile-value">${rv ? rv.value.toFixed(2) + '%' : '—'}</div><div class="cycle-tile-sub">restrictive &gt; 1.5%</div></div>`;
  el('tiles-curve').innerHTML = tiles;

  if (cBps != null) {
    let txt = '';
    if (cBps < -100) txt = `Curve at ${cBps.toFixed(0)}bp — deeply inverted. Recession lag historically 8-18 months.`;
    else if (cBps < 0) txt = `Curve at ${cBps.toFixed(0)}bp — inverted. Steepening from inversion is when recessions tend to start.`;
    else if (cBps < 100) txt = `Curve at ${cBps.toFixed(0)}bp — positive but flat. Bear-steepening or bull-steepening determines whether this is healthy or recession-onset.`;
    else txt = `Curve at ${cBps.toFixed(0)}bp — healthy positive slope. Term premium normal.`;
    if (rv && rv.value > 1.5) txt += ` Real yield at ${rv.value.toFixed(2)}% — monetary policy decisively restrictive.`;
    el('note-curve').textContent = txt;
  }
}

function renderTakeaway() {
  const result = computeCreditScore(state.data);
  if (!result) return;
  const phase = phaseFor('credit', result.score);
  const txt = `Composite score is <strong style="color:${phase.color}">${result.score.toFixed(0)}/100 (${phase.label})</strong>. ${
    result.score < 25 ? 'Conditions are decisively easy — risk-on regime, credit-sensitive sectors favored.' :
    result.score < 45 ? 'Accommodative posture; bank lending should be supportive of growth.' :
    result.score < 65 ? 'Neutral conditions; tightening direction matters more than the level.' :
    result.score < 80 ? 'Tight conditions — equity drawdowns and credit-sensitive earnings risk elevated.' :
    'Stress regime — historically associated with recessions starting within 9-12 months. Reduce credit and small-cap exposure; favor quality and duration.'
  }`;
  el('credit-takeaway-text').innerHTML = txt;
}

(async function () {
  setStatus('stale', 'Loading credit data…');
  try {
    await loadAll();
    renderScoreHero();
    renderConditionsChart();
    renderSpreadsChart();
    renderCurveChart();
    renderTakeaway();
    setStatus('live', 'Live — credit data current as of last FRED update');
  } catch (e) {
    console.error(e);
    setStatus('err', 'Failed to load credit data');
  }
})();

// download data hook
window.__downloadPageData = async function () {
  const { downloadJSON } = await import('/core/lib/csv-export.js');
  downloadJSON('credit-data.json', state.data);
};
