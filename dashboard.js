// Front-end controller: loads catalogs, fetches series, computes correlations,
// renders tabs + quote strip, refreshes prices on a 60s interval.

import {
  applyTransform,
  alignForward,
  rollingCorrelation,
  regression,
  pearson,
  zscore,
  logReturns,
} from '/lib/analytics.js';

// ---------- state ----------
const state = {
  catalog: null,            // FRED catalog keyed by series_id
  tickers: [],              // stock ticker catalog
  indicator: 'CPIAUCSL',    // default
  benchmark: 'SPY',         // default
  years: 5,
  window: 90,
  macroSeries: {},          // id -> transformed series [{date,value}]
  stockHistory: {},         // symbol -> closes [{date,value}]
  quotes: [],
  quotesFetchedAt: 0,
};

const charts = { rolling: null, regression: null, overlay: null };

// ---------- small helpers ----------
function el(id) { return document.getElementById(id); }
function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }
function setStatus(kind, text) {
  el('refresh-indicator').className = `dot ${kind}`;
  el('refresh-text').textContent = text;
}

// ---------- data fetching ----------
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${url} -> ${res.status} ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function loadCatalogs() {
  const [fred, fin] = await Promise.all([
    fetchJSON('/api/fred?catalog=1'),
    fetchJSON('/api/stocks?mode=catalog'),
  ]);
  state.catalog = fred.catalog;
  state.tickers = fin.tickers;
}

async function loadIndicator(id) {
  if (state.macroSeries[id]) return state.macroSeries[id];
  const start = `${new Date().getFullYear() - 20}-01-01`;
  const j = await fetchJSON(`/api/fred?series=${id}&start=${start}`);
  const raw = j.series[0].observations;
  const meta = state.catalog[id];
  const transformed = applyTransform(raw, meta.transform);
  state.macroSeries[id] = { raw, transformed, meta };
  return state.macroSeries[id];
}

async function loadStockHistory(symbols, years) {
  const key = `${symbols.join(',')}|${years}`;
  if (state.stockHistory[key]) return state.stockHistory[key];
  const j = await fetchJSON(`/api/stocks?mode=history&years=${years}&symbols=${symbols.join(',')}`);
  const out = {};
  for (const s of j.series) out[s.symbol] = s.closes;
  state.stockHistory[key] = out;
  return out;
}

async function loadQuotes() {
  const j = await fetchJSON('/api/stocks?mode=quote');
  state.quotes = j.quotes;
  state.quotesFetchedAt = j.ts;
  renderQuotes();
}

// ---------- rendering: quotes strip ----------
function renderQuotes() {
  const strip = el('quotes-strip');
  const byLabel = Object.fromEntries(state.tickers.map(t => [t.symbol, t]));
  strip.innerHTML = '';
  for (const q of state.quotes) {
    const meta = byLabel[q.symbol] || { label: q.symbol };
    const dir = q.changePct > 0 ? 'up' : q.changePct < 0 ? 'down' : 'flat';
    const sign = q.changePct > 0 ? '+' : '';
    const tile = document.createElement('div');
    tile.className = 'quote-tile';
    tile.innerHTML = `
      <span class="sym">${q.symbol} &middot; ${meta.label.replace(/\s*\([^)]+\)/, '')}</span>
      <span class="px">$${fmt(q.price)}</span>
      <span class="ch ${dir}">${sign}${fmt(q.change)} (${sign}${fmt(q.changePct)}%)</span>
    `;
    strip.appendChild(tile);
  }
}

// ---------- chart rendering ----------
function destroy(name) {
  if (charts[name]) { charts[name].destroy(); charts[name] = null; }
}

function renderRolling(macroTransformed, stockCloses) {
  const returns = logReturns(stockCloses);
  const aligned = alignForward(macroTransformed, returns);
  const roll = rollingCorrelation(aligned, state.window);
  const overall = pearson(aligned.x, aligned.y);

  destroy('rolling');
  const ctx = el('chart-rolling').getContext('2d');
  charts.rolling = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: `Rolling ${state.window}d corr`,
          data: roll.map(p => ({ x: p.date, y: p.value })),
          borderColor: '#f7a700',
          backgroundColor: 'rgba(247, 167, 0, 0.1)',
          borderWidth: 1.5,
          tension: 0.1,
          fill: true,
          pointRadius: 0,
        },
      ],
    },
    options: baseChartOptions({
      yMin: -1, yMax: 1,
      yTicks: v => v.toFixed(1),
      yTitle: 'correlation',
    }),
  });

  el('rolling-note').textContent =
    `Full-period Pearson r = ${fmt(overall, 3)} across ${aligned.x.length} daily observations. ` +
    `Rolling window captures regime shifts — when r crosses zero, the relationship flipped sign.`;
}

function renderRegression(macroTransformed, stockCloses) {
  const returns = logReturns(stockCloses);
  const aligned = alignForward(macroTransformed, returns);
  const reg = regression(aligned.x, aligned.y);

  const scatter = aligned.x.map((xv, i) => ({ x: xv, y: aligned.y[i] * 100 })); // convert daily log return to %

  const xs = aligned.x;
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const line = [
    { x: minX, y: (reg.alpha + reg.beta * minX) * 100 },
    { x: maxX, y: (reg.alpha + reg.beta * maxX) * 100 },
  ];

  destroy('regression');
  const ctx = el('chart-regression').getContext('2d');
  charts.regression = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'obs',
          data: scatter,
          backgroundColor: 'rgba(90, 156, 255, 0.35)',
          borderColor: 'rgba(90, 156, 255, 0.6)',
          pointRadius: 2,
        },
        {
          type: 'line',
          label: `OLS fit (β=${fmt(reg.beta, 4)})`,
          data: line,
          borderColor: '#f7a700',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: legendPlugin(),
      scales: {
        x: { type: 'linear', grid: gridColor(), ticks: tickColor(), title: axisTitle('indicator (transformed)') },
        y: { type: 'linear', grid: gridColor(), ticks: tickColor(), title: axisTitle('daily return (%)') },
      },
    },
  });

  el('regression-note').textContent =
    `β = ${fmt(reg.beta, 4)}, α = ${fmt(reg.alpha, 4)}, R² = ${fmt(reg.r2, 3)}, n = ${reg.n}. ` +
    `Beta is the expected percentage-point change in ${state.benchmark} daily return per 1-unit change in the indicator. ` +
    `Low R² is normal here — macro alone doesn't explain much daily variance.`;
}

function renderOverlay(macroTransformed, stockCloses) {
  // Overlay normalized (z-scored) indicator against normalized price level.
  const macroZ = zscore(macroTransformed);
  const priceZ = zscore(stockCloses);

  destroy('overlay');
  const ctx = el('chart-overlay').getContext('2d');
  charts.overlay = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [
        {
          label: `${state.catalog[state.indicator].label} (z)`,
          data: macroZ.map(p => ({ x: p.date, y: p.value })),
          borderColor: '#5a9cff',
          borderWidth: 1.5,
          tension: 0.1,
          pointRadius: 0,
        },
        {
          label: `${state.benchmark} price (z)`,
          data: priceZ.map(p => ({ x: p.date, y: p.value })),
          borderColor: '#3ecf8e',
          borderWidth: 1.5,
          tension: 0.1,
          pointRadius: 0,
        },
      ],
    },
    options: baseChartOptions({ yTitle: 'z-score' }),
  });

  el('overlay-note').textContent =
    `Both series standardized (z-score) over the visible window. Divergences highlight where the indicator and price are telling different stories.`;
}

function baseChartOptions({ yMin, yMax, yTicks, yTitle }) {
  const o = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    plugins: legendPlugin(),
    scales: {
      x: {
        type: 'time',
        time: { unit: 'month' },
        grid: gridColor(),
        ticks: tickColor(),
      },
      y: {
        grid: gridColor(),
        ticks: { ...tickColor().ticks, callback: yTicks },
        title: axisTitle(yTitle),
      },
    },
  };
  if (yMin !== undefined) o.scales.y.min = yMin;
  if (yMax !== undefined) o.scales.y.max = yMax;
  return o;
}

function gridColor() { return { grid: { color: 'rgba(255,255,255,0.04)' } }; }
function tickColor() { return { ticks: { color: '#8a94a3', font: { size: 10 } } }; }
function axisTitle(text) { return { display: !!text, text, color: '#8a94a3', font: { size: 11 } }; }
function legendPlugin() {
  return {
    legend: { labels: { color: '#e5e9ee', font: { size: 11 }, boxWidth: 12 } },
    tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1 },
  };
}

// ---------- heatmap (indicator x sector) ----------
async function renderHeatmap() {
  const indicators = Object.keys(state.catalog);
  const sectors = state.tickers.filter(t => t.group === 'sector').map(t => t.symbol);
  const sym = ['SPY', ...sectors];
  const history = await loadStockHistory(sym, 10);

  // Pre-compute returns for every symbol once.
  const rets = {};
  for (const s of sym) rets[s] = logReturns(history[s] || []);

  // Load every indicator once.
  await Promise.all(indicators.map(id => loadIndicator(id)));

  const rows = [];
  for (const id of indicators) {
    const macro = state.macroSeries[id].transformed;
    const row = { id, label: state.catalog[id].label, cells: [] };
    for (const s of sym) {
      const aligned = alignForward(macro, rets[s]);
      const r = pearson(aligned.x, aligned.y);
      row.cells.push({ symbol: s, r, n: aligned.x.length });
    }
    rows.push(row);
  }

  const tgt = el('heatmap');
  const header = `<tr><th class="label">Indicator</th>${sym.map(s => `<th>${s}</th>`).join('')}</tr>`;
  const body = rows.map(r => {
    const cells = r.cells.map(c => {
      const r2 = Number.isFinite(c.r) ? c.r : 0;
      // Linear gradient: red (-0.5) -> neutral (0) -> green (+0.5). Clamp outside.
      const t = Math.max(-0.5, Math.min(0.5, r2)) / 0.5; // -1..1
      let bg;
      if (t >= 0) bg = `rgba(62, 207, 142, ${0.1 + 0.55 * t})`;
      else bg = `rgba(239, 79, 90, ${0.1 + 0.55 * -t})`;
      return `<td style="background:${bg}">${fmt(c.r, 2)}</td>`;
    }).join('');
    return `<tr><td class="label">${r.label}</td>${cells}</tr>`;
  }).join('');
  tgt.innerHTML = `<table>${header}${body}</table>`;
}

// ---------- orchestration ----------
async function rerenderActive() {
  setStatus('stale', 'Loading series…');
  const { transformed } = await loadIndicator(state.indicator);
  const history = await loadStockHistory([state.benchmark], state.years);
  const closes = history[state.benchmark] || [];
  // Truncate macro to stock date window so transforms stay visible.
  const windowStart = closes.length ? closes[0].date : null;
  const macro = windowStart ? transformed.filter(o => o.date >= windowStart) : transformed;

  renderRolling(macro, closes);
  renderRegression(macro, closes);
  renderOverlay(macro, closes);

  el('last-updated').textContent = `Series updated ${new Date().toLocaleString()}`;
  setStatus('live', 'Live — prices refresh every 60s');
}

function wireControls() {
  // Populate indicator dropdown, grouped visually by inserting separators.
  const indSel = el('indicator-select');
  for (const [id, meta] of Object.entries(state.catalog)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${meta.label} (${id})`;
    if (id === state.indicator) opt.selected = true;
    indSel.appendChild(opt);
  }

  const benSel = el('benchmark-select');
  for (const t of state.tickers) {
    const opt = document.createElement('option');
    opt.value = t.symbol;
    opt.textContent = `${t.symbol} — ${t.label}`;
    if (t.symbol === state.benchmark) opt.selected = true;
    benSel.appendChild(opt);
  }

  indSel.addEventListener('change', () => { state.indicator = indSel.value; rerenderActive().catch(showErr); });
  benSel.addEventListener('change', () => { state.benchmark = benSel.value; rerenderActive().catch(showErr); });
  el('years-select').addEventListener('change', e => { state.years = Number(e.target.value); rerenderActive().catch(showErr); });
  el('window-select').addEventListener('change', e => { state.window = Number(e.target.value); rerenderActive().catch(showErr); });

  // Tab switching
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      el(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
}

function showErr(err) {
  console.error(err);
  setStatus('error', `Error: ${err.message}`);
}

async function main() {
  try {
    setStatus('stale', 'Loading catalogs…');
    await loadCatalogs();
    wireControls();
    await loadQuotes();
    await rerenderActive();
    await renderHeatmap();

    // Refresh quotes every 60s. Macro/history are cached heavily upstream.
    setInterval(() => {
      loadQuotes().catch(showErr);
    }, 60_000);
  } catch (err) {
    showErr(err);
  }
}

main();
