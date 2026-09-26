// snapshot-fred.mjs -- pull every FRED series the site uses into static JSON.
//
// Why: the live /api/fred proxy runs on Vercel's shared egress IPs, which
// FRED's CDN blocks outright at times (403 "Access Denied" on every request,
// seen 2026-09-26). Pages now read these snapshots first (lib/fred-snapshot.js)
// and only go live for series that are missing. A GitHub Actions runner pulls
// the data on a schedule, paced well under FRED's 120 req/min limit.
//
// Output (deterministic -- no timestamps inside per-series files, so a
// series that did not change produces no git diff):
//   data/fred/<ID>.json       {id, meta, d:[dates], v:[values]}
//   data/fred/<ID>.hist.json  daily series only: observations before Jan 1 of
//                             the current year, so daily commits touch ~5KB.
//   data/fred/manifest.json   {generatedAt, series:{ID:{freq,first,last,n,split,error?}}}
//
// Usage: FRED_API_KEY=... node scripts/snapshot-fred.mjs [--only=ID1,ID2]
// Exit 1 when more than 10% of series fail, so the workflow opens an issue.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { fetchWithRetry, sleep, redact } from './lib/http.mjs';
import { CATALOG } from '../api/fred.js';

const ROOT = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'fred');
const KEY = process.env.FRED_API_KEY;
if (!KEY) { console.error('FRED_API_KEY not set'); process.exit(2); }

const extra = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'fred-universe.json'), 'utf8')).ids;
let ids = [...new Set([...Object.keys(CATALOG), ...extra])].sort();
const only = process.argv.find(a => a.startsWith('--only='));
if (only) ids = only.slice(7).split(',');

fs.mkdirSync(OUT, { recursive: true });
const manPath = path.join(OUT, 'manifest.json');
const prev = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, 'utf8')) : { series: {} };
const man = { generatedAt: new Date().toISOString(), series: { ...prev.series } };

const yearStart = `${new Date().getUTCFullYear()}-01-01`;
const writeIfChanged = (file, obj) => {
  const s = JSON.stringify(obj);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === s) return false;
  fs.writeFileSync(file, s);
  return true;
};

async function one(id) {
  const u = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(id)}&api_key=${KEY}&file_type=json`;
  const json = await fetchWithRetry(u, { expectJson: true, tries: 3, delays: [1500, 5000], timeout: 30000 });
  const obs = (json.observations || []).filter(o => o.value !== '.' && o.value !== '' && Number.isFinite(Number(o.value)));
  if (!obs.length) throw new Error('no observations');
  const meta = CATALOG[id] || null;
  const freq = meta?.freq || null;
  const split = freq === 'daily' && obs.length > 400;
  const pack = arr => ({ id, meta, d: arr.map(o => o.date), v: arr.map(o => Number(o.value)) });
  let changed;
  if (split) {
    const hist = obs.filter(o => o.date < yearStart), cur = obs.filter(o => o.date >= yearStart);
    changed = writeIfChanged(path.join(OUT, `${id}.hist.json`), pack(hist));
    changed = writeIfChanged(path.join(OUT, `${id}.json`), pack(cur)) || changed;
  } else {
    changed = writeIfChanged(path.join(OUT, `${id}.json`), pack(obs));
    const h = path.join(OUT, `${id}.hist.json`); if (fs.existsSync(h)) fs.rmSync(h);
  }
  const old = man.series[id] || {};
  man.series[id] = {
    freq, first: obs[0].date, last: obs[obs.length - 1].date, n: obs.length, split,
    changedAt: changed ? man.generatedAt : (old.changedAt || man.generatedAt),
  };
}

let fail = 0, done = 0;
const queue = [...ids];
// Two workers, ~700ms apart each: ~85 requests/min, under FRED's 120/min.
await Promise.all([0, 1].map(async w => {
  await sleep(w * 350);
  while (queue.length) {
    const id = queue.shift();
    try { await one(id); }
    catch (e) {
      fail++;
      const msg = redact(e.message || String(e)).slice(0, 160);
      man.series[id] = { ...(man.series[id] || {}), error: msg, errorAt: man.generatedAt };
      console.error(`[fred] ${id}: ${msg}`);
    }
    if (++done % 50 === 0) console.log(`[fred] ${done}/${ids.length}`);
    await sleep(700);
  }
}));

const sorted = Object.fromEntries(Object.keys(man.series).sort().map(k => [k, man.series[k]]));
fs.writeFileSync(manPath, JSON.stringify({ generatedAt: man.generatedAt, count: Object.keys(sorted).length, failed: fail, series: sorted }, null, 0));
console.log(`[fred] done: ${ids.length - fail} ok, ${fail} failed`);
if (!only && fail / ids.length > 0.10) process.exit(1);
