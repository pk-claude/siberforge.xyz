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

// ---------- score functions ----------
// Each takes a `data` object keyed by FRED series id, where each value is the
// observations array. Returns { score: 0-100, signals: [{name, score, weight, raw}], cutoffDate }.
// `cutoffDate` is optional — when set, only observations with date <= cutoff
// are used. Enables back-casting for the "What changed" strip.

function filterToCutoff(arr, cutoff) {
  if (!cutoff) return arr;
  return (arr || []).filter(o => o.date <= cutoff);
}

export function computeCycleScore(data, cutoff = null) {
  const signals = [];
  const recProb = filterToCutoff(data.RECPROUSM156N, cutoff);
  const sahm = computeSahm(filterToCutoff(data.UNRATE || [], cutoff));
  const curve = filterToCutoff(data.T10Y3M, cutoff); // raw % from FRED
  const nfci = filterToCutoff(data.NFCI, cutoff);
  const hyOas = filterToCutoff(data.BAMLH0A0HYM2, cutoff); // raw % from FRED, convert to bps

  const p = latestValue(recProb);
  if (p) signals.push({ name: 'NY Fed rec. prob', score: Math.min(100, p.value * 1.5), weight: 0.25, raw: `${p.value.toFixed(0)}%` });

  const s = latestValue(sahm);
  if (s) {
    const sc = Math.min(100, Math.max(0, (s.value / 0.5) * 100));
    signals.push({ name: 'Sahm Rule', score: sc, weight: 0.25, raw: `${s.value.toFixed(2)}pp` });
  }

  const c = latestValue(curve);
  if (c) {
    const bps = c.value * 100;
    const sc = Math.min(100, Math.max(0, 50 - (bps / 4)));
    signals.push({ name: '10Y-3M curve', score: sc, weight: 0.15, raw: `${bps >= 0 ? '+' : ''}${bps.toFixed(0)}bp` });
  }

  const n = latestValue(nfci);
  if (n) {
    const sc = Math.min(100, Math.max(0, 50 + n.value * 50));
    signals.push({ name: 'NFCI', score: sc, weight: 0.15, raw: n.value.toFixed(2) });
  }

  const h = latestValue(hyOas);
  if (h) {
    const bps = h.value * 100;
    const sc = Math.min(100, Math.max(0, ((bps - 200) / 1000) * 100));
    signals.push({ name: 'HY OAS', score: sc, weight: 0.20, raw: `${bps.toFixed(0)}bp` });
  }

  if (!signals.length) return null;
  const totalW = signals.reduce((sum, x) => sum + x.weight, 0);
  const weighted = signals.reduce((sum, x) => sum + x.score * x.weight, 0) / totalW;
  return { score: weighted, signals, cutoff };
}

export function computeInflationScore(data, cutoff = null) {
  const signals = [];
  const sticky = filterToCutoff(data.CORESTICKM159SFRBATL, cutoff);
  const t5y5y = filterToCutoff(data.T5YIFR, cutoff);
  const coreCpi = filterToCutoff(data.CPILFESL, cutoff);
  const wages = filterToCutoff(data.CES0500000003, cutoff);
  const shelter = filterToCutoff(data.CPIHOSSL, cutoff);

  const ls = latestValue(sticky);
  if (ls) signals.push({ name: 'Sticky-Price Core CPI', score: Math.min(100, Math.max(0, ((ls.value - 2) / 3) * 100)), weight: 0.30, raw: `${ls.value.toFixed(1)}%` });

  const lf = latestValue(t5y5y);
  if (lf) signals.push({ name: '5y5y Forward Breakeven', score: Math.min(100, Math.max(0, ((lf.value - 1.8) / 1.2) * 100)), weight: 0.20, raw: `${lf.value.toFixed(2)}%` });

  const core6m = sixMonthAnnualized(coreCpi);
  const l6 = latestValue(core6m);
  if (l6) signals.push({ name: 'Core CPI 6m annualized', score: Math.min(100, Math.max(0, ((l6.value - 2) / 3) * 100)), weight: 0.20, raw: `${l6.value.toFixed(1)}%` });

  const wagesYoy = yoyPct(wages);
  const lw = latestValue(wagesYoy);
  if (lw) signals.push({ name: 'Wage growth (AHE)', score: Math.min(100, Math.max(0, ((lw.value - 3) / 2) * 100)), weight: 0.15, raw: `${lw.value.toFixed(1)}%` });

  const shelterYoy = yoyPct(shelter);
  const lsh = latestValue(shelterYoy);
  if (lsh) signals.push({ name: 'Shelter CPI', score: Math.min(100, Math.max(0, ((lsh.value - 3) / 3) * 100)), weight: 0.15, raw: `${lsh.value.toFixed(1)}%` });

  if (!signals.length) return null;
  const totalW = signals.reduce((sum, x) => sum + x.weight, 0);
  const weighted = signals.reduce((sum, x) => sum + x.score * x.weight, 0) / totalW;
  return { score: weighted, signals, cutoff };
}

export function computeHousingScore(data, cutoff = null) {
  const signals = [];
  const supply = filterToCutoff(data.MSACSR, cutoff);
  const permitYoy = yoyPct(filterToCutoff(data.PERMIT || [], cutoff));
  const mortgage = filterToCutoff(data.MORTGAGE30US, cutoff);
  const sfStartsYoy = yoyPct(filterToCutoff(data.HOUST1F || [], cutoff));
  const hpiYoy = yoyPct(filterToCutoff(data.CSUSHPISA || [], cutoff));
  const delinq = filterToCutoff(data.DRSFRMACBS, cutoff);
  const constrYoy = yoyPct(filterToCutoff(data.CES2000000001 || [], cutoff));

  const ms = latestValue(supply);
  if (ms) signals.push({ name: 'Months Supply', score: Math.min(100, Math.max(0, ((ms.value - 3) / 5) * 100)), weight: 0.30, raw: `${ms.value.toFixed(1)}mo` });

  const lp = latestValue(permitYoy);
  if (lp) signals.push({ name: 'Permits YoY', score: Math.min(100, Math.max(0, 50 - lp.value * (10/3))), weight: 0.15, raw: `${lp.value >= 0 ? '+' : ''}${lp.value.toFixed(1)}%` });

  const lmt = latestValue(mortgage);
  if (lmt) signals.push({ name: '30Y Mortgage', score: Math.min(100, Math.max(0, ((lmt.value - 4) / 5) * 100)), weight: 0.15, raw: `${lmt.value.toFixed(2)}%` });

  const lh1 = latestValue(sfStartsYoy);
  if (lh1) signals.push({ name: 'SF Starts YoY', score: Math.min(100, Math.max(0, 50 - lh1.value * (10/3))), weight: 0.15, raw: `${lh1.value >= 0 ? '+' : ''}${lh1.value.toFixed(1)}%` });

  const lhpi = latestValue(hpiYoy);
  if (lhpi) signals.push({ name: 'HPI YoY', score: Math.min(100, Math.max(0, lhpi.value > 0 ? (lhpi.value / 10) * 100 : 50 + Math.abs(lhpi.value) * 8)), weight: 0.10, raw: `${lhpi.value >= 0 ? '+' : ''}${lhpi.value.toFixed(1)}%` });

  const ld = latestValue(delinq);
  if (ld) signals.push({ name: 'SF Delinquency', score: Math.min(100, Math.max(0, ((ld.value - 1.5) / 4.5) * 100)), weight: 0.10, raw: `${ld.value.toFixed(2)}%` });

  const lce = latestValue(constrYoy);
  if (lce) signals.push({ name: 'Construction Emp YoY', score: Math.min(100, Math.max(0, 50 - lce.value * 10)), weight: 0.05, raw: `${lce.value >= 0 ? '+' : ''}${lce.value.toFixed(1)}%` });

  if (!signals.length) return null;
  const totalW = signals.reduce((sum, x) => sum + x.weight, 0);
  const weighted = signals.reduce((sum, x) => sum + x.score * x.weight, 0) / totalW;
  return { score: weighted, signals, cutoff };
}

export function computeConsumerScore(data, cutoff = null) {
  const signals = [];
  // Real wages = AHE YoY - Core CPI YoY
  const wages = filterToCutoff(data.CES0500000003, cutoff);
  const coreCpi = filterToCutoff(data.CPILFESL, cutoff);
  const psavert = filterToCutoff(data.PSAVERT, cutoff);
  const delinq = filterToCutoff(data.DRCCLACBS, cutoff);
  const claims = filterToCutoff(data.IC4WSA, cutoff);
  const sentiment = filterToCutoff(data.UMCSENT, cutoff);
  const tdsp = filterToCutoff(data.TDSP, cutoff);

  const wagesYoy = yoyPct(wages);
  const coreYoy = yoyPct(coreCpi);
  if (wagesYoy.length && coreYoy.length) {
    const cm = new Map(coreYoy.map(o => [o.date, o.value]));
    const real = wagesYoy.filter(o => cm.has(o.date)).map(o => ({ date: o.date, value: o.value - cm.get(o.date) }));
    const lrw = latestValue(real);
    if (lrw) signals.push({ name: 'Real wages', score: Math.min(100, Math.max(0, 50 - lrw.value * 25)), weight: 0.25, raw: `${lrw.value >= 0 ? '+' : ''}${lrw.value.toFixed(1)}%` });
  }

  const lsav = latestValue(psavert);
  if (lsav) signals.push({ name: 'Personal saving rate', score: Math.min(100, Math.max(0, 100 - (lsav.value - 2) * 10)), weight: 0.20, raw: `${lsav.value.toFixed(1)}%` });

  const ldel = latestValue(delinq);
  if (ldel) signals.push({ name: 'CC delinquency', score: Math.min(100, Math.max(0, ((ldel.value - 1.5) / 3.5) * 100)), weight: 0.20, raw: `${ldel.value.toFixed(2)}%` });

  const lcla = latestValue(claims);
  if (lcla) signals.push({ name: 'Jobless claims (4wk)', score: Math.min(100, Math.max(0, ((lcla.value - 200000) / 180000) * 100)), weight: 0.15, raw: `${(lcla.value / 1000).toFixed(0)}K` });

  const lsent = latestValue(sentiment);
  if (lsent) signals.push({ name: 'UMich sentiment', score: Math.min(100, Math.max(0, (100 - lsent.value) * 2)), weight: 0.10, raw: `${lsent.value.toFixed(0)}` });

  const ltd = latestValue(tdsp);
  if (ltd) signals.push({ name: 'Debt service ratio', score: Math.min(100, Math.max(0, ((ltd.value - 9) / 4) * 100)), weight: 0.10, raw: `${ltd.value.toFixed(1)}%` });

  if (!signals.length) return null;
  const totalW = signals.reduce((sum, x) => sum + x.weight, 0);
  const weighted = signals.reduce((sum, x) => sum + x.score * x.weight, 0) / totalW;
  return { score: weighted, signals, cutoff };
}

// Credit & liquidity composite. Higher score = tighter financial conditions /
// more credit stress. Components: NFCI, ANFCI, HY OAS, IG OAS, curve, real
// yield. Used in Today's Read on /core/macro/ and stand-alone on /core/macro/credit/.
export function computeCreditScore(data, cutoff = null) {
  const signals = [];
  const nfci  = filterToCutoff(data.NFCI, cutoff);
  const anfci = filterToCutoff(data.ANFCI, cutoff);
  const hyoas = filterToCutoff(data.BAMLH0A0HYM2, cutoff);
  const igoas = filterToCutoff(data.BAMLC0A0CM, cutoff);
  const curve = filterToCutoff(data.T10Y3M, cutoff);
  const ry    = filterToCutoff(data.DFII10, cutoff);

  // NFCI: -1 (very loose) to +1.5 (stressed). Map to 0-100 around 0.
  const n = latestValue(nfci);
  if (n) signals.push({ name: 'Chicago Fed NFCI', score: Math.min(100, Math.max(0, 50 + n.value * 33)), weight: 0.25, raw: n.value.toFixed(2) });

  const an = latestValue(anfci);
  if (an) signals.push({ name: 'Adjusted NFCI', score: Math.min(100, Math.max(0, 50 + an.value * 33)), weight: 0.15, raw: an.value.toFixed(2) });

  // HY OAS: 250bp = baseline, 1000bp = stressed
  const h = latestValue(hyoas);
  if (h) {
    const bps = h.value * 100;
    signals.push({ name: 'HY OAS', score: Math.min(100, Math.max(0, ((bps - 250) / 750) * 100)), weight: 0.20, raw: `${bps.toFixed(0)}bp` });
  }

  // IG OAS: 80bp = baseline, 300bp = stress
  const ig = latestValue(igoas);
  if (ig) {
    const bps = ig.value * 100;
    signals.push({ name: 'IG OAS', score: Math.min(100, Math.max(0, ((bps - 80) / 220) * 100)), weight: 0.15, raw: `${bps.toFixed(0)}bp` });
  }

  // Curve inversion adds stress; +200bp = score 0; -100bp = score 100
  const c = latestValue(curve);
  if (c) {
    const bps = c.value * 100;
    signals.push({ name: '10Y-3M curve', score: Math.min(100, Math.max(0, 50 - bps / 4)), weight: 0.15, raw: `${bps >= 0 ? '+' : ''}${bps.toFixed(0)}bp` });
  }

  // 10Y real yield: 0% loose, 2.5%+ restrictive
  const r = latestValue(ry);
  if (r) signals.push({ name: '10Y real yield', score: Math.min(100, Math.max(0, (r.value / 2.5) * 100)), weight: 0.10, raw: `${r.value.toFixed(2)}%` });

  if (!signals.length) return null;
  const totalW = signals.reduce((sum, x) => sum + x.weight, 0);
  const weighted = signals.reduce((sum, x) => sum + x.score * x.weight, 0) / totalW;
  return { score: weighted, signals, cutoff };
}

// Labor market composite. Higher score = labor market weakening.
// Components: unemployment level, Sahm Rule trigger distance, claims,
// payroll growth, wage growth.
export function computeLaborScore(data, cutoff = null) {
  const signals = [];
  const unrate = filterToCutoff(data.UNRATE || [], cutoff);
  const claims = filterToCutoff(data.IC4WSA, cutoff);
  const payems = filterToCutoff(data.PAYEMS || [], cutoff);
  const wages  = filterToCutoff(data.CES0500000003, cutoff);

  // Unemployment rate: 3.5% baseline, 7%+ stress
  const u = latestValue(unrate);
  if (u) signals.push({ name: 'Unemployment rate', score: Math.min(100, Math.max(0, ((u.value - 3.5) / 3.5) * 100)), weight: 0.20, raw: `${u.value.toFixed(1)}%` });

  // Sahm Rule
  const sahm = computeSahm(unrate);
  const s = latestValue(sahm);
  if (s) signals.push({ name: 'Sahm Rule', score: Math.min(100, Math.max(0, (s.value / 0.5) * 100)), weight: 0.20, raw: `${s.value.toFixed(2)}pp` });

  // Initial claims 4w MA: 200K healthy, 400K+ stress
  const cl = latestValue(claims);
  if (cl) signals.push({ name: 'Initial claims (4wk MA)', score: Math.min(100, Math.max(0, ((cl.value - 200000) / 200000) * 100)), weight: 0.20, raw: `${(cl.value / 1000).toFixed(0)}K` });

  // Payrolls 6m annualized growth: 2%+ strong, 0%- weak
  if (payems.length >= 7) {
    const cur = payems[payems.length - 1].value;
    const prev = payems[payems.length - 7].value;
    if (Number.isFinite(cur) && Number.isFinite(prev) && prev > 0) {
      const annRate = (Math.pow(cur / prev, 2) - 1) * 100;
      signals.push({ name: 'Payrolls 6m ann.', score: Math.min(100, Math.max(0, 50 - annRate * 25)), weight: 0.20, raw: `${annRate >= 0 ? '+' : ''}${annRate.toFixed(1)}%` });
    }
  }

  // Wage growth (AHE YoY): 4.5%+ strong; <2.5% indicates labor slack
  const wYoy = yoyPct(wages);
  const lw = latestValue(wYoy);
  if (lw) signals.push({ name: 'Wage growth (AHE YoY)', score: Math.min(100, Math.max(0, ((4.5 - lw.value) / 2) * 100)), weight: 0.20, raw: `${lw.value >= 0 ? '+' : ''}${lw.value.toFixed(1)}%` });

  if (!signals.length) return null;
  const totalW = signals.reduce((sum, x) => sum + x.weight, 0);
  const weighted = signals.reduce((sum, x) => sum + x.score * x.weight, 0) / totalW;
  return { score: weighted, signals, cutoff };
}

// Phase labels per score range. Different bucketing per composite type.
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
