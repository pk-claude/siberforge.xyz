// chart-theme.js: verify it rewrites hardcoded dark literals to live theme
// values, and flips them back on a theme change.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const dom = new JSDOM(`<!doctype html><html data-theme="dark"><head>
<style>:root{--muted:#8a94a3;--text:#e5e9ee;--panel:#13171c;--line:#232b35}
:root[data-theme="light"]{--muted:#5a6470;--text:#1a2028;--panel:#ffffff;--line:#d8dee5}</style>
</head><body></body></html>`, { runScripts: 'outside-only' });
const w = dom.window;

// Minimal Chart stand-in with the plugin hooks the real library calls.
const plugins = [];
w.Chart = {
  defaults: { plugins: { tooltip: {}, legend: { labels: {} } } },
  register: p => plugins.push(p),
};
w.eval(readFileSync(process.cwd() + '/core/lib/theme-toggle.js', 'utf8'));
w.eval(readFileSync(process.cwd() + '/core/lib/chart-theme.js', 'utf8'));

const errors = [];
const t = (label, fn) => { try { fn(); console.log('  PASS', label); } catch (e) { console.log('  FAIL', label, '--', e.message); errors.push(label); } };

t('plugin registered', () => { if (plugins.length !== 1) throw new Error('n=' + plugins.length); });

// A config copied from core/macro/dashboard.js
const chart = { options: {
  plugins: { legend: { labels: { color: '#e5e9ee' } },
             tooltip: { backgroundColor: '#13171c', borderColor: '#232b35' } },
  scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3' } } },
  data: { datasets: [{ borderColor: '#f7a700' }] },
} };

plugins[0].beforeUpdate(chart);
t('dark: tick colour resolved to --muted', () => {
  const v = chart.options.scales.x.ticks.color;
  if (v !== '#8a94a3') throw new Error(v);
});
t('dark: grid stays low-alpha white', () => {
  const v = chart.options.scales.x.grid.color;
  if (!/255,255,255/.test(v)) throw new Error(v);
});
t('dataset colours untouched', () => {
  const v = chart.options.data.datasets[0].borderColor;
  if (v !== '#f7a700') throw new Error(v);
});

// Flip to light and re-run, as the themechange listener does.
w.document.documentElement.setAttribute('data-theme', 'light');
plugins[0].beforeUpdate(chart);
t('light: tick colour follows the theme', () => {
  const v = chart.options.scales.x.ticks.color;
  if (v !== '#5a6470') throw new Error('expected #5a6470, got ' + v);
});
t('light: legend label follows the theme', () => {
  const v = chart.options.plugins.legend.labels.color;
  if (v !== '#1a2028') throw new Error('expected #1a2028, got ' + v);
});
t('light: tooltip bg follows the theme', () => {
  const v = chart.options.plugins.tooltip.backgroundColor;
  if (v !== '#ffffff') throw new Error('expected #ffffff, got ' + v);
});
t('light: grid inverts to dark ink', () => {
  const v = chart.options.scales.x.grid.color;
  if (!/26,32,40/.test(v)) throw new Error(v);
});

// Flip back: must map from the ORIGINAL literal, not the substituted one.
w.document.documentElement.setAttribute('data-theme', 'dark');
plugins[0].beforeUpdate(chart);
t('back to dark: round-trips correctly', () => {
  const v = chart.options.scales.x.ticks.color;
  if (v !== '#8a94a3') throw new Error('expected #8a94a3, got ' + v);
});

t('themechange event fires', () => {
  let fired = false;
  w.document.addEventListener('siberforge:themechange', () => { fired = true; });
  const btn = w.document.createElement('button');
  btn.className = 'theme-toggle';
  w.document.body.appendChild(btn);
  w.eval(readFileSync(process.cwd() + '/core/lib/theme-toggle.js', 'utf8'));
  btn.click();
  if (!fired) throw new Error('no event');
});

dom.window.close();
console.log(errors.length ? `\n${errors.length} FAILURES` : '\nchart-theme: all passed.');
process.exit(errors.length ? 1 : 0);
