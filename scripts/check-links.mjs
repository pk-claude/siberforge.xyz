// check-links.mjs -- every internal href in every shipped HTML file must
// resolve to something on disk.
//
// Deliberately narrow: no network, no anchors, no external URLs. It answers
// exactly one question -- can a visitor click this and get a page? -- and it
// runs in under a second, which is why it can sit in CI on every push.
//
// Exit code 1 on any dead link, so CI fails.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Not shipped: .vercelignore excludes branding/, and deploys/ + _archive are
// operational history rather than site content.
const SKIP_DIRS = new Set(['node_modules', '.git', 'branding', 'deploys', '_archive', 'docs']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

// A link resolves if the file exists, or the directory exists and has an
// index.html.
function resolves(target) {
  if (existsSync(target) && statSync(target).isFile()) return true;
  if (existsSync(target) && statSync(target).isDirectory()) {
    return existsSync(join(target, 'index.html'));
  }
  if (target.endsWith('/') && existsSync(join(target, 'index.html'))) return true;
  return false;
}

const HREF = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;

const files = walk(ROOT);
let checked = 0;
const dead = [];

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  let m;
  HREF.lastIndex = 0;
  while ((m = HREF.exec(html)) !== null) {
    const href = m[1].trim();
    if (!href) continue;
    if (/^(https?:|mailto:|tel:|data:|javascript:|#)/i.test(href)) continue;
    if (href.startsWith('//')) continue;
    // Template placeholders inside inline scripts (`href="${sec.page}"`) are
    // not links; they are code that happens to match the attribute regex.
    if (href.includes('${') || href.includes('{{')) continue;

    const clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;

    const target = clean.startsWith('/')
      ? join(ROOT, clean)
      : resolve(dirname(file), clean);

    checked++;
    if (!resolves(target)) {
      dead.push({ file: relative(ROOT, file), href });
    }
  }
}

console.log(`check-links: ${files.length} HTML files, ${checked} internal links`);
if (dead.length) {
  console.error(`\n${dead.length} dead link(s):`);
  for (const d of dead) console.error(`  ${d.file}  ->  ${d.href}`);
  process.exit(1);
}
console.log('check-links: all internal links resolve');
