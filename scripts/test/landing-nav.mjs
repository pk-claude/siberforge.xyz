// Landing page: says what the site is, routes to the live read, renders the
// section grid from nav-config (so it cannot drift from the interior nav).
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
const R = process.cwd();
const errors = [];
const t = (l, f) => { try { f(); console.log('  PASS', l); } catch (e) { console.log('  FAIL', l, '--', e.message); errors.push(l); } };
const html = readFileSync(R + '/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.siberforge.xyz/' });
const w = dom.window, d = w.document;
t('h1 describes the site', () => { const h = d.querySelector('h1'); if (!h || !/dashboards/i.test(h.textContent)) throw new Error(h && h.textContent); });
t('primary CTA goes to the macro read', () => { const a = d.querySelector('.home-btn--primary'); if (!a || a.getAttribute('href') !== '/macro/') throw new Error(a && a.getAttribute('href')); });
t('no dead subscribe form', () => { if (d.querySelector('#subscribe, form')) throw new Error('form present'); });
t('verdict + dials containers exist', () => { if (!d.getElementById('verdict') || !d.getElementById('dials')) throw new Error('missing'); });
w.eval(readFileSync(R + '/lib/nav-config.js', 'utf8'));
const inline = [...d.querySelectorAll('script:not([src]):not([type])')].map(s => s.textContent).join('\n');
w.eval(inline);
t('section grid renders one card per section', () => { const n = d.querySelectorAll('#home-grid .home-card').length; const k = w.SIBERFORGE_NAV.SECTIONS.length; if (n !== k) throw new Error(`${n} vs ${k}`); });
console.log(errors.length ? `${errors.length} landing failure(s)` : 'landing: all passed.');
process.exit(errors.length ? 1 : 0);
