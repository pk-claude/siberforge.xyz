// state-core.js -- the State of the Cycle computation, with no DOM.
//
// One implementation for three consumers, so they cannot disagree:
//   - macro/state.js            the page (browser)
//   - scripts/build-state.mjs   data/macro/state.json + state-history.json
//   - scripts/share-card.mjs    the link-preview image
//
// Imports are relative on purpose: they resolve to the same module URLs the
// page already loads, and they also resolve under Node.
import { last, at, addDays, pctile, yoy, policyStance } from '../lib/sf-kit.js';
import { seriesFor, computeComposite, phaseFor, termSpreadProbit } from '../lib/composite-scores.js';
import { buildRegimeMap, smoothCurrentRegime, regimeConviction, REGIMES } from './regime/regimes.js';

export const KINDS = ['cycle', 'labor', 'inflation', 'credit', 'housing', 'consumer'];
export const LABELS = { cycle: 'Recession risk', labor: 'Labor market', inflation: 'Inflation persistence', credit: 'Credit & liquidity', housing: 'Housing', consumer: 'Consumer stress' };
export const EXTRA = ['CPILFESL', 'INDPRO', 'PAYEMS', 'RRSFS', 'DFF', 'PCEPILFE', 'NFCI', 'UNRATE', 'SAHMREALTIME', 'CFNAIMA3', 'T10Y3M', 'USREC', 'BAA10Y', 'FEDTARMDLR'];
export const STATE_SERIES = [...new Set([...KINDS.flatMap(k => seriesFor(k)), ...EXTRA])];

const isoToday = () => new Date().toISOString().slice(0, 10);
const shiftYm = (ym, n) => { const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };
const side = z => Math.abs(z) < 0.25 ? 'close to' : z > 0 ? 'above' : 'below';

export function buildRegime(data) {
  return buildRegimeMap({ cpi: data.CPILFESL || [], indpro: data.INDPRO || [], payems: data.PAYEMS || [], rrsfs: data.RRSFS || [] });
}

// Real policy rate history: effective fed funds minus core PCE inflation (YoY).
export function realPolicySeries(data) {
  const corePce = yoy(data.PCEPILFE || []);
  const dff = data.DFF || [];
  return corePce.map(o => { const f = at(dff, addDays(o.date, 27)); return f ? { date: o.date, value: f.value - o.value } : null; }).filter(Boolean);
}

// Everything the front door states about today.
export function computeState(data) {
  const scores = {};
  for (const k of KINDS) scores[k] = computeComposite(k, data);

  const regimeMap = buildRegime(data);
  const months = [...regimeMap.keys()].sort();
  const latestYm = months[months.length - 1] || null;
  const latest = latestYm ? regimeMap.get(latestYm) : null;
  const smoothed = smoothCurrentRegime(regimeMap, 3);
  const conviction = regimeConviction(latest, smoothed);
  const regime = smoothed ? REGIMES[smoothed.regime] : null;
  const differs = !!(smoothed && latest && smoothed.regime !== latest.regime);

  const corePce = yoy(data.PCEPILFE || []);
  const lDff = last(data.DFF || []), lPce = last(corePce);
  const realFF = lDff && lPce ? lDff.value - lPce.value : null;
  const realHist = realPolicySeries(data);
  const realPct = realHist.length && realFF != null ? pctile(realHist, 20, realFF) : null;
  const sepLR = last(data.FEDTARMDLR || []);
  const neutralReal = sepLR ? sepLR.value - 2 : null;
  const stance = policyStance(realFF, neutralReal);

  const probit = termSpreadProbit(data.T10Y3M || []);
  return {
    scores, regimeMap, months, latestYm, latest, smoothed, conviction, regime, differs,
    growthText: latest ? `growth ${side(latest.growthZ)} its 10-year norm` : '',
    inflationText: latest ? `core inflation ${side(latest.inflationZ)} its 10-year norm` : '',
    corePce, lDff, lPce, realFF, realHist, realPct, neutralReal, stance,
    probit, lProb: last(probit), lSahm: last(data.SAHMREALTIME || []),
    cfnai: last(data.CFNAIMA3 || []), nfci: last(data.NFCI || []), nfciPct: pctile(data.NFCI || [], 20),
  };
}

// The dial vector as it would have read on `date` (publication lags applied;
// revised data, not original vintages). `date` omitted = today.
export function snapshotAt(data, regimeMap, date = null) {
  const d = date || isoToday();
  const s = {}, c = {};
  for (const k of KINDS) {
    const r = computeComposite(k, data, d);
    s[k] = r ? r.score : null; c[k] = r ? r.coverage : 0;
  }
  // A month's regime is knowable about six weeks after it ends.
  let ym = shiftYm(addDays(d, -16).slice(0, 7), -1), reg = null;
  for (let i = 0; i < 3 && !reg; i++) { reg = regimeMap.get(ym) || null; if (!reg) ym = shiftYm(ym, -1); }
  // Real policy rate as known then: fed funds on the day minus the latest core
  // PCE inflation that had been published (about two months after its month).
  const lp = last(yoy(data.PCEPILFE || []).filter(o => addDays(o.date, 60) <= d));
  // 30-day average of the effective rate: single days are distorted at
  // quarter- and year-ends (it printed 3.06% on 31 Dec 2007 against a 4.25% target).
  const from = addDays(d, -30);
  const win = (data.DFF || []).filter(o => o.date > from && o.date <= d);
  const dff = win.length ? { value: win.reduce((t, o) => t + o.value, 0) / win.length } : null;
  const nf = at(data.NFCI || [], addDays(d, -8));
  return {
    date: d, scores: s, coverage: c,
    regimeYm: reg ? ym : null, regime: reg ? reg.regime : null,
    growthZ: reg ? reg.growthZ : null, inflationZ: reg ? reg.inflationZ : null,
    realFF: dff && lp ? dff.value - lp.value : null,
    nfci: nf ? nf.value : null,
  };
}

// What followed a date, from the macro data alone.
export function outcomesAfter(data, date) {
  const un = data.UNRATE || [], rec = data.USREC || [];
  const end = addDays(date, 365);
  const lastRec = last(rec), lastUn = last(un);
  const u0 = at(un, date), u1 = lastUn && lastUn.date >= addDays(end, -31) ? at(un, end) : null;
  let recession = null;
  if (lastRec && lastRec.date >= addDays(end, -31)) {
    const inNow = (at(rec, date) || {}).value === 1;
    const starts = rec.some((o, i) => o.date > date && o.date <= end && o.value === 1 && i > 0 && rec[i - 1].value !== 1);
    recession = inNow ? 'already in one' : starts ? 'began within 12 months' : 'none within 12 months';
  }
  return { unrateChange: u0 && u1 ? u1.value - u0.value : null, recession };
}

// Distance between two dial vectors, in score points: root-mean-square gap over
// the six composites plus the two regime axes (one z = 20 points, so a move
// across a quadrant counts about as much as a 20-point score move).
export function dialDistance(a, b) {
  const parts = [];
  for (const k of KINDS) { if (a.scores[k] == null || b.scores[k] == null) return null; parts.push(a.scores[k] - b.scores[k]); }
  if (a.growthZ == null || b.growthZ == null || a.inflationZ == null || b.inflationZ == null) return null;
  parts.push((a.growthZ - b.growthZ) * 20, (a.inflationZ - b.inflationZ) * 20);
  return Math.sqrt(parts.reduce((t, x) => t + x * x, 0) / parts.length);
}

// One short headline and one supporting line, used verbatim by the page and
// the share card.
export function headline(S) {
  if (!S.regime) return { title: 'Regime unavailable', conviction: '', sub: '' };
  const conv = S.conviction ? S.conviction.label.toLowerCase() : '';
  const cyc = S.scores.cycle;
  return {
    title: S.regime.label,
    color: S.regime.color,
    conviction: conv,
    sub: `${S.growthText}, ${S.inflationText}`,
    recession: cyc ? `Recession risk ${cyc.score.toFixed(0)}/100 (${phaseFor('cycle', cyc.score).label.toLowerCase()})` : '',
  };
}
