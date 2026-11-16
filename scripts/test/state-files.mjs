// The derived front-door files agree with the code that pages run, and the
// link-preview card is a real 1200 x 630 PNG that the pages point at.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, fredLocal, manifest } from '../lib/fred-local.mjs';

let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) failed++; };
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

const core = await import(pathToFileURL(path.join(ROOT, 'macro', 'state-core.js')).href);
const state = read('data/macro/state.json');
const hist = read('data/macro/state-history.json');
const man = manifest();

const ageDays = (new Date(man.generatedAt.slice(0, 10)) - new Date(state.asOf)) / 864e5;
ok(ageDays >= 0 && ageDays <= 7, `state.json is at most a week behind the snapshot (${state.asOf} vs ${man.generatedAt.slice(0, 10)})`);

const data = await fredLocal(core.STATE_SERIES, '1960-01-01');
const S = core.computeState(data);
if (ageDays === 0) {
  ok(S.smoothed && S.smoothed.regime === state.headline.regime, `state.json regime matches the live computation (${state.headline.title})`);
  ok(core.KINDS.every(k => Math.abs(S.scores[k].score - state.scores[k].score) <= 1), 'state.json scores match the live computation');
} else {
  console.log('SKIP  live-vs-file comparison (state.json predates the snapshot; the data job rebuilds it)');
}
ok(S.latest && S.latest.components === 3, 'headline regime month uses all three growth inputs');
ok(state.trail.length === 24 && state.trail.every(p => Number.isFinite(p.g) && Number.isFinite(p.i)), 'state.json carries a 24-month regime trail');

ok(hist.rows.length > 400 && hist.rows[0].d === '1990-01-31', `history starts Jan 1990 and has ${hist.rows.length} months`);
ok(hist.rows.every((r, i) => i === 0 || r.d > hist.rows[i - 1].d), 'history dates strictly increase');
const dec07 = hist.rows.find(r => r.d === '2007-12-31'), feb20 = hist.rows.find(r => r.d === '2020-02-29');
ok(dec07 && dec07.rec === 'began within 12 months' && dec07.u12 > 1.5, 'Dec 2007: recession and rising unemployment recorded as what followed');
ok(feb20 && feb20.rec === 'began within 12 months', 'Feb 2020: recession recorded as what followed');
const a = { scores: Object.fromEntries(core.KINDS.map((k, i) => [k, dec07.s[i]])), growthZ: dec07.g, inflationZ: dec07.i };
ok(core.dialDistance(a, a) === 0, 'a month is at distance zero from itself');

const png = fs.readFileSync(path.join(ROOT, 'share', 'macro.png'));
ok(png.slice(1, 4).toString() === 'PNG' && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630, `share card is a 1200 x 630 PNG (${png.length} bytes)`);
ok(png.length < 400000, 'share card is under 400 KB');
for (const f of ['index.html', 'macro/index.html', 'macro/labor/index.html']) {
  ok(/og:image" content="https:\/\/www\.siberforge\.xyz\/share\/macro\.png"/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')), `${f} previews with the live card`);
}

if (failed) { console.error(`\n${failed} check(s) failed.`); process.exit(1); }
console.log('\nState files and share card are consistent.');
