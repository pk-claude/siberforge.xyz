// Today's Read hero panel — landing-page conclusions layer.
//
// Pulls the FRED series needed for all 4 composite scores + regime
// classification, computes scores, renders a single hero card with:
//   - Regime + conviction
//   - 4 composite scores (cycle/inflation/housing/consumer)
//   - Critical outliers (anything in warn/red status)
//   - "What changed" 1m/3m/12m delta strip
//   - One-paragraph tilt recommendation
// Handles all data fetching independently — does not require dashboard.js
// state. Adds ~3-4s to first paint of /core/macro/.

import {
  buildRegimeMap,
  smoothCurrentRegime,
  REGIMES,
} from './regimes.js';
import {
  computeCycleScore,
  computeInflationScore,
  computeHousingScore,
  computeConsumerScore,
  computeCreditScore,
  computeLaborScore,
  phaseFor,
} from '/core/lib/composite-scores.js';

// Series needed for all six composites + the regime classifier.
const ALL_SERIES = [
  // Regime
  'CPILFESL', 'INDPRO', 'PAYEMS', 'RRSFS',
  // Cycle
  'RECPROUSM156N', 'UNRATE', 'T10Y3M', 'NFCI', 'BAMLH0A0HYM2',
  // Inflation
  'CORESTICKM159SFRBATL', 'T5YIFR', 'CES0500000003', 'CPIHOSSL',
  // Housing
  'HOSSUPUSM673N', 'PERMIT', 'MORTGAGE30US', 'HOUST1F', 'CSUSHPISA', 'DRSFRMACBS', 'CES2000000001',
  // Consumer
  'PSAVERT', 'DRCCLACBS', 'IC4WSA', 'UMCSENT', 'TDSP',
  // Credit & Liquidity (additions; UNRATE/NFCI/HY OAS/T10Y3M/CES/PAYEMS/IC4WSA already above)
  'ANFCI', 'BAMLC0A0CM', 'DFII10',
];

const state = { data: {}, errors: [] };

function el(id) { return document.getElementById(id); }
function fmt(n, d = 1) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function loadAll() {
  // Batched fetches; partial-failure tolerant.
  const start = '1990-01-01';
  const batches = [];
  for (let i = 0; i < ALL_SERIES.length; i += 6) batches.push(ALL_SERIES.slice(i, i + 6));
  for (const batch of batches) {
    try {
      const j = await fetchJSON(`/api/fred?series=${batch.join(',')}&start=${start}`);
      for (const s of j.series) state.data[s.id] = s.observations;
      if (j.errors?.length) state.errors.push(...j.errors);
    } catch (err) {
      state.errors.push({ id: batch.join(','), error: String(err.message || err) });
    }
  }
}

// Find the date that's `monthsBack` months before the latest available date
// across the full data set. Used as a cutoff for back-cast scores.
function cutoffForMonthsBack(monthsBack) {
  const latestKnown = Object.values(state.data)
    .map(arr => (arr && arr.length) ? arr[arr.length - 1].date : null)
    .filter(Boolean)
    .sort()
    .pop();
  if (!latestKnown) return null;
  const [y, m] = latestKnown.slice(0, 7).split('-').map(Number);
  const total = y * 12 + (m - 1) - monthsBack;
  const ny = Math.floor(total / 12);
  const nm = (total % 12 + 12) % 12 + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-31`;
}

// Identify outliers — anything currently in 'warn' status. Each outlier
// includes a `link` to the relevant deep-dive section so the user can jump
// straight to the chart/context for that metric.
function findOutliers() {
  const flags = [];
  // Sahm
  const unrate = state.data.UNRATE || [];
  if (unrate.length >= 3) {
    const recent3 = unrate.slice(-3);
    const ma3 = recent3.reduce((s, o) => s + o.value, 0) / 3;
    const min12 = Math.min(...unrate.slice(-12).map(o => o.value));
    const sahm = ma3 - min12;
    if (sahm >= 0.5) flags.push({ metric: 'SAHM', kind: 'warn', text: `Sahm Rule TRIGGERED (${sahm.toFixed(2)}pp)`, link: '/core/macro/cycle/#cycle-recession', linkLabel: 'see cycle dashboard' });
    else if (sahm >= 0.4) flags.push({ metric: 'SAHM', kind: 'caution', text: `Sahm Rule near trigger (${sahm.toFixed(2)}pp; needs 0.50pp)`, link: '/core/macro/cycle/#cycle-recession', linkLabel: 'see cycle dashboard' });
  }
  // HY OAS
  const hy = state.data.BAMLH0A0HYM2 || [];
  if (hy.length) {
    const last = hy[hy.length - 1].value * 100; // bps
    if (last > 800) flags.push({ metric: 'HY_OAS', kind: 'warn', text: `HY OAS at ${last.toFixed(0)}bp — stress regime`, link: '/core/macro/cycle/#cycle-credit', linkLabel: 'see credit section' });
    else if (last > 500) flags.push({ metric: 'HY_OAS', kind: 'caution', text: `HY OAS at ${last.toFixed(0)}bp — elevated`, link: '/core/macro/cycle/#cycle-credit', linkLabel: 'see credit section' });
  }
  // Mortgage delinquency
  const dr = state.data.DRSFRMACBS || [];
  if (dr.length) {
    const last = dr[dr.length - 1].value;
    if (last > 4) flags.push({ metric: 'DRSFRMACBS', kind: 'warn', text: `SF mortgage delinquency at ${last.toFixed(2)}% — elevated`, link: '/core/macro/housing/#section-stress', linkLabel: 'see housing stress' });
  }
  // 10Y-3M curve inversion
  const c = state.data.T10Y3M || [];
  if (c.length) {
    const last = c[c.length - 1].value * 100;
    if (last < 0) flags.push({ metric: 'T10Y3M', kind: 'caution', text: `10Y-3M curve inverted at ${last.toFixed(0)}bp`, link: '/core/macro/cycle/#cycle-curve', linkLabel: 'see yield curve' });
  }
  // Months supply
  const ms = state.data.HOSSUPUSM673N || [];
  if (ms.length) {
    const last = ms[ms.length - 1].value;
    if (last > 7) flags.push({ metric: 'HOSSUPUSM673N', kind: 'warn', text: `Months supply at ${last.toFixed(1)} — buyers' market`, link: '/core/macro/housing/#section-inventory', linkLabel: 'see housing inventory' });
  }
  // Real wages
  const wages = (state.data.CES0500000003 || []);
  const core = (state.data.CPILFESL || []);
  if (wages.length >= 13 && core.length >= 13) {
    const wageYoy = (wages[wages.length - 1].value / wages[wages.length - 13].value - 1) * 100;
    const coreYoy = (core[core.length - 1].value / core[core.length - 13].value - 1) * 100;
    const real = wageYoy - coreYoy;
    if (real < 0) flags.push({ metric: 'REAL_WAGES', kind: 'warn', text: `Real wages negative (${real.toFixed(1)}%)`, link: '/core/macro/real-economy/#section-consumer', linkLabel: 'see consumer balance sheet' });
  }
  // NFCI tightening
  const nfci = state.data.NFCI || [];
  if (nfci.length) {
    const last = nfci[nfci.length - 1].value;
    if (last > 0.5) flags.push({ metric: 'NFCI', kind: 'warn', text: `NFCI at ${last.toFixed(2)} — financial conditions tight`, link: '/core/macro/cycle/#cycle-conditions', linkLabel: 'see conditions' });
  }
  // Sticky CPI elevated
  const sticky = state.data.CORESTICKM159SFRBATL || [];
  if (sticky.length) {
    const last = sticky[sticky.length - 1].value;
    if (last > 4) flags.push({ metric: 'STICKY_CPI', kind: 'warn', text: `Sticky CPI at ${last.toFixed(1)}% — services inflation persistent`, link: '/core/macro/inflation/#section-sticky', linkLabel: 'see inflation persistence' });
    else if (last > 3.5) flags.push({ metric: 'STICKY_CPI', kind: 'caution', text: `Sticky CPI at ${last.toFixed(1)}% — Fed-uncomfortable`, link: '/core/macro/inflation/#section-sticky', linkLabel: 'see inflation persistence' });
  }
  // Mortgage rate elevated
  const mort = state.data.MORTGAGE30US || [];
  if (mort.length) {
    const last = mort[mort.length - 1].value;
    if (last > 7) flags.push({ metric: 'MORTGAGE30US', kind: 'caution', text: `30Y mortgage at ${last.toFixed(2)}% — affordability constrained`, link: '/core/macro/housing/#section-affordability', linkLabel: 'see affordability' });
  }
  // 5y5y forward expectations unanchored
  const fwd = state.data.T5YIFR || [];
  if (fwd.length) {
    const last = fwd[fwd.length - 1].value;
    if (last > 2.7) flags.push({ metric: 'T5YIFR', kind: 'warn', text: `5y5y inflation breakeven at ${last.toFixed(2)}% — long-run expectations drifting up`, link: '/core/macro/inflation/#section-expectations', linkLabel: 'see expectations' });
  }
  return flags;
}

// Plain-language translation of a z-score against the 10-year (120-month)
// trailing window used in regimes.js. Anchor "10-yr norm" is surfaced
// explicitly so readers know the reference is recent history (not all-history,
// which would drag in the 1970s inflation regime).
function zPhrase(z) {
  if (!Number.isFinite(z)) return null;
  const abs = Math.abs(z);
  if (abs < 0.25) return 'near 10-yr norm';
  const dir = z >= 0 ? 'above' : 'below';
  if (abs < 0.75) return `modestly ${dir} 10-yr norm`;
  if (abs < 1.5)  return `${dir} 10-yr norm`;
  return `well ${dir} 10-yr norm`;
}

// Curated tilt picks per regime, matched to the EMPIRICAL regime-conditional
// returns table (Positioning section). Source-of-truth alignment is critical
// — earlier versions of this code derived tilt from the cycle composite SCORE
// which doesn't always match the regime CLASSIFIER (e.g. early-Disinflation
// looks like "expansion" by cycle score but is actually recession-middle by
// growth/inflation z's). Curated lookup keeps the V3 chips consistent with
// the Positioning detail below it.
const REGIME_TILT = {
  goldilocks: {
    action: 'Add risk',
    overweights:  'XLK tech, XLY discretionary, XLC communications',
    underweights: 'XLP staples, XLU utilities, XLE energy',
  },
  reflation: {
    action: 'Real-asset bias',
    overweights:  'XLE energy, XLB materials, XLF financials',
    underweights: 'XLK tech, XLU utilities, XLP staples',
  },
  stagflation: {
    action: 'Defensive + commodities',
    overweights:  'XLE energy, XLP staples, XLV healthcare',
    underweights: 'XLK tech, XLY discretionary, XLC communications',
  },
  disinflation: {
    action: 'Position for recovery',
    overweights:  'XLB materials, XLY discretionary, XLF financials',
    underweights: 'XLK tech, XLU utilities, XLP staples',
  },
};

function buildTilt(regimeKey) {
  // Sync with empirical positioning picks from dashboard.js
  const sample = window.__SF_STATE?.positioningSample || 'full';
  const table = sample === 'post2022' ? window.__SF_STATE?.regimeTablePost2022 : window.__SF_STATE?.regimeTable;
  const minN = sample === 'post2022' ? 6 : 24;

  if (!table || !regimeKey) {
    // Fallback to static map if dashboard hasn't loaded
    return REGIME_TILT[regimeKey] || { action: 'Stay neutral', overweights: '', underweights: '' };
  }

  // Replicate positioning logic: filter by minN, sort by mean, top 3 / bottom 3
  const allSyms = window.__SF_STATE?.regimeSymbols?.filter(s => s !== 'SPY') || [];
  const cells = allSyms
    .map(s => ({ s, c: table[s]?.[regimeKey]?.[6] }))
    .filter(o => o.c && o.c.n >= minN)
    .sort((a, b) => b.c.mean - a.c.mean);

  if (cells.length < 6) {
    // Not enough picks
    return REGIME_TILT[regimeKey] || { action: 'Stay neutral', overweights: '', underweights: '' };
  }

  const top = cells.slice(0, 3);
  const bottom = cells.slice(-3).reverse();

  // Map symbols to sector labels
  const getSectorLabel = (sym) => {
    // Import SECTOR_PROFILES lazily or assume it's available globally
    const profiles = window.__SF_STATE?.SECTOR_PROFILES || {};
    const profile = profiles[sym];
    return profile?.label || sym;
  };

  const overweights = top.map(t => `${t.s} ${getSectorLabel(t.s)}`).join(', ');
  const underweights = bottom.map(t => `${t.s} ${getSectorLabel(t.s)}`).join(', ');

  // Use static action string for this regime
  const actions = {
    goldilocks: 'Add risk',
    reflation: 'Real-asset bias',
    stagflation: 'Defensive + commodities',
    disinflation: 'Position for recovery',
  };

  return {
    action: actions[regimeKey] || 'Stay neutral',
    overweights,
    underweights,
  };
}

// ---------- rendering ----------

function renderScore(label, kind, scoreObj, oldScoreObj) {
  if (!scoreObj) return `<div class="tr-score-block tr-empty"><div class="tr-score-label">${label}</div><div class="tr-score-value">—</div></div>`;
  const phase = phaseFor(kind, scoreObj.score);
  const delta = oldScoreObj ? scoreObj.score - oldScoreObj.score : null;
  const dArrow = delta == null ? '' : delta > 1 ? '▲' : delta < -1 ? '▼' : '→';
  const dCls = delta == null ? '' : delta > 1 ? 'tr-up' : delta < -1 ? 'tr-down' : 'tr-flat';
  return `
    <div class="tr-score-block">
      <div class="tr-score-label">${label}</div>
      <div class="tr-score-value" style="color:${phase.color}">${scoreObj.score.toFixed(0)}<span class="tr-score-scale">/100</span></div>
      <div class="tr-score-phase" style="color:${phase.color}">${phase.label}</div>
      ${delta != null ? `<div class="tr-score-delta ${dCls}">${dArrow} ${Math.abs(delta).toFixed(0)}pt vs 1m</div>` : ''}
    </div>
  `;
}

// Map composite kind → metric-context catalog id (composite-level entry).
const COMPOSITE_METRIC_ID = {
  cycle:     'CYCLE_COMPOSITE',
  inflation: 'INFLATION_COMPOSITE',
  housing:   'HOUSING_COMPOSITE',
  consumer:  'CONSUMER_COMPOSITE',
  credit:    'CREDIT_COMPOSITE',
  labor:     'LABOR_COMPOSITE',
};

// Map composite kind → deep-dive page URL. Used to make Score Trajectory
// rail labels clickable so the redundant tr-quick-jump button row at the
// bottom of Today's Read can be removed.
const COMPOSITE_DEEP_DIVE_URL = {
  cycle:     '/core/macro/cycle/',
  inflation: '/core/macro/inflation/',
  housing:   '/core/macro/housing/',
  consumer:  '/core/macro/real-economy/',
  credit:    '/core/macro/credit/',
  labor:     '/core/macro/labor/',
};

// Compact horizontal-row variant. Used in the side-by-side layout where the 6
// score cards stack vertically beside the rose chart. Each card carries the
// composite's metric-id so the global tile-tooltip surfaces context on hover.
function renderScoreRow(label, kind, scoreObj, oldScoreObj) {
  const metricId = COMPOSITE_METRIC_ID[kind] || '';
  const metricAttr = metricId ? ` data-tile-metric="${metricId}"` : '';
  if (!scoreObj) {
    return `<div class="tr-score-row tr-empty"${metricAttr}>
      <div class="tr-score-row-label">${label}</div>
      <div class="tr-score-row-value">—</div>
    </div>`;
  }
  const phase = phaseFor(kind, scoreObj.score);
  const delta = oldScoreObj ? scoreObj.score - oldScoreObj.score : null;
  const dArrow = delta == null ? '' : delta > 1 ? '▲' : delta < -1 ? '▼' : '→';
  const dCls = delta == null ? '' : delta > 1 ? 'tr-up' : delta < -1 ? 'tr-down' : 'tr-flat';
  const deltaTxt = delta != null
    ? `<span class="tr-score-row-delta ${dCls}">${dArrow} ${Math.abs(delta).toFixed(0)}pt</span>`
    : '';
  return `
    <div class="tr-score-row"${metricAttr}>
      <div class="tr-score-row-left">
        <div class="tr-score-row-label">${label}</div>
        <div class="tr-score-row-phase" style="color:${phase.color}">${phase.label}</div>
      </div>
      <div class="tr-score-row-right">
        <div class="tr-score-row-value" style="color:${phase.color}">${scoreObj.score.toFixed(0)}<span class="tr-score-row-scale">/100</span></div>
        ${deltaTxt}
      </div>
    </div>
  `;
}

// Visual trajectory rail — a horizontal 0-100 track with up to 4 dots
// (12m, 3m, 1m, Now), each colored by its score's phase and sized/opacity
// graded by recency. A connecting line shows direction of travel.
function renderTrajRail(label, kind, s12, s3, s1, sNow) {
  const W = 600;   // viewBox width in user units
  const H = 36;
  const trackY = H / 2;
  const xFor = (s) => Math.max(0, Math.min(100, s)) / 100 * W;

  // Quarter-tick marks for orientation
  const ticks = [0, 25, 50, 75, 100].map(t => `<line x1="${xFor(t)}" y1="${trackY - 7}" x2="${xFor(t)}" y2="${trackY + 7}" stroke="rgba(138,148,163,0.20)" stroke-width="1"/>`).join('');

  // Background track gradient: green-tinted at low end (low risk), red-tinted at high end.
  const gradId = `tr-grad-${kind}`;
  const gradient = `
    <defs>
      <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"  stop-color="rgba(62,207,142,0.18)"/>
        <stop offset="50%" stop-color="rgba(247,167,0,0.12)"/>
        <stop offset="100%" stop-color="rgba(239,79,90,0.20)"/>
      </linearGradient>
    </defs>`;

  const trackBg = `<rect x="0" y="${trackY - 4}" width="${W}" height="8" rx="4" fill="url(#${gradId})" stroke="rgba(138,148,163,0.18)" stroke-width="0.7"/>`;

  const points = [
    { obj: s12, ageLabel: '12m', alpha: 0.32, r: 5.5 },
    { obj: s3,  ageLabel: '3m',  alpha: 0.55, r: 6.5 },
    { obj: s1,  ageLabel: '1m',  alpha: 0.78, r: 7.5 },
    { obj: sNow,ageLabel: 'now', alpha: 1.0,  r: 11, isNow: true },
  ].filter(p => p.obj && Number.isFinite(p.obj.score));

  const metricId = COMPOSITE_METRIC_ID[kind] || '';
  const metricAttr = metricId ? ` data-tile-metric="${metricId}"` : '';

  if (points.length === 0) {
    const dlUrlEmpty = COMPOSITE_DEEP_DIVE_URL[kind];
    const labelHtmlEmpty = dlUrlEmpty
      ? `<a class="tr-rail-label tr-rail-label-link" href="${dlUrlEmpty}">${label} <span class="tr-rail-arrow">&rarr;</span></a>`
      : `<div class="tr-rail-label">${label}</div>`;
    return `<div class="tr-rail-row tr-rail-empty"${metricAttr}>${labelHtmlEmpty}<div class="tr-rail-empty-msg">insufficient history</div></div>`;
  }

  // Connecting line through the points in time order
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(p.obj.score).toFixed(1)} ${trackY}`).join(' ');
  const lineEl = `<path d="${linePath}" fill="none" stroke="rgba(247,167,0,0.45)" stroke-width="2" stroke-linecap="round"/>`;

  // Dots
  const dotsHtml = points.map(p => {
    const ph = phaseFor(kind, p.obj.score);
    const stroke = p.isNow ? `stroke="#fff" stroke-width="2"` : '';
    const tip = `${p.ageLabel}: ${p.obj.score.toFixed(0)}/100 — ${ph.label}`;
    return `<circle cx="${xFor(p.obj.score).toFixed(1)}" cy="${trackY}" r="${p.r}" fill="${ph.color}" opacity="${p.alpha}" ${stroke}><title>${tip}</title></circle>`;
  }).join('');

  // The Now value + phase displayed to the right of the rail
  const phNow = phaseFor(kind, sNow.score);
  const delta1m = (s1 && Number.isFinite(s1.score)) ? sNow.score - s1.score : null;
  const dArrow = delta1m == null ? '' : delta1m > 1 ? '▲' : delta1m < -1 ? '▼' : '→';
  const dCls = delta1m == null ? '' : delta1m > 1 ? 'tr-up' : delta1m < -1 ? 'tr-down' : 'tr-flat';
  const deltaTxt = delta1m != null ? `<span class="tr-rail-delta ${dCls}">${dArrow} ${Math.abs(delta1m).toFixed(0)}pt 1m</span>` : '';

  return `
    <div class="tr-rail-row"${metricAttr}>
      ${COMPOSITE_DEEP_DIVE_URL[kind]
        ? `<a class="tr-rail-label tr-rail-label-link" href="${COMPOSITE_DEEP_DIVE_URL[kind]}">${label} <span class="tr-rail-arrow">&rarr;</span></a>`
        : `<div class="tr-rail-label">${label}</div>`}
      <div class="tr-rail-svg-wrap">
        <svg class="tr-rail-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${label} trajectory">
          ${gradient}
          ${trackBg}
          ${ticks}
          ${lineEl}
          ${dotsHtml}
        </svg>
      </div>
      <div class="tr-rail-now">
        <div class="tr-rail-now-value" style="color:${phNow.color}">${sNow.score.toFixed(0)}</div>
        <div class="tr-rail-now-phase" style="color:${phNow.color}">${phNow.label}</div>
        ${deltaTxt}
      </div>
    </div>
  `;
}

// ---------- rose / radar plot ----------
//
// Four orthogonal axes — Cycle (top), Inflation (right), Housing (bottom),
// Consumer (left) — with two overlaid polygons:
//   - "Now"     : bold accent-colored, filled
//   - "12m ago" : faded dashed reference
// Polygon shape encodes the regime balance at a glance: kite = imbalance,
// diamond = uniform tightening/loosening, small square = all clear.

function rosePoint(score, axisAngleRad, rPx) {
  // score 0..100 -> 0..rPx; SVG coords (y inverted is handled per-axis).
  const t = Math.max(0, Math.min(100, score)) / 100;
  return [Math.cos(axisAngleRad) * rPx * t, Math.sin(axisAngleRad) * rPx * t];
}

// Returns an SVG markup string (no <svg> wrapper — caller wraps).
// Hexagonal rose — 6 composites in 6-fold rotational symmetry. Cycle (top) →
// Inflation (UR) → Housing (LR) → Consumer (bottom) → Labor (LL) →
// Credit (UL). Going clockwise from 12 o'clock at 60° intervals.
function renderRose(scoresNow, scores12m) {
  const VIEW = 540; // bumped from 460 so 'CONSUMER' / 'INFLATION' labels stay inside
  const rPx = 175;  // 100-ring radius

  // 6 axes evenly spaced; angles computed from index.
  const labels = [
    { key: 'cycle',     label: 'CYCLE'     },
    { key: 'inflation', label: 'INFLATION' },
    { key: 'housing',   label: 'HOUSING'   },
    { key: 'consumer',  label: 'CONSUMER'  },
    { key: 'labor',     label: 'LABOR'     },
    { key: 'credit',    label: 'CREDIT'    },
  ];
  const N = labels.length;
  const axes = labels.map((a, i) => ({
    ...a,
    angle: -Math.PI / 2 + (i / N) * 2 * Math.PI,
  }));

  // Anchor + dy for axis labels — derived from angle so it generalizes to N axes.
  function anchorFor(angle) {
    const cx = Math.cos(angle);
    if (Math.abs(cx) < 0.18) return 'middle';
    return cx > 0 ? 'start' : 'end';
  }
  function dyFor(angle) {
    const sy = Math.sin(angle); // SVG y inverted: positive sy = below
    if (sy < -0.7) return -10;  // top
    if (sy > 0.7) return 18;    // bottom
    return 4;                    // sides
  }

  const ringRadii = [25, 50, 75, 100].map(v => ({ v, r: rPx * v / 100 }));
  const ringHtml = ringRadii.map(({ v, r }) => `
    <circle cx="0" cy="0" r="${r.toFixed(1)}" fill="none" stroke="rgba(138,148,163,${v === 100 ? 0.45 : 0.22})" stroke-width="${v === 100 ? 1.6 : 1.0}"/>
    <text x="4" y="${(r - 3).toFixed(1)}" fill="rgba(138,148,163,0.65)" font-size="11" font-weight="600">${v}</text>
  `).join('');

  const axisLineHtml = axes.map(a => {
    const [x, y] = rosePoint(100, a.angle, rPx);
    return `<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(138,148,163,0.40)" stroke-width="1.2"/>`;
  }).join('');

  function polyPoints(scores) {
    return axes.map(a => {
      const sc = scores[a.key]?.score;
      const s = Number.isFinite(sc) ? sc : 0;
      const [x, y] = rosePoint(s, a.angle, rPx);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
  const nowPolyD = polyPoints(scoresNow);
  const oldPolyD = polyPoints(scores12m);
  const ACCENT = '#f7a700';

  const dotHtml = axes.map(a => {
    const sObj = scoresNow[a.key];
    if (!sObj || !Number.isFinite(sObj.score)) return '';
    const ph = phaseFor(a.key, sObj.score);
    const [x, y] = rosePoint(sObj.score, a.angle, rPx);
    const metricId = COMPOSITE_METRIC_ID[a.key] || '';
    const metricAttr = metricId ? ` data-tile-metric="${metricId}"` : '';
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="${ph.color}" stroke="#13171c" stroke-width="2.2" class="tr-rose-dot"${metricAttr}><title>${a.label}: ${sObj.score.toFixed(0)}/100 — ${ph.label}</title></circle>`;
  }).join('');

  const labelHtml = axes.map(a => {
    const [lx, ly] = rosePoint(100, a.angle, rPx + 28);
    const sObj = scoresNow[a.key];
    const oldObj = scores12m[a.key];
    const sNow = sObj && Number.isFinite(sObj.score) ? sObj.score.toFixed(0) : '—';
    const sOld = oldObj && Number.isFinite(oldObj.score) ? oldObj.score.toFixed(0) : null;
    const anchor = anchorFor(a.angle);
    const dy = dyFor(a.angle);
    const valColor = sObj ? phaseFor(a.key, sObj.score).color : '#e5e9ee';
    const compareTxt = sOld != null ? `<tspan fill="rgba(138,148,163,0.85)" font-size="13" font-weight="600"> ← ${sOld}</tspan>` : '';
    return `
      <text x="${lx.toFixed(1)}" y="${(ly + dy - 12).toFixed(1)}" fill="var(--text, #e5e9ee)" font-size="14" font-weight="800" text-anchor="${anchor}" letter-spacing="0.5">${a.label}</text>
      <text x="${lx.toFixed(1)}" y="${(ly + dy + 10).toFixed(1)}" fill="${valColor}" font-size="20" font-weight="800" text-anchor="${anchor}">${sNow}${compareTxt}</text>
    `;
  }).join('');

  const legendHtml = `
    <g transform="translate(${(-VIEW / 2 + 16).toFixed(1)},${(-VIEW / 2 + 18).toFixed(1)})">
      <line x1="0" y1="0" x2="20" y2="0" stroke="${ACCENT}" stroke-width="4"/>
      <text x="26" y="5" fill="var(--text, #e5e9ee)" font-size="13" font-weight="700">Now</text>
      <line x1="0" y1="20" x2="20" y2="20" stroke="${ACCENT}" stroke-width="2.5" stroke-dasharray="5,4" opacity="0.55"/>
      <text x="26" y="25" fill="rgba(138,148,163,0.95)" font-size="13" font-weight="600">12m ago</text>
    </g>
  `;

  return `
    <svg class="tr-rose-svg" viewBox="${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Composite scores radar">
      ${ringHtml}
      ${axisLineHtml}
      <polygon points="${oldPolyD}" fill="rgba(247,167,0,0.10)" stroke="${ACCENT}" stroke-width="3" stroke-dasharray="6,5" opacity="0.65" stroke-linejoin="round"/>
      <polygon points="${nowPolyD}" fill="rgba(247,167,0,0.22)" stroke="${ACCENT}" stroke-width="4.5" stroke-linejoin="round"/>
      ${dotHtml}
      ${labelHtml}
      ${legendHtml}
    </svg>
  `;
}

function regimeConviction(growthZ, inflationZ) {
  if (!Number.isFinite(growthZ) || !Number.isFinite(inflationZ)) return null;
  const dist = Math.sqrt(growthZ * growthZ + inflationZ * inflationZ);
  if (dist < 0.5) return { label: 'LOW',    color: '#ef4f5a', desc: 'Near regime boundary — high flip risk.' };
  if (dist < 1.0) return { label: 'MEDIUM', color: '#f7a700', desc: 'Solid regime read; watch for shifts.' };
  return                { label: 'HIGH',   color: '#3ecf8e', desc: 'Deep in regime; high conviction.' };
}

export async function renderTodayRead() {
  const tgt = el('today-read');
  if (!tgt) return;
  tgt.innerHTML = '<div class="tr-loading">Loading Today\'s Read…</div>';

  await loadAll();

  // Build regime map from fetched data
  const regimeMap = buildRegimeMap({
    cpi:    state.data.CPILFESL || [],
    indpro: state.data.INDPRO   || [],
    payems: state.data.PAYEMS   || [],
    rrsfs:  state.data.RRSFS    || [],
  });
  const months = [...regimeMap.keys()].sort();
  const currentYm = months[months.length - 1];
  const currentInfo = currentYm ? regimeMap.get(currentYm) : null;
  const smoothed = smoothCurrentRegime(regimeMap, 3);

  const regimeLabel = smoothed ? REGIMES[smoothed.regime].label : 'Unclassified';
  const regimeColor = smoothed ? REGIMES[smoothed.regime].color : '#8a94a3';
  const conviction = currentInfo ? regimeConviction(currentInfo.growthZ, currentInfo.inflationZ) : null;

  // Composite scores: now + 1m ago + 3m ago + 12m ago. Six composites.
  const scoresNow = {
    cycle:     computeCycleScore(state.data),
    inflation: computeInflationScore(state.data),
    housing:   computeHousingScore(state.data),
    consumer:  computeConsumerScore(state.data),
    credit:    computeCreditScore(state.data),
    labor:     computeLaborScore(state.data),
  };
  const cutoff1m  = cutoffForMonthsBack(1);
  const cutoff3m  = cutoffForMonthsBack(3);
  const cutoff12m = cutoffForMonthsBack(12);
  const scores1m = {
    cycle:     computeCycleScore(state.data, cutoff1m),
    inflation: computeInflationScore(state.data, cutoff1m),
    housing:   computeHousingScore(state.data, cutoff1m),
    consumer:  computeConsumerScore(state.data, cutoff1m),
    credit:    computeCreditScore(state.data, cutoff1m),
    labor:     computeLaborScore(state.data, cutoff1m),
  };
  const scores3m = {
    cycle:     computeCycleScore(state.data, cutoff3m),
    inflation: computeInflationScore(state.data, cutoff3m),
    housing:   computeHousingScore(state.data, cutoff3m),
    consumer:  computeConsumerScore(state.data, cutoff3m),
    credit:    computeCreditScore(state.data, cutoff3m),
    labor:     computeLaborScore(state.data, cutoff3m),
  };
  const scores12m = {
    cycle:     computeCycleScore(state.data, cutoff12m),
    inflation: computeInflationScore(state.data, cutoff12m),
    housing:   computeHousingScore(state.data, cutoff12m),
    consumer:  computeConsumerScore(state.data, cutoff12m),
    credit:    computeCreditScore(state.data, cutoff12m),
    labor:     computeLaborScore(state.data, cutoff12m),
  };

  const outliers = findOutliers();

  // Pretty date
  const [y, m] = currentYm.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // V3 header: plain-language z phrases + structured tilt chips
  const growthPhrase = currentInfo ? zPhrase(currentInfo.growthZ) : null;
  const inflPhrase   = currentInfo ? zPhrase(currentInfo.inflationZ) : null;
  const regimeKey    = smoothed?.regime || null;
  const tilt         = buildTilt(regimeKey);

  tgt.innerHTML = `
    <div class="tr-summary" style="--tr-color:${regimeColor}">
      <div class="tr-summary-row tr-summary-regime">
        <span class="tr-summary-label">REGIME</span>
        <span class="tr-summary-name" style="color:${regimeColor}">${regimeLabel}</span>
        ${conviction ? `<span class="tr-summary-conv" style="color:${conviction.color}; border-color:${conviction.color}">${conviction.label} conviction</span>` : ''}
        ${(growthPhrase || inflPhrase) ? `<span class="tr-summary-bullet">&middot;</span><span class="tr-summary-z">${growthPhrase ? `growth ${growthPhrase}` : ''}${growthPhrase && inflPhrase ? ', ' : ''}${inflPhrase ? `inflation ${inflPhrase}` : ''}</span>` : ''}
        <span class="tr-summary-bullet">&middot;</span>
        <span class="tr-summary-period">3-month smoothed, ${monthName}</span>
      </div>
      <div class="tr-summary-row tr-summary-tilt">
        <span class="tr-summary-label">TILT</span>
        <span class="tr-summary-action">${tilt.action}</span>
        ${tilt.overweights ? `<span class="tr-summary-bullet">&middot;</span><span class="tr-chip-block"><span class="tr-chip-tag tr-chip-ow">OW</span><span class="tr-chip-list">${tilt.overweights}</span></span>` : ''}
        ${tilt.underweights ? `<span class="tr-chip-block"><span class="tr-chip-tag tr-chip-uw">UW</span><span class="tr-chip-list">${tilt.underweights}</span></span>` : ''}
      </div>
    </div>

    <div class="tr-hero-row">
      <div class="tr-trajectory-col">
        <div class="tr-trajectory-header">
          <div class="tr-trajectory-title">SCORE TRAJECTORY &middot; 12 MONTHS &rarr; NOW</div>
          <div class="tr-trajectory-sub">Each row is a 0-100 risk track. Faded dots = older snapshots; solid dot = today. Connecting line shows direction; phase color tracks the score.</div>
        </div>
        ${[
          ['Cycle Risk',           'cycle'],
          ['Inflation Persistence','inflation'],
          ['Housing Cycle',        'housing'],
          ['Consumer Stress',      'consumer'],
          ['Credit & Liquidity',   'credit'],
          ['Labor Market',         'labor'],
        ].map(([label, k]) => renderTrajRail(label, k, scores12m[k], scores3m[k], scores1m[k], scoresNow[k])).join('')}
        <div class="tr-trajectory-scale">
          <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
        </div>
      </div>
      <div class="tr-rose-col">
        <div class="tr-rose-title">Composite scores &middot; today vs 12 months ago</div>
        <div class="tr-rose-sub">Polygon shape encodes regime balance: kite = imbalance, diamond = uniform tightening, small = all-clear.</div>
        <div class="tr-rose-canvas">${renderRose(scoresNow, scores12m)}</div>
      </div>
    </div>

    ${outliers.length ? `<div class="tr-outliers">
      <div class="tr-outliers-label">⚠ OUTLIERS / WHAT TO WATCH &middot; click to investigate</div>
      ${outliers.map(o => {
        const metricAttr = o.metric ? ` data-tile-metric="${o.metric}"` : '';
        return o.link
          ? `<a class="tr-outlier tr-${o.kind} tr-outlier-link" href="${o.link}"${metricAttr}><span class="tr-outlier-text">${o.text}</span><span class="tr-outlier-cta">${o.linkLabel || 'see detail'} &rarr;</span></a>`
          : `<div class="tr-outlier tr-${o.kind}"${metricAttr}>${o.text}</div>`;
      }).join('')}
    </div>` : ''}

  `;
}

// Sync with Positioning sample toggle
document.addEventListener('regime:sample-changed', () => {
  renderTodayRead().catch(() => {});
});
