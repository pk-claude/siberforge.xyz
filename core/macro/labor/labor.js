// Labor Market deep-dive controller. Pulls UNRATE, IC4WSA, PAYEMS,
// CES0500000003 (AHE), CPILFESL (for real-wages context) and renders
// composite score, three time-series charts, threshold tiles, and a
// data-driven narrative.

import { computeLaborScore, phaseFor, computeSahm, yoyPct } from '/core/lib/composite-scores.js';

const SERIES = ['UNRATE', 'IC4WSA', 'PAYEMS', 'CES0500000003', 'CPILFESL'];
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

const latest = arr => arr && arr.length ? arr[arr.length - 1] : null;

function renderScoreHero() {
  const tgt = el('labor-score-section');
  if (!tgt) return;
  const result = computeLaborScore(state.data);
  if (!result) { tgt.innerHTML = '<div class="cs-empty">Insufficient data.</div>'; return; }
  const phase = phaseFor('labor', result.score);

  const signalBars = result.signals.map(s => {
    const sevColor = phaseFor('labor', s.score).color;
    return `<div class="cs-signal">
      <div class="cs-signal-name">${s.name}</div>
      <div class="cs-signal-bar"><div class="cs-signal-fill" style="width:${s.score.toFixed(0)}%;background:${sevColor}"></div></div>
      <div class="cs-signal-value">${s.raw}</div>
    </div>`;
  }).join('');

  tgt.innerHTML = `
    <div class="cs-score-card">
      <div class="cs-score-dial" style="--cs-color:${phase.color}">
        <div class="cs-score-label">LABOR MARKET COMPOSITE</div>
        <div class="cs-score-value">${result.score.toFixed(0)}<span class="cs-score-scale">/100</span></div>
        <div class="cs-score-phase" style="color:${phase.color}">${phase.label}</div>
        <div class="cs-score-desc">Higher = labor market weakening. 0&ndash;25 very tight; 25&ndash;45 tight; 45&ndash;65 cooling; 65&ndash;80 weakening; 80+ recessionary.</div>
      </div>
      <div class="cs-signals">
        <div class="cs-signals-title">Component readings</div>
        ${signalBars}
        <div class="cs-weights-note">Weights: UNRATE 20% · Sahm Rule 20% · Initial claims 20% · Payrolls 6m ann. 20% · Wage growth 20%.</div>
      </div>
    </div>
  `;
}

function renderUnrateChart() {
  const ctx = el('chart-unrate');
  if (!ctx) return;
  const u = state.data.UNRATE || [];
  const sahm = computeSahm(u);
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'Unemployment rate', data: u.map(o => ({ x: o.date, y: o.value })), borderColor: '#5a9cff', backgroundColor: 'rgba(90,156,255,0.10)', borderWidth: 1.6, pointRadius: 0, fill: true, tension: 0.05, yAxisID: 'y' },
        { label: 'Sahm Rule (pp)', data: sahm.map(o => ({ x: o.date, y: o.value })), borderColor: '#ef4f5a', borderWidth: 1.4, pointRadius: 0, tension: 0.05, yAxisID: 'y2' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8a94a3', font: { size: 11 } } } },
      scales: {
        x: { type: 'time', ticks: { color: '#8a94a3' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { position: 'left', ticks: { color: '#5a9cff', callback: v => `${v.toFixed(1)}%` }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y2: { position: 'right', ticks: { color: '#ef4f5a', callback: v => `${v.toFixed(2)}pp` }, grid: { display: false } },
      },
    },
  });
  const cur = latest(u), s = latest(sahm);
  el('tiles-unrate').innerHTML = `
    <div class="cycle-tile" data-tile-metric="UNRATE"><div class="cycle-tile-label">UNRATE</div><div class="cycle-tile-value">${cur ? cur.value.toFixed(1) + '%' : '—'}</div><div class="cycle-tile-sub">52-wk low ${u.length ? Math.min(...u.slice(-12).map(o => o.value)).toFixed(1) : '—'}%</div></div>
    <div class="cycle-tile" data-tile-metric="SAHM"><div class="cycle-tile-label">Sahm Rule</div><div class="cycle-tile-value" style="color:${s && s.value >= 0.5 ? '#ef4f5a' : s && s.value >= 0.4 ? '#f7a700' : '#3ecf8e'}">${s ? s.value.toFixed(2) + 'pp' : '—'}</div><div class="cycle-tile-sub">trigger 0.50pp</div></div>`;
  if (s) {
    let txt = '';
    if (s.value >= 0.5) txt = `Sahm Rule TRIGGERED at ${s.value.toFixed(2)}pp — recession indicator firing.`;
    else if (s.value >= 0.4) txt = `Sahm Rule at ${s.value.toFixed(2)}pp — close to the 0.50pp trigger. Watch next 1-2 prints carefully.`;
    else if (s.value >= 0.2) txt = `Sahm Rule at ${s.value.toFixed(2)}pp — above zero, signaling a weakening trajectory.`;
    else txt = `Sahm Rule at ${s.value.toFixed(2)}pp — at or near cycle low; labor market remains tight.`;
    el('note-unrate').textContent = txt;
  }
}

function renderClaimsChart() {
  const ctx = el('chart-claims');
  if (!ctx) return;
  const c = state.data.IC4WSA || [];
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{ label: 'Initial claims (4wk MA)', data: c.map(o => ({ x: o.date, y: o.value })), borderColor: '#f7a700', backgroundColor: 'rgba(247,167,0,0.10)', borderWidth: 1.6, pointRadius: 0, fill: true, tension: 0.05 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { type: 'time', ticks: { color: '#8a94a3' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#8a94a3', callback: v => `${(v / 1000).toFixed(0)}K` }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
  const cur = latest(c);
  if (cur) {
    const k = cur.value;
    const last52Min = c.length >= 52 ? Math.min(...c.slice(-52).map(o => o.value)) : null;
    const last52Max = c.length >= 52 ? Math.max(...c.slice(-52).map(o => o.value)) : null;
    el('tiles-claims').innerHTML = `
      <div class="cycle-tile" data-tile-metric="IC4WSA"><div class="cycle-tile-label">Claims (4wk MA)</div><div class="cycle-tile-value">${(k / 1000).toFixed(0)}K</div><div class="cycle-tile-sub">stress &gt; 350K</div></div>
      <div class="cycle-tile" data-tile-metric="IC4WSA"><div class="cycle-tile-label">52w range</div><div class="cycle-tile-value">${last52Min ? (last52Min / 1000).toFixed(0) : '—'}-${last52Max ? (last52Max / 1000).toFixed(0) : '—'}K</div><div class="cycle-tile-sub">expansion 200-300K</div></div>`;
    let txt = '';
    if (k > 350000) txt = `Claims at ${(k / 1000).toFixed(0)}K — labor market weakening fast; sustained level confirms recessionary regime.`;
    else if (k > 280000) txt = `Claims at ${(k / 1000).toFixed(0)}K — elevated. Watch for a sustained climb above 350K.`;
    else if (k > 230000) txt = `Claims at ${(k / 1000).toFixed(0)}K — normal expansion range.`;
    else txt = `Claims at ${(k / 1000).toFixed(0)}K — historically low; labor market remains very tight.`;
    el('note-claims').textContent = txt;
  }
}

function renderWagesChart() {
  const ctx = el('chart-wages');
  if (!ctx) return;
  const wages = state.data.CES0500000003 || [];
  const core = state.data.CPILFESL || [];
  const payems = state.data.PAYEMS || [];
  const wagesYoy = yoyPct(wages);
  const coreYoy = yoyPct(core);
  // Real wages
  const cm = new Map(coreYoy.map(o => [o.date, o.value]));
  const real = wagesYoy.filter(o => cm.has(o.date)).map(o => ({ date: o.date, value: o.value - cm.get(o.date) }));
  // Payrolls 6m annualized
  const payAnn = [];
  for (let i = 6; i < payems.length; i++) {
    const cur = payems[i].value, prev = payems[i - 6].value;
    if (Number.isFinite(cur) && Number.isFinite(prev) && prev > 0) {
      payAnn.push({ date: payems[i].date, value: (Math.pow(cur / prev, 2) - 1) * 100 });
    }
  }
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'AHE YoY (%)', data: wagesYoy.map(o => ({ x: o.date, y: o.value })), borderColor: '#3ecf8e', borderWidth: 1.6, pointRadius: 0, tension: 0.05 },
        { label: 'Real wages (AHE - Core CPI)', data: real.map(o => ({ x: o.date, y: o.value })), borderColor: '#5a9cff', borderWidth: 1.4, pointRadius: 0, tension: 0.05, borderDash: [4, 3] },
        { label: 'Payrolls 6m ann. (%)', data: payAnn.map(o => ({ x: o.date, y: o.value })), borderColor: '#f7a700', borderWidth: 1.4, pointRadius: 0, tension: 0.05 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#8a94a3', font: { size: 11 } } } },
      scales: {
        x: { type: 'time', ticks: { color: '#8a94a3' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#8a94a3', callback: v => `${v.toFixed(1)}%` }, grid: { color: 'rgba(255,255,255,0.04)' } },
      },
    },
  });
  const lw = latest(wagesYoy), lr = latest(real), lp = latest(payAnn);
  el('tiles-wages').innerHTML = `
    <div class="cycle-tile" data-tile-metric="AHE_YOY"><div class="cycle-tile-label">AHE YoY</div><div class="cycle-tile-value">${lw ? lw.value.toFixed(1) + '%' : '—'}</div><div class="cycle-tile-sub">tight &gt; 4.5%</div></div>
    <div class="cycle-tile" data-tile-metric="REAL_WAGES"><div class="cycle-tile-label">Real wages</div><div class="cycle-tile-value" style="color:${lr && lr.value < 0 ? '#ef4f5a' : '#3ecf8e'}">${lr ? (lr.value >= 0 ? '+' : '') + lr.value.toFixed(1) + 'pp' : '—'}</div><div class="cycle-tile-sub">vs core CPI</div></div>
    <div class="cycle-tile" data-tile-metric="PAYEMS_6M"><div class="cycle-tile-label">Payrolls 6m ann.</div><div class="cycle-tile-value">${lp ? (lp.value >= 0 ? '+' : '') + lp.value.toFixed(1) + '%' : '—'}</div><div class="cycle-tile-sub">expansion &gt; 1.5%</div></div>`;
  if (lw && lr) {
    let txt = `Wages running ${lw.value.toFixed(1)}% YoY; real wages ${lr.value >= 0 ? '+' : ''}${lr.value.toFixed(1)}pp vs Core CPI. `;
    if (lw.value > 4.5) txt += 'Tight labor market — bargaining power favors workers.';
    else if (lw.value > 3.5) txt += 'Moderate; near productivity-trend wage growth.';
    else txt += 'Wage growth running below 3.5% — emerging slack signal.';
    if (lr.value < 0) txt += ' Real wages negative is a direct consumer-stress signal — discretionary spending typically softens within 1-2 quarters.';
    el('note-wages').textContent = txt;
  }
}

function renderTakeaway() {
  const result = computeLaborScore(state.data);
  if (!result) return;
  const phase = phaseFor('labor', result.score);
  const txt = `Composite score is <strong style="color:${phase.color}">${result.score.toFixed(0)}/100 (${phase.label})</strong>. ${
    result.score < 25 ? 'Labor market is unambiguously tight; employment growth and wage pressure should support the consumer.' :
    result.score < 45 ? 'Labor market healthy. Watch wage growth and claims for early-warning shifts.' :
    result.score < 65 ? 'Cooling — payrolls slowing and/or claims drifting up. Discretionary spending typically softens 6-9 months from here.' :
    result.score < 80 ? 'Weakening — Sahm Rule trajectory and claims pattern suggest accelerating deterioration. Consumer-discretionary risk elevated.' :
    'Recessionary regime confirmed. Defensive labor positioning historically beats cyclical labor-sensitive sectors by 15-25%.'
  }`;
  el('labor-takeaway-text').innerHTML = txt;
}

(async function () {
  setStatus('stale', 'Loading labor data…');
  try {
    await loadAll();
    renderScoreHero();
    renderUnrateChart();
    renderClaimsChart();
    renderWagesChart();
    renderTakeaway();
    setStatus('live', 'Live — labor data current as of last FRED update');
  } catch (e) {
    console.error(e);
    setStatus('err', 'Failed to load labor data');
  }
})();

window.__downloadPageData = async function () {
  const { downloadJSON } = await import('/core/lib/csv-export.js');
  downloadJSON('labor-data.json', state.data);
};
