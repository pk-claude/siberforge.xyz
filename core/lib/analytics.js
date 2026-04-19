// Client-side analytics: date alignment, correlation, regression, z-score.
// Transforms live in ./transforms.js (canonical). This module re-exports
// applyTransform / yoyPct / logReturns for back-compat with the macro
// dashboard's existing import list.
//
// All functions assume input series are arrays of { date: 'YYYY-MM-DD', value: number }.

import {
  applyTransform as applyTransformCanonical,
  transformYoy,
  transformLogReturn,
} from './transforms.js';

// ---------- transforms (re-exports) ----------

export const applyTransform = applyTransformCanonical;
// Historical names kept for back-compat with macro/dashboard.js import.
export const yoyPct     = transformYoy;
export const logReturns = transformLogReturn;

// ---------- alignment ----------

// Align two series on shared dates. When a series is lower-frequency (e.g.
// monthly macro vs daily stocks), we forward-fill the macro value through each
// day until the next release. This is how practitioners line up macro-to-price.
export function alignForward(macro, stocks) {
  if (!macro.length || !stocks.length) return { x: [], y: [], dates: [] };
  const macroSorted = [...macro].sort((a, b) => a.date.localeCompare(b.date));
  const stockSorted = [...stocks].sort((a, b) => a.date.localeCompare(b.date));

  const x = [], y = [], dates = [];
  let mi = 0;
  for (const s of stockSorted) {
    // Advance macro pointer to the latest obs with date <= s.date.
    while (mi + 1 < macroSorted.length && macroSorted[mi + 1].date <= s.date) mi++;
    if (macroSorted[mi].date > s.date) continue; // no macro data yet on this date
    x.push(macroSorted[mi].value);
    y.push(s.value);
    dates.push(s.date);
  }
  return { x, y, dates };
}

// ---------- statistics ----------

function mean(arr) {
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

function stdDev(arr, mu) {
  if (arr.length < 2) return 0;
  const m = mu !== undefined ? mu : mean(arr);
  let s = 0;
  for (const v of arr) s += (v - m) * (v - m);
  return Math.sqrt(s / (arr.length - 1)); // sample stddev
}

// Pearson correlation between two equal-length arrays.
export function pearson(x, y) {
  if (x.length !== y.length || x.length < 2) return NaN;
  const mx = mean(x), my = mean(y);
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < x.length; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b;
    dx2 += a * a;
    dy2 += b * b;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? NaN : num / denom;
}

// Rolling correlation over a given window length (in observations).
// Returns array of { date, value } matching the trailing date of each window.
export function rollingCorrelation(aligned, window) {
  const { x, y, dates } = aligned;
  const out = [];
  if (x.length < window) return out;
  for (let i = window - 1; i < x.length; i++) {
    const xs = x.slice(i - window + 1, i + 1);
    const ys = y.slice(i - window + 1, i + 1);
    const r = pearson(xs, ys);
    if (Number.isFinite(r)) out.push({ date: dates[i], value: r });
  }
  return out;
}

// OLS simple regression: y = alpha + beta * x. Returns beta, alpha, R^2.
export function regression(x, y) {
  if (x.length !== y.length || x.length < 2) {
    return { beta: NaN, alpha: NaN, r2: NaN, n: x.length };
  }
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const beta = sxx === 0 ? NaN : sxy / sxx;
  const alpha = my - beta * mx;
  const r2 = (sxx === 0 || syy === 0) ? NaN : (sxy * sxy) / (sxx * syy);
  return { beta, alpha, r2, n: x.length };
}

// Z-score transform of a series — useful for overlaying indicators on one axis.
export function zscore(series) {
  const vals = series.map(o => o.value);
  const mu = mean(vals);
  const sd = stdDev(vals, mu);
  if (sd === 0) return series.map(o => ({ date: o.date, value: 0 }));
  return series.map(o => ({ date: o.date, value: (o.value - mu) / sd }));
}

// Convenience: align + pearson in one call.
export function corrPair(macro, stocks) {
  const { x, y } = alignForward(macro, stocks);
  return { r: pearson(x, y), n: x.length };
}
