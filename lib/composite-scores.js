// Shared composite-score computations.
//
// Each dashboard page (cycle, inflation, housing, real-economy) has its own
// composite-score function. This module reimplements them as pure functions
// that take raw FRED observations and return { score, signals }, so the
// landing-page Today's Read can compute all four in one place without
// re-running each page's full DOM-rendering pipeline.

// ---------- helpers ----------

export function latestValue(s) { return s && s.length ? s[s.length - 1] : null; }

// 12-month % change from monthly index series.
export function yoyPct(series) {
  const out = [];
  for (let i = 12; i < series.length; i++) {
    const cur = series[i].value, prev = series[i - 12].value;
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) continue;
    out.push({ date: series[i].date, value: (cur / prev - 1) * 100 });
  }
  return out;
}

// 6-month annualized rate of change. Used for Core CPI 6m view.
export function sixMonthAnnualized(series) {
  const out = [];
  for (let i = 6; i < series.length; i++) {
    const cur = series[i].value, prev = series[i - 6].value;
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) continue;
    out.push({ date: series[i].date, value: (Math.pow(cur / prev, 2) - 1) * 100 });
  }
  return out;
}

// Sahm Rule from monthly UNRATE.
export function computeSahm(unrate) {
  const out = [];
  for (let i = 2; i < unrate.length; i++) {
    const ma3 = (unrate[i].value + unrate[i - 1].value + unrate[i - 2].value) / 3;
    const wStart = Math.max(0, i - 11);
    const min12 = Math.min(...unrate.slice(wStart, i + 1).map(o => o.value));
    out.push({ date: unrate[i].date, value: ma3 - min12 });
  }
  return out;
}

// ---------- score engine ----------
//
// Every composite is built the same way, and the specs below are the ONLY
// place the method is written down: renderMethodology() prints them, so the
// disclosure cannot drift from the code.
//
//   1. Each signal is a stationary transform of one or more FRED series
//      (a spread level, a YoY rate, a 6-month annualized rate ...).
//   2. Point-in-time: an observation only counts once it would have been
//      published (date + typical release lag <= as-of date). No look-ahead
//      in the back-casts ("1m ago", "12m ago").
//   3. Score = percentile rank of the latest value within that signal's own
//      trailing 20-year history (min 5 years), sign-aligned so that
//      100 = the most risk the panel is named for. A score of 80 reads
//      "riskier than 80% of the last 20 years".
//   4. Composite = weighted mean of the available signals. A signal whose
//      latest print is older than its normal release cycle is flagged stale.
//
// This replaces hand-picked linear anchors (e.g. "HY OAS 200bp = 0,
// 1200bp = 100"), which were judgements with no distributional basis.

const LAG_DAYS   = { daily: 1, weekly: 8, monthly: 45, quarterly: 100, annual: 420 };
const STALE_DAYS = { daily: 10, weekly: 21, monthly: 125, quarterly: 220, annual: 550 };
const WINDOW_YEARS = 20;
const MIN_YEARS = 5;

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}
const todayIso = () => new Date().toISOString().slice(0, 10);

// Observations that would have been public on `asOf`.
export function pointInTime(arr, asOf, freq) {
  if (!arr) return [];
  if (!asOf) return arr;
  const lag = LAG_DAYS[freq] ?? 30;
  return arr.filter(o => addDays(o.date, lag) <= asOf);
}

// Monthly average of a daily/weekly series -> [{date:'YYYY-MM-01', value}].
export function monthlyAverage(arr) {
  const m = new Map();
  for (const o of arr || []) {
    if (!Number.isFinite(o.value)) continue;
    const k = o.date.slice(0, 7) + '-01';
    const e = m.get(k) || [0, 0]; e[0] += o.value; e[1] += 1; m.set(k, e);
  }
  return [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([date, [s, n]]) => ({ date, value: s / n }));
}

// Standard normal CDF (Abramowitz-Stegun 7.1.26, |err| < 1.5e-7).
export function normCdf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// NY Fed-style term-spread probit: probability of a US recession 12 months
// ahead from the monthly-average 10Y-3M spread (percentage points).
// Coefficients: Estrella & Trubin (2006), P = Phi(-0.5333 - 0.6330 * S).
export function termSpreadProbit(t10y3m) {
  return monthlyAverage(t10y3m).map(o => ({ date: o.date, value: 100 * normCdf(-0.5333 - 0.6330 * o.value) }));
}

function pctRank(values, x) {
  let below = 0, equal = 0;
  for (const v of values) { if (v < x) below++; else if (v === x) equal++; }
  return (below + 0.5 * equal) / values.length;
}

const lvl  = id => d => d[id] || [];
const yoy  = id => d => yoyPct(d[id] || []);
const ann6 = id => d => sixMonthAnnualized(d[id] || []);
const bps  = v => `${(v * 100).toFixed(0)}bp`;
const pct1 = v => `${v.toFixed(1)}%`;
const pct2 = v => `${v.toFixed(2)}%`;
const sgn1 = v => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

function realWages(d) {
  const w = yoyPct(d.CES0500000003 || []), c = new Map(yoyPct(d.CPILFESL || []).map(o => [o.date, o.value]));
  return w.filter(o => c.has(o.date)).map(o => ({ date: o.date, value: o.value - c.get(o.date) }));
}

// sign +1: higher value = more risk. -1: lower value = more risk.
export const SPECS = {
  cycle: {
    title: 'Cycle Risk Composite', scale: 'Higher = more recession risk.',
    signals: [
      { name: 'Term-spread probit (12m ahead)', weight: 0.25, freq: 'monthly', srcFreq: 'daily', sign: +1, ids: ['T10Y3M'], build: d => termSpreadProbit(d.T10Y3M), fmt: v => `${v.toFixed(0)}%`, how: 'P = Phi(-0.533 - 0.633 x monthly-avg 10Y-3M spread)' },
      { name: 'Sahm rule (real-time)',          weight: 0.25, freq: 'monthly', sign: +1, ids: ['SAHMREALTIME'], build: lvl('SAHMREALTIME'), fmt: v => `${v.toFixed(2)}pp`, how: 'FRED SAHMREALTIME, first-release unemployment' },
      { name: 'Baa - 10Y spread',               weight: 0.20, freq: 'daily',   sign: +1, ids: ['BAA10Y'], build: lvl('BAA10Y'), fmt: bps, how: 'Moody\'s Baa corporate yield minus 10Y Treasury (history since 1986; ICE HY OAS on FRED only covers 3 years)' },
      { name: 'Chicago Fed NFCI',               weight: 0.15, freq: 'weekly',  sign: +1, ids: ['NFCI'], build: lvl('NFCI'), fmt: v => v.toFixed(2), how: 'level' },
      { name: 'Jobless claims 4wk, YoY',        weight: 0.15, freq: 'weekly',  sign: +1, ids: ['IC4WSA'], build: d => weeklyYoy(d.IC4WSA || []), fmt: sgn1, how: '4-week average initial claims vs a year earlier' },
    ],
  },
  inflation: {
    title: 'Inflation Persistence Composite', scale: 'Higher = stickier / more persistent inflation.',
    signals: [
      { name: 'Sticky-price core CPI', weight: 0.30, freq: 'monthly', sign: +1, ids: ['CORESTICKM159SFRBATL'], build: lvl('CORESTICKM159SFRBATL'), fmt: pct1, how: 'Atlanta Fed, YoY' },
      { name: '5y5y forward breakeven', weight: 0.20, freq: 'daily', sign: +1, ids: ['T5YIFR'], build: lvl('T5YIFR'), fmt: pct2, how: 'level' },
      { name: 'Core CPI 6m annualized', weight: 0.20, freq: 'monthly', sign: +1, ids: ['CPILFESL'], build: ann6('CPILFESL'), fmt: pct1, how: '6-month change, annualized' },
      { name: 'Wage growth (AHE YoY)',  weight: 0.15, freq: 'monthly', sign: +1, ids: ['CES0500000003'], build: yoy('CES0500000003'), fmt: pct1, how: 'YoY' },
      { name: 'Shelter CPI YoY',        weight: 0.15, freq: 'monthly', sign: +1, ids: ['CPIHOSSL'], build: yoy('CPIHOSSL'), fmt: pct1, how: 'YoY' },
    ],
  },
  housing: {
    title: 'Housing Cycle Composite', scale: 'Higher = closer to contraction.',
    signals: [
      { name: 'Existing-home months supply', weight: 0.25, freq: 'monthly', sign: +1, ids: ['HOSSUPUSM673N'], build: lvl('HOSSUPUSM673N'), fmt: v => `${v.toFixed(1)}mo`, how: 'level' },
      { name: 'Permits YoY',                 weight: 0.15, freq: 'monthly', sign: -1, ids: ['PERMIT'], build: yoy('PERMIT'), fmt: sgn1, how: 'YoY; lower = more risk' },
      { name: '30Y mortgage rate',           weight: 0.15, freq: 'weekly',  sign: +1, ids: ['MORTGAGE30US'], build: lvl('MORTGAGE30US'), fmt: pct2, how: 'level' },
      { name: 'Single-family starts YoY',    weight: 0.15, freq: 'monthly', sign: -1, ids: ['HOUST1F'], build: yoy('HOUST1F'), fmt: sgn1, how: 'YoY; lower = more risk' },
      { name: 'Case-Shiller HPI YoY',        weight: 0.10, freq: 'monthly', sign: -1, ids: ['CSUSHPISA'], build: yoy('CSUSHPISA'), fmt: sgn1, how: 'YoY; lower = more risk (monotone)' },
      { name: 'SF mortgage delinquency',     weight: 0.10, freq: 'quarterly', sign: +1, ids: ['DRSFRMACBS'], build: lvl('DRSFRMACBS'), fmt: pct2, how: 'level' },
      { name: 'Construction employment YoY', weight: 0.10, freq: 'monthly', sign: -1, ids: ['USCONS'], build: yoy('USCONS'), fmt: sgn1, how: 'YoY; lower = more risk' },
    ],
  },
  consumer: {
    title: 'Consumer Stress Composite', scale: 'Higher = more household stress.',
    signals: [
      { name: 'Real wage growth',        weight: 0.25, freq: 'monthly', sign: -1, ids: ['CES0500000003', 'CPILFESL'], build: realWages, fmt: sgn1, how: 'AHE YoY minus core CPI YoY; lower = more stress' },
      { name: 'Personal saving rate',    weight: 0.15, freq: 'monthly', sign: -1, ids: ['PSAVERT'], build: lvl('PSAVERT'), fmt: pct1, how: 'level; lower = less cushion' },
      { name: 'Credit-card delinquency', weight: 0.20, freq: 'quarterly', sign: +1, ids: ['DRCCLACBS'], build: lvl('DRCCLACBS'), fmt: pct2, how: 'level' },
      { name: 'Jobless claims (4wk)',    weight: 0.15, freq: 'weekly', sign: +1, ids: ['IC4WSA'], build: lvl('IC4WSA'), fmt: v => `${(v / 1000).toFixed(0)}K`, how: 'level' },
      { name: 'UMich sentiment',         weight: 0.10, freq: 'monthly', sign: -1, ids: ['UMCSENT'], build: lvl('UMCSENT'), fmt: v => v.toFixed(0), how: 'level; lower = more stress' },
      { name: 'Debt service ratio',      weight: 0.15, freq: 'quarterly', sign: +1, ids: ['TDSP'], build: lvl('TDSP'), fmt: pct1, how: 'level' },
    ],
  },
  credit: {
    title: 'Credit & Liquidity Composite', scale: 'Higher = tighter financial conditions / more credit stress.',
    signals: [
      { name: 'Chicago Fed NFCI',  weight: 0.25, freq: 'weekly', sign: +1, ids: ['NFCI'], build: lvl('NFCI'), fmt: v => v.toFixed(2), how: 'level' },
      { name: 'Adjusted NFCI',     weight: 0.15, freq: 'weekly', sign: +1, ids: ['ANFCI'], build: lvl('ANFCI'), fmt: v => v.toFixed(2), how: 'level, net of the cycle' },
      { name: 'Baa - 10Y spread',  weight: 0.25, freq: 'daily',  sign: +1, ids: ['BAA10Y'], build: lvl('BAA10Y'), fmt: bps, how: 'Moody\'s Baa minus 10Y Treasury' },
      { name: 'Aaa - 10Y spread',  weight: 0.10, freq: 'daily',  sign: +1, ids: ['AAA10Y'], build: lvl('AAA10Y'), fmt: bps, how: 'Moody\'s Aaa minus 10Y Treasury' },
      { name: '10Y-3M curve',      weight: 0.10, freq: 'daily',  sign: -1, ids: ['T10Y3M'], build: lvl('T10Y3M'), fmt: bps, how: 'level; more inverted = tighter' },
      { name: '10Y real yield',    weight: 0.15, freq: 'daily',  sign: +1, ids: ['DFII10'], build: lvl('DFII10'), fmt: pct2, how: 'TIPS yield (since 2003)' },
    ],
  },
  labor: {
    title: 'Labor Market Composite', scale: 'Higher = weaker labor market.',
    signals: [
      { name: 'Unemployment rate',       weight: 0.20, freq: 'monthly', sign: +1, ids: ['UNRATE'], build: lvl('UNRATE'), fmt: pct1, how: 'level' },
      { name: 'Sahm rule (real-time)',   weight: 0.20, freq: 'monthly', sign: +1, ids: ['SAHMREALTIME'], build: lvl('SAHMREALTIME'), fmt: v => `${v.toFixed(2)}pp`, how: 'FRED SAHMREALTIME' },
      { name: 'Initial claims (4wk MA)', weight: 0.20, freq: 'weekly',  sign: +1, ids: ['IC4WSA'], build: lvl('IC4WSA'), fmt: v => `${(v / 1000).toFixed(0)}K`, how: 'level' },
      { name: 'Payrolls 6m annualized',  weight: 0.20, freq: 'monthly', sign: -1, ids: ['PAYEMS'], build: ann6('PAYEMS'), fmt: sgn1, how: '6-month change, annualized; lower = weaker' },
      { name: 'Wage growth (AHE YoY)',   weight: 0.20, freq: 'monthly', sign: -1, ids: ['CES0500000003'], build: yoy('CES0500000003'), fmt: sgn1, how: 'YoY; lower = more slack' },
    ],
  },
};

function weeklyYoy(arr) {
  const out = [];
  for (let i = 52; i < arr.length; i++) {
    const cur = arr[i].value, prev = arr[i - 52].value;
    if (Number.isFinite(cur) && Number.isFinite(prev) && prev > 0) out.push({ date: arr[i].date, value: (cur / prev - 1) * 100 });
  }
  return out;
}

// Series ids a composite needs -- callers use this to know what to fetch.
export function seriesFor(kind) {
  return [...new Set((SPECS[kind]?.signals || []).flatMap(s => s.ids))];
}

function scoreSignal(spec, data, asOf) {
  // Point-in-time inputs, then the transform.
  const pit = {};
  for (const id of spec.ids) pit[id] = pointInTime(data[id], asOf, spec.srcFreq || spec.freq);
  const series = spec.build(pit).filter(o => Number.isFinite(o.value));
  if (!series.length) return null;
  const last = series[series.length - 1];
  const from = addDays(last.date, -Math.round(WINDOW_YEARS * 365.25));
  const hist = series.filter(o => o.date >= from).map(o => o.value);
  const spanYears = daysBetween(series[0].date, last.date) / 365.25;
  if (spanYears < MIN_YEARS) return null;
  const p = pctRank(hist, last.value);
  const risk = spec.sign > 0 ? p : 1 - p;
  const ref = asOf || todayIso();
  return {
    name: spec.name, weight: spec.weight, score: 100 * risk,
    raw: spec.fmt(last.value), value: last.value, date: last.date,
    stale: daysBetween(last.date, ref) > (STALE_DAYS[spec.freq] ?? 90),
    windowYears: Math.min(WINDOW_YEARS, spanYears),
  };
}

// Generic composite. `asOf` (YYYY-MM-DD) back-casts point-in-time.
export function computeComposite(kind, data, asOf = null) {
  const spec = SPECS[kind];
  if (!spec) return null;
  const signals = spec.signals.map(s => scoreSignal(s, data || {}, asOf)).filter(Boolean);
  if (!signals.length) return null;
  const totalW = signals.reduce((a, x) => a + x.weight, 0);
  const score = signals.reduce((a, x) => a + x.score * x.weight, 0) / totalW;
  return { score, signals, cutoff: asOf, coverage: totalW, stale: signals.filter(x => x.stale).map(x => x.name) };
}

export const computeCycleScore     = (d, c = null) => computeComposite('cycle', d, c);
export const computeInflationScore = (d, c = null) => computeComposite('inflation', d, c);
export const computeHousingScore   = (d, c = null) => computeComposite('housing', d, c);
export const computeConsumerScore  = (d, c = null) => computeComposite('consumer', d, c);
export const computeCreditScore    = (d, c = null) => computeComposite('credit', d, c);
export const computeLaborScore     = (d, c = null) => computeComposite('labor', d, c);

// Back-compat: METHODOLOGY is derived from SPECS, never hand-copied.
export const METHODOLOGY = Object.fromEntries(Object.entries(SPECS).map(([k, v]) => [k, v]));

export function renderMethodology(host, kind) {
  if (!host) return;
  const m = SPECS[kind];
  if (!m) return;
  const rows = m.signals.map(s =>
    '<tr><th>' + s.name + '</th><td>' + (s.weight * 100).toFixed(0) + '%</td><td>' +
    (s.sign > 0 ? 'higher = more risk' : 'lower = more risk') + '</td><td>' + s.how + '</td></tr>').join('');
  const el = document.createElement('details');
  el.className = 'sf-method';
  el.innerHTML =
    '<summary>How this score is built</summary>' +
    '<div class="sf-method-body">' +
      '<p>' + m.scale + ' Each signal is scored as its percentile within its own trailing ' + WINDOW_YEARS +
      '-year history (minimum ' + MIN_YEARS + ' years), direction-aligned so 100 = most risk; the composite is the weighted mean. ' +
      'Inputs are point-in-time: a print counts only once it would have been published, so the "1m / 12m ago" readings use only data public then (revisions excepted: FRED serves the latest vintage).</p>' +
      '<table><thead><tr><th>Signal</th><th>Weight</th><th>Direction</th><th>Transform</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p style="margin-top:8px">Phase bands read off the same percentile scale: below 25 = calmer than three-quarters of the last 20 years; 80+ = top-quintile stress. Weights are judgemental and equal-ish by design; they are not fitted to past recessions, which avoids overfitting a sample of four.</p>' +
    '</div>';
  host.appendChild(el);
}

export function phaseFor(kind, score) {
  if (score == null) return { label: '—', color: '#8a94a3' };
  if (kind === 'cycle') {
    if (score < 25) return { label: 'Early/Mid Expansion',  color: '#3ecf8e' };
    if (score < 45) return { label: 'Late Expansion',        color: '#5a9cff' };
    if (score < 65) return { label: 'Slowdown',              color: '#f7a700' };
    if (score < 80) return { label: 'Contraction Risk',      color: '#ef4f5a' };
    return                  { label: 'Contraction Underway', color: '#ef4f5a' };
  }
  if (kind === 'inflation') {
    if (score < 25) return { label: 'Disinflationary', color: '#3ecf8e' };
    if (score < 45) return { label: 'Normalizing',     color: '#5a9cff' };
    if (score < 65) return { label: 'Sticky',          color: '#f7a700' };
    if (score < 80) return { label: 'Persistent',      color: '#ef4f5a' };
    return                  { label: 'Accelerating',   color: '#ef4f5a' };
  }
  if (kind === 'housing') {
    if (score < 25) return { label: 'Early-Cycle Recovery', color: '#3ecf8e' };
    if (score < 45) return { label: 'Mid-Cycle Expansion',  color: '#5a9cff' };
    if (score < 65) return { label: 'Late-Cycle',           color: '#f7a700' };
    if (score < 80) return { label: 'Cooling',              color: '#ef4f5a' };
    return                  { label: 'Contraction',         color: '#ef4f5a' };
  }
  if (kind === 'consumer') {
    if (score < 25) return { label: 'Robust',     color: '#3ecf8e' };
    if (score < 45) return { label: 'Healthy',    color: '#5a9cff' };
    if (score < 65) return { label: 'Mixed',      color: '#f7a700' };
    if (score < 80) return { label: 'Stressed',   color: '#ef4f5a' };
    return                  { label: 'Distressed', color: '#ef4f5a' };
  }
  if (kind === 'credit') {
    if (score < 25) return { label: 'Very Accommodative', color: '#3ecf8e' };
    if (score < 45) return { label: 'Accommodative',      color: '#5a9cff' };
    if (score < 65) return { label: 'Neutral',            color: '#f7a700' };
    if (score < 80) return { label: 'Tight',              color: '#ef4f5a' };
    return                  { label: 'Stressed',          color: '#ef4f5a' };
  }
  if (kind === 'labor') {
    if (score < 25) return { label: 'Very Tight',   color: '#3ecf8e' };
    if (score < 45) return { label: 'Tight',        color: '#5a9cff' };
    if (score < 65) return { label: 'Cooling',      color: '#f7a700' };
    if (score < 80) return { label: 'Weakening',    color: '#ef4f5a' };
    return                  { label: 'Recessionary',color: '#ef4f5a' };
  }
  return { label: '—', color: '#8a94a3' };
}
