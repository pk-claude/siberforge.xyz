// Every colour pair the site actually renders text on must clear WCAG AA
// (4.5:1). Two of these were live failures: the Plug page eyebrow at 1.85:1
// in the default dark theme, and light-theme --accent at 4.06:1.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function lum(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = readFileSync(ROOT + '/core/lib/tokens.css', 'utf8');
function tokens(selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([\\s\\S]*?)\\}');
  const m = css.match(re);
  const out = {};
  for (const [, k, v] of (m[1].matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/g))) out[k] = v;
  return out;
}
const dark = tokens(':root');
const light = { ...dark, ...tokens(':root[data-theme="light"]') };

const PAIRS = [
  ['accent on accent-bg (Plug eyebrow)', '--accent', '--accent-bg'],
  ['on-accent on accent (active nav)',   '--on-accent', '--accent'],
  ['accent on bg',      '--accent', '--bg'],
  ['accent on panel',   '--accent', '--panel'],
  ['accent on panel-2', '--accent', '--panel-2'],
  ['green on bg',       '--green',  '--bg'],
  ['green on panel',    '--green',  '--panel'],
  ['red on bg',         '--red',    '--bg'],
  ['blue on bg',        '--blue',   '--bg'],
  ['muted on bg',       '--muted',  '--bg'],
  ['text on bg',        '--text',   '--bg'],
  ['stale on stale-bg', '--stale',  '--stale-bg'],
];

let fails = 0;
for (const [name, theme] of [['dark', dark], ['light', light]]) {
  for (const [label, fg, bg] of PAIRS) {
    const r = ratio(theme[fg], theme[bg]);
    const ok = r >= 4.5;
    if (!ok) fails++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${label.padEnd(36)} ${theme[fg]} on ${theme[bg]} = ${r.toFixed(2)}:1`);
  }
}
console.log(fails ? `\n${fails} pair(s) below WCAG AA` : '\ncontrast: all pairs clear WCAG AA (4.5:1).');
process.exit(fails ? 1 : 0);
