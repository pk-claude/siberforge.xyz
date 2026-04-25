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
} from '/core/lib/analytics.js';
import {
  buildRegimeMap,
  regimeDistribution,
  REGIMES,
} from './regimes.js';
import { buildRegimeReturnsTable } from './regime-returns.js';
import { SECTOR_PROFILES, REGIME_NARRATIVES } from './sector-profiles.js';

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
  // Regime-returns state (populated by renderRegimeReturns)
  regimeRawSeries: {},      // id -> raw observations (long history) for regime calc
  regimeMap: null,          // Map<YYYY-MM, {regime, growthZ, inflationZ}>
  regimeTable: null,        // { symbol: { regime: { 1: {mean,n}, 3: ..., 6: ... } } }
  regimeSymbols: [],        // ordered list of symbols (SPY first, then sectors)
  currentHorizon: 6,        // selected horizon in months (default 6m)
  currentRegime: null,      // string label for the most recent classified month
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

// ---------- regime-conditional sector returns ----------
//
// Replaces the old indicator-x-sector correlation heatmap. The classifier and
// aggregator live in regimes.js / regime-returns.js (pure modules); this
// section is the thin orchestration + DOM layer.

// Pull raw FRED observations with a custom start. Bypasses the macro-page
// transform pipeline; we want LEVELS so the regime classifier can compute its
// own 6-month annualized rates of change.
async function fetchRawSeries(id, start) {
  const cacheKey = `${id}|${start}`;
  if (state.regimeRawSeries[cacheKey]) return state.regimeRawSeries[cacheKey];
  const j = await fetchJSON(`/api/fred?series=${id}&start=${start}`);
  const obs = j.series[0]?.observations || [];
  state.regimeRawSeries[cacheKey] = obs;
  return obs;
}

async function renderRegimeReturns() {
  setStatus('stale', 'Loading regime data…');

  // 40y of macro: gives the trailing 120m z-score window full warmup before
  // the earliest sector ETF inception (~1998-12). FRED handles this trivially.
  const REGIME_START = `${new Date().getFullYear() - 40}-01-01`;
  const [cpi, indpro, payems, rrsfs] = await Promise.all([
    fetchRawSeries('CPILFESL', REGIME_START),
    fetchRawSeries('INDPRO',   REGIME_START),
    fetchRawSeries('PAYEMS',   REGIME_START),
    fetchRawSeries('RRSFS',    REGIME_START),
  ]);

  // 30y of equity history (max we allow at the API). Sector ETFs back to 1998.
  const sectors = state.tickers.filter(t => t.group === 'sector').map(t => t.symbol);
  const sym = ['SPY', ...sectors];
  const history = await loadStockHistory(sym, 30);

  // Build the regime map (Map<YYYY-MM, {regime, growthZ, inflationZ}>)
  const regimeMap = buildRegimeMap({ cpi, indpro, payems, rrsfs });
  state.regimeMap = regimeMap;
  state.regimeSymbols = sym;

  // Console diagnostic: distribution should be roughly balanced if the trailing
  // z-window is doing its job. Wildly skewed (e.g., 80% in one quadrant)
  // suggests the window or the composite needs adjusting.
  const dist = regimeDistribution(regimeMap);
  console.log('[regime] classified months:', regimeMap.size, dist);

  // Aggregate forward returns by regime per symbol.
  state.regimeTable = buildRegimeReturnsTable(history, regimeMap, [1, 3, 6]);

  // Identify the current (most recent) regime.
  const months = [...regimeMap.keys()].sort();
  const currentYm = months[months.length - 1];
  const currentInfo = currentYm ? regimeMap.get(currentYm) : null;
  state.currentRegime = currentInfo?.regime || null;

  renderCurrentRegimeTile(currentYm, currentInfo, regimeMap);
  renderRegimeTable();
  renderRegimeInterpretation();
  wireHorizonTabs();

  setStatus('live', 'Live — prices refresh every 60s');
}

// Top tile: current regime badge + growth/inflation z-scores + persistence.
function renderCurrentRegimeTile(currentYm, info, regimeMap) {
  const tile = el('regime-current');
  if (!tile) return;
  if (!info) {
    tile.innerHTML = '<div class="regime-current-empty">Insufficient history to classify current regime.</div>';
    return;
  }
  const meta = REGIMES[info.regime];

  // Count how many of the most recent consecutive months share the current regime.
  const months = [...regimeMap.keys()].sort();
  let streak = 0;
  for (let i = months.length - 1; i >= 0; i--) {
    if (regimeMap.get(months[i]).regime === info.regime) streak++;
    else break;
  }

  // Pretty date: "April 2026" rather than "2026-04"
  const [y, m] = currentYm.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  tile.innerHTML = `
    <div class="regime-badge" style="--regime-color: ${meta.color}">
      <div class="regime-badge-label">CURRENT REGIME</div>
      <div class="regime-badge-name">${meta.label}</div>
      <div class="regime-badge-desc">${meta.desc}</div>
    </div>
    <div class="regime-stats">
      <div class="regime-stat">
        <div class="regime-stat-label">Growth z-score</div>
        <div class="regime-stat-value ${info.growthZ >= 0 ? 'pos' : 'neg'}">${info.growthZ >= 0 ? '+' : ''}${fmt(info.growthZ, 2)}</div>
        <div class="regime-stat-sub">composite: INDPRO + payrolls + real retail</div>
      </div>
      <div class="regime-stat">
        <div class="regime-stat-label">Inflation z-score</div>
        <div class="regime-stat-value ${info.inflationZ >= 0 ? 'pos' : 'neg'}">${info.inflationZ >= 0 ? '+' : ''}${fmt(info.inflationZ, 2)}</div>
        <div class="regime-stat-sub">Core CPI 6m annualized</div>
      </div>
      <div class="regime-stat">
        <div class="regime-stat-label">As of</div>
        <div class="regime-stat-value">${monthName}</div>
        <div class="regime-stat-sub">${streak} consecutive month${streak === 1 ? '' : 's'} in this regime</div>
      </div>
    </div>
  `;
}

// Render the regime × symbol returns table for the currently selected horizon.
function renderRegimeTable() {
  const tgt = el('regime-table');
  if (!tgt || !state.regimeTable) return;
  const sym = state.regimeSymbols;
  const horizon = state.currentHorizon;
  // Color saturates at ±2.5%/month equivalent — tightens with longer horizon.
  const colorScale = horizon * 2.5;

  // Header row: column tooltips describe the sector itself (no regime context).
  const headerCells = sym.map(s => {
    const profile = SECTOR_PROFILES[s];
    const lbl = profile?.label || s;
    return `<th data-tooltip-kind="sector" data-tooltip-sym="${s}" title="${lbl}">${s}</th>`;
  }).join('');
  const header = `<tr><th class="regime-col-label">Regime</th>${headerCells}</tr>`;

  const regimeOrder = ['goldilocks', 'reflation', 'stagflation', 'disinflation'];
  const body = regimeOrder.map(r => {
    const meta = REGIMES[r];
    const rowClass = state.currentRegime === r ? 'regime-row current' : 'regime-row';
    // Row-label tooltip: the regime's macro narrative.
    const labelCell = `
      <td class="regime-col-label" data-tooltip-kind="regime" data-tooltip-regime="${r}">
        <span class="regime-dot" style="background:${meta.color}"></span>
        <span class="regime-row-name">${meta.label}</span>
        <span class="regime-row-desc">${meta.short}</span>
      </td>`;
    const cells = sym.map(s => {
      const cell = state.regimeTable[s]?.[r]?.[horizon];
      if (!cell || cell.n === 0) {
        return `<td class="regime-cell empty" data-tooltip-kind="cell" data-tooltip-sym="${s}" data-tooltip-regime="${r}">—</td>`;
      }
      const ret = cell.mean;
      // Diverging color: red (negative) -> neutral (0) -> green (positive).
      const t = Math.max(-1, Math.min(1, ret / colorScale));
      let bg;
      if (t >= 0) bg = `rgba(62, 207, 142, ${0.10 + 0.55 * t})`;
      else        bg = `rgba(239, 79, 90,  ${0.10 + 0.55 * -t})`;
      // Sample-size opacity: cells with n < 12 fade out.
      const opacity = cell.n >= 24 ? 1 : cell.n >= 12 ? 0.75 : 0.45;
      const sign = ret > 0 ? '+' : '';
      return `<td class="regime-cell" style="background:${bg};opacity:${opacity}"
                  data-tooltip-kind="cell" data-tooltip-sym="${s}" data-tooltip-regime="${r}">
        <div class="regime-cell-ret">${sign}${fmt(ret, 1)}%</div>
        <div class="regime-cell-n">n=${cell.n}</div>
      </td>`;
    }).join('');
    return `<tr class="${rowClass}">${labelCell}${cells}</tr>`;
  }).join('');

  tgt.innerHTML = `<table class="regime-returns-table">${header}${body}</table>`;
  wireRegimeTooltip();
}

// Custom hover tooltip for the regime returns table.
//
// Three kinds of tooltip content (selected via data-tooltip-kind on the target):
//   sector — column header on a ticker; explains what the sector IS.
//   regime — row label; explains the regime's macro thesis.
//   cell   — body cell; combines sector profile + regime-specific "so what" +
//            numbers + delta vs SPY in the same cell.
function wireRegimeTooltip() {
  let tooltipEl = document.getElementById('regime-tooltip');
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'regime-tooltip';
    tooltipEl.className = 'regime-tooltip';
    tooltipEl.style.display = 'none';
    document.body.appendChild(tooltipEl);
  }

  const horizon = state.currentHorizon;
  const horizonLabel = horizon === 1 ? '1m' : horizon === 3 ? '3m' : '6m';

  // Build tooltip HTML based on what's being hovered.
  function buildContent(target) {
    const kind = target.dataset.tooltipKind;
    if (kind === 'sector') {
      const profile = SECTOR_PROFILES[target.dataset.tooltipSym];
      if (!profile) return '';
      return `
        <div class="rt-title">${target.dataset.tooltipSym} &middot; ${profile.label}</div>
        <div class="rt-body">${profile.description}</div>
        <div class="rt-foot">Hover any cell in this column for the regime-specific implication.</div>
      `;
    }
    if (kind === 'regime') {
      const r = target.dataset.tooltipRegime;
      const narr = REGIME_NARRATIVES[r];
      const meta = REGIMES[r];
      if (!narr) return '';
      return `
        <div class="rt-title" style="color:${meta.color}">${narr.title}</div>
        <div class="rt-body">${narr.body}</div>
      `;
    }
    if (kind === 'cell') {
      const sym = target.dataset.tooltipSym;
      const r = target.dataset.tooltipRegime;
      const profile = SECTOR_PROFILES[sym];
      const meta = REGIMES[r];
      const cell = state.regimeTable?.[sym]?.[r]?.[horizon];
      const spyCell = state.regimeTable?.SPY?.[r]?.[horizon];
      if (!profile || !meta) return '';
      const narrative = profile.byRegime[r] || '';

      let numbers = '';
      if (cell && cell.n > 0) {
        const sign = cell.mean > 0 ? '+' : '';
        let deltaTxt = '';
        if (sym !== 'SPY' && spyCell && spyCell.n > 0) {
          const delta = cell.mean - spyCell.mean;
          const deltaSign = delta > 0 ? '+' : '';
          const deltaClass = delta >= 0 ? 'rt-delta-pos' : 'rt-delta-neg';
          deltaTxt = ` &middot; <span class="${deltaClass}">${deltaSign}${fmt(delta, 1)}pp vs SPY</span>`;
        }
        numbers = `
          <div class="rt-stats">
            <strong>${sign}${fmt(cell.mean, 1)}%</strong> avg forward ${horizonLabel}
            ${deltaTxt}
            <br>
            <span class="rt-sub">σ=${fmt(cell.std, 1)}% &middot; n=${cell.n} historical months</span>
          </div>`;
      } else {
        numbers = `<div class="rt-stats"><span class="rt-sub">No observations at this horizon (sector inception too recent or rare regime).</span></div>`;
      }

      return `
        <div class="rt-title">${sym} &middot; <span style="color:${meta.color}">${meta.label}</span></div>
        <div class="rt-body">${profile.description}</div>
        <div class="rt-mech"><strong>Why this regime:</strong> ${narrative}</div>
        ${numbers}
      `;
    }
    return '';
  }

  function position(e) {
    // Place near the cursor, but flip to left/above when near the viewport edge.
    const PAD = 14;
    const w = tooltipEl.offsetWidth;
    const h = tooltipEl.offsetHeight;
    let x = e.clientX + PAD;
    let y = e.clientY + PAD;
    if (x + w + 8 > window.innerWidth)  x = e.clientX - w - PAD;
    if (y + h + 8 > window.innerHeight) y = e.clientY - h - PAD;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top  = y + 'px';
  }

  // Use mouseover/mouseout (bubbling) on the table so we attach one listener.
  const table = el('regime-table');
  if (!table) return;
  // Strip the lazy "title" attribute fallback so it doesn't double-render with our tooltip.
  table.querySelectorAll('[title]').forEach(n => { n.dataset.lazyTitle = n.title; n.removeAttribute('title'); });

  table.addEventListener('mouseover', (e) => {
    const tgt = e.target.closest('[data-tooltip-kind]');
    if (!tgt) return;
    const html = buildContent(tgt);
    if (!html) return;
    tooltipEl.innerHTML = html;
    tooltipEl.style.display = 'block';
    position(e);
  });
  table.addEventListener('mousemove', (e) => {
    if (tooltipEl.style.display !== 'block') return;
    position(e);
  });
  table.addEventListener('mouseout', (e) => {
    // Hide only when leaving the labeled element entirely (not entering a child).
    const tgt = e.target.closest('[data-tooltip-kind]');
    if (!tgt) return;
    const next = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-tooltip-kind]');
    if (next === tgt) return;
    tooltipEl.style.display = 'none';
  });
}

// One-sentence interpretation auto-generated from the current regime's row.
function renderRegimeInterpretation() {
  const note = el('regime-interpretation');
  if (!note || !state.currentRegime || !state.regimeTable) return;
  const horizon = state.currentHorizon;
  const sym = state.regimeSymbols.filter(s => s !== 'SPY');
  // Find best/worst sectors at the current horizon for the current regime.
  const cells = sym
    .map(s => ({ s, c: state.regimeTable[s]?.[state.currentRegime]?.[horizon] }))
    .filter(o => o.c && o.c.n >= 12);
  if (!cells.length) {
    note.textContent = '';
    return;
  }
  cells.sort((a, b) => b.c.mean - a.c.mean);
  const best = cells[0];
  const worst = cells[cells.length - 1];
  const spy = state.regimeTable['SPY']?.[state.currentRegime]?.[horizon];

  const meta = REGIMES[state.currentRegime];
  const horizonLabel = horizon === 1 ? '1-month' : horizon === 3 ? '3-month' : '6-month';
  const tickerLabels = Object.fromEntries(state.tickers.map(t => [t.symbol, t.label]));
  const lbl = s => (tickerLabels[s] || s).replace(/\s*\([^)]+\)/, '');

  const spyTxt = spy && spy.n
    ? `SPY averaged ${spy.mean >= 0 ? '+' : ''}${fmt(spy.mean, 1)}% (n=${spy.n}). `
    : '';
  note.innerHTML = `
    <strong>How to read this</strong> — in <span style="color:${meta.color}">${meta.label}</span>
    regimes since the data starts, the average forward ${horizonLabel} total return for
    ${spyTxt}
    Best sector: <strong>${best.s}</strong> (${lbl(best.s)}) at
    ${best.c.mean >= 0 ? '+' : ''}${fmt(best.c.mean, 1)}% (n=${best.c.n}, σ=${fmt(best.c.std, 1)}%).
    Worst: <strong>${worst.s}</strong> (${lbl(worst.s)}) at
    ${worst.c.mean >= 0 ? '+' : ''}${fmt(worst.c.mean, 1)}% (n=${worst.c.n}).
    Cells faded for n&lt;24; greyed for n&lt;12. Past base rates, not forecasts.
  `;
}

// Horizon tab clicks swap the displayed return horizon without re-fetching.
function wireHorizonTabs() {
  document.querySelectorAll('.h-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const h = Number(btn.dataset.h);
      if (!Number.isFinite(h) || h === state.currentHorizon) return;
      state.currentHorizon = h;
      document.querySelectorAll('.h-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRegimeTable();
      renderRegimeInterpretation();
    });
  });
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
    if (meta.group === 'econ') continue; // skip econ-only entries
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
    await renderRegimeReturns();

    // Refresh quotes every 60s. Macro/history are cached heavily upstream.
    setInterval(() => {
      loadQuotes().catch(showErr);
    }, 60_000);
  } catch (err) {
    showErr(err);
  }
}

main();
