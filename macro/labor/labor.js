// Labor Market deep-dive controller. Pulls UNRATE, IC4WSA, PAYEMS,
// CES0500000003 (AHE), CPILFESL (for real-wages context) and renders
// composite score, three time-series charts, threshold tiles, and a
// data-driven narrative.

import { renderMethodology as shared_renderMethodology, computeLaborScore, phaseFor, computeSahm, yoyPct, synthesisHtml, realWages, headerHtml } from '/lib/composite-scores.js';
import { asOfLine } from '/lib/sf-kit.js';

const SERIES = ['UNRATE', 'IC4WSA', 'PAYEMS', 'CES0500000003', 'CPIAUCSL', 'SAHMREALTIME'];
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
        <div class="cs-weights-note">Each signal is scored as its percentile within its own last 20 years (100 = most risk); weights and transforms under "How this score is built".</div>
      </div>
    </div>
  `;
  shared_renderMethodology(tgt, 'labor');
}

function renderUnrateChart() {
  const ctx = el('chart-unrate');
  if (!ctx) return;
  const u = state.data.UNRATE || [];
  // First-release Sahm rule from FRED where it exists; the same rule computed
  // from today's revised unemployment rate before that.
  const rt = state.data.SAHMREALTIME || [];
  const sahm = rt.length ? [...computeSahm(u).filter(o => o.date < rt[0].date), ...rt] : computeSahm(u);
  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        { label: 'Unemployment rate', data: u.map(o => ({ x: o.date, y: o.value })), borderColor: '#5a9cff', backgroundColor: 'rgba(90,156,255,0.10)', borderWidth: 1.6, pointRadius: 0, fill: true, tension: 0.05, yAxisID: 'y' },
        { label: 'Sahm rule, real-time (pp)', data: sahm.map(o => ({ x: o.date, y: o.value })), borderColor: '#ef4f5a', borderWidth: 1.4, pointRadius: 0, tension: 0.05, yAxisID: 'y2' },
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
    <div class="cycle-tile" data-tile-metric="UNRATE"><div class="cycle-tile-label">Unemployment rate</div><div class="cycle-tile-value">${cur ? cur.value.toFixed(1) + '%' : '—'}</div><div class="cycle-tile-sub">12-month low ${u.length ? Math.min(...u.slice(-12).map(o => o.value)).toFixed(1) : '—'}%</div></div>
    <div class="cycle-tile" data-tile-metric="SAHM"><div class="cycle-tile-label">Sahm Rule</div><div class="cycle-tile-value" style="color:${s && s.value >= 0.5 ? '#ef4f5a' : s && s.value >= 0.4 ? '#f7a700' : '#3ecf8e'}">${s ? s.value.toFixed(2) + 'pp' : '—'}</div><div class="cycle-tile-sub">trigger 0.50pp</div></div>`;
  if (s) {
    let txt = '';
    if (s.value >= 0.5) txt = `Sahm rule at ${s.value.toFixed(2)}pp: at or above the 0.50pp trigger.`;
    else if (s.value >= 0.4) txt = `Sahm rule at ${s.value.toFixed(2)}pp: close to the 0.50pp trigger.`;
    else if (s.value >= 0.2) txt = `Sahm rule at ${s.value.toFixed(2)}pp: the 3-month average jobless rate is rising, but is under half-way to the trigger.`;
    else txt = `Sahm rule at ${s.value.toFixed(2)}pp: the 3-month average jobless rate is at or near its 12-month low.`;
    if (cur) txt += ` Unemployment is ${cur.value.toFixed(1)}%.`;
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
      <div class="cycle-tile" data-tile-metric="IC4WSA"><div class="cycle-tile-label">Claims (4wk MA)</div><div class="cycle-tile-value">${(k / 1000).toFixed(0)}K</div><div class="cycle-tile-sub">passed 350K around the start of the 2001 and 2008 recessions</div></div>
      <div class="cycle-tile" data-tile-metric="IC4WSA"><div class="cycle-tile-label">52w range</div><div class="cycle-tile-value">${last52Min ? (last52Min / 1000).toFixed(0) : '—'}-${last52Max ? (last52Max / 1000).toFixed(0) : '—'}K</div><div class="cycle-tile-sub">lowest and highest of the last 52 weeks</div></div>`;
    let txt = '';
    if (k > 350000) txt = `Claims at ${(k / 1000).toFixed(0)}K: a level reached around the start of the 2001 and 2008 recessions.`;
    else if (k > 280000) txt = `Claims at ${(k / 1000).toFixed(0)}K: above the 200–275K of recent expansions.`;
    else if (k > 230000) txt = `Claims at ${(k / 1000).toFixed(0)}K: within the range of recent expansions.`;
    else txt = `Claims at ${(k / 1000).toFixed(0)}K: layoffs are historically low. That measures firing, not hiring.`;
    el('note-claims').textContent = txt;
  }
}

function renderWagesChart() {
  const ctx = el('chart-wages');
  if (!ctx) return;
  const wages = state.data.CES0500000003 || [];
  const payems = state.data.PAYEMS || [];
  const wagesYoy = yoyPct(wages);
  // Real wages: hourly earnings YoY minus headline CPI YoY (shared definition).
  const real = realWages(state.data);
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
        { label: 'Real wages (AHE - CPI)', data: real.map(o => ({ x: o.date, y: o.value })), borderColor: '#5a9cff', borderWidth: 1.4, pointRadius: 0, tension: 0.05, borderDash: [4, 3] },
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
    <div class="cycle-tile" data-tile-metric="AHE_YOY"><div class="cycle-tile-label">AHE YoY</div><div class="cycle-tile-value">${lw ? lw.value.toFixed(1) + '%' : '—'}</div><div class="cycle-tile-sub">2015–19 average 2.7%</div></div>
    <div class="cycle-tile" data-tile-metric="REAL_WAGES"><div class="cycle-tile-label">Real wages</div><div class="cycle-tile-value" style="color:${lr && lr.value < 0 ? '#ef4f5a' : '#3ecf8e'}">${lr ? (lr.value >= 0 ? '+' : '') + lr.value.toFixed(1) + 'pp' : '—'}</div><div class="cycle-tile-sub">wage growth less CPI inflation</div></div>
    <div class="cycle-tile" data-tile-metric="PAYEMS_6M"><div class="cycle-tile-label">Payrolls 6m ann.</div><div class="cycle-tile-value">${lp ? (lp.value >= 0 ? '+' : '') + lp.value.toFixed(1) + '%' : '—'}</div><div class="cycle-tile-sub">2015–19 average 1.6%</div></div>`;
  if (lw && lr) {
    let txt = `Average hourly earnings are up ${lw.value.toFixed(1)}% on the year; after CPI inflation that is ${lr.value >= 0 ? '+' : ''}${lr.value.toFixed(1)}pp in real terms`;
    txt += lr.value < 0 ? ', so pay is losing ground to prices.' : ', so pay is outpacing prices.';
    if (lp) txt += ` Payrolls have grown at a ${lp.value.toFixed(1)}% annualized pace over six months${lp.value < 1 ? ', below the roughly 1% that keeps pace with labor-force growth' : ''}.`;
    el('note-wages').textContent = txt;
  }
}

function renderTakeaway() {
  const result = computeLaborScore(state.data);
  if (!result) return;
  const txt = synthesisHtml('labor', state.data, result);
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
    // Shared page header: one computed line and the data dates.
    { const v = document.getElementById('verdict'); if (v) v.innerHTML = headerHtml('labor', state.data); }
    asOfLine('asof', state.data);
    setStatus('live', 'Snapshot data');
  } catch (e) {
    console.error(e);
    setStatus('err', 'Failed to load labor data');
  }
})();

window.__downloadPageData = async function () {
  const { downloadJSON } = await import('/lib/csv-export.js');
  downloadJSON('labor-data.json', state.data);
};
