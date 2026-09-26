// Regime-conditional forward returns aggregator.
//
// Pure module — no DOM, no fetch. Takes a regime classification (Map keyed by
// YYYY-MM) and per-symbol daily close arrays, and returns the average forward
// total return per (regime × symbol × horizon).
//
// We retain the full sample of forward returns per (regime × symbol × horizon)
// so we can report the full distribution (min / Q1 / median / Q3 / max), not
// just the mean. The Disinflation regime in particular is bimodal — soft-
// landing rallies vs. recession bottoms — and the mean alone hides that.

// Reduce a daily series to month-end. We pick the LAST observed close in each
// calendar month rather than seeking a specific business day, which is robust
// to month-end holidays and varying exchange schedules.
//
// Returns Map<'YYYY-MM', { date, value }>.
export function dailyToMonthEnd(closes) {
  if (!closes || !closes.length) return new Map();
  const m = new Map();
  for (const o of closes) {
    if (!o || !Number.isFinite(o.value)) continue;
    const ym = o.date.slice(0, 7);
    m.set(ym, { date: o.date, value: o.value });
  }
  return m;
}

export function prevMonth(ym) {
  let [y, m] = ym.split('-').map(Number);
  m -= 1; if (m === 0) { m = 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
const monthIndex = ym => { const [y, m] = ym.split('-').map(Number); return y * 12 + m - 1; };

// Quantile of a sorted array via linear interpolation between observations.
// q in [0, 1].
function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  if (q <= 0) return sorted[0];
  if (q >= 1) return sorted[sorted.length - 1];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Aggregate forward returns by regime for one symbol. Returns:
//   { goldilocks: { 1: {mean, std, n, min, q1, median, q3, max}, 3: ..., 6: ... }, ... }
export function regimeForwardReturns(monthEndCloses, regimeMap, horizons = [1, 3, 6], { since = null } = {}) {
  const samples = {};
  for (const r of ['goldilocks', 'reflation', 'stagflation', 'disinflation']) {
    samples[r] = {};
    for (const h of horizons) samples[r][h] = [];
  }

  const months = [...monthEndCloses.keys()].sort();

  for (let i = 0; i < months.length; i++) {
    const ym = months[i];
    if (since && ym < since.slice(0, 7)) continue;
    // Point-in-time: at the close of month m the latest classifiable month is
    // m-1 (CPI, IP, retail sales and payrolls for m are published during m+1).
    const info = regimeMap.get(prevMonth(ym));
    if (!info) continue;
    const startVal = monthEndCloses.get(ym).value;
    if (!Number.isFinite(startVal) || startVal <= 0) continue;

    for (const h of horizons) {
      const futureIdx = i + h;
      if (futureIdx >= months.length) continue;
      const futureClose = monthEndCloses.get(months[futureIdx]);
      if (!futureClose || !Number.isFinite(futureClose.value) || futureClose.value <= 0) continue;
      const ret = (futureClose.value / startVal - 1) * 100;
      samples[info.regime][h].push(ret);
    }
  }

  const out = {};
  for (const r of Object.keys(samples)) {
    out[r] = {};
    for (const h of horizons) {
      const arr = samples[r][h];
      if (arr.length === 0) {
        out[r][h] = { mean: NaN, std: NaN, n: 0, min: NaN, q1: NaN, median: NaN, q3: NaN, max: NaN };
      } else {
        const n = arr.length;
        let sum = 0, sumSq = 0;
        for (const v of arr) { sum += v; sumSq += v * v; }
        const mean = sum / n;
        const variance = n > 1 ? (sumSq - sum * sum / n) / (n - 1) : 0;
        const sorted = arr.slice().sort((a, b) => a - b);
        out[r][h] = {
          mean,
          std: variance > 0 ? Math.sqrt(variance) : 0,
          n,
          min:    sorted[0],
          q1:     quantile(sorted, 0.25),
          median: quantile(sorted, 0.5),
          q3:     quantile(sorted, 0.75),
          max:    sorted[sorted.length - 1],
        };
      }
    }
  }
  return out;
}

// Build the full table for a set of symbols.
export function buildRegimeReturnsTable(stockHistoryMap, regimeMap, horizons = [1, 3, 6], { since = null } = {}) {
  const result = {};
  for (const [symbol, closes] of Object.entries(stockHistoryMap)) {
    const monthEnds = dailyToMonthEnd(closes);
    result[symbol] = regimeForwardReturns(monthEnds, regimeMap, horizons, { since });
  }
  return result;
}

// Excess forward return of `sym` over SPY, conditional on regime, on MATCHED
// months only (both series must exist at start and end), with a Newey-West
// t-statistic. Overlapping h-month windows sampled monthly are serially
// correlated to lag h-1, so the naive n overstates the evidence roughly h-fold;
// NW with lag h-1 corrects the standard error.
//
// Returns { regime: { mean, n, t, se, first } }.
export function regimeExcessStats(symCloses, spyCloses, regimeMap, h = 6, { since = null } = {}) {
  const a = dailyToMonthEnd(symCloses), b = dailyToMonthEnd(spyCloses);
  const months = [...a.keys()].filter(k => b.has(k)).sort();
  const byRegime = {};
  for (let i = 0; i + h < months.length; i++) {
    const ym = months[i];
    if (since && ym < since.slice(0, 7)) continue;
    const end = months[i + h];
    if (monthIndex(end) - monthIndex(ym) !== h) continue; // gap in data
    const info = regimeMap.get(prevMonth(ym));
    if (!info) continue;
    const ra = a.get(end).value / a.get(ym).value - 1;
    const rb = b.get(end).value / b.get(ym).value - 1;
    if (!Number.isFinite(ra) || !Number.isFinite(rb)) continue;
    (byRegime[info.regime] ||= []).push({ k: monthIndex(ym), e: (ra - rb) * 100, ym });
  }
  const out = {};
  for (const [r, xs] of Object.entries(byRegime)) {
    const n = xs.length;
    const mean = xs.reduce((s, x) => s + x.e, 0) / n;
    let v = xs.reduce((s, x) => s + (x.e - mean) ** 2, 0) / n;
    const L = h - 1;
    for (let lag = 1; lag <= L; lag++) {
      let g = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n && xs[j].k - xs[i].k <= lag; j++) {
        if (xs[j].k - xs[i].k === lag) g += (xs[i].e - mean) * (xs[j].e - mean);
      }
      v += 2 * (1 - lag / (L + 1)) * (g / n);
    }
    const se = Math.sqrt(Math.max(v, 1e-12) / n);
    out[r] = { mean, n, se, t: mean / se, first: xs[0].ym };
  }
  return out;
}
