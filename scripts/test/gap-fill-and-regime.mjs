// Data-layer and classifier regressions found in the November 2026 review.
//
//  1. lib/fred-snapshot.js fills a lone missing month (BLS never published
//     October 2025 for the CPI or the household survey), so "12 observations
//     ago" really is a year ago.
//  2. macro/regime/regimes.js classifies a month only when every growth input
//     has reported it (payrolls arrive two weeks before the other two).
//  3. lib/composite-scores.js: Sahm rule formula, real wages on headline CPI,
//     every composite input has enough history to be scored.
//
// The shim is a browser script, so it runs here in a vm with a fetch that
// reads the snapshot from disk: the test exercises the code pages really load.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + msg); if (!cond) failed++; };

// ---- load the real shim against the on-disk snapshot ----
const fileFetch = async (input) => {
  const u = new URL(String(input), 'http://local/');
  const p = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!fs.existsSync(p)) return new Response('{}', { status: 404 });
  return new Response(fs.readFileSync(p), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
const win = { fetch: fileFetch };
const ctx = vm.createContext({ window: win, location: { href: 'http://local/', origin: 'http://local' }, URL, Response, Promise, console, Date, JSON, Number, String, Object, Array, Math, isFinite, encodeURIComponent });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'lib', 'fred-snapshot.js'), 'utf8'), ctx);
const SF = win.SF_FRED;
export const fredLocal = (ids, start = '1900-01-01') => SF.get(ids, start);

const cs = await import(pathToFileURL(path.join(ROOT, 'lib', 'composite-scores.js')).href);
const rg = await import(pathToFileURL(path.join(ROOT, 'macro', 'regime', 'regimes.js')).href);

// ---- 1. gap fill ----
const d = await fredLocal(['CPIAUCSL', 'CPILFESL', 'UNRATE', 'PAYEMS', 'CUURA102SA0', 'UMCSENT', 'CES0500000003', 'INDPRO', 'RRSFS', 'SAHMREALTIME']);
const monthIdx = s => Number(s.slice(0, 4)) * 12 + Number(s.slice(5, 7));
for (const id of ['CPIAUCSL', 'CPILFESL', 'UNRATE']) {
  const a = d[id].filter(o => o.date >= '2015-01-01');
  let contiguous = true;
  for (let i = 1; i < a.length; i++) if (monthIdx(a[i].date) - monthIdx(a[i - 1].date) !== 1) contiguous = false;
  ok(contiguous, `${id}: monthly and contiguous since 2015 after the fill`);
  const oct = a.find(o => o.date === '2025-10-01');
  ok(oct && oct.interpolated === true, `${id}: October 2025 present and flagged interpolated`);
}
ok(!d.PAYEMS.some(o => o.interpolated), 'PAYEMS: nothing interpolated (no hole)');
ok(!d.CUURA102SA0.some(o => o.interpolated && o.date < '2025-01-01'), 'bimonthly regional CPI: history not filled');
ok(!d.UMCSENT.some(o => o.interpolated && o.date < '1980-01-01'), 'UMCSENT quarterly era: not filled');
const yoy = cs.yoyPct(d.CPIAUCSL);
const lastYoy = yoy[yoy.length - 1];
const base = d.CPIAUCSL.find(o => o.date === `${Number(lastYoy.date.slice(0, 4)) - 1}${lastYoy.date.slice(4)}`);
const cur = d.CPIAUCSL[d.CPIAUCSL.length - 1];
ok(base && Math.abs(lastYoy.value - (cur.value / base.value - 1) * 100) < 1e-9, `CPI YoY ${lastYoy.date} uses the same month a year earlier (${lastYoy.value.toFixed(2)}%)`);

// ---- 2. regime needs every growth input ----
const rm = rg.buildRegimeMap({ cpi: d.CPILFESL, indpro: d.INDPRO, payems: d.PAYEMS, rrsfs: d.RRSFS });
const months = [...rm.keys()].sort();
const latest = rm.get(months[months.length - 1]);
ok(latest.components === 3, `latest regime month ${months[months.length - 1]} uses all 3 growth inputs (${latest.regime}, growth z ${latest.growthZ.toFixed(2)})`);
ok(months.filter(m => m >= '1997-01').every(m => rm.get(m).components === 3), 'every regime month since 1997 uses all 3 growth inputs');
const sm = rg.smoothCurrentRegime(rm, 3);
console.log('      3-month call:', sm.regime, JSON.stringify(sm.votes));

// ---- 3. scores ----
const sahm = cs.computeSahm(d.UNRATE);
const jul24 = sahm.find(o => o.date === '2024-07-01');
ok(jul24 && jul24.value >= 0.5, `Sahm rule formula triggers in July 2024 (${jul24 ? jul24.value.toFixed(2) : 'n/a'}pp)`);
const rt = new Map(d.SAHMREALTIME.map(o => [o.date, o.value]));
const diffs = sahm.filter(o => o.date >= '2015-01-01' && rt.has(o.date)).map(o => Math.abs(o.value - rt.get(o.date)));
ok(Math.max(...diffs) < 0.25, `Sahm formula tracks FRED SAHMREALTIME since 2015 (max gap ${Math.max(...diffs).toFixed(2)}pp)`);
const rw = cs.realWages(d);
const lw = rw[rw.length - 1], wy = cs.yoyPct(d.CES0500000003), ly = wy[wy.length - 1];
ok(Math.abs(lw.value - (ly.value - lastYoy.value)) < 1e-9 || lw.date !== lastYoy.date, `real wages = AHE YoY - headline CPI YoY (${lw.value.toFixed(2)}pp)`);

for (const kind of Object.keys(cs.SPECS)) {
  const all = await fredLocal(cs.seriesFor(kind), '1960-01-01');
  const r = cs.computeComposite(kind, all);
  const want = cs.SPECS[kind].signals.length;
  ok(r && r.signals.length === want, `${kind}: all ${want} inputs scored (${r ? r.score.toFixed(0) : 'n/a'}/100${r && r.signals.length !== want ? ', got ' + r.signals.length : ''})`);
}

if (failed) { console.error(`\n${failed} check(s) failed.`); process.exit(1); }
console.log('\nGap fill, regime completeness and score inputs hold.');
