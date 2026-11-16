// quadrant.js -- the growth x inflation regime map as an SVG string.
//
// Pure: no DOM, no fetch. The State of the Cycle page injects the string; the
// share-card script rasterises the same string, so the picture people see in a
// link preview is the picture on the page.
//
//   x = growth z (right = stronger than its 10-year norm)
//   y = core-inflation z (up = hotter than its 10-year norm)
//
// Colours are passed in so the page can hand over CSS variables and the
// rasteriser literal hex values. Everything is set through style="" because
// var() is honoured there in browsers and plain values are honoured by resvg.

const REG = {
  goldilocks:   { label: 'GOLDILOCKS',   color: '#3ecf8e' },
  reflation:    { label: 'REFLATION',    color: '#f7a700' },
  stagflation:  { label: 'STAGFLATION',  color: '#ef4f5a' },
  disinflation: { label: 'DISINFLATION', color: '#5a9cff' },
};
const DARK = { text: '#e5e9ee', muted: '#8a94a3', line: '#2a323d', panel: '#13171c' };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = ym => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

// trail: [{ ym, g, i, r }] oldest first; the last element is the latest month.
// opts: { size, palette, call (regime key of the 3-month vote), font, showCaption }
export function quadrantSvg(trail, opts = {}) {
  const W = opts.size || 420, H = W;
  const P = { ...DARK, ...(opts.palette || {}) };
  const font = opts.font || 'Inter, system-ui, sans-serif';
  const pad = Math.round(W * 0.085);
  const x0 = pad, y0 = pad, pw = W - 2 * pad, ph = H - 2 * pad;
  const pts = (trail || []).filter(p => Number.isFinite(p.g) && Number.isFinite(p.i));
  // Symmetric range: at least +/-1.5 z, widened in half-steps to hold the trail, capped at 3 (z is clipped there).
  const far = pts.reduce((m, p) => Math.max(m, Math.abs(p.g), Math.abs(p.i)), 0);
  const R = Math.min(3, Math.max(1.5, Math.ceil((far + 0.15) * 2) / 2));
  const sx = g => x0 + (Math.max(-R, Math.min(R, g)) + R) / (2 * R) * pw;
  const sy = i => y0 + (R - Math.max(-R, Math.min(R, i))) / (2 * R) * ph;
  const cx = sx(0), cy = sy(0);
  const fs = n => (W * n / 420).toFixed(1);
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Growth and inflation regime map, last ${pts.length} months" style="font-family:${font}">`);

  // Quadrant tints and names.
  const quad = (key, qx, qy, tx, ty, anchor) => {
    const q = REG[key], on = opts.call === key;
    out.push(`<rect x="${qx}" y="${qy}" width="${pw / 2}" height="${ph / 2}" style="fill:${q.color};fill-opacity:${on ? 0.16 : 0.055}"/>`);
    out.push(`<text x="${tx}" y="${ty}" text-anchor="${anchor}" style="fill:${q.color};fill-opacity:${on ? 1 : 0.7};font-size:${fs(11)}px;font-weight:700;letter-spacing:1.2px">${q.label}</text>`);
  };
  const m = Math.round(W * 0.025);
  quad('stagflation',  x0,  y0,  x0 + m,       y0 + m + Number(fs(9)), 'start');
  quad('reflation',    cx,  y0,  x0 + pw - m,  y0 + m + Number(fs(9)), 'end');
  quad('disinflation', x0,  cy,  x0 + m,       y0 + ph - m,            'start');
  quad('goldilocks',   cx,  cy,  x0 + pw - m,  y0 + ph - m,            'end');

  // Frame, axes, unit ticks.
  out.push(`<rect x="${x0}" y="${y0}" width="${pw}" height="${ph}" style="fill:none;stroke:${P.line};stroke-width:1"/>`);
  out.push(`<line x1="${cx}" y1="${y0}" x2="${cx}" y2="${y0 + ph}" style="stroke:${P.muted};stroke-opacity:0.55;stroke-width:1"/>`);
  out.push(`<line x1="${x0}" y1="${cy}" x2="${x0 + pw}" y2="${cy}" style="stroke:${P.muted};stroke-opacity:0.55;stroke-width:1"/>`);
  for (let z = -Math.floor(R); z <= Math.floor(R); z++) {
    if (z === 0) continue;
    out.push(`<line x1="${sx(z)}" y1="${cy - 3}" x2="${sx(z)}" y2="${cy + 3}" style="stroke:${P.muted};stroke-opacity:0.6"/>`);
    out.push(`<line x1="${cx - 3}" y1="${sy(z)}" x2="${cx + 3}" y2="${sy(z)}" style="stroke:${P.muted};stroke-opacity:0.6"/>`);
  }
  if (opts.showCaption !== false) {
    out.push(`<text x="${x0 + pw / 2}" y="${H - pad * 0.3}" text-anchor="middle" style="fill:${P.muted};font-size:${fs(10.5)}px">growth vs its 10-year norm  &#8594;  stronger</text>`);
    out.push(`<text transform="translate(${pad * 0.42} ${y0 + ph / 2}) rotate(-90)" text-anchor="middle" style="fill:${P.muted};font-size:${fs(10.5)}px">core inflation vs its 10-year norm  &#8594;  hotter</text>`);
  }

  // Trail: older segments fainter.
  const n = pts.length;
  for (let k = 1; k < n; k++) {
    const a = pts[k - 1], b = pts[k], t = k / (n - 1 || 1);
    out.push(`<line x1="${sx(a.g).toFixed(1)}" y1="${sy(a.i).toFixed(1)}" x2="${sx(b.g).toFixed(1)}" y2="${sy(b.i).toFixed(1)}" style="stroke:${P.text};stroke-opacity:${(0.10 + 0.55 * t).toFixed(2)};stroke-width:${(1 + 1.2 * t).toFixed(2)};stroke-linecap:round"/>`);
  }
  pts.forEach((p, k) => {
    const t = n > 1 ? k / (n - 1) : 1, lastOne = k === n - 1, vote = k >= n - 3;
    const c = (REG[p.r] || {}).color || P.text;
    if (lastOne) {
      out.push(`<circle cx="${sx(p.g).toFixed(1)}" cy="${sy(p.i).toFixed(1)}" r="${(W * 0.03).toFixed(1)}" style="fill:${c};fill-opacity:0.22"/>`);
      out.push(`<circle cx="${sx(p.g).toFixed(1)}" cy="${sy(p.i).toFixed(1)}" r="${(W * 0.016).toFixed(1)}" style="fill:${c};stroke:${P.panel};stroke-width:2"/>`);
    } else {
      out.push(`<circle cx="${sx(p.g).toFixed(1)}" cy="${sy(p.i).toFixed(1)}" r="${(vote ? W * 0.011 : W * 0.006 + W * 0.003 * t).toFixed(1)}" style="fill:${c};fill-opacity:${(vote ? 0.95 : 0.25 + 0.5 * t).toFixed(2)}"/>`);
    }
  });
  if (n) {
    const p = pts[n - 1], px = sx(p.g), py = sy(p.i);
    const right = px < x0 + pw * 0.62, below = py < y0 + ph * 0.2;
    out.push(`<text x="${(px + (right ? 1 : -1) * W * 0.04).toFixed(1)}" y="${(py + (below ? W * 0.05 : -W * 0.032)).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}" style="fill:${P.text};font-size:${fs(12)}px;font-weight:700;paint-order:stroke;stroke:${P.panel};stroke-width:4px;stroke-linejoin:round">${monthLabel(p.ym)}</text>`);
  }
  out.push('</svg>');
  return out.join('');
}
