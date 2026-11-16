// set-head-meta.mjs -- title, description, canonical and link-preview tags for
// the pages listed below. Crawlers and chat/social previews do not run
// JavaScript, so these have to be in the static HTML.
//
//   node scripts/set-head-meta.mjs          write
//   node scripts/set-head-meta.mjs --check  exit 1 if any page is out of date
//
// Idempotent: everything between the <title> line and the first stylesheet or
// script that follows is managed here; re-running replaces it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://www.siberforge.xyz';
// The live card: regime, key numbers and the regime map, re-rendered by the
// data job whenever a number on it changes (scripts/share-card.mjs).
const OG_IMAGE = ORIGIN + '/share/macro.png';

export const PAGES = {
  'macro/index.html':            ['State of the Cycle', '/macro/', 'Where the US cycle stands on one screen: growth and inflation regime, eight dials, recession odds three ways, and what would change the call.'],
  'macro/this-week/index.html':  ['This Week', '/macro/this-week/', 'What moved most in the latest US data against its own history, what sits at a 20-year extreme, releases due and the week in markets.'],
  'macro/regime/index.html':     ['Regime & base rates', '/macro/regime/', 'The US growth and inflation regime, how confident the call is, and what sectors historically did next, with significance tests.'],
  'macro/labor/index.html':      ['Labor', '/macro/labor/', 'The US labor market on one page: unemployment and the Sahm rule, jobless claims, payroll growth and real wages, with a 0-100 score.'],
  'macro/consumer/index.html':   ['Consumer', '/macro/consumer/', 'US household health: real wages, real disposable income, the saving rate, debt service and delinquencies, with a 0-100 stress score.'],
  'macro/housing/index.html':    ['Housing', '/macro/housing/', 'The US housing cycle: permits, starts, sales, inventory, prices, mortgage rates, affordability and delinquencies.'],
  'macro/inflation/index.html':  ['Inflation', '/macro/inflation/', 'Is US inflation persistent? Headline and core, sticky and flexible prices, shelter, wages and market-implied expectations.'],
  'macro/indicators/index.html': ['All indicators', '/macro/indicators/', '26 US indicators on one page: latest print, change from the previous print, five-year percentile and next release date.'],
  'macro/policy/index.html':     ['Policy & Rates', '/macro/policy/', 'Fed funds against the 2-year yield, the real policy rate against neutral, the Treasury curve and the term premium.'],
  'macro/liquidity/index.html':  ['Liquidity & Fiscal', '/macro/liquidity/', 'Net Fed liquidity, bank reserves, the federal deficit, the interest burden and federal debt.'],
  'macro/credit/index.html':     ['Credit', '/macro/credit/', 'US credit and financial conditions: the Chicago Fed NFCI, corporate spreads, the yield curve and real yields.'],
  'macro/cycle/index.html':      ['Cycle & Recession', '/macro/cycle/', 'How close the US cycle is to a turn: yield-curve recession odds, the Sahm rule, financial conditions and credit spreads.'],
  'macro/recession/index.html':  ['Recession signals', '/macro/recession/', 'Four recession triggers (labor, rates, credit, activity) with each signal\'s track record and false alarms against NBER dates.'],
};

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function block(title, url, desc) {
  const full = `Siberforge — ${title}`;
  return [
    `<title>Siberforge &mdash; ${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<link rel="canonical" href="${ORIGIN}${url}" />`,
    `<link rel="icon" href="/favicon.ico" sizes="any" />`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Siberforge" />`,
    `<meta property="og:title" content="${esc(full)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${ORIGIN}${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Siberforge: where the US cycle stands, with the growth and inflation regime map" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join('\n');
}

// Lines this script owns inside <head>.
const OWNED = /^\s*(<title>.*<\/title>|<meta name="description"[^>]*>|<link rel="canonical"[^>]*>|<link rel="icon"[^>]*>|<link rel="apple-touch-icon"[^>]*>|<meta property="og:[^>]*>|<meta name="twitter:[^>]*>)\s*$/;

const check = process.argv.includes('--check');
let stale = 0;
for (const [file, [title, url, desc]] of Object.entries(PAGES)) {
  const p = path.join(ROOT, file);
  const src = fs.readFileSync(p, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const lines = src.split(/\r?\n/);
  const headEnd = lines.findIndex(l => /<\/head>/i.test(l));
  const titleAt = lines.findIndex(l => /<title>/.test(l));
  if (titleAt < 0 || headEnd < 0) { console.error(`${file}: no <title> in <head>`); process.exit(2); }
  const kept = lines.filter((l, i) => !(i < headEnd && OWNED.test(l)));
  // Re-insert where the title was (count owned lines removed above it).
  const removedBefore = lines.slice(0, titleAt).filter(l => OWNED.test(l)).length;
  kept.splice(titleAt - removedBefore, 0, ...block(title, url, desc).split('\n'));
  const out = kept.join(eol);
  if (out !== src) {
    stale++;
    if (check) console.log(`STALE  ${file}`);
    else { fs.writeFileSync(p, out); console.log(`wrote  ${file}`); }
  }
}
if (check && stale) { console.error(`${stale} page(s) need: node scripts/set-head-meta.mjs`); process.exit(1); }
console.log(check ? 'Head metadata is current.' : `${stale} page(s) updated.`);
