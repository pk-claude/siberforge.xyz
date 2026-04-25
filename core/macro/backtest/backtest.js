// Walk-forward backtest of the regime-rotation framework.
//
// At each monthly rebalance:
//   1. Classify the current regime using only data known through month t.
//   2. For each sector, compute its historical forward-6m mean return in
//      months that (a) precede t and (b) shared the same regime as t. Sample
//      size requirement: n >= 6 to qualify; otherwise the strategy falls back
//      to equal-weighting all sectors that month.
//   3. Rank qualifying sectors by their prior-period mean. Take the top 3,
//      equal-weight them, hold for 1 month.
//   4. Rebalance at next month's close.
//
// Benchmarks: SPY buy-and-hold; 60/40 (SPY + IEF) monthly-rebalanced.
//
// Walk-forward discipline matters: using full-sample sector rankings (which
// the main dashboard table shows) would bake the future into every decision
// and inflate the apparent edge. This implementation has zero look-ahead.

import { buildRegimeMap } from '/core/macro/regimes.js';
import { dailyToMonthEnd } from '/core/macro/regime-returns.js';

// ---------- state ----------
const state = {
  regimeMap: null,
  monthEnds: {}, // symbol -> Map<YYYY-MM, {date, value}>
  results: null, // { strategy, spy, sixtyForty } each with returns + cumValue arrays
};
const charts = {};

// ---------- helpers ----------
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

const SECTOR_SYMS = ['XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC'];

// ---------- data load ----------

async function loadAllData() {
  setStatus('stale', 'Loading 30y of equity history…');
  const symbols = ['SPY', 'IEF', ...SECTOR_SYMS];
  const j = await fetchJSON(`/api/stocks?mode=history&years=30&symbols=${symbols.join(',')}`);
  for (const s of j.series) {
    state.monthEnds[s.symbol] = dailyToMonthEnd(s.closes);
  }

  setStatus('stale', 'Loading 40y of macro history…');
  const REGIME_START = `${new Date().getFullYear() - 40}-01-01`;
  const r = await fetchJSON(`/api/fred?series=CPILFESL,INDPRO,PAYEMS,RRSFS&start=${REGIME_START}`);
  const series = {};
  for (const s of r.series) series[s.id] = s.observations;
  state.regimeMap = buildRegimeMap({
    cpi:    series.CPILFESL || [],
    indpro: series.INDPRO   || [],
    payems: series.PAYEMS   || [],
    rrsfs:  series.RRSFS    || [],
  });
}

// ---------- the backtest ----------

function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12 + 12) % 12 + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

function compareYm(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

// Compute, for a given regime, each sector's historical forward-6m mean
// return using only months strictly before `cutoffYm` that shared `regime`.
function priorRegimeRanking(regime, cutoffYm) {
  const result = {};
  for (const sym of SECTOR_SYMS) {
    const monthEnds = state.monthEnds[sym];
    if (!monthEnds || !monthEnds.size) { result[sym] = { mean: NaN, n: 0 }; continue; }
    const samples = [];
    for (const [ym, info] of state.regimeMap.entries()) {
      if (info.regime !== regime) continue;
      if (compareYm(ym, cutoffYm) >= 0) continue; // strict <
      const startClose = monthEnds.get(ym);
      const futureYm = shiftMonth(ym, 6);
      const futureClose = monthEnds.get(futureYm);
      // Also require the future month to be < cutoff so the realized 6m return
      // was actually observable at cutoff time (no in-flight returns sneaking in).
      if (compareYm(futureYm, cutoffYm) >= 0) continue;
      if (!startClose || !futureClose) continue;
      if (startClose.value <= 0 || futureClose.value <= 0) continue;
      samples.push((futureClose.value / startClose.value - 1) * 100);
    }
    if (samples.length === 0) { result[sym] = { mean: NaN, n: 0 }; continue; }
    let sum = 0; for (const v of samples) sum += v;
    result[sym] = { mean: sum / samples.length, n: samples.length };
  }
  return result;
}

// Pick the top-N sectors by walk-forward mean. Requires minN observations to
// qualify; if too few qualify, return null (caller falls back to equal-weight).
function pickTopN(ranking, topN, minN) {
  const eligible = Object.entries(ranking)
    .filter(([_, v]) => Number.isFinite(v.mean) && v.n >= minN);
  if (eligible.length < topN) return null;
  eligible.sort((a, b) => b[1].mean - a[1].mean);
  return eligible.slice(0, topN).map(([sym]) => sym);
}

// One-period (1-month) return of a sector from cutoffYm to cutoffYm+1.
function monthReturn(sym, fromYm) {
  const monthEnds = state.monthEnds[sym];
  if (!monthEnds) return null;
  const a = monthEnds.get(fromYm);
  const b = monthEnds.get(shiftMonth(fromYm, 1));
  if (!a || !b || a.value <= 0 || b.value <= 0) return null;
  return b.value / a.value - 1;
}

function runBacktest() {
  // Determine the rebalance dates: every month that has both a regime
  // classification AND price data for SPY + at least the 9 original sectors
  // (XLRE post-2015, XLC post-2018 are tolerated as missing for early years).
  const regimeMonths = [...state.regimeMap.keys()].sort();
  const minSpyYm = state.monthEnds.SPY ? [...state.monthEnds.SPY.keys()].sort()[0] : null;
  const minIefYm = state.monthEnds.IEF ? [...state.monthEnds.IEF.keys()].sort()[0] : null;

  // Backtest start: max(IEF inception ~2002-07, sector inception ~1998-12, regime warmup).
  // Plus 60-month walk-forward warmup so priors are usable.
  const earliestData = [minSpyYm, minIefYm, '1999-12'].filter(Boolean).sort().pop();
  const backtestStart = shiftMonth(earliestData, 60);

  const usable = regimeMonths.filter(ym => compareYm(ym, backtestStart) >= 0);
  if (usable.length < 12) {
    return { error: 'Insufficient overlap between regime data and price history.' };
  }

  // Strategy state
  let stratValue = 100;
  let benchSpy = 100;
  let benchSf = 100;
  let prevWeights = {};
  const stratReturns = [], spyReturns = [], sfReturns = [];
  const stratValues = [], spyValues = [], sfValues = [];
  const dates = [];
  const regimes = [];
  const turnoverMonthly = [];

  // We rebalance at month t, hold to month t+1. So we iterate up to second-to-last.
  for (let i = 0; i < usable.length - 1; i++) {
    const ym = usable[i];
    const info = state.regimeMap.get(ym);
    if (!info) continue;

    // Walk-forward sector ranking
    const ranking = priorRegimeRanking(info.regime, ym);
    let weights;
    let top3 = pickTopN(ranking, 3, 6);
    if (!top3) {
      // Fallback: equal-weight all sectors with price data this month
      const available = SECTOR_SYMS.filter(s => state.monthEnds[s]?.has(ym));
      if (!available.length) continue;
      weights = Object.fromEntries(available.map(s => [s, 1 / available.length]));
    } else {
      weights = Object.fromEntries(top3.map(s => [s, 1 / 3]));
    }

    // Realized return over the next month
    let stratR = 0;
    for (const [sym, w] of Object.entries(weights)) {
      const r = monthReturn(sym, ym);
      if (r != null) stratR += w * r;
    }
    const spyR = monthReturn('SPY', ym) ?? 0;
    const iefR = monthReturn('IEF', ym) ?? 0;
    const sfR = 0.6 * spyR + 0.4 * iefR;

    // Turnover: sum of |new_w - prev_w| / 2
    let turnover = 0;
    const allKeys = new Set([...Object.keys(weights), ...Object.keys(prevWeights)]);
    for (const k of allKeys) {
      turnover += Math.abs((weights[k] || 0) - (prevWeights[k] || 0));
    }
    turnoverMonthly.push(turnover / 2);
    prevWeights = weights;

    stratValue *= (1 + stratR);
    benchSpy   *= (1 + spyR);
    benchSf    *= (1 + sfR);

    // Record at end of held period (i.e., month t+1)
    const holdYm = usable[i + 1];
    dates.push(holdYm);
    regimes.push(info.regime);
    stratReturns.push(stratR);
    spyReturns.push(spyR);
    sfReturns.push(sfR);
    stratValues.push(stratValue);
    spyValues.push(benchSpy);
    sfValues.push(benchSf);
  }

  return {
    dates, regimes,
    strategy:    { name: 'Regime Rotation', returns: stratReturns, values: stratValues, color: '#f7a700' },
    spy:         { name: 'SPY (buy-hold)',  returns: spyReturns,   values: spyValues,   color: '#5a9cff' },
    sixtyForty:  { name: '60/40',           returns: sfReturns,    values: sfValues,    color: '#3ecf8e' },
    turnoverMonthly,
    backtestStart,
  };
}

// ---------- metrics ----------

function metrics(result, vsSpy) {
  const r = result.returns;
  const v = result.values;
  if (!r.length) return null;
  const months = r.length;
  const years = months / 12;
  const cagr = Math.pow(v[v.length - 1] / 100, 1 / years) - 1;
  // Annualized vol from monthly returns (sample stddev * sqrt(12))
  let mu = 0; for (const x of r) mu += x; mu /= months;
  let sumSq = 0; for (const x of r) sumSq += (x - mu) * (x - mu);
  const monthlyVol = Math.sqrt(sumSq / Math.max(1, months - 1));
  const annVol = monthlyVol * Math.sqrt(12);
  const sharpe = annVol > 0 ? (cagr - 0.02) / annVol : NaN;

  // Max drawdown
  let peak = v[0], maxDd = 0;
  for (const x of v) { if (x > peak) peak = x; const dd = x / peak - 1; if (dd < maxDd) maxDd = dd; }

  // Beta vs SPY (using monthly returns)
  let beta = NaN, hitRate = NaN;
  if (vsSpy && vsSpy.returns.length === r.length) {
    const sx = vsSpy.returns;
    let sxMu = 0; for (const x of sx) sxMu += x; sxMu /= months;
    let cov = 0, vx = 0;
    for (let i = 0; i < months; i++) {
      cov += (r[i] - mu) * (sx[i] - sxMu);
      vx  += (sx[i] - sxMu) * (sx[i] - sxMu);
    }
    beta = vx > 0 ? cov / vx : NaN;
    let hits = 0;
    for (let i = 0; i < months; i++) if (r[i] > sx[i]) hits++;
    hitRate = hits / months;
  }
  return { cagr, annVol, sharpe, maxDd, beta, hitRate, months };
}

// ---------- rendering ----------

function renderEquityCurve(result) {
  const datasets = [result.strategy, result.spy, result.sixtyForty].map(s => ({
    label: s.name,
    data: result.dates.map((d, i) => ({ x: `${d}-15`, y: s.values[i] })),
    borderColor: s.color,
    backgroundColor: s.color === '#f7a700' ? 'rgba(247, 167, 0, 0.10)' : 'transparent',
    borderWidth: s.name.includes('Rotation') ? 2.2 : 1.4,
    pointRadius: 0,
    fill: s.name.includes('Rotation'),
    tension: 0.1,
  }));

  if (charts.equity) charts.equity.destroy();
  charts.equity = new Chart(el('chart-equity').getContext('2d'), {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#e5e9ee', font: { size: 11 }, boxWidth: 12 } },
        tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1 },
      },
      scales: {
        x: { type: 'time', time: { unit: 'year' }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 } } },
        y: { type: 'logarithmic', grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 }, callback: v => `$${v}` } },
      },
    },
  });
}

function renderMetricsTable(stratM, spyM, sfM, totalTurnover) {
  const rows = [
    ['CAGR',                stratM, spyM, sfM, m => m ? `${(m.cagr * 100).toFixed(2)}%` : '—', 'higher'],
    ['Annualized vol',      stratM, spyM, sfM, m => m ? `${(m.annVol * 100).toFixed(1)}%` : '—', 'lower'],
    ['Sharpe (rf=2%)',      stratM, spyM, sfM, m => m ? m.sharpe.toFixed(2) : '—', 'higher'],
    ['Max drawdown',        stratM, spyM, sfM, m => m ? `${(m.maxDd * 100).toFixed(1)}%` : '—', 'higher'], // less negative = better
    ['Beta vs SPY',         stratM, spyM, sfM, m => m && Number.isFinite(m.beta) ? m.beta.toFixed(2) : '—', null],
    ['Hit rate vs SPY',     stratM, spyM, sfM, m => m && Number.isFinite(m.hitRate) ? `${(m.hitRate * 100).toFixed(0)}%` : '—', null],
  ];

  const valFor = (m, fmt_) => fmt_(m);

  // For "best" highlighting, find the row's best value among strat/spy/sf when applicable
  function bestOf(rowLabel, vals, dir) {
    if (!dir) return -1;
    let best = -1, bestVal = null;
    vals.forEach((v, i) => {
      if (v == null) return;
      if (bestVal == null) { best = i; bestVal = v; return; }
      if (dir === 'higher' && v > bestVal) { best = i; bestVal = v; }
      if (dir === 'lower'  && v < bestVal) { best = i; bestVal = v; }
    });
    return best;
  }

  const html = `
    <table class="bt-metrics-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th class="bt-strat-col">Regime Rotation</th>
          <th>SPY</th>
          <th>60/40</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(([label, sm, ym, fm, fn, dir]) => {
          // raw values for ranking
          const raw = [
            sm ? (label.startsWith('CAGR') ? sm.cagr : label.startsWith('Annualized') ? sm.annVol : label.startsWith('Sharpe') ? sm.sharpe : label.startsWith('Max') ? sm.maxDd : null) : null,
            ym ? (label.startsWith('CAGR') ? ym.cagr : label.startsWith('Annualized') ? ym.annVol : label.startsWith('Sharpe') ? ym.sharpe : label.startsWith('Max') ? ym.maxDd : null) : null,
            fm ? (label.startsWith('CAGR') ? fm.cagr : label.startsWith('Annualized') ? fm.annVol : label.startsWith('Sharpe') ? fm.sharpe : label.startsWith('Max') ? fm.maxDd : null) : null,
          ];
          const best = bestOf(label, raw, dir);
          return `<tr>
            <td>${label}</td>
            <td class="${best === 0 ? 'bt-best' : ''} bt-strat-col">${fn(sm)}</td>
            <td class="${best === 1 ? 'bt-best' : ''}">${fn(ym)}</td>
            <td class="${best === 2 ? 'bt-best' : ''}">${fn(fm)}</td>
          </tr>`;
        }).join('')}
        <tr>
          <td>Avg annual turnover</td>
          <td class="bt-strat-col">${(totalTurnover * 12 * 100).toFixed(0)}%</td>
          <td>~0% (buy-hold)</td>
          <td>~30% (monthly rebal.)</td>
        </tr>
      </tbody>
    </table>
    <p class="bt-table-note">
      <strong>Reading:</strong> CAGR &amp; Sharpe higher is better; vol lower is better; max drawdown
      closer-to-zero is better. <strong>Best in each row highlighted.</strong> Hit rate at 50% means
      the strategy beat SPY in the same fraction of months it lost — meaningfully above 55% is
      where consistent edge lives.
    </p>
  `;
  el('bt-metrics-table').innerHTML = html;
}

function renderExcessChart(result) {
  // Rolling 12-month excess of strategy vs SPY (compounded).
  const r = result.strategy.returns, s = result.spy.returns;
  const out = [];
  for (let i = 11; i < r.length; i++) {
    let stratC = 1, spyC = 1;
    for (let j = i - 11; j <= i; j++) { stratC *= (1 + r[j]); spyC *= (1 + s[j]); }
    out.push({ x: `${result.dates[i]}-15`, y: (stratC - spyC) * 100 });
  }
  if (charts.excess) charts.excess.destroy();
  charts.excess = new Chart(el('chart-excess').getContext('2d'), {
    type: 'line',
    data: {
      datasets: [{
        label: 'Rolling 12m excess vs SPY (pp)',
        data: out,
        borderColor: '#f7a700',
        backgroundColor: 'rgba(247, 167, 0, 0.10)',
        borderWidth: 1.6,
        pointRadius: 0,
        fill: { target: 'origin', above: 'rgba(62, 207, 142, 0.15)', below: 'rgba(239, 79, 90, 0.15)' },
        tension: 0.1,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e5e9ee', font: { size: 11 } } },
        tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1 },
      },
      scales: {
        x: { type: 'time', time: { unit: 'year' }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 }, callback: v => `${v >= 0 ? '+' : ''}${v}pp` } },
      },
    },
  });
}

function renderRegimeBreakdown(result) {
  // For each regime, compute annualized return of strategy + SPY conditional on
  // months that traded in that regime.
  const REGIMES = ['goldilocks', 'reflation', 'stagflation', 'disinflation'];
  const labels = { goldilocks: 'Goldilocks', reflation: 'Reflation', stagflation: 'Stagflation', disinflation: 'Disinflation' };
  const colors = { goldilocks: '#3ecf8e', reflation: '#f7a700', stagflation: '#ef4f5a', disinflation: '#5a9cff' };

  const stratByR = {}, spyByR = {};
  for (const r of REGIMES) { stratByR[r] = []; spyByR[r] = []; }
  for (let i = 0; i < result.regimes.length; i++) {
    const r = result.regimes[i];
    if (!stratByR[r]) continue;
    stratByR[r].push(result.strategy.returns[i]);
    spyByR[r].push(result.spy.returns[i]);
  }
  function annualize(arr) {
    if (!arr.length) return null;
    let cum = 1; for (const x of arr) cum *= (1 + x);
    const yrs = arr.length / 12;
    return (Math.pow(cum, 1 / yrs) - 1) * 100;
  }
  const stratVals = REGIMES.map(r => annualize(stratByR[r]));
  const spyVals   = REGIMES.map(r => annualize(spyByR[r]));

  if (charts.breakdown) charts.breakdown.destroy();
  charts.breakdown = new Chart(el('chart-regime-breakdown').getContext('2d'), {
    type: 'bar',
    data: {
      labels: REGIMES.map(r => labels[r]),
      datasets: [
        {
          label: 'Regime Rotation',
          data: stratVals,
          backgroundColor: REGIMES.map(r => colors[r]),
          borderWidth: 0,
        },
        {
          label: 'SPY',
          data: spyVals,
          backgroundColor: 'rgba(229, 233, 238, 0.40)',
          borderColor: 'rgba(229, 233, 238, 0.7)',
          borderWidth: 1.5,
          borderDash: [4, 4],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e5e9ee', font: { size: 11 } } },
        tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1 },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8a94a3', font: { size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 }, callback: v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%` },
             title: { display: true, text: 'annualized return while in regime (%)', color: '#8a94a3', font: { size: 11 } } },
      },
    },
  });

  // Companion table with deltas + month counts
  const rows = REGIMES.map((r, i) => {
    const sv = stratVals[i], yv = spyVals[i];
    const delta = (sv != null && yv != null) ? sv - yv : null;
    const months = stratByR[r].length;
    const dCls = delta == null ? 'flat' : delta > 0 ? 'up' : 'down';
    return `<tr>
      <td><span class="regime-dot" style="background:${colors[r]}"></span> ${labels[r]}</td>
      <td>${months}</td>
      <td>${sv != null ? `${sv >= 0 ? '+' : ''}${sv.toFixed(1)}%` : '—'}</td>
      <td>${yv != null ? `${yv >= 0 ? '+' : ''}${yv.toFixed(1)}%` : '—'}</td>
      <td class="bt-delta ${dCls}">${delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}pp` : '—'}</td>
    </tr>`;
  }).join('');
  el('bt-regime-table').innerHTML = `
    <table class="bt-regime-table">
      <thead><tr><th>Regime</th><th>Months</th><th>Strategy ann.</th><th>SPY ann.</th><th>Edge</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ---------- verdict hero ----------

function renderVerdict(stratM, spyM, sfM) {
  const tgt = el('bt-verdict-section');
  if (!tgt || !stratM || !spyM) return;
  const cagrEdge = (stratM.cagr - spyM.cagr) * 100;
  const sharpeEdge = stratM.sharpe - spyM.sharpe;

  let verdictColor = '#5a9cff';
  let verdictLabel = 'Inconclusive';
  if (cagrEdge > 1.5 && sharpeEdge > 0.1)        { verdictColor = '#3ecf8e'; verdictLabel = 'Edge confirmed'; }
  else if (cagrEdge > 0 && sharpeEdge > 0)       { verdictColor = '#f7a700'; verdictLabel = 'Modest edge'; }
  else if (cagrEdge < -0.5 || sharpeEdge < -0.1) { verdictColor = '#ef4f5a'; verdictLabel = 'No edge'; }

  tgt.innerHTML = `
    <div class="cs-score-card">
      <div class="cs-score-dial" style="--cs-color:${verdictColor}">
        <div class="cs-score-label">VERDICT &middot; ${stratM.months} MONTHS</div>
        <div class="cs-score-value" style="font-size:38px">${cagrEdge >= 0 ? '+' : ''}${cagrEdge.toFixed(2)}<span class="cs-score-scale">pp/yr</span></div>
        <div class="cs-score-phase" style="color:${verdictColor}">${verdictLabel}</div>
        <div class="cs-score-desc">Regime Rotation strategy CAGR minus SPY CAGR over the backtest window.</div>
      </div>
      <div class="cs-signals">
        <div class="cs-signals-title">Headline numbers</div>
        <div class="cs-signal">
          <div class="cs-signal-name">Strategy CAGR</div>
          <div class="cs-signal-bar"><div class="cs-signal-fill" style="width:${Math.min(100, Math.max(0, stratM.cagr * 500))}%;background:${verdictColor}"></div></div>
          <div class="cs-signal-value">${(stratM.cagr * 100).toFixed(2)}%</div>
        </div>
        <div class="cs-signal">
          <div class="cs-signal-name">SPY CAGR</div>
          <div class="cs-signal-bar"><div class="cs-signal-fill" style="width:${Math.min(100, Math.max(0, spyM.cagr * 500))}%;background:#5a9cff"></div></div>
          <div class="cs-signal-value">${(spyM.cagr * 100).toFixed(2)}%</div>
        </div>
        <div class="cs-signal">
          <div class="cs-signal-name">Sharpe edge vs SPY</div>
          <div class="cs-signal-bar"><div class="cs-signal-fill" style="width:${Math.min(100, Math.max(0, (sharpeEdge + 0.5) * 100))}%;background:${verdictColor}"></div></div>
          <div class="cs-signal-value">${sharpeEdge >= 0 ? '+' : ''}${sharpeEdge.toFixed(2)}</div>
        </div>
        <div class="cs-signal">
          <div class="cs-signal-name">Drawdown vs SPY</div>
          <div class="cs-signal-bar"><div class="cs-signal-fill" style="width:${Math.min(100, Math.max(0, (Math.abs(spyM.maxDd) - Math.abs(stratM.maxDd)) * 200 + 50))}%;background:${verdictColor}"></div></div>
          <div class="cs-signal-value">${((Math.abs(spyM.maxDd) - Math.abs(stratM.maxDd)) * 100).toFixed(1)}pp better</div>
        </div>
        <div class="cs-weights-note">All metrics use walk-forward decisions (no look-ahead). Backtest window: ${stratM.months} months, ~${(stratM.months / 12).toFixed(1)} years.</div>
      </div>
    </div>
  `;
}

// ---------- main ----------

async function main() {
  try {
    await loadAllData();
    setStatus('stale', 'Running walk-forward backtest…');
    const result = runBacktest();
    if (result.error) {
      el('bt-verdict-section').innerHTML = `<div class="bt-error">${result.error}</div>`;
      setStatus('error', 'No backtest result');
      return;
    }
    state.results = result;

    const stratM = metrics(result.strategy, result.spy);
    const spyM   = metrics(result.spy,      result.spy);
    const sfM    = metrics(result.sixtyForty, result.spy);
    const avgTurnover = result.turnoverMonthly.reduce((s, x) => s + x, 0) / Math.max(1, result.turnoverMonthly.length);

    renderVerdict(stratM, spyM, sfM);
    renderEquityCurve(result);
    renderMetricsTable(stratM, spyM, sfM, avgTurnover);
    renderExcessChart(result);
    renderRegimeBreakdown(result);

    el('last-updated').textContent = `Updated ${new Date().toLocaleString()}`;
    setStatus('live', 'Live');
  } catch (err) {
    console.error(err);
    setStatus('error', `Error: ${err.message}`);
  }
}

main();
