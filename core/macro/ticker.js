// Ticker drill-down page controller.
//
// URL: /core/macro/ticker.html?sym=XLK
//
// Data shown:
//   * Live quote (Finnhub /quote)
//   * Multi-year price chart, normalized vs SPY OR absolute price (Yahoo)
//   * Realized return + max drawdown stats over the visible window
//   * Top holdings + their daily moves + contribution to ETF return (for ETFs)
//   * Recent news (Finnhub /company-news; for ETFs, falls back to top-3 holdings)
//
// Why this exists: the macro dashboard has a quote strip showing current prices
// for SPY + 11 sectors. Without context — what's driving the move, who's the
// concentration risk, what's the news — those tiles are barely informative.
// This page is the "explain the move" follow-up.

import { ETF_HOLDINGS } from './holdings.js';
import { SECTOR_PROFILES } from './sector-profiles.js';

const params = new URLSearchParams(location.search);
const SYM = (params.get('sym') || 'SPY').toUpperCase();

const state = {
  symbol: SYM,
  isEtf: !!ETF_HOLDINGS[SYM],
  years: 5,
  mode: 'normalized', // 'normalized' | 'absolute'
  history: {},        // { symbol: closes[] }
  quote: null,
  spyQuote: null,
  holdingsQuotes: {}, // symbol -> Finnhub quote
};

let chart = null;

function el(id) { return document.getElementById(id); }
function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }
function setStatus(kind, text) {
  el('refresh-indicator').className = `dot ${kind}`;
  el('refresh-text').textContent = text;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

// ---------- header / quote ----------

async function loadQuote() {
  const j = await fetchJSON(`/api/stocks?mode=quote&symbols=${state.symbol},SPY`);
  for (const q of j.quotes) {
    if (q.symbol === state.symbol) state.quote = q;
    if (q.symbol === 'SPY')         state.spyQuote = q;
  }
}

function renderHeader() {
  const profile = SECTOR_PROFILES[state.symbol];
  el('t-symbol').textContent = state.symbol;
  el('t-name').textContent = profile?.label || (ETF_HOLDINGS[state.symbol]?.label || 'Equity');

  if (state.quote) {
    const q = state.quote;
    el('t-price').textContent = `$${fmt(q.price, 2)}`;
    const sign = q.change > 0 ? '+' : '';
    const dir  = q.changePct > 0 ? 'up' : q.changePct < 0 ? 'down' : 'flat';
    el('t-change').textContent = `${sign}${fmt(q.change, 2)} (${sign}${fmt(q.changePct, 2)}%)`;
    el('t-change').className = `ticker-change ${dir}`;
    el('t-open').textContent     = `$${fmt(q.open, 2)}`;
    el('t-hilo').textContent     = `$${fmt(q.low, 2)} – $${fmt(q.high, 2)}`;
    el('t-prevclose').textContent= `$${fmt(q.prevClose, 2)}`;
  }

  if (profile) {
    el('t-profile').textContent = profile.description;
  } else {
    el('t-profile').textContent = '';
  }
}

// ---------- price chart ----------

async function loadHistory() {
  const symbols = state.symbol === 'SPY' ? ['SPY'] : [state.symbol, 'SPY'];
  const j = await fetchJSON(`/api/stocks?mode=history&years=${state.years}&symbols=${symbols.join(',')}`);
  state.history = {};
  for (const s of j.series) state.history[s.symbol] = s.closes;
}

function normalizeToHundred(closes) {
  if (!closes || !closes.length) return [];
  const base = closes[0].value;
  if (!base) return [];
  return closes.map(o => ({ x: o.date, y: (o.value / base) * 100 }));
}

function maxDrawdown(closes) {
  if (!closes || !closes.length) return { dd: 0, peakDate: null, troughDate: null };
  let peak = closes[0].value, peakDate = closes[0].date;
  let maxDd = 0, ddPeakDate = null, ddTroughDate = null;
  for (const o of closes) {
    if (o.value > peak) { peak = o.value; peakDate = o.date; }
    const dd = (o.value / peak) - 1;
    if (dd < maxDd) { maxDd = dd; ddPeakDate = peakDate; ddTroughDate = o.date; }
  }
  return { dd: maxDd * 100, peakDate: ddPeakDate, troughDate: ddTroughDate };
}

function annualizedReturn(closes) {
  if (!closes || closes.length < 2) return NaN;
  const first = closes[0].value, last = closes[closes.length - 1].value;
  const years = (new Date(closes[closes.length - 1].date) - new Date(closes[0].date)) / (365.25 * 86400000);
  if (years <= 0 || first <= 0) return NaN;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

function renderChart() {
  const targetCloses = state.history[state.symbol] || [];
  const spyCloses    = state.history.SPY || [];
  if (!targetCloses.length) {
    el('t-chart-note').textContent = 'No price history available.';
    return;
  }

  const isAbsolute = state.mode === 'absolute';
  const datasets = [];

  if (isAbsolute) {
    datasets.push({
      label: state.symbol,
      data: targetCloses.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700',
      backgroundColor: 'rgba(247, 167, 0, 0.10)',
      borderWidth: 1.8,
      pointRadius: 0,
      tension: 0.0,
      fill: true,
    });
  } else {
    datasets.push({
      label: `${state.symbol} (rebased to 100)`,
      data: normalizeToHundred(targetCloses),
      borderColor: '#f7a700',
      backgroundColor: 'rgba(247, 167, 0, 0.10)',
      borderWidth: 1.8,
      pointRadius: 0,
      tension: 0.0,
      fill: true,
    });
    if (state.symbol !== 'SPY' && spyCloses.length) {
      datasets.push({
        label: 'SPY (rebased to 100)',
        data: normalizeToHundred(spyCloses),
        borderColor: '#5a9cff',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        borderDash: [4, 4],
        tension: 0.0,
        fill: false,
      });
    }
  }

  if (chart) { chart.destroy(); chart = null; }
  const ctx = el('ticker-chart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#e5e9ee', font: { size: 11 } } },
        tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1 },
      },
      scales: {
        x: { type: 'time', time: { unit: state.years <= 2 ? 'month' : 'year' },
             grid: { color: 'rgba(255,255,255,0.04)' },
             ticks: { color: '#8a94a3', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' },
             ticks: { color: '#8a94a3', font: { size: 10 },
                      callback: v => isAbsolute ? `$${v}` : v.toFixed(0) } },
      },
    },
  });

  // Stats: total return, annualized, max drawdown, vs-SPY delta.
  const total = ((targetCloses[targetCloses.length - 1].value / targetCloses[0].value) - 1) * 100;
  const ann   = annualizedReturn(targetCloses);
  const md    = maxDrawdown(targetCloses);
  const spyTotal = spyCloses.length ? ((spyCloses[spyCloses.length - 1].value / spyCloses[0].value) - 1) * 100 : null;
  const vsSpy = spyTotal != null ? total - spyTotal : null;

  const sign = v => v > 0 ? '+' : '';
  el('t-chart-stats').innerHTML = `
    <div class="t-stat"><div class="t-stat-key">Total return</div><div class="t-stat-val ${total >= 0 ? 'pos' : 'neg'}">${sign(total)}${fmt(total, 1)}%</div></div>
    <div class="t-stat"><div class="t-stat-key">Annualized</div><div class="t-stat-val ${ann >= 0 ? 'pos' : 'neg'}">${sign(ann)}${fmt(ann, 1)}%</div></div>
    <div class="t-stat"><div class="t-stat-key">Max drawdown</div><div class="t-stat-val neg">${fmt(md.dd, 1)}%</div></div>
    ${vsSpy != null ? `<div class="t-stat"><div class="t-stat-key">vs SPY</div><div class="t-stat-val ${vsSpy >= 0 ? 'pos' : 'neg'}">${sign(vsSpy)}${fmt(vsSpy, 1)} pp</div></div>` : ''}
  `;
  el('t-chart-note').textContent = state.symbol === 'SPY'
    ? `${state.years}-year history. Total returns include reinvested dividends (Yahoo adjusted close).`
    : `${state.years}-year history. Solid line = ${state.symbol}; dashed = SPY benchmark, both rebased to 100 at start. Total returns include reinvested dividends.`;
}

// ---------- top holdings ----------

async function loadHoldingsQuotes() {
  if (!state.isEtf) return;
  const holdings = ETF_HOLDINGS[state.symbol].holdings;
  const symbols = holdings.map(h => h.sym).join(',');
  try {
    const j = await fetchJSON(`/api/stocks?mode=quote&symbols=${symbols}`);
    state.holdingsQuotes = Object.fromEntries(j.quotes.map(q => [q.symbol, q]));
  } catch (e) {
    console.warn('holdings quote fetch failed:', e);
  }
}

function renderHoldings() {
  const tgt = el('t-holdings-table');
  const note = el('t-holdings-note');
  const asOf = el('t-holdings-asof');
  if (!state.isEtf) {
    el('t-holdings-table').parentElement.style.display = 'none';
    return;
  }
  const def = ETF_HOLDINGS[state.symbol];
  asOf.textContent = `as of ${def.asOf}`;

  // Compute contribution to ETF return: weight × stock_pct_change
  const rows = def.holdings.map(h => {
    const q = state.holdingsQuotes[h.sym];
    const pct = q?.changePct;
    const contribution = (Number.isFinite(pct) ? pct * h.weight / 100 : null);
    return { ...h, pct, contribution };
  });

  // Sort by absolute contribution (biggest movers first), with weight tie-break.
  const ordered = rows.slice().sort((a, b) => {
    const aAbs = Math.abs(a.contribution ?? 0);
    const bAbs = Math.abs(b.contribution ?? 0);
    if (aAbs !== bAbs) return bAbs - aAbs;
    return b.weight - a.weight;
  });

  // Identify top 3 contributors (by absolute contribution) for highlight.
  const topContribs = new Set(ordered.slice(0, 3).map(r => r.sym));

  const tableRows = ordered.map(r => {
    const sign = (v, d = 2) => Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${v.toFixed(d)}` : '—';
    const dirClass = r.pct == null ? 'flat' : r.pct > 0 ? 'up' : r.pct < 0 ? 'down' : 'flat';
    const cdir     = r.contribution == null ? 'flat' : r.contribution > 0 ? 'up' : r.contribution < 0 ? 'down' : 'flat';
    const isTop    = topContribs.has(r.sym) ? ' top-contrib' : '';
    return `<tr class="${isTop.trim()}">
      <td class="th-sym">${r.sym}${topContribs.has(r.sym) ? '<span class="th-badge">drv</span>' : ''}</td>
      <td class="th-name">${r.name}</td>
      <td class="th-weight">${r.weight.toFixed(1)}%</td>
      <td class="th-move ${dirClass}">${r.pct == null ? '—' : sign(r.pct)}%</td>
      <td class="th-contrib ${cdir}">${r.contribution == null ? '—' : sign(r.contribution, 2)} pp</td>
    </tr>`;
  }).join('');

  tgt.innerHTML = `<table class="holdings-table">
    <thead><tr>
      <th>Symbol</th><th>Name</th><th>Weight</th><th>Today</th><th>Contribution</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>`;

  // Sum of contributions == ETF's roughly-explained move from the top 10.
  const sumContrib = ordered.reduce((s, r) => s + (r.contribution ?? 0), 0);
  const etfPct = state.quote?.changePct;
  if (Number.isFinite(etfPct) && Number.isFinite(sumContrib)) {
    const explained = etfPct === 0 ? 0 : (sumContrib / etfPct) * 100;
    note.innerHTML = `
      ${state.symbol} is ${etfPct >= 0 ? 'up' : 'down'} <strong>${etfPct >= 0 ? '+' : ''}${etfPct.toFixed(2)}%</strong> today.
      Top-10 holdings contributed <strong>${sumContrib >= 0 ? '+' : ''}${sumContrib.toFixed(2)}pp</strong>
      (~${Math.abs(explained).toFixed(0)}% of the move). Remainder is from the other ${def.holdings.length < 50 ? '40+' : ''} holdings.
      <span class="t-badge-explainer"><strong>drv</strong> = top-3 contributor by today's |weight × move|.</span>
    `;
  } else {
    note.textContent = '';
  }
}

// ---------- news ----------

async function loadNews() {
  // For an ETF, Finnhub /company-news often returns empty. Fall back to news
  // for the top 3 holdings (concatenated, deduplicated). For SPY specifically
  // we use a curated mix of large-caps that drive the index.
  const newsSymbols = state.isEtf
    ? ETF_HOLDINGS[state.symbol].holdings.slice(0, 3).map(h => h.sym)
    : [state.symbol];
  try {
    const j = await fetchJSON(`/api/stocks?mode=news&days=14&symbols=${newsSymbols.join(',')}`);
    // Flatten + dedupe by URL, sort by datetime desc, take top 12.
    const seen = new Set();
    const merged = [];
    for (const block of j.news) {
      for (const item of block.items) {
        if (seen.has(item.url)) continue;
        seen.add(item.url);
        merged.push({ ...item, sourceSymbol: block.symbol });
      }
    }
    merged.sort((a, b) => b.datetime - a.datetime);
    renderNews(merged.slice(0, 12), newsSymbols);
  } catch (e) {
    console.warn('news fetch failed:', e);
    renderNews([], newsSymbols);
  }
}

function renderNews(items, sourceSymbols) {
  const tgt = el('t-news-list');
  el('t-news-asof').textContent = state.isEtf ? `via top holdings: ${sourceSymbols.join(', ')}` : '';
  if (!items.length) {
    tgt.innerHTML = '<p class="t-empty">No recent news from Finnhub for this symbol.</p>';
    return;
  }
  tgt.innerHTML = items.map(it => {
    const date = new Date(it.datetime * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const summary = it.summary && it.summary.length > 200 ? it.summary.slice(0, 200) + '…' : (it.summary || '');
    return `<a class="t-news-item" href="${it.url}" target="_blank" rel="noopener noreferrer">
      <div class="t-news-meta">
        <span class="t-news-date">${date}</span>
        <span class="t-news-source">${it.source}</span>
        ${state.isEtf && it.sourceSymbol ? `<span class="t-news-attrib">via ${it.sourceSymbol}</span>` : ''}
      </div>
      <div class="t-news-headline">${it.headline}</div>
      ${summary ? `<div class="t-news-summary">${summary}</div>` : ''}
    </a>`;
  }).join('');
}

// ---------- wire-up ----------

function wireControls() {
  document.querySelectorAll('.period-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      const y = Number(btn.dataset.y);
      if (!Number.isFinite(y) || y === state.years) return;
      state.years = y;
      document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setStatus('stale', `Loading ${y}y…`);
      await loadHistory();
      renderChart();
      setStatus('live', 'Live');
    });
  });
  document.querySelectorAll('.chart-mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.m;
      if (m === state.mode) return;
      state.mode = m;
      document.querySelectorAll('.chart-mode-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderChart();
    });
  });
}

async function main() {
  document.title = `${state.symbol} — Siberforge`;
  setStatus('stale', 'Loading…');
  wireControls();

  try {
    await loadQuote();
    renderHeader();
    await Promise.all([loadHistory(), loadHoldingsQuotes(), loadNews()]);
    renderChart();
    renderHoldings();
    el('last-updated').textContent = `Updated ${new Date().toLocaleString()}`;
    setStatus('live', 'Live');
  } catch (err) {
    console.error(err);
    setStatus('error', `Error: ${err.message}`);
  }
}

main();
