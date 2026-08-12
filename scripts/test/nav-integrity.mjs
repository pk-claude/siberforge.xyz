// nav-config is the single source of truth for six surfaces. A typo in a
// KEYWORDS or RELATED id fails silently at runtime (no crash, just a link
// that never appears), so it has to fail loudly here instead.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const win = {};
new Function('window', readFileSync(ROOT + '/core/lib/nav-config.js', 'utf8'))(win);
const NAV = win.SIBERFORGE_NAV;
const index = NAV.index();
const ids = new Set(index.map(i => i.id));

let fails = 0;
const bad = (m) => { console.log('FAIL ', m); fails++; };

for (const [k, v] of Object.entries(NAV.RELATED)) {
  if (!ids.has(k)) bad(`RELATED key "${k}" is not a link id`);
  for (const r of v) {
    if (!ids.has(r)) bad(`RELATED ${k} -> "${r}" does not exist`);
    if (r === k) bad(`RELATED ${k} links to itself`);
  }
}
for (const k of Object.keys(NAV.KEYWORDS)) {
  if (!ids.has(k)) bad(`KEYWORDS key "${k}" is not a link id`);
}
for (const item of index) {
  if (!item.keywords.length) bad(`link "${item.id}" has no search keywords`);
}

// The searches that used to return nothing.
function score(item, q) {
  const label = item.label.toLowerCase();
  const kw = (item.keywords || []).join(' ').toLowerCase();
  const meta = (item.meta + ' ' + item.section + ' ' + item.group).toLowerCase();
  if (label === q) return 0;
  if (label.indexOf(q) === 0) return 1;
  if (label.indexOf(q) !== -1) return 2;
  if (kw.indexOf(q) !== -1) return 3;
  if (meta.indexOf(q) !== -1) return 4;
  return -1;
}
const MUST_FIND = ['unemployment', 'gdp', 'mortgage', 'housing starts', 'case-shiller',
  'p/e ratio', 'home prices', 'interest rates', 'jobs report', 'consumer spending',
  'retail sales', 'yield curve', 'recession', 'freight', 'nvidia'];
for (const q of MUST_FIND) {
  const hits = index.filter(i => score(i, q) >= 0);
  if (!hits.length) bad(`search "${q}" returns nothing`);
}

console.log(fails ? `\n${fails} nav integrity failure(s)` :
  `nav-integrity: ${index.length} views, ${Object.keys(NAV.RELATED).length} cross-linked, ${MUST_FIND.length}/${MUST_FIND.length} searches resolve.`);
process.exit(fails ? 1 : 0);
