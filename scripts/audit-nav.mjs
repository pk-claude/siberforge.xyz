// audit-nav.mjs -- verifies that every page on the site is reachable and that
// its "you are here" state actually resolves. Run before any deploy:
//
//   node scripts/audit-nav.mjs
//
// Checks:
//   1. no duplicate attributes in any <body> tag (HTML keeps the first and
//      silently drops the rest -- this is what broke the Supply section)
//   2. every data-section matches a SECTIONS id
//   3. every data-page / data-page-parent matches a link id in its PAGES entry
//   4. every href in nav-config resolves to a real file
//   5. every HTML file is either in nav-config or explicitly excused below
//   6. sitemap.xml matches nav-config exactly

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Pages that intentionally have no nav entry of their own.
const EXCUSED = new Set([
  '404.html',                      // error page
  'index.html',                    // landing
  'core/equity/index.html',        // legacy redirect stub
  'core/econ/indicator.html',      // drill-down, uses data-page-parent
  'core/supply/metric.html',       // drill-down, uses data-page-parent
  'core/influencers/index.html',   // Home Depot work, deliberately unlisted
]);

const src = readFileSync(join(ROOT, 'core/lib/nav-config.js'), 'utf8');
const win = {};
new Function('window', src)(win);
const NAV = win.SIBERFORGE_NAV;

const errors = [];
const warnings = [];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'branding') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.html') && !name.endsWith('.bak')) out.push(full);
  }
  return out;
}

const files = walk(ROOT).map((f) => relative(ROOT, f).split('\\').join('/'));

// ---- link ids per PAGES key ------------------------------------------------
const idsByKey = {};
const hrefsInNav = new Set();
for (const [key, entry] of Object.entries(NAV.PAGES)) {
  idsByKey[key] = new Set();
  for (const g of entry.groups) {
    for (const l of g.links) {
      idsByKey[key].add(l.id);
      hrefsInNav.add(l.href);
    }
  }
}
const sectionIds = new Set(NAV.SECTIONS.map((s) => s.id));

// ---- 1-3: per-file body attribute checks -----------------------------------
for (const rel of files) {
  const html = readFileSync(join(ROOT, rel), 'utf8');
  const m = html.match(/<body[^>]*>/);
  if (!m) { warnings.push(`${rel}: no <body> tag found`); continue; }
  const body = m[0];

  const seen = new Set();
  for (const attr of body.matchAll(/([a-zA-Z-]+)\s*=\s*"/g)) {
    const name = attr[1].toLowerCase();
    if (seen.has(name)) errors.push(`${rel}: duplicate attribute "${name}" in <body> -- later value is silently dropped`);
    seen.add(name);
  }

  // Pages that deliberately render no shared chrome are not checked for
  // nav identity -- they have none by design.
  if (!html.includes('/core/lib/layout.js')) continue;

  const get = (n) => (body.match(new RegExp(n + '="([^"]*)"')) || [])[1] || '';
  const section = get('data-section');
  const sub = get('data-sub-section');
  const page = get('data-page');
  const parent = get('data-page-parent');

  if (!section) { errors.push(`${rel}: missing data-section`); continue; }
  if (!sectionIds.has(section)) { errors.push(`${rel}: data-section="${section}" is not a SECTIONS id`); continue; }

  const key = sub ? `${section}:${sub}` : section;
  if (!idsByKey[key]) { errors.push(`${rel}: no PAGES entry for "${key}"`); continue; }

  const active = page || parent;
  if (!active) {
    warnings.push(`${rel}: no data-page or data-page-parent -- nothing will highlight`);
  } else if (!idsByKey[key].has(active)) {
    errors.push(`${rel}: data-page="${active}" does not match any link id in PAGES["${key}"]`);
  }
}

// ---- 4: nav hrefs resolve to files -----------------------------------------
for (const href of hrefsInNav) {
  const path = href.endsWith('/') ? join(ROOT, href, 'index.html') : join(ROOT, href);
  if (!existsSync(path)) errors.push(`nav-config: href ${href} has no file at ${relative(ROOT, path)}`);
}

// ---- 5: every file is reachable --------------------------------------------
for (const rel of files) {
  if (EXCUSED.has(rel)) continue;
  const route = '/' + rel.replace(/index\.html$/, '');
  if (!hrefsInNav.has(route)) errors.push(`${rel}: orphan -- route ${route} appears nowhere in nav-config`);
}

// ---- 6: sitemap matches nav ------------------------------------------------
const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const inMap = new Set([...sitemap.matchAll(/<loc>https:\/\/www\.siberforge\.xyz([^<]*)<\/loc>/g)].map((m) => m[1]));
const expected = new Set(['/', ...NAV.index().map((v) => v.href)]);
for (const h of expected) if (!inMap.has(h)) errors.push(`sitemap.xml: missing ${h} -- run node scripts/gen-sitemap.mjs`);
for (const h of inMap) if (!expected.has(h)) errors.push(`sitemap.xml: stale entry ${h} -- run node scripts/gen-sitemap.mjs`);

// ---- report ----------------------------------------------------------------
const views = NAV.index().length;
console.log(`Checked ${files.length} HTML files against ${NAV.SECTIONS.length} sections / ${views} unique views.`);
for (const w of warnings) console.log('  WARN  ' + w);
for (const e of errors) console.log('  FAIL  ' + e);
if (errors.length) {
  console.log(`\n${errors.length} error(s).`);
  process.exit(1);
}
console.log(`\nOK -- ${warnings.length} warning(s), 0 errors.`);
