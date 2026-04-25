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
export function regimeForwardReturns(monthEndCloses, regimeMap, horizons = [1, 3, 6]) {
  const samples = {};
  for (const r of ['goldilocks', 'reflation', 'stagflation', 'disinflation']) {
    samples[r] = {};
    for (const h of horizons) samples[r][h] = [];
  }

  const months = [...monthEndCloses.keys()].sort();

  for (let i = 0; i < months.length; i++) {
    const ym = months[i];
    const info = regimeMap.get(ym);
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
export function buildRegimeReturnsTable(stockHistoryMap, regimeMap, horizons = [1, 3, 6]) {
  const result = {};
  for (const [symbol, closes] of Object.entries(stockHistoryMap)) {
    const monthEnds = dailyToMonthEnd(closes);
    result[symbol] = regimeForwardReturns(monthEnds, regimeMap, horizons);
  }
  return result;
}
