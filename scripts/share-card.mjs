// share-card.mjs -- the link-preview image (Open Graph card), 1200 x 630.
//
// Drawn as SVG from data/macro/state.json and rasterised with resvg, using the
// Inter files in scripts/assets/fonts (SIL OFL) so the result is identical on
// a laptop and on the GitHub runner. The regime map is the same SVG the State
// of the Cycle page shows (lib/quadrant.js).
//
//   node scripts/share-card.mjs            render from the existing state.json
//
// Normally called by scripts/build-state.mjs. The card names the month, not the
// day, so it only changes (and only creates a commit) when a number on it does.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'share', 'macro.png');
const FONT_DIR = path.join(ROOT, 'scripts', 'assets', 'fonts');
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const C = { bg: '#0b0d10', panel: '#13171c', line: '#2a323d', text: '#e5e9ee', muted: '#8a94a3', accent: '#f7a700', red: '#ef4f5a' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const sgn = (n, d = 1) => (n > 0 ? '+' : '') + Number(n).toFixed(d);

export async function cardSvg(state) {
  const { quadrantSvg } = await import(pathToFileURL(path.join(ROOT, 'lib', 'quadrant.js')).href);
  const h = state.headline;
  const month = `${MON[Number(state.asOf.slice(5, 7)) - 1]} ${state.asOf.slice(0, 4)}`;
  // "growth above its 10-year norm, core inflation close to its 10-year norm" -> two lines at the comma.
  const [l1, l2] = h.sub.split(', ');
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const facts = [
    state.scores.cycle ? [`${state.scores.cycle.score}/100`, 'recession risk', state.scores.cycle.phase.toLowerCase()] : null,
    state.recession.curveOdds != null ? [`${Math.round(state.recession.curveOdds)}%`, 'curve-model odds', '12 months ahead'] : null,
    state.scores.inflation ? [`${state.scores.inflation.score}/100`, 'inflation persistence', state.scores.inflation.phase.toLowerCase()] : null,
    state.policy.realFF != null ? [`${sgn(state.policy.realFF, 1)}%`, 'real fed funds', state.policy.stance] : null,
  ].filter(Boolean);
  const quad = quadrantSvg(state.trail.map(p => ({ ym: p.ym, g: p.g, i: p.i, r: p.r })), {
    size: 470, call: h.regime, font: 'Inter', palette: { text: C.text, muted: C.muted, line: C.line, panel: C.panel },
  });
  const titleSize = h.title.length > 11 ? 92 : 108;
  const chipW = 60 + (h.conviction.length + 11) * 11.2;
  const fx = i => 64 + i * 152;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" style="font-family:Inter">
  <rect width="1200" height="630" style="fill:${C.bg}"/>
  <rect x="0" y="0" width="1200" height="6" style="fill:${h.color || C.accent}"/>
  <rect x="682" y="48" width="486" height="534" rx="10" style="fill:${C.panel};stroke:${C.line};stroke-width:1"/>
  <g transform="translate(690 78)">${quad}</g>

  <text x="64" y="92" style="font-size:30px;font-weight:800;letter-spacing:1px"><tspan style="fill:${C.text}">SIBER</tspan><tspan dx="10" style="fill:${C.red}">FORGE</tspan></text>
  <text x="64" y="150" style="fill:${C.accent};font-size:17px;font-weight:600;letter-spacing:3px">WHERE THE US CYCLE STANDS  ·  ${esc(month.toUpperCase())}</text>

  <text x="60" y="${titleSize > 100 ? 268 : 258}" style="fill:${h.color || C.text};font-size:${titleSize}px;font-weight:800;letter-spacing:-3px">${esc(h.title)}</text>
  ${h.conviction ? `<rect x="64" y="294" width="${chipW.toFixed(0)}" height="36" rx="18" style="fill:none;stroke:${C.line};stroke-width:1.5"/>
  <text x="${(64 + chipW / 2).toFixed(0)}" y="318" text-anchor="middle" style="fill:${C.muted};font-size:15px;font-weight:600;letter-spacing:2.2px">${esc(h.conviction.toUpperCase())} CONVICTION</text>` : ''}
  <text x="64" y="380" style="fill:${C.text};font-size:25px;font-weight:400">${esc(cap(l1 || ''))}${l2 ? ',' : '.'}</text>
  ${l2 ? `<text x="64" y="414" style="fill:${C.text};font-size:25px;font-weight:400">${esc(l2)}.</text>` : ''}

  ${facts.map((f, i) => `<g transform="translate(${fx(i)} 470)">
    <rect x="0" y="0" width="2" height="78" style="fill:${C.line}"/>
    <text x="14" y="26" style="fill:${C.text};font-size:28px;font-weight:800">${esc(f[0])}</text>
    <text x="14" y="50" style="fill:${C.muted};font-size:14px;font-weight:400">${esc(f[1])}</text>
    <text x="14" y="70" style="fill:${C.accent};font-size:14px;font-weight:600">${esc(f[2])}</text>
  </g>`).join('\n  ')}

  <text x="64" y="596" style="fill:${C.muted};font-size:15px;font-weight:400">siberforge.xyz  ·  built from public data  ·  not investment advice</text>
</svg>`;
}

// Returns true when the PNG on disk changed.
export async function renderShareCard(state) {
  const { Resvg } = await import('@resvg/resvg-js');
  const svg = await cardSvg(state);
  const fontFiles = fs.readdirSync(FONT_DIR).filter(f => f.endsWith('.ttf')).map(f => path.join(FONT_DIR, f));
  if (!fontFiles.length) throw new Error('no fonts in ' + FONT_DIR);
  const png = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Inter' }, fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  if (fs.existsSync(OUT) && Buffer.compare(fs.readFileSync(OUT), png) === 0) return false;
  fs.writeFileSync(OUT, png);
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'macro', 'state.json'), 'utf8'));
  const changed = await renderShareCard(state);
  console.log(`share/macro.png ${changed ? 'written' : 'unchanged'} (${fs.statSync(OUT).size} bytes)`);
}
