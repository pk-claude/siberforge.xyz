// Recession-risk composite — pure compute module (no DOM).
//
// Shared by:
//   - /core/econ/recession.js   (full subpage view)
//   - /index.html               (landing-page teaser gauge)
//
// Keeping thresholds and transform logic in one place so the landing-page
// composite can't drift from the detail view. Everything here is deterministic
// on {series → observations}; no fetch or rendering.

// ============================================================================
// Config
// ============================================================================

export const SERIES = ['SAHMCURRENT', 'T10Y3M', 'BAMLH0A0HYM2', 'UNRATE', 'PAYEMS'];
export const HISTORY_START = '1975-01-01';

// Signal metadata — order here = render order on the subpage.
export const SIGNALS = [
  {
    id: 'sahm',
    label: 'Sahm Rule',
    short: 'Sahm',
    source: 'SAHMCURRENT',
    unit: 'pp',
    decimals: 2,
    threshold: 0.50,
    direction: 'above',          // trigger when value >= threshold
    axisMin: -0.5,
    axisMax: 3.0,
    description: 'UNRATE 3mo avg − its 12mo prior min. Trigger ≥ 0.50.',
  },
  {
    id: 'curve',
    label: 'Yield Curve (10Y − 3M)',
    short: '10Y-3M',
    source: 'T10Y3M',
    unit: '%',
    decimals: 2,
    threshold: 0.00,
    direction: 'below',          // trigger when value < threshold
    axisMin: -2.5,
    axisMax: 4.0,
    description: 'Spread between 10-year and 3-month Treasury yields. Trigger < 0 (inversion).',
  },
  {
    id: 'hyoas',
    label: 'High-Yield OAS',
    short: 'HY OAS',
    source: 'BAMLH0A0HYM2',
    unit: '%',
    decimals: 2,
    threshold: 6.00,
    direction: 'above',
    axisMin: 2.0,
    axisMax: 22.0,
    description: 'ICE BofA US HY option-adjusted spread. Trigger ≥ 6.00%.',
  },
  {
    id: 'unchg6',
    label: 'Unemployment 6mo Change',
    short: 'UNRATE Δ6m',
    source: 'derived',
    unit: 'pp',
    decimals: 2,
    threshold: 0.50,
    direction: 'above',
    axisMin: -2.0,
    axisMax: 4.0,
    description: 'Current UNRATE minus UNRATE 6 months ago. Trigger ≥ +0.5 pp.',
  },
  {
    id: 'nfp3',
    label: 'Payrolls 3mo Avg',
    short: 'NFP 3mo',
    source: 'derived',
    unit: 'k/mo',
    decimals: 0,
    threshold: 50,
    direction: 'below',
    axisMin: -500,
    axisMax: 600,
    description: 'Average monthly change in nonfarm payrolls over last 3 months. Trigger < 50k/mo.',
  },
];

// NBER US recessions. Dates from NBER Business Cycle Dating Committee.
// Format: [peak_month, trough_month] as "YYYY-MM" — peak is first month of
// recession in NBER parlance, trough is last month before expansion resumes.
export const NBER_RECESSIONS = [
  ['1973-11', '1975-03'],
  ['1980-01', '1980-07'],
  ['1981-07', '1982-11'],
  ['1990-07', '1991-03'],
  ['2001-03', '2001-11'],
  ['2007-12', '2009-06'],
  ['2020-02', '2020-04'],
];

// Tier thresholds
export function tierOf(count) {
  if (count >= 3) return { label: 'HIGH',      cls: 'tier-high',     sub: 'Multiple signals agree — historically rare outside of or just before recessions.' };
  if (count >= 2) return { label: 'ELEVATED',  cls: 'tier-elevated', sub: 'Two signals triggered. Worth watching, not yet a consensus alarm.' };
  if (count >= 1) return { label: 'LOW',       cls: 'tier-low',      sub: 'One signal triggered. Common during late-cycle conditions without a recession following.' };
  return            { label: 'BENIGN',    cls: 'tier-benign',   sub: 'No signals triggered.' };
}

// ============================================================================
// Derived signals
// ============================================================================

// Compute UNRATE 6-month change series: for each month, value = UNRATE[i] - UNRATE[i-6].
export function unrateChange6m(unrate) {
  const out = [];
  for (let i = 6; i < unrate.length; i++) {
    out.push({ date: unrate[i].date, value: unrate[i].value - unrate[i - 6].value });
  }
  return out;
}

// PAYEMS comes in levels (thousands of persons). Convert to MoM diff (new jobs)
// then take 3-month rolling average of those diffs. Output units: thousands / month.
export function payemsAvg3mo(payems) {
  const diffs = [];
  for (let i = 1; i < payems.length; i++) {
    diffs.push({ date: payems[i].date, value: payems[i].value - payems[i - 1].value });
  }
  const out = [];
  for (let i = 2; i < diffs.length; i++) {
    const avg = (diffs[i].value + diffs[i - 1].value + diffs[i - 2].value) / 3;
    out.push({ date: diffs[i].date, value: avg });
  }
  return out;
}

// Resample a daily/weekly series to monthly (last observation of each month).
export function resampleToMonthly(obs) {
  const byMonth = new Map(); // "YYYY-MM" → {date, value} (keeps last seen)
  for (const o of obs) {
    const key = o.date.slice(0, 7);
    byMonth.set(key, o);
  }
  // Order by YYYY-MM and use a canonical date = YYYY-MM-01 for alignment.
  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, o]) => ({ date: `${key}-01`, value: o.value }));
}

// ============================================================================
// Signal state
// ============================================================================
export function isTriggered(value, sig) {
  if (!Number.isFinite(value)) return false;
  if (sig.direction === 'above') return value >= sig.threshold;
  if (sig.direction === 'below') return value <  sig.threshold;
  return false;
}

// Build per-signal {currentValue, currentDate, triggered, series (monthly)}.
// `raw` is the { [seriesId]: [{date, value}, …] } map returned by fetchFred
// (unwrapped to just observations).
export function computeSignals(raw) {
  const sahmMonthly = raw.SAHMCURRENT || [];
  const curveMonthly = resampleToMonthly(raw.T10Y3M || []);
  const hyMonthly = resampleToMonthly(raw.BAMLH0A0HYM2 || []);
  const unchgMonthly = unrateChange6m(raw.UNRATE || []);
  const nfpMonthly = payemsAvg3mo(raw.PAYEMS || []);

  const seriesBySignal = {
    sahm:   sahmMonthly,
    curve:  curveMonthly,
    hyoas:  hyMonthly,
    unchg6: unchgMonthly,
    nfp3:   nfpMonthly,
  };

  const out = SIGNALS.map(sig => {
    const s = seriesBySignal[sig.id];
    const last = s[s.length - 1];
    return {
      ...sig,
      series: s,
      currentValue: last ? last.value : NaN,
      currentDate:  last ? last.date  : null,
      triggered:    last ? isTriggered(last.value, sig) : false,
    };
  });

  return { signals: out, seriesBySignal };
}

// ============================================================================
// Historical composite (how many signals triggered each month)
// ============================================================================
export function compositeOverTime(seriesBySignal) {
  // Build a monthly grid = union of all signals' months.
  const monthSet = new Set();
  for (const s of Object.values(seriesBySignal)) {
    for (const o of s) monthSet.add(o.date.slice(0, 7));
  }
  const months = [...monthSet].sort();

  // Map each signal by month for O(1) lookup.
  const lookup = {};
  for (const [k, s] of Object.entries(seriesBySignal)) {
    const m = new Map();
    for (const o of s) m.set(o.date.slice(0, 7), o.value);
    lookup[k] = m;
  }

  const out = [];
  for (const m of months) {
    let count = 0;
    let hasAny = false;
    for (const sig of SIGNALS) {
      const v = lookup[sig.id].get(m);
      if (!Number.isFinite(v)) continue;
      hasAny = true;
      if (isTriggered(v, sig)) count++;
    }
    if (!hasAny) continue;
    out.push({ date: `${m}-01`, count });
  }
  return out;
}
