// Regime classifier.
//
// Pure module â€” no DOM, no fetch. Inputs are FRED-shape arrays of
// { date: 'YYYY-MM-DD', value: number }. Output is a Map<YYYY-MM, {regime, ...}>.
//
// Methodology (chosen by user, see ../../../_archive/macro_dashboard_redesign.md):
//   X-axis (growth)    = composite z-score of three 6m-annualized growth measures:
//                          INDPRO   (industrial production, monthly)
//                          PAYEMS   (nonfarm payrolls, monthly)
//                          RRSFS    (real retail sales, monthly)
//                        Each series is converted to 6m annualized rate-of-change,
//                        then z-scored on a trailing 120-month (10y) window. The
//                        three component z's are averaged to form the composite.
//
//   Y-axis (inflation) = z-score of CPILFESL (Core CPI) 6m annualized rate-of-change,
//                        same trailing-120m z-window.
//
// Quadrant convention (X, Y):
//   growthZ >= 0 & inflationZ <  0  -> goldilocks   (growth up, inflation cool)
//   growthZ >= 0 & inflationZ >= 0  -> reflation    (growth up, inflation up)
//   growthZ <  0 & inflationZ >= 0  -> stagflation  (growth down, inflation up)
//   growthZ <  0 & inflationZ <  0  -> disinflation (growth down, inflation down â€” recession risk)
//
// Why a TRAILING z-score window:
//   Regime "where are we vs recent history" beats "where are we vs all of history."
//   Inflation in the 1970s structurally swamps everything else; using a full-sample
//   z-score makes the 2024 episode look mild. 120 months captures roughly one full
//   cycle plus expansion, which is the right reference frame for cycle positioning.
//   Trailing also means the historical classification is computable at the time â€”
//   no look-ahead bias when a user is reading the chart.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Daily/monthly FRED observations -> Map<'YYYY-MM', value>.
// For monthly FRED series, observations are already first-of-month dated; we
// just key by year-month. If multiple observations land in the same month
// (shouldn't for monthly series, but safe) keep the latest.
export function toMonthlyMap(series) {
  const m = new Map();
  for (const o of series) {
    const ym = o.date.slice(0, 7);
    m.set(ym, o.value);
  }
  return m;
}

// Step a YYYY-MM key forward/backward by N months.
function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12 + 12) % 12 + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

// 6-month annualized percent change. Returns [{ ym, value }] in the same
// order as the input keys' chronological sort.
//
// Annualization: ratio over 6m, raised to (12/6)=2 power, minus 1.
export function sixMonthAnnualized(monthlyMap) {
  const months = [...monthlyMap.keys()].sort();
  const out = [];
  for (const ym of months) {
    const back = shiftMonth(ym, -6);
    if (!monthlyMap.has(back)) continue;
    const cur = monthlyMap.get(ym);
    const prev = monthlyMap.get(back);
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) continue;
    const ratio = cur / prev;
    const ann = Math.pow(ratio, 2) - 1;
    out.push({ ym, value: ann * 100 }); // percent, e.g. 2.4 = 2.4%
  }
  return out;
}

// Trailing rolling z-score over `window` months. For points before `minObs`
// observations are available, returns NaN (caller filters those out).
export function rollingZScore(series, window = 120, minObs = 36) {
  const out = [];
  for (let i = 0; i < series.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = series.slice(start, i + 1);
    if (slice.length < minObs) {
      out.push({ ym: series[i].ym, value: NaN });
      continue;
    }
    const vals = slice.map(o => o.value);
    const n = vals.length;
    let sum = 0;
    for (const v of vals) sum += v;
    const mu = sum / n;
    let sq = 0;
    for (const v of vals) sq += (v - mu) * (v - mu);
    const sd = n > 1 ? Math.sqrt(sq / (n - 1)) : 0;
    const z = sd === 0 ? 0 : (series[i].value - mu) / sd;
    out.push({ ym: series[i].ym, value: z });
  }
  return out;
}

// Average multiple { ym, value } z-series by ym. A month is included only
// when at least one series has a finite z; missing components are skipped.
// (This matters at the start of the sample where INDPRO is available
// before others, etc.)
export function compositeZ(...zSeries) {
  // Build ym -> [values] index.
  const byYm = new Map();
  for (const s of zSeries) {
    for (const o of s) {
      if (!Number.isFinite(o.value)) continue;
      if (!byYm.has(o.ym)) byYm.set(o.ym, []);
      byYm.get(o.ym).push(o.value);
    }
  }
  const out = [];
  for (const ym of [...byYm.keys()].sort()) {
    const arr = byYm.get(ym);
    if (!arr.length) continue;
    let s = 0; for (const v of arr) s += v;
    out.push({ ym, value: s / arr.length, components: arr.length });
  }
  return out;
}

// Classify a single (growthZ, inflationZ) point.
export function classifyRegime(growthZ, inflationZ) {
  if (!Number.isFinite(growthZ) || !Number.isFinite(inflationZ)) return null;
  if (growthZ >= 0 && inflationZ <  0) return 'goldilocks';
  if (growthZ >= 0 && inflationZ >= 0) return 'reflation';
  if (growthZ <  0 && inflationZ >= 0) return 'stagflation';
  if (growthZ <  0 && inflationZ <  0) return 'disinflation';
  return null;
}

// Display metadata for the four regimes. Color choices match the macro
// dashboard's existing palette (--green/--accent/--red/--blue from styles.css).
export const REGIMES = {
  goldilocks:   { label: 'Goldilocks',   color: '#3ecf8e', desc: 'Growth above trend, inflation cooling',  short: 'Growthâ†‘ Inflâ†“' },
  reflation:    { label: 'Reflation',    color: '#f7a700', desc: 'Growth and inflation both above trend',  short: 'Growthâ†‘ Inflâ†‘' },
  stagflation:  { label: 'Stagflation',  color: '#ef4f5a', desc: 'Growth slowing, inflation hot',          short: 'Growthâ†“ Inflâ†‘' },
  disinflation: { label: 'Disinflation', color: '#5a9cff', desc: 'Growth slowing, inflation cooling',      short: 'Growthâ†“ Inflâ†“' },
};

// ---------------------------------------------------------------------------
// Top-level: build the historical regime map.
// ---------------------------------------------------------------------------

// inputs is { cpi, indpro, payems, rrsfs } each a FRED observations array.
// Returns Map<YYYY-MM, { regime, growthZ, inflationZ, components }>.
//
// `components` records how many growth z's contributed (1, 2, or 3) â€” useful
// for diagnostics if early-history months drop a series.
export function buildRegimeMap({ cpi, indpro, payems, rrsfs }) {
  const cpiMonthly    = toMonthlyMap(cpi);
  const indproMonthly = toMonthlyMap(indpro);
  const payemsMonthly = toMonthlyMap(payems);
  const rrsfsMonthly  = toMonthlyMap(rrsfs);

  // 6m annualized rates of change.
  const cpiRate    = sixMonthAnnualized(cpiMonthly);
  const indproRate = sixMonthAnnualized(indproMonthly);
  const payemsRate = sixMonthAnnualized(payemsMonthly);
  const rrsfsRate  = sixMonthAnnualized(rrsfsMonthly);

  // Trailing 120-month z-scores.
  const cpiZ    = rollingZScore(cpiRate);
  const indproZ = rollingZScore(indproRate);
  const payemsZ = rollingZScore(payemsRate);
  const rrsfsZ  = rollingZScore(rrsfsRate);

  // Composite growth z = average of three.
  const growthZ = compositeZ(indproZ, payemsZ, rrsfsZ);
  const cpiZmap = new Map(cpiZ.map(o => [o.ym, o.value]));

  const out = new Map();
  for (const g of growthZ) {
    const inflZ = cpiZmap.get(g.ym);
    if (!Number.isFinite(inflZ) || !Number.isFinite(g.value)) continue;
    const regime = classifyRegime(g.value, inflZ);
    if (!regime) continue;
    out.set(g.ym, {
      regime,
      growthZ: g.value,
      inflationZ: inflZ,
      components: g.components,
    });
  }
  return out;
}

// Distribution diagnostic: { goldilocks: n, reflation: n, ... } over a regime map.
// Used at startup to sanity-check the classification balance â€” wildly skewed
// distributions (e.g., 80% in one quadrant) suggest a problem with the z-window.
export function regimeDistribution(regimeMap) {
  const out = { goldilocks: 0, reflation: 0, stagflation: 0, disinflation: 0 };
  for (const v of regimeMap.values()) out[v.regime] = (out[v.regime] || 0) + 1;
  return out;
}

// Smooth the "current regime" reading via majority vote over the last `window`
// months. Used ONLY for the live headline + table-row highlight â€” historical
// aggregation always uses the raw monthly classification.
//
// Why: a single noisy CPI or payrolls print can flip the headline regime month
// to month, which is whipsaw-y and unhelpful for a 6-24m positioning view. A
// 3-month majority vote means it takes 2-of-3 consecutive contradicting months
// to flip the call. Tie-break (rare with 3 votes) defers to the most recent.
//
// Returns { regime, ym, votes } where ym is the latest month covered.
export function smoothCurrentRegime(regimeMap, window = 3) {
  const months = [...regimeMap.keys()].sort();
  if (!months.length) return null;
  const tail = months.slice(-window);
  const votes = { goldilocks: 0, reflation: 0, stagflation: 0, disinflation: 0 };
  for (const ym of tail) {
    const r = regimeMap.get(ym).regime;
    votes[r] = (votes[r] || 0) + 1;
  }
  // Majority winner; tie-break on most recent observation.
  let bestRegime = regimeMap.get(tail[tail.length - 1]).regime;
  let bestCount = votes[bestRegime];
  for (const r of Object.keys(votes)) {
    if (votes[r] > bestCount) { bestRegime = r; bestCount = votes[r]; }
  }
  return { regime: bestRegime, ym: tail[tail.length - 1], votes, window };
}
