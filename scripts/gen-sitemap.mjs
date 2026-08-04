// gen-sitemap.mjs -- writes sitemap.xml from nav-config.js.
//
// nav-config.js is the single source of truth for navigation; the sitemap used
// to be hand-maintained and had already drifted out of sync with it. Run this
// after adding or removing any page:
//
//   node scripts/gen-sitemap.mjs
//
// Parameterised drill-downs (indicator.html?id=, metric.html?id=) are
// deliberately excluded: they have no meaningful bare URL.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://www.siberforge.xyz';

// nav-config.js is a browser IIFE that assigns to window.
const src = readFileSync(join(ROOT, 'core/lib/nav-config.js'), 'utf8');
const sandbox = { window: {} };
new Function('window', src)(sandbox.window);
const NAV = sandbox.window.SIBERFORGE_NAV;

const hrefs = ['/'].concat(NAV.index().map((v) => v.href));
const unique = [...new Set(hrefs)].sort();

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  unique.map((h) => `  <url><loc>${ORIGIN}${h}</loc></url>`).join('\n') +
  '\n</urlset>\n';

writeFileSync(join(ROOT, 'sitemap.xml'), xml, 'utf8');
console.log(`sitemap.xml written -- ${unique.length} urls`);
