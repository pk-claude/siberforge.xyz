// Renders every live single-name page's engine (sn.js) under jsdom against
// the shipped data + research JSONs. Catches: broken JSON, runtime errors in
// sn.js, missing sections, and valuation-lab outputs that fail to compute.
import { JSDOM } from 'jsdom';
import fs from 'node:fs';

const snjs = fs.readFileSync('core/single-name/sn.js', 'utf8');
const TICKERS = ['NVDA', 'TSM', 'MU', 'AVGO', 'GOOGL', 'PLTR', 'CRWV', 'CBRS'];
let fails = 0;

async function testTicker(T) {
  const dom = new JSDOM(`<!DOCTYPE html><html><head></head>
    <body data-ticker="${T}"><main id="sn-root"></main></body></html>`,
    { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.fetch = async (url) => {
    const m = String(url).match(/\/core\/single-name\/data\/(.+)$/);
    if (m) {
      const p = 'core/single-name/data/' + m[1];
      if (fs.existsSync(p)) return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
      return { ok: false, json: async () => { throw new Error('404'); } };
    }
    return { ok: false, json: async () => null }; // /api/stocks offline in tests
  };
  const errors = [];
  window.addEventListener('error', e => errors.push(e.message));
  window.eval(snjs);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));
  const html = window.document.getElementById('sn-root').innerHTML;
  const has = (s) => html.includes(s);
  const checks = {
    hero: has('sn-hero'), stats: has('sn-stats'), scenarios: has('sn-scen'),
    charts: has('<svg'), lab: has('lab-panel'), peers: has('peer-tbl'),
    research: has('Research notes'), sources: has('sn-sources'),
  };
  const rdOut = window.document.getElementById('rd-out') || window.document.getElementById('rv-out');
  const fdOut = window.document.getElementById('fd-out') || window.document.getElementById('sv-out');
  checks.reverseOut = !!rdOut && rdOut.textContent.length > 1 && rdOut.textContent !== '—';
  checks.forwardOut = !!fdOut && fdOut.textContent.length > 1 && fdOut.textContent !== '—';
  checks.noJsErrors = errors.length === 0;
  const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
  if (bad.length) { fails++; console.log(`FAIL  ${T}: ${bad.join(', ')}${errors.length ? ' | ' + errors.join('; ') : ''}`); }
  else console.log(`PASS  ${T} | ${rdOut.textContent.slice(0, 52)}`);
}

for (const t of TICKERS) await testTicker(t);
console.log(fails ? `${fails} single-name render failure(s)` : 'All single-name pages render.');
process.exit(fails ? 1 : 0);
