// Data-backbone checks: the FRED snapshot covers what the analytics need,
// composites only reference allowlisted series, and no credential leaks
// into a published manifest.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG } from '../../api/fred.js';
import { SPECS, seriesFor } from '../../lib/composite-scores.js';

let fails = 0;
const run = (name, fn) => { try { fn(); console.log('PASS ', name); } catch (e) { fails++; console.log('FAIL ', name, '--', e.message); } };
const man = JSON.parse(readFileSync('data/fred/manifest.json', 'utf8'));

run('every composite input is in the proxy allowlist', () => {
  const miss = Object.keys(SPECS).flatMap(seriesFor).filter(id => !CATALOG[id]);
  if (miss.length) throw new Error(miss.join(','));
});
run('every composite input is in the snapshot', () => {
  const miss = Object.keys(SPECS).flatMap(seriesFor).filter(id => !man.series[id] || !man.series[id].n);
  if (miss.length) throw new Error(miss.join(','));
});
run('snapshot covers >= 95% of the allowlist', () => {
  const ids = Object.keys(CATALOG);
  const have = ids.filter(id => man.series[id] && man.series[id].n).length;
  if (have / ids.length < 0.95) throw new Error(`${have}/${ids.length}`);
});
run('every manifest series has its data file', () => {
  const miss = Object.entries(man.series).filter(([id, e]) => e.n && (!existsSync(join('data/fred', id + '.json')) || (e.split && !existsSync(join('data/fred', id + '.hist.json'))))).map(([id]) => id);
  if (miss.length) throw new Error(miss.slice(0, 10).join(','));
});
run('no credentials in published JSON manifests', () => {
  const bad = [];
  for (const f of ['data/fred/manifest.json', 'supply/data/manifest.json']) {
    if (existsSync(f) && /(api_key|apikey|registrationkey)=(?!REDACTED)[A-Za-z0-9]{8,}/i.test(readFileSync(f, 'utf8'))) bad.push(f);
  }
  if (bad.length) throw new Error(bad.join(','));
});
console.log(fails ? `${fails} data-integrity failure(s)` : 'Data backbone OK.');
process.exit(fails ? 1 : 0);
