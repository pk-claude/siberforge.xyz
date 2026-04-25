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
  smoothCurrentRegime,
  sixMonthAnnualized,
  toMonthlyMap,
  REGIMES,
} from './regimes.js';
import { buildRegimeReturnsTable } from './regime-returns.js';
import { SECTOR_PROFILES, REGIME_NARRATIVES } from './sector-profiles.js';
import { ETF_HOLDINGS } from './holdings.js';

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
  // NBER recession ranges (populated once on first need). Each entry: { start, end }
  // in YYYY-MM-DD form. Used to shade recessions on time-series charts.
  recessionRanges: null,
  // Regime-returns state (populated by renderRegimeReturns)
  regimeRawSeries: {},      // id -> raw observations (long history) for regime calc
  regimeMap: null,          // Map<YYYY-MM, {regime, growthZ, inflationZ}>
  regimeTable: null,        // { symbol: { regime: { 1: {mean,n}, 3: ..., 6: ... } } }
  regimeSymbols: [],        // ordered list of symbols (SPY first, then sectors)
  currentHorizon: 6,        // selected horizon in months (default 6m)
  currentRegime: null,      // string label for the smoothed current regime (3m majority vote)
  currentRegimeRaw: null,   // unsmoothed most-recent month regime (for diagnostics)
  currentRegimeInfo: null,  // { regime, ym, votes, window } from smoothCurrentRegime
  returnMode: 'absolute',   // 'absolute' | 'excess' — toggle on the returns table
};

const charts = { rolling: null, regression: null, overlay: null, trajectory: null };

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

// Fetch NBER USREC monthly indicator (1 = recession, 0 = expansion) and reduce
// to discrete recession ranges. Used by the rolling-correlation chart's
// recession-shading plugin. Cached after first call — NBER doesn't update often.
async function loadRecessionRanges() {
  if (state.recessionRanges) return state.recessionRanges;
  const start = '1960-01-01';
  const j = await fetchJSON(`/api/fred?series=USREC&start=${start}`);
  const obs = j.series[0]?.observations || [];
  // Reduce 1/0 monthly series to ranges of contiguous 1s.
  const ranges = [];
  let inRecession = false, rangeStart = null;
  for (const o of obs) {
    const v = Number(o.value);
    if (v === 1 && !inRecession) { rangeStart = o.date; inRecession = true; }
    else if (v === 0 && inRecession) { ranges.push({ start: rangeStart, end: o.date }); inRecession = false; }
  }
  if (inRecession && rangeStart) ranges.push({ start: rangeStart, end: obs[obs.length - 1].date });
  state.recessionRanges = ranges;
  return ranges;
}

// Chart.js plugin that shades NBER recessions as low-opacity vertical bands.
// Pass the ranges via plugin options so the same plugin instance can be reused.
const nberShadingPlugin = {
  id: 'nberShading',
  beforeDatasetsDraw(chart, args, opts) {
    const ranges = opts?.ranges;
    if (!ranges || !ranges.length) return;
    const { ctx, chartArea: a, scales: s } = chart;
    if (!a || !s.x) return;
    ctx.save();
    ctx.fillStyle = 'rgba(239, 79, 90, 0.10)';
    for (const r of ranges) {
      const x1 = s.x.getPixelForValue(new Date(r.start).getTime());
      const x2 = s.x.getPixelForValue(new Date(r.end).getTime());
      // Skip ranges entirely outside the visible window.
      if (x2 < a.left || x1 > a.right) continue;
      const left  = Math.max(x1, a.left);
      const right = Math.min(x2, a.right);
      ctx.fillRect(left, a.top, right - left, a.bottom - a.top);
    }
    ctx.restore();
  },
};

async function loadQuotes() {
  const j = await fetchJSON('/api/stocks?mode=quote');
  state.quotes = j.quotes;
  state.quotesFetchedAt = j.ts;
  renderQuotes();
}

// ---------- rendering: quotes strip ----------
//
// Tiles are clickable (navigate to /core/macro/ticker.html?sym=XXX) and have a
// hover popup showing the ETF's top holdings + their daily moves, sorted by
// contribution to the ETF return today.
function renderQuotes() {
  const strip = el('quotes-strip');
  const byLabel = Object.fromEntries(state.tickers.map(t => [t.symbol, t]));
  strip.innerHTML = '';
  for (const q of state.quotes) {
    const meta = byLabel[q.symbol] || { label: q.symbol };
    const dir = q.changePct > 0 ? 'up' : q.changePct < 0 ? 'down' : 'flat';
    const sign = q.changePct > 0 ? '+' : '';
    const tile = document.createElement('a');
    tile.className = 'quote-tile';
    tile.href = `/core/macro/ticker.html?sym=${q.symbol}`;
    tile.dataset.sym = q.symbol;
    tile.title = `Open ${q.symbol} drill-down — chart, vs SPY, holdings, news`;
    tile.innerHTML = `
      <span class="sym">${q.symbol} &middot; ${meta.label.replace(/\s*\([^)]+\)/, '')}</span>
      <span class="px">$${fmt(q.price)}</span>
      <span class="ch ${dir}">${sign}${fmt(q.change)} (${sign}${fmt(q.changePct)}%)</span>
      <span class="quote-hover-hint">hover for top movers &middot; click for drill-down</span>
    `;
    strip.appendChild(tile);
  }
  wireQuoteHovers();
}

// Hover popup for the quote strip: shows top-10 holdings + their daily %
// changes, sorted by absolute contribution (weight × stock %change). Live
// quotes for holdings are lazy-fetched on first hover and cached for the
// session — saves us from making 100+ Finnhub calls on page load.
function wireQuoteHovers() {
  let popup = document.getElementById('quote-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'quote-popup';
    popup.className = 'quote-popup';
    popup.style.display = 'none';
    document.body.appendChild(popup);
  }

  // Shared state across all tile listeners. The previous version put `hideTimer`
  // inside the forEach closure, so each tile had its own timer. When the user
  // moved from tile A to tile B, A's hide timer kept running and fired 80ms
  // later — hiding B's popup right after it loaded. Now there's one shared
  // timer that any tile's mouseenter can cancel.
  //
  // `hoverToken` is a monotonically incrementing request id. Each fetch
  // captures its token at start; if the token has been bumped by a newer
  // mouseenter by the time the fetch returns, we ignore the result. Prevents
  // a slow XLK fetch from over-writing a fresh XLF popup.
  let hideTimer = null;
  let hoverToken = 0;
  let activeSym = null;

  function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }
  function scheduleHide() {
    cancelHide();
    hideTimer = setTimeout(() => {
      popup.style.display = 'none';
      activeSym = null;
    }, 100);
  }

  document.querySelectorAll('.quote-tile').forEach(tile => {
    tile.addEventListener('mouseenter', async () => {
      cancelHide();
      const sym = tile.dataset.sym;
      const def = ETF_HOLDINGS[sym];
      if (!def) {
        popup.style.display = 'none';
        activeSym = null;
        return;
      }
      // Bump the request token. Any in-flight fetch from a previous tile will
      // notice this and abandon its DOM update.
      const myToken = ++hoverToken;
      activeSym = sym;

      // Show popup with loading state immediately, fill in once quotes arrive.
      popup.innerHTML = renderPopupContent(sym, def, null);
      popup.style.display = 'block';
      positionPopup(tile);

      // Lazy-load holdings quotes (cached after first fetch).
      if (!state.holdingsQuoteCache) state.holdingsQuoteCache = {};
      let quotes = state.holdingsQuoteCache[sym];
      if (!quotes) {
        try {
          const symbols = def.holdings.map(h => h.sym).join(',');
          const j = await fetchJSON(`/api/stocks?mode=quote&symbols=${symbols}`);
          quotes = Object.fromEntries(j.quotes.map(q => [q.symbol, q]));
          state.holdingsQuoteCache[sym] = quotes;
        } catch (e) {
          console.warn('holdings hover fetch failed:', e);
          quotes = {};
        }
      }
      // Bail if a newer hover started or popup is no longer for this symbol.
      if (myToken !== hoverToken || activeSym !== sym) return;
      popup.innerHTML = renderPopupContent(sym, def, quotes);
      positionPopup(tile);
    });

    tile.addEventListener('mouseleave', () => {
      // Slight delay so flickers between adjacent tiles don't dismiss the
      // popup just to bring it back; the next mouseenter cancels this.
      scheduleHide();
    });
  });

  function positionPopup(tile) {
    const rect = tile.getBoundingClientRect();
    popup.style.left = `${rect.left}px`;
    popup.style.top  = `${rect.bottom + 6}px`;
    setTimeout(() => {
      const w = popup.offsetWidth;
      if (rect.left + w > window.innerWidth - 8) {
        popup.style.left = `${Math.max(8, window.innerWidth - w - 8)}px`;
      }
    }, 0);
  }
}

function renderPopupContent(sym, def, quotes) {
  const etfQuote = state.quotes.find(q => q.symbol === sym);
  const etfPct = etfQuote?.changePct;

  // Compute contribution per holding (weight × pct change), sort by abs value.
  const rows = def.holdings.map(h => {
    const q = quotes ? quotes[h.sym] : null;
    const pct = q?.changePct;
    const contribution = Number.isFinite(pct) ? (pct * h.weight) / 100 : null;
    return { ...h, pct, contribution };
  });
  rows.sort((a, b) => {
    const aa = Math.abs(a.contribution ?? 0), bb = Math.abs(b.contribution ?? 0);
    return bb - aa;
  });

  const headerRight = quotes
    ? (Number.isFinite(etfPct) ? `<span class="qp-etf-pct ${etfPct >= 0 ? 'up' : 'down'}">${etfPct >= 0 ? '+' : ''}${etfPct.toFixed(2)}%</span>` : '')
    : '<span class="qp-loading">loading…</span>';

  const body = quotes
    ? rows.slice(0, 6).map(r => {
        const sign = (v, d = 2) => Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(d)}` : '—';
        const dirClass = r.pct == null ? 'flat' : r.pct > 0 ? 'up' : r.pct < 0 ? 'down' : 'flat';
        return `<div class="qp-row">
          <div class="qp-sym">${r.sym}</div>
          <div class="qp-name">${r.name}</div>
          <div class="qp-weight">${r.weight.toFixed(1)}%</div>
          <div class="qp-move ${dirClass}">${sign(r.pct, 2)}%</div>
          <div class="qp-contrib ${dirClass}">${sign(r.contribution, 2)}pp</div>
        </div>`;
      }).join('')
    : `<div class="qp-loading-row">Loading holdings quotes…</div>`;

  return `
    <div class="qp-header">
      <div>
        <div class="qp-title">${sym} &middot; ${def.label}</div>
        <div class="qp-subtitle">Top contributors today &middot; weights as of ${def.asOf}</div>
      </div>
      ${headerRight}
    </div>
    <div class="qp-rows-header">
      <div></div><div>Holding</div><div>Wt</div><div>Today</div><div>Contribution</div>
    </div>
    ${body}
    <div class="qp-foot">Click the tile for full drill-down: longer chart, vs SPY, news.</div>
  `;
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
  const opts = baseChartOptions({
    yMin: -1, yMax: 1,
    yTicks: v => v.toFixed(1),
    yTitle: 'correlation',
  });
  // Wire NBER shading via plugin options. Ranges are pre-fetched in main().
  opts.plugins = { ...opts.plugins, nberShading: { ranges: state.recessionRanges || [] } };

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
    options: opts,
    plugins: [nberShadingPlugin],
  });

  el('rolling-note').textContent =
    `Full-period Pearson r = ${fmt(overall, 3)} across ${aligned.x.length} daily observations. ` +
    `Rolling window captures regime shifts — when r crosses zero, the relationship flipped sign. Pink bands = NBER recessions.`;
}

function renderRegression(macroTransformed, stockCloses) {
  const returns = logReturns(stockCloses);
  const aligned = alignForward(macroTransformed, returns);
  const reg = regression(aligned.x, aligned.y);

  // Regime-color each observation by the date's macro regime quadrant. If the
  // regime map isn't available yet (first render before regime data loads),
  // fall back to a single neutral color and a single OLS line.
  const regimeMap = state.regimeMap;
  const haveRegimes = regimeMap && regimeMap.size > 0;

  const datasets = [];

  if (haveRegimes) {
    // Bucket observations by regime; run a separate OLS per regime.
    const buckets = { goldilocks: [], reflation: [], stagflation: [], disinflation: [] };
    for (let i = 0; i < aligned.x.length; i++) {
      const ym = aligned.dates[i].slice(0, 7);
      const info = regimeMap.get(ym);
      if (!info) continue;
      buckets[info.regime].push({ x: aligned.x[i], y: aligned.y[i] });
    }
    const xRange = [Math.min(...aligned.x), Math.max(...aligned.x)];
    for (const [regime, pts] of Object.entries(buckets)) {
      if (!pts.length) continue;
      const meta = REGIMES[regime];
      // Per-regime scatter
      datasets.push({
        type: 'scatter',
        label: `${meta.label} (n=${pts.length})`,
        data: pts.map(p => ({ x: p.x, y: p.y * 100 })),
        backgroundColor: hexToRgba(meta.color, 0.45),
        borderColor: hexToRgba(meta.color, 0.7),
        pointRadius: 2,
      });
      // Per-regime OLS line (only if at least 30 observations — below that,
      // the slope is too noisy to draw)
      if (pts.length >= 30) {
        const xs = pts.map(p => p.x);
        const ys = pts.map(p => p.y);
        const r = regression(xs, ys);
        datasets.push({
          type: 'line',
          label: `${meta.label} fit β=${fmt(r.beta, 3)} R²=${fmt(r.r2, 2)}`,
          data: [
            { x: xRange[0], y: (r.alpha + r.beta * xRange[0]) * 100 },
            { x: xRange[1], y: (r.alpha + r.beta * xRange[1]) * 100 },
          ],
          borderColor: meta.color,
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        });
      }
    }
  } else {
    // Fallback to a single dataset + single OLS while regime data is still loading.
    datasets.push({
      label: 'obs',
      data: aligned.x.map((xv, i) => ({ x: xv, y: aligned.y[i] * 100 })),
      backgroundColor: 'rgba(90, 156, 255, 0.35)',
      borderColor: 'rgba(90, 156, 255, 0.6)',
      pointRadius: 2,
    });
    const xRange = [Math.min(...aligned.x), Math.max(...aligned.x)];
    datasets.push({
      type: 'line',
      label: `OLS fit (β=${fmt(reg.beta, 4)})`,
      data: [
        { x: xRange[0], y: (reg.alpha + reg.beta * xRange[0]) * 100 },
        { x: xRange[1], y: (reg.alpha + reg.beta * xRange[1]) * 100 },
      ],
      borderColor: '#f7a700',
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
    });
  }

  destroy('regression');
  const ctx = el('chart-regression').getContext('2d');
  charts.regression = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
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

  if (haveRegimes) {
    el('regression-note').innerHTML =
      `Each point colored by the macro regime of its date (composite growth z &times; Core CPI z). ` +
      `Separate OLS line per regime where n &ge; 30. The same indicator can have very different slopes by regime — ` +
      `that's the actual finance content of this chart, not the single full-sample β.`;
  } else {
    el('regression-note').textContent =
      `β = ${fmt(reg.beta, 4)}, α = ${fmt(reg.alpha, 4)}, R² = ${fmt(reg.r2, 3)}, n = ${reg.n}. ` +
      `Regime data still loading — once available, points will color by regime and per-regime regressions will appear.`;
  }
}

// Convert "#f7a700" or "rgb(...)" to rgba string with given alpha.
function hexToRgba(color, alpha) {
  if (color.startsWith('rgba')) return color;
  if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  // Hex
  const c = color.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

async function fetchRawSeries(id, start) {
  const cacheKey = `${id}|${start}`;
  if (state.regimeRawSeries[cacheKey]) return state.regimeRawSeries[cacheKey];
  const j = await fetchJSON(`/api/fred?series=${id}&start=${start}`);
  const obs = j.series[0]?.observations || [];
  state.regimeRawSeries[cacheKey] = obs;
  return obs;
}

async function renderRegimeReturns() {
  const have = el('regime-trajectory') || el('regime-table');
  if (!have) return;

  setStatus('stale', 'Loading regime data…');

  const REGIME_START = `${new Date().getFullYear() - 40}-01-01`;
  const [cpi, indpro, payems, rrsfs] = await Promise.all([
    fetchRawSeries('CPILFESL', REGIME_START),
    fetchRawSeries('INDPRO',   REGIME_START),
    fetchRawSeries('PAYEMS',   REGIME_START),
    fetchRawSeries('RRSFS',    REGIME_START),
  ]);

  const sectors = state.tickers.filter(t => t.group === 'sector').map(t => t.symbol);
  const sym = ['SPY', ...sectors];
  const history = await loadStockHistory(sym, 30);

  const regimeMap = buildRegimeMap({ cpi, indpro, payems, rrsfs });
  state.regimeMap = regimeMap;
  state.regimeSymbols = sym;

  const dist = regimeDistribution(regimeMap);
  console.log('[regime] classified months:', regimeMap.size, dist);

  state.regimeTable = buildRegimeReturnsTable(history, regimeMap, [1, 3, 6]);

  const months = [...regimeMap.keys()].sort();
  const currentYm = months[months.length - 1];
  const currentInfoRaw = currentYm ? regimeMap.get(currentYm) : null;
  const smoothed = smoothCurrentRegime(regimeMap, 3);
  state.currentRegimeRaw = currentInfoRaw?.regime || null;
  state.currentRegime = smoothed?.regime || null;
  state.currentRegimeInfo = smoothed;

  // Stash the raw observations for the live macro strip.
  state.macroStripData = { cpi, indpro, payems, rrsfs };

  renderMacroStrip(cpi, indpro, payems, rrsfs);
  renderRegimeTrajectory(regimeMap);
  renderCurrentRegimeTile(currentYm, currentInfoRaw, regimeMap, smoothed);
  renderRegimeTable();
  renderRegimeInterpretation();
  renderRegimeTransitions(regimeMap);
  renderPositioning();
  wireHorizonTabs();
  wireReturnModeToggle();

  if (charts.regression) await rerenderActive();

  setStatus('live', 'Live — prices refresh every 60s');
}

// ---------- regime trajectory chart ----------

function renderRegimeTrajectory(regimeMap) {
  const canvas = el('regime-trajectory');
  if (!canvas) return;
  const months = [...regimeMap.keys()].sort();
  const tail = months.slice(-24);
  if (tail.length < 2) return;

  const points = tail.map((ym, idx) => {
    const info = regimeMap.get(ym);
    const meta = REGIMES[info.regime];
    const recency = (idx + 1) / tail.length;
    return {
      x: info.growthZ,
      y: info.inflationZ,
      ym,
      regime: info.regime,
      label: meta.label,
      backgroundColor: meta.color,
      borderColor: meta.color,
      pointRadius: 3.5 + recency * 5.5,
    };
  });

  const lineSegment = tail.map(ym => {
    const info = regimeMap.get(ym);
    return { x: info.growthZ, y: info.inflationZ };
  });

  destroy('trajectory');

  const quadrantPlugin = {
    id: 'regimeQuadrants',
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales: s } = chart;
      if (!a) return;
      const x0 = s.x.getPixelForValue(0);
      const y0 = s.y.getPixelForValue(0);

      ctx.save();
      ctx.fillStyle = 'rgba(62, 207, 142, 0.04)';
      ctx.fillRect(x0, y0, a.right - x0, a.bottom - y0);
      ctx.fillStyle = 'rgba(247, 167, 0, 0.04)';
      ctx.fillRect(x0, a.top, a.right - x0, y0 - a.top);
      ctx.fillStyle = 'rgba(239, 79, 90, 0.04)';
      ctx.fillRect(a.left, a.top, x0 - a.left, y0 - a.top);
      ctx.fillStyle = 'rgba(90, 156, 255, 0.04)';
      ctx.fillRect(a.left, y0, x0 - a.left, a.bottom - y0);

      ctx.strokeStyle = 'rgba(138, 148, 163, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.left, y0); ctx.lineTo(a.right, y0);
      ctx.moveTo(x0, a.top);  ctx.lineTo(x0, a.bottom);
      ctx.stroke();

      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      const labels = [
        { txt: 'GOLDILOCKS',   x: (x0 + a.right) / 2, y: (y0 + a.bottom) / 2, c: 'rgba(62, 207, 142, 0.55)' },
        { txt: 'REFLATION',    x: (x0 + a.right) / 2, y: (a.top + y0) / 2,    c: 'rgba(247, 167, 0, 0.55)' },
        { txt: 'STAGFLATION',  x: (a.left + x0) / 2,  y: (a.top + y0) / 2,    c: 'rgba(239, 79, 90, 0.55)' },
        { txt: 'DISINFLATION', x: (a.left + x0) / 2,  y: (y0 + a.bottom) / 2, c: 'rgba(90, 156, 255, 0.55)' },
      ];
      for (const d of labels) { ctx.fillStyle = d.c; ctx.fillText(d.txt, d.x, d.y); }
      ctx.restore();
    },
  };

  const ctx = canvas.getContext('2d');
  charts.trajectory = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Trail',
          type: 'line',
          data: lineSegment,
          borderColor: 'rgba(229, 233, 238, 0.20)',
          borderWidth: 1,
          pointRadius: 0,
          tension: 0.0,
          fill: false,
          showLine: true,
          order: 99,
        },
        {
          label: 'Months',
          type: 'scatter',
          data: points,
          backgroundColor: c => c.raw?.backgroundColor || '#fff',
          borderColor:     c => c.raw?.borderColor || '#fff',
          pointRadius:     c => c.raw?.pointRadius || 4,
          pointBorderWidth: 1,
          pointHoverRadius: 9,
          parsing: false,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#13171c',
          borderColor: '#232b35',
          borderWidth: 1,
          callbacks: {
            label(c) {
              const p = c.raw;
              if (!p || !p.ym) return '';
              const [y, m] = p.ym.split('-').map(Number);
              const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
              return [
                `${monthName} — ${p.label}`,
                `growth z: ${p.x >= 0 ? '+' : ''}${p.x.toFixed(2)}, inflation z: ${p.y >= 0 ? '+' : ''}${p.y.toFixed(2)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'growth z-score (composite)', color: '#8a94a3', font: { size: 11 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#8a94a3', font: { size: 10 } },
        },
        y: {
          type: 'linear',
          title: { display: true, text: 'inflation z-score (Core CPI)', color: '#8a94a3', font: { size: 11 } },
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#8a94a3', font: { size: 10 } },
        },
      },
    },
    plugins: [quadrantPlugin],
  });
}

// ---------- current regime tile ----------

function renderCurrentRegimeTile(currentYm, info, regimeMap, smoothed) {
  const tile = el('regime-current');
  if (!tile) return;
  if (!info || !smoothed) {
    tile.innerHTML = '<div class="regime-current-empty">Insufficient history to classify current regime.</div>';
    return;
  }
  const meta = REGIMES[smoothed.regime];

  const months = [...regimeMap.keys()].sort();
  let streak = 0;
  for (let i = months.length - 1; i >= 0; i--) {
    if (regimeMap.get(months[i]).regime === smoothed.regime) streak++;
    else break;
  }

  const [y, m] = currentYm.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  let dissentLine = '';
  if (info.regime !== smoothed.regime) {
    const rawMeta = REGIMES[info.regime];
    dissentLine = `<div class="regime-dissent">
      <strong>Boundary watch:</strong> latest print (${monthName}) was
      <span style="color:${rawMeta.color}">${rawMeta.label}</span>, but the
      3-month vote remains <span style="color:${meta.color}">${meta.label}</span>.
      A flip would require a confirming print next month.
    </div>`;
  }

  tile.innerHTML = `
    <div class="regime-badge" style="--regime-color: ${meta.color}">
      <div class="regime-badge-label">CURRENT REGIME &middot; 3-MONTH SMOOTHED</div>
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
    ${dissentLine}
  `;
}

// ---------- regime returns table ----------

function renderRegimeTable() {
  const tgt = el('regime-table');
  if (!tgt || !state.regimeTable) return;
  const sym = state.regimeSymbols;
  const horizon = state.currentHorizon;
  const isExcess = state.returnMode === 'excess';
  const colorScale = isExcess ? horizon * 1.0 : horizon * 2.5;
  const unit = isExcess ? 'pp' : '%';

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
    const spyCell = state.regimeTable.SPY?.[r]?.[horizon];
    const spyMean = spyCell?.mean;

    const labelCell = `
      <td class="regime-col-label" data-tooltip-kind="regime" data-tooltip-regime="${r}">
        <span class="regime-dot" style="background:${meta.color}"></span>
        <span class="regime-row-name">${meta.label}</span>
        <span class="regime-row-desc">${meta.short}</span>
      </td>`;

    const cellData = sym.map(s => {
      const cell = state.regimeTable[s]?.[r]?.[horizon];
      if (!cell || cell.n === 0) return { s, displayVal: null, cell: null };
      let displayVal = cell.mean;
      if (isExcess) {
        if (s === 'SPY') return { s, displayVal: null, cell, isSpyExcess: true };
        if (Number.isFinite(spyMean)) displayVal = cell.mean - spyMean;
        else                          displayVal = null;
      }
      return { s, displayVal, cell };
    });

    const eligible = cellData.filter(d =>
      d.displayVal != null && d.cell && d.cell.n >= 12 && (!isExcess || d.s !== 'SPY')
    );
    let bestSym = null, worstSym = null;
    if (eligible.length >= 2) {
      eligible.sort((a, b) => b.displayVal - a.displayVal);
      bestSym  = eligible[0].s;
      worstSym = eligible[eligible.length - 1].s;
    }

    const cells = cellData.map(d => {
      if (d.isSpyExcess) {
        return `<td class="regime-cell empty" data-tooltip-kind="cell"
                    data-tooltip-sym="SPY" data-tooltip-regime="${r}">— <span class="rt-baseline">baseline</span></td>`;
      }
      if (d.displayVal == null) {
        return `<td class="regime-cell empty" data-tooltip-kind="cell" data-tooltip-sym="${d.s}" data-tooltip-regime="${r}">—</td>`;
      }
      const ret = d.displayVal;
      const t = Math.max(-1, Math.min(1, ret / colorScale));
      let bg;
      if (t >= 0) bg = `rgba(62, 207, 142, ${0.10 + 0.55 * t})`;
      else        bg = `rgba(239, 79, 90,  ${0.10 + 0.55 * -t})`;
      const opacity = d.cell.n >= 24 ? 1 : d.cell.n >= 12 ? 0.75 : 0.45;
      const sign = ret > 0 ? '+' : '';
      let extraClass = '';
      if (d.s === bestSym)  extraClass = ' leader';
      if (d.s === worstSym) extraClass = ' laggard';
      return `<td class="regime-cell${extraClass}" style="background:${bg};opacity:${opacity}"
                  data-tooltip-kind="cell" data-tooltip-sym="${d.s}" data-tooltip-regime="${r}">
        <div class="regime-cell-ret">${sign}${fmt(ret, 1)}${unit}</div>
        <div class="regime-cell-n">n=${d.cell.n}</div>
      </td>`;
    }).join('');
    return `<tr class="${rowClass}">${labelCell}${cells}</tr>`;
  }).join('');

  tgt.innerHTML = `<table class="regime-returns-table">${header}${body}</table>`;
  wireRegimeTooltip();
}

// ---------- regime tooltip ----------

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
          const dSign = delta > 0 ? '+' : '';
          const dCls = delta >= 0 ? 'rt-delta-pos' : 'rt-delta-neg';
          deltaTxt = ` &middot; <span class="${dCls}">${dSign}${fmt(delta, 1)}pp vs SPY</span>`;
        }
        const distHtml = Number.isFinite(cell.median) ? `
          <div class="rt-distribution">
            <div class="rt-dist-label">Distribution</div>
            <div class="rt-dist-row">
              <span><span class="rt-dist-key">Min</span> ${fmt(cell.min, 1)}%</span>
              <span><span class="rt-dist-key">Q1</span> ${fmt(cell.q1, 1)}%</span>
              <span><span class="rt-dist-key">Median</span> ${fmt(cell.median, 1)}%</span>
              <span><span class="rt-dist-key">Q3</span> ${fmt(cell.q3, 1)}%</span>
              <span><span class="rt-dist-key">Max</span> ${fmt(cell.max, 1)}%</span>
            </div>
          </div>` : '';
        numbers = `
          <div class="rt-stats">
            <strong>${sign}${fmt(cell.mean, 1)}%</strong> avg forward ${horizonLabel}
            ${deltaTxt}
            <br>
            <span class="rt-sub">σ=${fmt(cell.std, 1)}% &middot; n=${cell.n} historical months</span>
          </div>
          ${distHtml}`;
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

  const table = el('regime-table');
  if (!table) return;
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
    const tgt = e.target.closest('[data-tooltip-kind]');
    if (!tgt) return;
    const next = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-tooltip-kind]');
    if (next === tgt) return;
    tooltipEl.style.display = 'none';
  });
}

// ---------- interpretation note ----------

function renderRegimeInterpretation() {
  const note = el('regime-interpretation');
  if (!note || !state.currentRegime || !state.regimeTable) return;
  const horizon = state.currentHorizon;
  const sym = state.regimeSymbols.filter(s => s !== 'SPY');
  const cells = sym
    .map(s => ({ s, c: state.regimeTable[s]?.[state.currentRegime]?.[horizon] }))
    .filter(o => o.c && o.c.n >= 12);
  if (!cells.length) { note.textContent = ''; return; }
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

function wireReturnModeToggle() {
  document.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (!mode || mode === state.returnMode) return;
      state.returnMode = mode;
      document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRegimeTable();
      renderRegimeInterpretation();
    });
  });
}

// ---------- live macro strip (T5.1) ----------
//
// Six small gauges above the regime hero, each showing a key macro input:
// the three growth components, Core CPI, the 10Y-3M curve, and HY OAS. Each
// shows the current 6m-annualized rate (or current level for the spread/OAS),
// its percentile vs. own history, and the 1m delta. Lets the user see WHY the
// regime is what it is, not just the label.


async function renderMacroStrip(cpi, indpro, payems, rrsfs) {
  const tgt = el('macro-strip');
  if (!tgt) return;

  // 6m annualized for the four levels, raw level for spread + spread.
  const rates = {
    INDPRO:   sixMonthAnnualized(toMonthlyMap(indpro)),
    PAYEMS:   sixMonthAnnualized(toMonthlyMap(payems)),
    RRSFS:    sixMonthAnnualized(toMonthlyMap(rrsfs)),
    CPILFESL: sixMonthAnnualized(toMonthlyMap(cpi)),
  };

  // Fetch curve + HY OAS as raw levels.
  let curve = [], hyoas = [];
  try {
    const start = `${new Date().getFullYear() - 30}-01-01`;
    const j = await fetchJSON(`/api/fred?series=T10Y3M,BAMLH0A0HYM2&start=${start}`);
    for (const s of j.series) {
      if (s.id === 'T10Y3M') curve = s.observations.map(o => ({ ym: o.date.slice(0, 7), value: o.value * 100 })); // pct -> bps
      if (s.id === 'BAMLH0A0HYM2') hyoas = s.observations.map(o => ({ ym: o.date.slice(0, 7), value: o.value * 100 })); // pct -> bps
    }
  } catch (e) {
    console.warn('macro-strip series fetch failed:', e);
  }
  // Reduce daily data to month-end for percentile calc + delta.
  const reduceMonthly = arr => {
    const m = new Map();
    for (const o of arr) m.set(o.ym, o.value);
    return [...m.entries()].sort().map(([ym, value]) => ({ ym, value }));
  };
  const curveMonthly = reduceMonthly(curve);
  const hyoasMonthly = reduceMonthly(hyoas);

  const indicators = [
    { id: 'INDPRO',   label: 'Industrial Prod',  unit: '%', desc: '6m annualized growth in physical output (factories, mines, utilities).', series: rates.INDPRO,   target: 'higher' },
    { id: 'PAYEMS',   label: 'Nonfarm Payrolls', unit: '%', desc: '6m annualized job growth. Real-time labor demand.',                       series: rates.PAYEMS,   target: 'higher' },
    { id: 'RRSFS',    label: 'Real Retail',      unit: '%', desc: '6m annualized inflation-adjusted retail spending. Consumer demand.',     series: rates.RRSFS,    target: 'higher' },
    { id: 'CPILFESL', label: 'Core CPI',         unit: '%', desc: '6m annualized core inflation. Fed reaction-function input.',             series: rates.CPILFESL, target: 'target', targetVal: 2.0 },
    { id: 'T10Y3M',   label: '10Y-3M Curve',     unit: 'bp',desc: '10Y minus 3M Treasury spread. Negative = inversion = recession signal.', series: curveMonthly,   target: 'higher' },
    { id: 'BAMLH0A0HYM2', label: 'HY Credit Spread', unit: 'bp', desc: 'High-yield option-adjusted spread. Stress thermometer.',             series: hyoasMonthly,   target: 'lower' },
  ];

  function pctRank(arr, val) {
    if (!arr.length) return null;
    const sorted = arr.map(o => o.value).sort((a, b) => a - b);
    let lo = 0;
    for (let i = 0; i < sorted.length; i++) { if (sorted[i] <= val) lo = i + 1; else break; }
    return Math.round((lo / sorted.length) * 100);
  }

  const tiles = indicators.map(ind => {
    const s = ind.series;
    if (!s.length) {
      return `<div class="ms-tile loading">
        <div class="ms-label">${ind.label}</div>
        <div class="ms-value">—</div>
      </div>`;
    }
    const last = s[s.length - 1];
    const prev = s.length > 1 ? s[s.length - 2] : null;
    const delta = prev ? last.value - prev.value : null;
    const pctile = pctRank(s, last.value);

    // Color logic per indicator's "target":
    //   higher = green when above median, red when below
    //   lower  = inverse
    //   target = green near targetVal (within 0.5), neutral elsewhere
    let valClass = 'flat';
    if (ind.target === 'higher') valClass = pctile >= 50 ? 'pos' : 'neg';
    else if (ind.target === 'lower') valClass = pctile <= 50 ? 'pos' : 'neg';
    else if (ind.target === 'target') valClass = Math.abs(last.value - ind.targetVal) <= 0.5 ? 'pos' : Math.abs(last.value - ind.targetVal) <= 1.0 ? 'flat' : 'neg';

    const dec = ind.unit === 'bp' ? 0 : 1;
    const sign = v => v > 0 ? '+' : '';

    return `<div class="ms-tile" title="${ind.desc}">
      <div class="ms-label">${ind.label}</div>
      <div class="ms-value ${valClass}">${sign(last.value)}${last.value.toFixed(dec)}<span class="ms-unit">${ind.unit}</span></div>
      <div class="ms-meta">
        <span class="ms-pctile">${pctile != null ? pctile + 'th %ile' : '—'}</span>
        ${delta != null ? `<span class="ms-delta ${delta >= 0 ? 'pos' : 'neg'}">${sign(delta)}${delta.toFixed(dec)}${ind.unit} mo/mo</span>` : ''}
      </div>
    </div>`;
  }).join('');

  tgt.innerHTML = `
    <div class="ms-header">
      <span class="ms-title">Live macro inputs</span>
      <span class="ms-subtitle">What's driving the regime today &middot; current value, percentile vs. 30-year history, 1-month delta</span>
    </div>
    <div class="ms-grid">${tiles}</div>
  `;
}

// ---------- regime transition matrix (T5.2) ----------
//
// Given the current regime, what's the historical base rate of being in each
// regime 6 months from now? Compute from the regime map: for every historical
// month with a known regime AND a regime 6 months later, count transitions.

function renderRegimeTransitions(regimeMap) {
  const tgt = el('regime-transitions');
  if (!tgt) return;

  const months = [...regimeMap.keys()].sort();
  const ymToIdx = new Map(months.map((ym, i) => [ym, i]));
  const HORIZON = 6;

  // counts[from][to] = N
  const counts = {
    goldilocks:   { goldilocks: 0, reflation: 0, stagflation: 0, disinflation: 0 },
    reflation:    { goldilocks: 0, reflation: 0, stagflation: 0, disinflation: 0 },
    stagflation:  { goldilocks: 0, reflation: 0, stagflation: 0, disinflation: 0 },
    disinflation: { goldilocks: 0, reflation: 0, stagflation: 0, disinflation: 0 },
  };

  for (let i = 0; i + HORIZON < months.length; i++) {
    const from = regimeMap.get(months[i]);
    const to   = regimeMap.get(months[i + HORIZON]);
    if (!from || !to) continue;
    counts[from.regime][to.regime] += 1;
  }

  const current = state.currentRegime;
  const fromCounts = counts[current];
  const total = Object.values(fromCounts).reduce((s, n) => s + n, 0);
  if (!total) { tgt.innerHTML = ''; return; }

  const order = ['goldilocks', 'reflation', 'stagflation', 'disinflation'];
  const tiles = order.map(r => {
    const meta = REGIMES[r];
    const n = fromCounts[r];
    const pct = (n / total) * 100;
    const isCurrent = r === current;
    const intensity = pct / 100;
    return `<div class="rt-tile ${isCurrent ? 'self' : ''}" style="--rt-color:${meta.color};--rt-intensity:${intensity.toFixed(3)}">
      <div class="rt-tile-name">${meta.label}</div>
      <div class="rt-tile-pct">${pct.toFixed(0)}%</div>
      <div class="rt-tile-n">${n} of ${total} obs</div>
      ${isCurrent ? '<div class="rt-tile-stay">stay</div>' : ''}
    </div>`;
  }).join('');

  const meta = REGIMES[current];
  tgt.innerHTML = `
    <div class="rt-trans-header">
      <h3>What historically came next?</h3>
      <p class="rt-trans-sub">Current regime: <strong style="color:${meta.color}">${meta.label}</strong>. Base rate of being in each regime 6 months from now, computed from every prior occurrence of the current regime.</p>
    </div>
    <div class="rt-trans-grid">${tiles}</div>
    <p class="rt-trans-foot">Past base rates, not forecasts. Sample of ${total} historical 6-month windows.</p>
  `;
}

// ---------- pair-explorer orchestration (research page only) ----------

async function rerenderActive() {
  if (!el('chart-rolling')) return;
  setStatus('stale', 'Loading series…');
  const { transformed } = await loadIndicator(state.indicator);
  const history = await loadStockHistory([state.benchmark], state.years);
  const closes = history[state.benchmark] || [];
  const windowStart = closes.length ? closes[0].date : null;
  const macro = windowStart ? transformed.filter(o => o.date >= windowStart) : transformed;

  renderRolling(macro, closes);
  renderRegression(macro, closes);
  renderOverlay(macro, closes);

  if (el('last-updated')) el('last-updated').textContent = `Series updated ${new Date().toLocaleString()}`;
  setStatus('live', 'Live — prices refresh every 60s');
}

function wireControls() {
  const indSel = el('indicator-select');
  if (!indSel) return;
  const groups = {
    'Core macro':         ['CPIAUCSL', 'DFF', 'UNRATE', 'GDPC1', 'DGS10'],
    'Leading indicators': ['INDPRO', 'ICSA', 'UMCSENT', 'PERMIT', 'RSAFS'],
    'Liquidity & money':  ['M2SL', 'WALCL', 'RRPONTSYD', 'WTREGEN'],
  };
  for (const [groupLabel, ids] of Object.entries(groups)) {
    const og = document.createElement('optgroup');
    og.label = groupLabel;
    for (const id of ids) {
      const meta = state.catalog[id];
      if (!meta) continue;
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = `${meta.label} (${id})`;
      if (id === state.indicator) opt.selected = true;
      og.appendChild(opt);
    }
    if (og.childElementCount) indSel.appendChild(og);
  }
  const known = new Set(Object.values(groups).flat());
  for (const [id, meta] of Object.entries(state.catalog)) {
    if (meta.group === 'econ' || meta.group === 'recession') continue;
    if (known.has(id)) continue;
    if (id === 'USREC') continue;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${meta.label} (${id})`;
    if (id === state.indicator) opt.selected = true;
    indSel.appendChild(opt);
  }

  const benSel = el('benchmark-select');
  if (benSel) {
    for (const t of state.tickers) {
      const opt = document.createElement('option');
      opt.value = t.symbol;
      opt.textContent = `${t.symbol} — ${t.label}`;
      if (t.symbol === state.benchmark) opt.selected = true;
      benSel.appendChild(opt);
    }
  }

  if (indSel) indSel.addEventListener('change', () => { state.indicator = indSel.value; rerenderActive().catch(showErr); });
  if (benSel) benSel.addEventListener('change', () => { state.benchmark = benSel.value; rerenderActive().catch(showErr); });
  const ys = el('years-select');
  const ws = el('window-select');
  if (ys) ys.addEventListener('change', e => { state.years = Number(e.target.value); rerenderActive().catch(showErr); });
  if (ws) ws.addEventListener('change', e => { state.window = Number(e.target.value); rerenderActive().catch(showErr); });

  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tab = el(`tab-${btn.dataset.tab}`);
      if (tab) tab.classList.add('active');
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
    const recessionPromise = loadRecessionRanges().catch(e => { console.warn('USREC fetch failed:', e); return []; });
    await loadQuotes();
    await recessionPromise;
    await rerenderActive();
    await renderRegimeReturns();

    setInterval(() => { loadQuotes().catch(showErr); }, 60_000);
  } catch (err) {
    showErr(err);
  }
}

main();

// ---------- positioning capstone (T5.5) ----------
//
// Translates the current regime + historical 6m sector returns into a clear
// over/underweight call. Three pillars:
//   * Over-weights: top 3 sectors by historical 6m mean return in current regime
//                   (excludes SPY, requires n >= 24 to qualify)
//   * Under-weights: bottom 3 by same criterion
//   * Each rec includes the historical mean, the worst-quartile (Q1) for tail
//     awareness, and a one-line rationale from the sector profile
//
// Why this exists: the table tells you the historical pattern; this section
// converts it into a specific tilt recommendation so a portfolio manager
// has something they can act on directly. The pillar the user explicitly asked
// for — "clear so whats and takeaways to help drive decisions."

function renderPositioning() {
  const tgt = el('regime-positioning');
  if (!tgt || !state.regimeTable || !state.currentRegime) return;
  const regime = state.currentRegime;
  const meta = REGIMES[regime];
  const horizon = 6; // capstone always uses 6m horizon — matches the user's stated decision horizon

  const sym = state.regimeSymbols.filter(s => s !== 'SPY');
  const cells = sym
    .map(s => ({ s, c: state.regimeTable[s]?.[regime]?.[horizon] }))
    .filter(o => o.c && o.c.n >= 24); // require 2+ years of observations to qualify

  if (cells.length < 4) {
    tgt.innerHTML = `<div class="rp-empty">Insufficient sector history in this regime to issue tilt recommendations (require n &ge; 24 per sector).</div>`;
    return;
  }

  cells.sort((a, b) => b.c.mean - a.c.mean);
  const top    = cells.slice(0, 3);
  const bottom = cells.slice(-3).reverse();

  const spyCell = state.regimeTable.SPY?.[regime]?.[horizon];
  const spyMean = spyCell?.mean;

  function renderRec(item, kind) {
    const profile = SECTOR_PROFILES[item.s];
    const sign = v => v > 0 ? '+' : '';
    const c = item.c;
    const vsSpy = Number.isFinite(spyMean) ? c.mean - spyMean : null;
    const tailLine = Number.isFinite(c.q1)
      ? `Worst-quartile outcome: ${sign(c.q1)}${fmt(c.q1, 1)}% (size positions accordingly).`
      : '';
    return `<div class="rp-rec ${kind}">
      <div class="rp-rec-head">
        <div class="rp-rec-action">${kind === 'over' ? 'OVERWEIGHT' : 'UNDERWEIGHT'}</div>
        <div class="rp-rec-sym">${item.s}</div>
        <div class="rp-rec-name">${profile?.label || item.s}</div>
      </div>
      <div class="rp-rec-stats">
        <span class="rp-rec-mean ${c.mean >= 0 ? 'pos' : 'neg'}">${sign(c.mean)}${fmt(c.mean, 1)}%</span>
        <span class="rp-rec-meta">avg fwd 6m</span>
        ${vsSpy != null ? `<span class="rp-rec-vsspy ${vsSpy >= 0 ? 'pos' : 'neg'}">${sign(vsSpy)}${fmt(vsSpy, 1)}pp vs SPY</span>` : ''}
        <span class="rp-rec-n">n=${c.n}</span>
      </div>
      <div class="rp-rec-rationale">${profile?.byRegime?.[regime] || ''}</div>
      ${tailLine ? `<div class="rp-rec-tail">${tailLine}</div>` : ''}
    </div>`;
  }

  tgt.innerHTML = `
    <div class="rp-header">
      <div class="rp-eyebrow">Positioning &middot; based on ${meta.label} regime + 6m historical returns</div>
      <h3>So what — how to tilt the book</h3>
      <p class="rp-sub">
        Translates the current regime call into a specific over/under-weight tilt.
        Picks the top 3 and bottom 3 sectors by historical forward 6-month return
        in this regime (n ≥ 24 required to qualify). These are base rates, not
        forecasts — but absent a strong contrary view, they're the prior that
        should anchor sector positioning today.
      </p>
    </div>
    <div class="rp-grid">
      <div class="rp-col rp-overweights">
        <div class="rp-col-title">Over-weight</div>
        ${top.map(t => renderRec(t, 'over')).join('')}
      </div>
      <div class="rp-col rp-underweights">
        <div class="rp-col-title">Under-weight</div>
        ${bottom.map(t => renderRec(t, 'under')).join('')}
      </div>
    </div>
    <p class="rp-foot">
      Methodology: 30+ years of monthly history classified into four regimes,
      forward-6-month total returns averaged within the current regime, top/bottom
      ranked. Excludes sectors with &lt; 24 historical observations in this regime
      (XLRE pre-2015, XLC pre-2018 may be excluded depending on the regime).
      <strong>Past base rates — not forecasts.</strong>
    </p>
  `;
}
