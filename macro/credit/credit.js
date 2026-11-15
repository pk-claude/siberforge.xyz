// Credit & Liquidity deep-dive controller.
// Pulls NFCI, ANFCI, Baa/Aaa spreads, HY/IG OAS, 10Y-3M curve, 10Y real yield. Renders
// the composite score, three time-series charts, threshold tiles, and a
// data-driven narrative.

import { renderMethodology as shared_renderMethodology, computeCreditScore, phaseFor, synthesisHtml, ordinal } from '/lib/composite-scores.js';

const SERIES = ['NFCI', 'ANFCI', 'BAMLH0A0HYM2', 'BAMLC0A0CM', 'T10Y3M', 'DFII10', 'BAA10Y', 'AAA10Y'];
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
// Percentile of the latest value within the loaded history (0-100).
function pctOf(arr) {
  const v = (arr || []).map(o => o.value).filter(Number.isFinite);
  if (v.length < 2) return null;
  const x = v[v.length - 1];
  return Math.round(100 * v.filter(y => y < x).length / (v.length - 1));
}
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
  if (!result) { tgt.innerHTML = '<div class="cs-empty">Insufficient data.</div>'; return; }
  const phase = phaseFor('credit', result.score);

  const signalBars = result.signals.map(s => {
    const sevColor = phaseFor('credit', s.score).color;
    return `<div class="cs-signal">
      <div class="cs-signal-name">${s.name}</div>
      <div class="cs-signal-bar"><div class="cs-signal-fill" style="width:${s.score.toFixed(0)}%;background:${sevColor}"></div></div>
      <div class="cs-signal-value">${s.raw}</div>
    </div>`;
  }).join('');

  tgt.innerHTML = `
    <div class="cs-score-card">
      <div class="cs-score-dial" style="--cs-color:${phase.color}">
        <div class="cs-score-label">CREDIT &amp; LIQUIDITY COMPOSITE</div>
        <div class="cs-score-value">${result.score.toFixed(0)}<span class="cs-score-scale">/100</span></div>
        <div class="cs-score-phase" style="color:${phase.color}">${phase.label}</div>
        <div class="cs-score-desc">Higher = tighter financial conditions / more credit stress. 0&ndash;25 very accommodative; 25&ndash;45 accommodative; 45&ndash;65 neutral; 65&ndash;80 tight; 80+ stressed.</div>
      </div>
      <div class="cs-signals">
        <div class="cs-signals-title">Component readings</div>
        ${signalBars}
        <div class="cs-weights-note">Each signal is scored as its percentile within its own last 20 years (100 = most risk); weights and transforms under "How this score is built".</div>
      </div>
    </div>
  `;
  shared_renderMethodology(tgt, 'credit');
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
    const p = pctOf(nfci);
    if (lvl < 0) txt = `NFCI at ${lvl.toFixed(2)}: looser than its long-run average of zero`;
    else if (lvl < 0.5) txt = `NFCI at ${lvl.toFixed(2)}: tighter than its long-run average of zero`;
    else txt = `NFCI at ${lvl.toFixed(2)}: well above zero, a level seen during past stress episodes`;
    txt += p != null ? ` (${ordinal(p)} percentile since 1990, higher = tighter).` : '.';
    el('note-conditions').textContent = txt;
  }
}

// ---- chart 2: spreads ----
// FRED carries only about three years of the ICE BofA option-adjusted spreads,
// so the long history is Moody's Baa and Aaa yields minus the 10-year Treasury
// (the two series the composite scores). The OAS lines are drawn where they exist.
function renderSpreadsChart() {
  const ctx = el('chart-spreads');
  if (!ctx) return;
  const hy = state.data.BAMLH0A0HYM2 || [];
  const ig = state.data.BAMLC0A0CM || [];
  const baa = state.data.BAA10Y || [];
  const aaa = state.data.AAA10Y || [];
  const bp = arr => arr.map(o => ({ x: o.date, y: o.value * 100 }));
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'Baa − 10Y (bp)', data: bp(baa), borderColor: '#ef4f5a', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.05 },
        { label: 'Aaa − 10Y (bp)', data: bp(aaa), borderColor: '#5a9cff', borderWidth: 1.4, pointRadius: 0, tension: 0.05 },
        { label: 'HY OAS (bp, 3 years on FRED)', data: bp(hy), borderColor: '#f7a700', borderWidth: 1.4, pointRadius: 0, tension: 0.05, borderDash: [4, 3] },
        { label: 'IG OAS (bp, 3 years on FRED)', data: bp(ig), borderColor: '#3ecf8e', borderWidth: 1.4, pointRadius: 0, tension: 0.05, borderDash: [4, 3] },
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

  const hyL = latest(hy), igL = latest(ig), baaL = latest(baa), aaaL = latest(aaa);
  const pBaa = pctOf(baa), pAaa = pctOf(aaa);
  const since = arr => (arr.length ? arr[0].date.slice(0, 4) : '');
  el('tiles-spreads').innerHTML = `
    <div class="cycle-tile" data-tile-metric="BAA10Y"><div class="cycle-tile-label">Baa − 10Y</div><div class="cycle-tile-value">${baaL ? (baaL.value * 100).toFixed(0) + 'bp' : '—'}</div><div class="cycle-tile-sub">${pBaa != null ? `${ordinal(pBaa)} percentile since ${since(baa)}` : ''}</div></div>
    <div class="cycle-tile" data-tile-metric="AAA10Y"><div class="cycle-tile-label">Aaa − 10Y</div><div class="cycle-tile-value">${aaaL ? (aaaL.value * 100).toFixed(0) + 'bp' : '—'}</div><div class="cycle-tile-sub">${pAaa != null ? `${ordinal(pAaa)} percentile since ${since(aaa)}` : ''}</div></div>
    <div class="cycle-tile" data-tile-metric="HY_OAS"><div class="cycle-tile-label">HY OAS</div><div class="cycle-tile-value">${hyL ? (hyL.value * 100).toFixed(0) + 'bp' : '—'}</div><div class="cycle-tile-sub">peaks: about 1,100bp in 2020, 2,000bp in 2008</div></div>
    <div class="cycle-tile" data-tile-metric="IG_OAS"><div class="cycle-tile-label">IG OAS</div><div class="cycle-tile-value">${igL ? (igL.value * 100).toFixed(0) + 'bp' : '—'}</div><div class="cycle-tile-sub">peak: above 600bp in 2008</div></div>`;

  if (baaL) {
    let txt = `Baa spread at ${(baaL.value * 100).toFixed(0)}bp`;
    if (pBaa != null) txt += `, the ${ordinal(pBaa)} percentile of its history since ${since(baa)}: ${pBaa < 20 ? 'investors are being paid unusually little for corporate credit risk' : pBaa > 80 ? 'investors are demanding unusually high compensation for corporate credit risk' : 'within its usual range'}`;
    txt += '.';
    if (hyL) txt += ` High-yield OAS is ${(hyL.value * 100).toFixed(0)}bp.`;
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
    <div class="cycle-tile" data-tile-metric="DFII10"><div class="cycle-tile-label">10Y real</div><div class="cycle-tile-value">${rv ? rv.value.toFixed(2) + '%' : '—'}</div><div class="cycle-tile-sub">${pctOf(ry) != null ? `${ordinal(pctOf(ry))} percentile since ${ry[0].date.slice(0, 4)}` : ''}</div></div>`;
  el('tiles-curve').innerHTML = tiles;

  if (cBps != null) {
    let txt = '';
    if (cBps < 0) txt = `Curve at ${cBps.toFixed(0)}bp: inverted. Inversions have preceded recessions by roughly 6 to 18 months, with one false signal in 2022-25.`;
    else if (cBps < 100) txt = `Curve at +${cBps.toFixed(0)}bp: positive but flatter than its average of about 145bp since 1990.`;
    else txt = `Curve at +${cBps.toFixed(0)}bp: positively sloped.`;
    if (rv) { const p = pctOf(ry); txt += ` The 10-year real yield is ${rv.value.toFixed(2)}%${p != null ? `, the ${ordinal(p)} percentile since ${ry[0].date.slice(0, 4)}` : ''}: long-term borrowing costs after inflation are ${p != null && p > 80 ? 'high by the standards of the TIPS era' : p != null && p < 20 ? 'low by the standards of the TIPS era' : 'mid-range'}.`; }
    el('note-curve').textContent = txt;
  }
}

function renderTakeaway() {
  const result = computeCreditScore(state.data);
  if (!result) return;
  const txt = synthesisHtml('credit', state.data, result);
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
    setStatus('live', 'Snapshot data');
  } catch (e) {
    console.error(e);
    setStatus('err', 'Failed to load credit data');
  }
})();

// download data hook
window.__downloadPageData = async function () {
  const { downloadJSON } = await import('/lib/csv-export.js');
  downloadJSON('credit-data.json', state.data);
};
