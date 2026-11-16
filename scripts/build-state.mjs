// build-state.mjs -- derive the front-door state from the FRED snapshot.
//
//   node scripts/build-state.mjs [--no-card]
//
// Writes (deterministic: no timestamps beyond the snapshot's own, so an
// unchanged snapshot produces no git diff):
//   data/macro/state.json          today's headline, dials and scores
//   data/macro/state-history.json  the same dial vector at every month-end
//                                  since 1990, as it would have read then
//   share/macro.png                the link-preview card (scripts/share-card.mjs)
//
// Runs in the snapshot-fred workflow right after the snapshot, and locally.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, fredLocal, manifest } from './lib/fred-local.mjs';

const core = await import(pathToFileURL(path.join(ROOT, 'macro', 'state-core.js')).href);
const { phaseFor } = await import(pathToFileURL(path.join(ROOT, 'lib', 'composite-scores.js')).href);
const { REGIMES } = await import(pathToFileURL(path.join(ROOT, 'macro', 'regime', 'regimes.js')).href);

const r1 = x => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
const r2 = x => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);

const man = manifest();
const asOf = man.generatedAt.slice(0, 10);           // the snapshot's date is "today" for every calculation
const data = await fredLocal(core.STATE_SERIES, '1960-01-01');

// ---- pin "today" to the snapshot date so reruns are reproducible ----
const RealDate = Date;
const fixed = new RealDate(asOf + 'T12:00:00Z').getTime();
globalThis.Date = class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(fixed); }
  static now() { return fixed; }
};

const S = core.computeState(data);
const H = core.headline(S);
const today = core.snapshotAt(data, S.regimeMap, asOf);

const state = {
  asOf,
  headline: { regime: S.smoothed ? S.smoothed.regime : null, title: H.title, color: H.color || null, conviction: H.conviction, sub: H.sub },
  latestMonth: S.latestYm, latestMonthRegime: S.latest ? S.latest.regime : null, differs: S.differs,
  growthZ: r2(S.latest?.growthZ), inflationZ: r2(S.latest?.inflationZ),
  scores: Object.fromEntries(core.KINDS.map(k => [k, S.scores[k] ? { score: Math.round(S.scores[k].score), phase: phaseFor(k, S.scores[k].score).label } : null])),
  policy: { realFF: r2(S.realFF), neutralReal: r2(S.neutralReal), stance: S.stance.label },
  nfci: r2(S.nfci?.value),
  recession: { curveOdds: r1(S.lProb?.value), sahm: r2(S.lSahm?.value) },
  trail: S.months.slice(-24).map(ym => { const m = S.regimeMap.get(ym); return { ym, g: r2(m.growthZ), i: r2(m.inflationZ), r: m.regime }; }),
};

// ---- history: month-ends since 1990 ----
const rows = [];
const end = new RealDate(asOf + 'T00:00:00Z');
for (let y = 1990, m = 0; ; m++) {
  if (m === 12) { m = 0; y++; }
  const d = new RealDate(RealDate.UTC(y, m + 1, 0)); // last day of month
  if (d >= end) break;
  const iso = d.toISOString().slice(0, 10);
  const s = core.snapshotAt(data, S.regimeMap, iso);
  const o = core.outcomesAfter(data, iso);
  rows.push({
    d: iso,
    s: core.KINDS.map(k => (s.scores[k] == null ? null : Math.round(s.scores[k]))),
    c: core.KINDS.map(k => Math.round(s.coverage[k] * 100)),
    g: r2(s.growthZ), i: r2(s.inflationZ), r: s.regime,
    ff: r2(s.realFF), n: r2(s.nfci),
    u12: r1(o.unrateChange), rec: o.recession,
  });
}
const history = {
  asOf, kinds: core.KINDS,
  note: 's = composite scores in `kinds` order, c = share of each score\'s weight that had data (percent), g/i = regime growth and inflation z, r = that month\'s regime, ff = real fed funds, n = NFCI, u12 = change in the unemployment rate over the following 12 months (points), rec = recession status over the following 12 months. Values are what the site would have shown on that date: publication lags applied, today\'s revised data.',
  today: { d: asOf, s: core.KINDS.map(k => (today.scores[k] == null ? null : Math.round(today.scores[k]))), g: r2(today.growthZ), i: r2(today.inflationZ), r: today.regime, ff: r2(today.realFF), n: r2(today.nfci) },
  rows,
};

globalThis.Date = RealDate;

const outDir = path.join(ROOT, 'data', 'macro');
fs.mkdirSync(outDir, { recursive: true });
const writeIfChanged = (file, text) => {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return false;
  fs.writeFileSync(file, text); return true;
};
const histText = '{\n' + ['asOf', 'kinds', 'note', 'today'].map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(history[k])}`).join(',\n') +
  ',\n  "rows": [\n' + rows.map(r => '    ' + JSON.stringify(r)).join(',\n') + '\n  ]\n}\n';
const a = writeIfChanged(path.join(outDir, 'state.json'), JSON.stringify(state, null, 1) + '\n');
const b = writeIfChanged(path.join(outDir, 'state-history.json'), histText);
console.log(`[state] ${asOf}: ${H.title} (${H.conviction} conviction); scores ${core.KINDS.map(k => k + ' ' + (state.scores[k]?.score ?? '-')).join(', ')}`);
console.log(`[state] state.json ${a ? 'written' : 'unchanged'}; state-history.json ${b ? 'written' : 'unchanged'} (${rows.length} months)`);

if (!process.argv.includes('--no-card')) {
  try {
    const { renderShareCard } = await import('./share-card.mjs');
    const changed = await renderShareCard(state);
    console.log(`[state] share/macro.png ${changed ? 'written' : 'unchanged'}`);
  } catch (err) {
    // The card is a nicety; never fail the data job over it.
    console.error('[state] share card skipped: ' + (err && err.message || err));
  }
}
