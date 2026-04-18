// Sparkline + historical-percentile renderers. Pure SVG — no chart libraries.
// Designed to render 22 of these per page without hitting frame-rate issues.

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/**
 * Render a compact sparkline into `container`.
 *
 * @param {HTMLElement} container      target element (will be emptied)
 * @param {Array<{date:string,value:number}>} series  observations (ascending date)
 * @param {Object} opts
 *   opts.width     default 140
 *   opts.height    default 36
 *   opts.stroke    default '#e5e9ee'
 *   opts.zeroLine  boolean — draw dashed 0 line if series crosses zero
 *   opts.endpoint  boolean — draw filled dot at last point (default true)
 *   opts.fill      boolean — fill area under line with faint stroke color
 */
export function renderSparkline(container, series, opts = {}) {
  const {
    width = 140,
    height = 36,
    stroke = '#e5e9ee',
    zeroLine = false,
    endpoint = true,
    fill = false,
  } = opts;

  container.innerHTML = '';

  const values = series.map(o => o.value).filter(Number.isFinite);
  if (values.length < 2) {
    const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}` });
    const text = svgEl('text', {
      x: width / 2, y: height / 2 + 4,
      'text-anchor': 'middle',
      fill: '#8a94a3',
      'font-size': 10,
    });
    text.textContent = '—';
    svg.appendChild(text);
    container.appendChild(svg);
    return;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Leave 2px padding top/bottom so endpoints aren't clipped.
  const pad = 3;
  const h = height - pad * 2;

  const x = (i) => (i / (values.length - 1)) * (width - 2) + 1;
  const y = (v) => pad + (1 - (v - min) / range) * h;

  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}` });

  // Optional zero-baseline (only if series straddles 0)
  if (zeroLine && min < 0 && max > 0) {
    const yZero = y(0);
    svg.appendChild(svgEl('line', {
      x1: 0, y1: yZero, x2: width, y2: yZero,
      stroke: '#2a313c', 'stroke-width': 1, 'stroke-dasharray': '2 2',
    }));
  }

  const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');

  if (fill) {
    const fillPath = `${d} L${(width - 1).toFixed(2)},${height - 1} L1,${height - 1} Z`;
    svg.appendChild(svgEl('path', {
      d: fillPath,
      fill: stroke,
      opacity: 0.08,
    }));
  }

  svg.appendChild(svgEl('path', {
    d,
    fill: 'none',
    stroke,
    'stroke-width': 1.5,
    'stroke-linejoin': 'round',
    'stroke-linecap': 'round',
  }));

  if (endpoint) {
    const lastIdx = values.length - 1;
    svg.appendChild(svgEl('circle', {
      cx: x(lastIdx).toFixed(2),
      cy: y(values[lastIdx]).toFixed(2),
      r: 2,
      fill: stroke,
    }));
  }

  container.appendChild(svg);
}

/**
 * Historical-percentile context strip.
 *
 * Shows where the current value sits within the range of a historical lookback
 * (e.g. 5yr). Gives the reader fast intuition: "this is hot" or "near trough."
 *
 * @param {HTMLElement} container
 * @param {number} current    current value
 * @param {number[]} history  historical values to derive the distribution from
 * @param {Object} opts
 *   opts.width     default 140
 *   opts.height    default 10
 *   opts.direction 'higher_better' | 'lower_better' | 'target_band' | 'neutral'
 *   opts.target    for direction='target_band' — value to mark on strip
 */
export function renderContextStrip(container, current, history, opts = {}) {
  const {
    width = 140,
    height = 10,
    direction = 'neutral',
    target = null,
  } = opts;

  container.innerHTML = '';

  const vals = history.filter(Number.isFinite);
  if (!Number.isFinite(current) || vals.length < 10) {
    container.style.opacity = 0.35;
    return;
  }
  container.style.opacity = 1;

  const min = Math.min(...vals, current);
  const max = Math.max(...vals, current);
  const range = max - min || 1;

  // Colors indicate whether current position is "good" or "bad" in context.
  const pct = percentile(vals, current); // 0..1 rank in history
  let markerColor = '#e5e9ee';
  if (direction === 'higher_better') {
    markerColor = pct >= 0.66 ? '#3ecf8e' : pct <= 0.33 ? '#ef4f5a' : '#f7a700';
  } else if (direction === 'lower_better') {
    markerColor = pct <= 0.33 ? '#3ecf8e' : pct >= 0.66 ? '#ef4f5a' : '#f7a700';
  } else if (direction === 'target_band' && target != null) {
    const deviation = Math.abs(current - target) / (range || 1);
    markerColor = deviation < 0.1 ? '#3ecf8e' : deviation > 0.25 ? '#ef4f5a' : '#f7a700';
  }

  const svg = svgEl('svg', { width, height, viewBox: `0 0 ${width} ${height}` });

  // Base strip
  svg.appendChild(svgEl('rect', {
    x: 0, y: height / 2 - 1,
    width, height: 2,
    fill: '#2a313c',
    rx: 1,
  }));

  const xOf = (v) => ((v - min) / range) * (width - 4) + 2;

  // Target marker (thin tick)
  if (direction === 'target_band' && target != null && target >= min && target <= max) {
    svg.appendChild(svgEl('line', {
      x1: xOf(target), y1: 1, x2: xOf(target), y2: height - 1,
      stroke: '#8a94a3', 'stroke-width': 1,
    }));
  }

  // Current-value marker
  svg.appendChild(svgEl('circle', {
    cx: xOf(current),
    cy: height / 2,
    r: 3,
    fill: markerColor,
    stroke: '#0b0d10',
    'stroke-width': 1,
  }));

  container.appendChild(svg);
  container.dataset.percentile = Math.round(pct * 100);
}

/** Rank of `value` within `vals` (0..1). Handles ties by midrank. */
function percentile(vals, value) {
  let below = 0, equal = 0;
  for (const v of vals) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return (below + equal * 0.5) / vals.length;
}
