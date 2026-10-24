// Keeps the research index cards (research/index.html) in step with each
// note's asOf date. The cards carry the date as static HTML, so a refreshed
// note otherwise keeps advertising its old date.
//   node scripts/sync-research-index.mjs          rewrite the dates
//   node scripts/sync-research-index.mjs --check  exit 1 if any card is stale
import fs from 'node:fs';

const FILE = 'research/index.html';
const check = process.argv.includes('--check');
let html = fs.readFileSync(FILE, 'utf8');
const stale = [];

html = html.replace(/(<a class="ov-card" href="\/research\/([a-z0-9]+)\/">\s*<div class="ov-card-meta"><span class="tag sn-date" data-asof=")([0-9-]+)(">Note )([0-9-]+)(<\/span>)/g,
  (m, a, slug, d1, b, d2, c) => {
    const p = 'research/data/' + slug.toUpperCase() + '.research.json';
    if (!fs.existsSync(p)) return m;
    const asOf = JSON.parse(fs.readFileSync(p, 'utf8')).asOf;
    if (!asOf || (asOf === d1 && asOf === d2)) return m;
    stale.push(slug.toUpperCase() + ' ' + d1 + ' -> ' + asOf);
    return a + asOf + b + asOf + c;
  });

if (check) {
  if (stale.length) { console.log('FAIL  research index dates out of date: ' + stale.join(', ') + '\n      fix: node scripts/sync-research-index.mjs'); process.exit(1); }
  console.log('PASS  research index dates match the notes');
} else {
  fs.writeFileSync(FILE, html);
  console.log(stale.length ? 'updated ' + stale.length + ': ' + stale.join(', ') : 'research index already in sync');
}
