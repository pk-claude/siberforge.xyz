// Recession-risk composite — pure compute module (no DOM).
//
// Shared by:
//   - /macro/recession/recession.js   (full subpage view)
//   - /index.html               (landing-page teaser gauge)
//
// Keeping thresholds and transform logic in one place so the landing-page
// composite can't drift from the detail view. Everything here is deterministic
// on {series → observations}; no fetch or rendering.

// ============================================================================
// Config
// ============================================================================

// Four signals, one per channel. The earlier version counted three coincident
// labor measures (Sahm, UNRATE 6m change, payrolls) as separate "votes", so a
// single labor wobble looked like consensus; they are collapsed into the Sahm
// rule. HY OAS is replaced by Moody's Baa-10Y because ICE's OAS on FRED now
// covers only ~3 years, which made the historical count silently "out of 4".
export const SERIES = ['SAHMREALTIME', 'T10Y3M', 'BAA10Y', 'CFNAIMA3', 'USREC'];
export const HISTORY_START = '1975-01-01';

export const SIGNALS = [
  {
    id: 'sahm', label: 'Labor: Sahm rule (real-time)', short: 'Sahm', source: 'SAHMREALTIME',
    unit: 'pp', decimals: 2, threshold: 0.50, direction: 'above', axisMin: -0.5, axisMax: 3.0, horizon: 'coincident',
    description: '3-month average unemployment rate minus its low of the prior 12 months. Trigger >= 0.50pp. Coincident: it confirms rather than forecasts. Triggered Jul-2024 with no recession.',
  },
  {
    id: 'curve', label: 'Rates: yield curve (10Y - 3M)', short: '10Y-3M', source: 'T10Y3M',
    unit: '%', decimals: 2, threshold: 0.00, direction: 'below', axisMin: -2.5, axisMax: 4.0, horizon: 'leads 6-18 months',
    description: 'Monthly average spread between 10-year and 3-month Treasury yields. Trigger < 0 (inversion). Leading, with a long and variable lag; inverted from late 2022 into 2025 with no recession.',
  },
  {
    id: 'credit', label: 'Credit: Baa - 10Y spread', short: 'Baa spread', source: 'BAA10Y',
    unit: '%', decimals: 2, threshold: 3.00, direction: 'above', axisMin: 1.0, axisMax: 6.5, horizon: 'coincident to slightly leading',
    description: "Moody's Baa corporate yield minus the 10-year Treasury (history since 1986). Trigger >= 3.00%.",
  },
  {
    id: 'activity', label: 'Activity: CFNAI 3-month average', short: 'CFNAI-MA3', source: 'CFNAIMA3',
    unit: '', decimals: 2, threshold: -0.70, direction: 'below', axisMin: -5, axisMax: 2, horizon: 'coincident',
    description: 'Chicago Fed National Activity Index, 3-month average of 85 indicators. The Chicago Fed reads below -0.70 after an expansion as an increasing likelihood that a recession has begun.',
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

// Derive [peak_month, trough_month] ranges from FRED USREC observations
// (value 1 = recession month). Lets new NBER declarations show up without a
// code change; NBER_RECESSIONS above stays as the offline fallback.
export function recessionRangesFromUsrec(obs) {
  const ranges = [];
  let start = null, prev = null;
  for (const o of obs || []) {
    const ym = String(o.date).slice(0, 7);
    if (o.value >= 1) {
      if (start === null) start = ym;
      prev = ym;
    } else if (start !== null) {
      ranges.push([start, prev]);
      start = null;
    }
  }
  if (start !== null) ranges.push([start, prev]);
  return ranges;
}

// Tier thresholds
export function tierOf(count) {
  if (count >= 3) return { label: 'HIGH',      cls: 'tier-high',     sub: 'Three or more channels agree. See the calibration table for how often that has happened outside recessions.' };
  if (count >= 2) return { label: 'ELEVATED',  cls: 'tier-elevated', sub: 'Two channels triggered. Historically this mostly happened at or just after recession starts, not well ahead of them.' };
  if (count >= 1) return { label: 'LOW',       cls: 'tier-low',      sub: 'One channel triggered. Common late in expansions without a recession following.' };
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
  const seriesBySignal = {
    sahm:     raw.SAHMREALTIME || [],
    curve:    monthlyMean(raw.T10Y3M || []),
    credit:   monthlyMean(raw.BAA10Y || []),
    activity: raw.CFNAIMA3 || [],
  };
  const out = SIGNALS.map(sig => {
    const s = seriesBySignal[sig.id];
    const last = s[s.length - 1];
    return { ...sig, series: s, currentValue: last ? last.value : NaN, currentDate: last ? last.date : null, triggered: last ? isTriggered(last.value, sig) : false };
  });
  return { signals: out, seriesBySignal };
}

// Monthly mean of a daily series, dated YYYY-MM-01.
export function monthlyMean(obs) {
  const m = new Map();
  for (const o of obs) { const k = o.date.slice(0, 7); const e = m.get(k) || [0, 0]; e[0] += o.value; e[1]++; m.set(k, e); }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, [s, n]]) => ({ date: `${k}-01`, value: s / n }));
}

// Calibration against NBER dates, computed from the data on every load so the
// page reports its own track record instead of asserting one.
//   caught:     recessions where the signal fired between 24 months before the
//               start and 6 months after it (among recessions its data covers)
//   medianLead: months from first firing in that window to the start
//               (positive = fired before the recession began)
//   falseRate:  share of firing months outside recessions (and the 12 months
//               after them) that were NOT followed by a recession start
//               within 12 months
export function calibrate(series, test, usrec) {
  const idx = ym => { const [y, m] = ym.split('-').map(Number); return y * 12 + m - 1; };
  const ranges = recessionRangesFromUsrec(usrec);
  const vals = new Map(series.map(o => [o.date.slice(0, 7), o.value]));
  const first = series.length ? series[0].date.slice(0, 7) : null;
  const lastYm = series.length ? series[series.length - 1].date.slice(0, 7) : null;
  if (!first) return null;
  const covered = ranges.filter(([s]) => idx(s) - 24 >= idx(first));
  const leads = [];
  for (const [s] of covered) {
    for (let k = idx(s) - 24; k <= idx(s) + 6; k++) {
      const ym = `${Math.floor(k / 12)}-${String(k % 12 + 1).padStart(2, '0')}`;
      if (test(vals.get(ym))) { leads.push(idx(s) - k); break; }
    }
  }
  // In, or within 12 months after, a recession: late confirmation, not a false alarm.
  const inRec = k => ranges.some(([s, e]) => k >= idx(s) && k <= idx(e) + 12);
  const startsWithin12 = k => ranges.some(([s]) => idx(s) > k && idx(s) - k <= 12);
  let fires = 0, falseFires = 0;
  for (const [ym, v] of vals) {
    const k = idx(ym);
    if (!test(v) || inRec(k) || idx(lastYm) - k < 12) continue;
    fires++; if (!startsWithin12(k)) falseFires++;
  }
  leads.sort((a, b) => a - b);
  return {
    covered: covered.length, caught: leads.length,
    medianLead: leads.length ? leads[Math.floor((leads.length - 1) / 2)] : null,
    falseRate: fires ? falseFires / fires : null, fires,
    since: first,
  };
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
