// Regime-conditional forward returns aggregator.
//
// Pure module — no DOM, no fetch. Takes a regime classification (Map keyed by
// YYYY-MM) and per-symbol daily close arrays, and returns the average forward
// total return per (regime × symbol × horizon).
//
// What this is replacing: the old indicator × sector correlation heatmap
// (renderHeatmap) computed Pearson r between each indicator's daily forward-
// filled value and each sector's daily log return — averaged across multiple
// regimes, dominated by autocorrelation artifacts, and not actionable.
//
// What this gives you instead: for each historical month classified into one of
// four growth/inflation regimes, the realized forward 1m / 3m / 6m total return
// of every sector. The result table answers a directly tradeable question:
// "given we're in regime X, what has historically happened to each sector over
// the next N months?"
//
// Caveats:
//   * Past performance ≠ future returns. The regimes don't recur identically;
//     average forward returns are a base-rate estimate, not a forecast.
//   * Sample sizes vary by regime and by symbol (XLRE began Oct 2015, XLC in
//     June 2018). Cells with low n should be greyed out at the UI layer.
//   * Returns are simple (not log) total return and assume month-end-to-
//     month-end holding. Dividends are excluded since Yahoo's adjusted close
//     would be needed; for sector ETFs over 6m horizons the dividend miss is
//     small (~50–150bp annualized) but real.

// Reduce a daily series to month-end. We pick the LAST observed close in each
// calendar month rather than seeking a specific business day, which is robust
// to month-end holidays and varying exchange schedules.
//
// Returns Map<'YYYY-MM', { date, value }>.
export function dailyToMonthEnd(closes) {
  if (!closes || !closes.length) return new Map();
  // Closes from /api/stocks come pre-sorted ascending. Walk and keep last per ym.
  const m = new Map();
  for (const o of closes) {
    if (!o || !Number.isFinite(o.value)) continue;
    const ym = o.date.slice(0, 7);
    m.set(ym, { date: o.date, value: o.value });
  }
  return m;
}

// Aggregate forward returns by regime for one symbol. Returns:
//   { goldilocks: { 1: {mean, n}, 3: {mean, n}, 6: {mean, n} }, ... }
//
// horizons is in months. For each in-sample month with a known regime AND a
// future month-end value at that horizon, add the percent total return to the
// regime's accumulator and increment n.
export function regimeForwardReturns(monthEndCloses, regimeMap, horizons = [1, 3, 6]) {
  const accum = {};
  for (const r of ['goldilocks', 'reflation', 'stagflation', 'disinflation']) {
    accum[r] = {};
    for (const h of horizons) accum[r][h] = { sum: 0, sumSq: 0, n: 0 };
  }

  const months = [...monthEndCloses.keys()].sort();
  const ymToIdx = new Map(months.map((ym, i) => [ym, i]));

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
      const ret = (futureClose.value / startVal - 1) * 100; // pct
      const a = accum[info.regime][h];
      a.sum += ret;
      a.sumSq += ret * ret;
      a.n += 1;
    }
  }

  const out = {};
  for (const r of Object.keys(accum)) {
    out[r] = {};
    for (const h of horizons) {
      const a = accum[r][h];
      if (a.n === 0) {
        out[r][h] = { mean: NaN, std: NaN, n: 0 };
      } else {
        const mean = a.sum / a.n;
        const variance = a.n > 1 ? (a.sumSq - a.sum * a.sum / a.n) / (a.n - 1) : 0;
        out[r][h] = { mean, std: variance > 0 ? Math.sqrt(variance) : 0, n: a.n };
      }
    }
  }
  return out;
}

// Build the full table for a set of symbols. Input is { symbol: closes[] };
// output is { symbol: regimeForwardReturns(...) }. Used by the dashboard.
export function buildRegimeReturnsTable(stockHistoryMap, regimeMap, horizons = [1, 3, 6]) {
  const result = {};
  for (const [symbol, closes] of Object.entries(stockHistoryMap)) {
    const monthEnds = dailyToMonthEnd(closes);
    result[symbol] = regimeForwardReturns(monthEnds, regimeMap, horizons);
  }
  return result;
}
