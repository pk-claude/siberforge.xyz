// Landing page: mobile menu + CTA.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
const R = process.cwd();
const errors = [];
const t = (l, f) => { try { f(); console.log('  PASS', l); } catch (e) { console.log('  FAIL', l, '--', e.message); errors.push(l); } };

const html = readFileSync(R + '/index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://www.siberforge.xyz/' });
const w = dom.window, d = w.document;

t('CTA points at the dashboards, not the dead form', () => {
  const cta = d.querySelector('.ed-nav-cta');
  if (!cta) throw new Error('no CTA');
  if (cta.getAttribute('href') === '#subscribe') throw new Error('still points at #subscribe');
  if (!/Explore/i.test(cta.textContent)) throw new Error(cta.textContent);
});
t('Subscribe demoted to a plain link', () => {
  const s = [...d.querySelectorAll('a')].find(a => a.getAttribute('href') === '#subscribe' && /Subscribe/i.test(a.textContent));
  if (!s) throw new Error('subscribe link gone entirely');
  if (s.classList.contains('ed-nav-cta')) throw new Error('still the styled CTA');
});
t('menu button + panel exist in markup', () => {
  if (!d.getElementById('ed-menu-btn')) throw new Error('no button');
  if (!d.getElementById('ed-menu')) throw new Error('no panel');
});

w.eval(readFileSync(R + '/core/lib/nav-config.js', 'utf8'));
w.eval(readFileSync(R + '/core/lib/landing-hub.js', 'utf8'));
await new Promise(r => { d.addEventListener('DOMContentLoaded', r); setTimeout(r, 1200); });

t('menu populated with all six sections', () => {
  const links = d.querySelectorAll('#ed-menu .ed-menu-link');
  if (links.length < 6) throw new Error('links=' + links.length);
  const labels = [...links].map(a => a.querySelector('.ed-menu-name').textContent);
  for (const s of w.SIBERFORGE_NAV.SECTIONS) if (!labels.includes(s.label)) throw new Error('missing ' + s.label);
  console.log('       ', labels.join(' / '));
});
t('menu starts closed', () => { if (!d.getElementById('ed-menu').hidden) throw new Error('open by default'); });
t('button toggles the panel', () => {
  const btn = d.getElementById('ed-menu-btn'), panel = d.getElementById('ed-menu');
  btn.click();
  if (panel.hidden) throw new Error('did not open');
  if (btn.getAttribute('aria-expanded') !== 'true') throw new Error('aria-expanded not updated');
  btn.click();
  if (!panel.hidden) throw new Error('did not close');
});
t('clicking a menu link closes the panel', () => {
  const btn = d.getElementById('ed-menu-btn'), panel = d.getElementById('ed-menu');
  btn.click();
  panel.querySelector('.ed-menu-link').click();
  if (!panel.hidden) throw new Error('stayed open');
});

w.close();
console.log(errors.length ? `\n${errors.length} FAILURES` : '\nlanding: all passed.');
process.exit(errors.length ? 1 : 0);
