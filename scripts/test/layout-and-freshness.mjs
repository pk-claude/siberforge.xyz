import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const R = process.cwd();
const rd = p => readFileSync(R + '/' + p, 'utf8');
const errors = [];
function run(label, fn) {
  try { fn(); console.log('  PASS', label); }
  catch (e) { console.log('  FAIL', label, '--', e.message); errors.push(label); }
}

function boot(bodyAttrs) {
  // JSDOM reports readyState 'loading' at construction, so layout.js defers
  // to DOMContentLoaded -- the same path a real browser takes.
  const dom = new JSDOM(
    `<!doctype html><html><head></head><body ${bodyAttrs}>
       <main><h2>Sector returns</h2><div class="wrap"><canvas id="chart-a"></canvas></div>
       <table><thead><tr><th>Ticker</th><th>P/E</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table>
       </main></body></html>`,
    { runScripts: 'outside-only', url: 'https://www.siberforge.xyz/core/macro/inflation/' }
  );
  const w = dom.window;
  w.eval(rd('core/lib/nav-config.js'));
  w.eval(rd('core/lib/freshness.js'));
  w.eval(rd('core/lib/layout.js'));
  return new Promise(resolve => {
    if (w.document.readyState === 'complete') return resolve(w);
    w.document.addEventListener('DOMContentLoaded', () => resolve(w));
    w.addEventListener('load', () => resolve(w));
    setTimeout(() => resolve(w), 1500);
  });
}

console.log('layout.js render');
const w = await boot('data-section="macro" data-page="inflation" data-page-status="live"');
const d = w.document;

run('header injected',       () => { if (!d.querySelector('header.sf-top')) throw new Error('no header'); });
run('six section tabs',      () => { const n = d.querySelectorAll('.sf-nav-tab').length; if (n !== 6) throw new Error('tabs=' + n); });
run('active tab is Macro',   () => { const a = d.querySelector('.sf-nav-tab.active'); if (!a || a.textContent !== 'Macro') throw new Error(a && a.textContent); });
run('second tier rendered',  () => { if (!d.querySelector('#sf-nav-pages')) throw new Error('no pages row'); });
run('mobile nav toggle',     () => { if (!d.querySelector('#sf-nav-more')) throw new Error('no toggle'); });
run('breadcrumbs present',   () => { const c = d.querySelectorAll('.sf-crumb'); if (c.length < 3) throw new Error('crumbs=' + c.length); });
run('skip link is first',    () => { const f = d.body.firstElementChild; if (!f || !f.classList.contains('sf-skip')) throw new Error(f && f.className); });
run('canvas got aria-label', () => { const c = d.getElementById('chart-a'); if (!c.getAttribute('aria-label')) throw new Error('unlabelled'); if (c.getAttribute('role') !== 'img') throw new Error('no role'); });
run('canvas label from h2',  () => { const l = d.getElementById('chart-a').getAttribute('aria-label'); if (!/Sector returns/.test(l)) throw new Error(l); });
run('th got scope=col',      () => { for (const x of d.querySelectorAll('thead th')) if (x.getAttribute('scope') !== 'col') throw new Error('missing scope'); });
run('search overlay built',  () => { if (!d.getElementById('sf-search-overlay')) throw new Error('no overlay'); });
run('see-also: 3 cards',     () => { const s = d.querySelector('.sf-seealso'); if (!s) throw new Error('no see-also'); const n = s.querySelectorAll('.sf-seealso-card').length; if (n !== 3) throw new Error('cards=' + n); });
run('see-also -> regional-cpi', () => { const h = [...d.querySelectorAll('.sf-seealso-card')].map(a => a.getAttribute('href')); if (!h.includes('/core/macro/regional/regional-cpi/')) throw new Error(h.join(',')); });

console.log('breadcrumb: /core/plug/ (was a duplicate crumb)');
const w2 = await boot('data-section="equity" data-sub-section="plug" data-page="plug-overview"');
run('no duplicate crumb', () => {
  const crumbs = [...w2.document.querySelectorAll('.sf-crumb')].map(c => c.textContent);
  console.log('       trail:', crumbs.join(' > '));
  if (crumbs.filter(c => c === 'Section overview').length) throw new Error('dup: ' + crumbs.join(' > '));
});

console.log('leaf with no curated related entries');
const w3 = await boot('data-section="equity" data-sub-section="plug" data-page="plug-map"');
run('no empty see-also block', () => { if (w3.document.querySelector('.sf-seealso')) throw new Error('rendered empty block'); });

console.log('freshness.js');
const F = w.SF_FRESH;
const daysAgo = n => new Date(Date.now() - n * 86400000).toISOString();
run('1d weekly -> fresh',     () => { const f = F.assess(daysAgo(1), 'weekly'); if (f.level !== 'fresh') throw new Error(f.label); });
run('12d weekly -> aging',    () => { const f = F.assess(daysAgo(12), 'weekly'); if (f.level !== 'aging') throw new Error(f.label); });
run('22d weekly -> stale',    () => { const f = F.assess(daysAgo(22), 'weekly'); if (f.level !== 'stale' || !/22d/.test(f.label)) throw new Error(f.label); });
run('56d weekly -> stale',    () => { const f = F.assess(daysAgo(56), 'weekly'); if (f.level !== 'stale') throw new Error(f.label); });
run('null -> unknown',        () => { const f = F.assess(null); if (f.level !== 'unknown') throw new Error(f.label); });
run('note silent when fresh', () => { if (F.note(F.assess(daysAgo(1), 'weekly')) !== '') throw new Error('spoke up'); });
run('note speaks when stale', () => { if (!/22 days/.test(F.note(F.assess(daysAgo(22), 'weekly')))) throw new Error('silent'); });
run('badge carries level',    () => { const h = F.badge(F.assess(daysAgo(30), 'weekly')); if (!/sf-fresh--stale/.test(h)) throw new Error(h); });

w.close(); w2.close(); w3.close();
console.log(errors.length ? `\n${errors.length} FAILURES: ${errors.join(', ')}` : '\nAll smoke tests passed.');
process.exit(errors.length ? 1 : 0);
