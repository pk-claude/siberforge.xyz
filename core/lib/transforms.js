// Canonical transform library. All dashboard callers (macro, econ, drill-down,
// compare) import applyTransform from here.
//
// Each transform takes an ascending-by-date observations array
// ([{date: 'YYYY-MM-DD', value: number}, ...]) and returns a new array.
// Observations that can't be transformed (e.g. no 12mo lookback yet) are
// dropped, so the result may be shorter than the input.

// --- level-style: unit conversions only, no temporal math --------------------

export function transformLevel(obs) {
  return obs.map(o => ({ date: o.date, value: o.value }));
}

export function transformLevelK(obs) {
  // Raw → thousands (/ 1,000). e.g. a series published in units → display in k.
  return obs.map(o => ({ date: o.date, value: o.value / 1000 }));
}

export function transformLevelM(obs) {
  // Raw → millions (/ 1,000,000). For series published as counts (units sold).
  return obs.map(o => ({ date: o.date, value: o.value / 1_000_000 }));
}

export function transformLevelBps(obs) {
  // Percent → basis points (* 100).
  return obs.map(o => ({ date: o.date, value: o.value * 100 }));
}

// --- temporal transforms -----------------------------------------------------

// Year-over-year percent change. Uses a 365-day (wall-clock) lookback —
// matches observation closest to `date - 365 days`. For monthly/quarterly
// series this is equivalent to "same period last year" with minor
// imprecision around leap years, which is fine for macro visualization.
export function transformYoy(obs) {
  const dates = obs.map(o => new Date(o.date).getTime());
  const out = [];
  for (let i = 0; i < obs.length; i++) {
    const target = dates[i] - 365 * 24 * 3600 * 1000;
    // Linear scan backwards for nearest obs on-or-before target.
    // Fast enough at N ≤ few thousand.
    let j = -1;
    for (let k = i - 1; k >= 0; k--) {
      if (dates[k] <= target) { j = k; break; }
    }
    if (j < 0) continue;
    const prior = obs[j].value;
    if (prior === 0 || !Number.isFinite(prior)) continue;
    out.push({ date: obs[i].date, value: (obs[i].value / prior - 1) * 100 });
  }
  return out;
}

// Month-over-month absolute difference. For PAYEMS this is monthly job change
// (in the series' native unit — thousands of persons for PAYEMS).
export function transformMomDiff(obs) {
  const out = [];
  for (let i = 1; i < obs.length; i++) {
    out.push({ date: obs[i].date, value: obs[i].value - obs[i - 1].value });
  }
  return out;
}

// Log returns — typically used for equity prices in correlation work.
export function transformLogReturn(obs) {
  const out = [];
  for (let i = 1; i < obs.length; i++) {
    const prev = obs[i - 1].value;
    const curr = obs[i].value;
    if (prev > 0 && curr > 0) {
      out.push({ date: obs[i].date, value: Math.log(curr / prev) });
    }
  }
  return out;
}

// --- dispatch table ----------------------------------------------------------

const TRANSFORMS = {
  'level':       transformLevel,
  'level_k':     transformLevelK,
  'level_m':     transformLevelM,
  'level_bps':   transformLevelBps,
  'yoy':         transformYoy,
  'yoy_pct':     transformYoy,       // alias — macro dashboard naming
  'mom_diff':    transformMomDiff,
  'mom_diff_k':  transformMomDiff,   // PAYEMS diff is already in thousands
  'log_return':  transformLogReturn,
};

export function applyTransform(obs, transform) {
  const fn = TRANSFORMS[transform];
  if (!fn) {
    console.warn(`Unknown transform: ${transform}`);
    return obs;
  }
  return fn(obs);
}
