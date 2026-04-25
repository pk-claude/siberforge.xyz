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
  phaseFor,
} from '/core/lib/composite-scores.js';

// Series needed for all four composites + the regime classifier.
const ALL_SERIES = [
  // Regime
  'CPILFESL', 'INDPRO', 'PAYEMS', 'RRSFS',
  // Cycle
  'RECPROUSM156N', 'UNRATE', 'T10Y3M', 'NFCI', 'BAMLH0A0HYM2',
  // Inflation
  'CORESTICKM159SFRBATL', 'T5YIFR', 'CES0500000003', 'CPIHOSSL',
  // Housing
  'MSACSR', 'PERMIT', 'MORTGAGE30US', 'HOUST1F', 'CSUSHPISA', 'DRSFRMACBS', 'CES2000000001',
  // Consumer
  'PSAVERT', 'DRCCLACBS', 'IC4WSA', 'UMCSENT', 'TDSP',
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
    if (sahm >= 0.5) flags.push({ kind: 'warn', text: `Sahm Rule TRIGGERED (${sahm.toFixed(2)}pp)`, link: '/core/macro/cycle/#cycle-recession', linkLabel: 'see cycle dashboard' });
    else if (sahm >= 0.4) flags.push({ kind: 'caution', text: `Sahm Rule near trigger (${sahm.toFixed(2)}pp; needs 0.50pp)`, link: '/core/macro/cycle/#cycle-recession', linkLabel: 'see cycle dashboard' });
  }
  // HY OAS
  const hy = state.data.BAMLH0A0HYM2 || [];
  if (hy.length) {
    const last = hy[hy.length - 1].value * 100; // bps
    if (last > 800) flags.push({ kind: 'warn', text: `HY OAS at ${last.toFixed(0)}bp — stress regime`, link: '/core/macro/cycle/#cycle-credit', linkLabel: 'see credit section' });
    else if (last > 500) flags.push({ kind: 'caution', text: `HY OAS at ${last.toFixed(0)}bp — elevated`, link: '/core/macro/cycle/#cycle-credit', linkLabel: 'see credit section' });
  }
  // Mortgage delinquency
  const dr = state.data.DRSFRMACBS || [];
  if (dr.length) {
    const last = dr[dr.length - 1].value;
    if (last > 4) flags.push({ kind: 'warn', text: `SF mortgage delinquency at ${last.toFixed(2)}% — elevated`, link: '/core/macro/housing/#section-stress', linkLabel: 'see housing stress' });
  }
  // 10Y-3M curve inversion
  const c = state.data.T10Y3M || [];
  if (c.length) {
    const last = c[c.length - 1].value * 100;
    if (last < 0) flags.push({ kind: 'caution', text: `10Y-3M curve inverted at ${last.toFixed(0)}bp`, link: '/core/macro/cycle/#cycle-curve', linkLabel: 'see yield curve' });
  }
  // Months supply
  const ms = state.data.MSACSR || [];
  if (ms.length) {
    const last = ms[ms.length - 1].value;
    if (last > 7) flags.push({ kind: 'warn', text: `Months supply at ${last.toFixed(1)} — buyers' market`, link: '/core/macro/housing/#section-inventory', linkLabel: 'see housing inventory' });
  }
  // Real wages
  const wages = (state.data.CES0500000003 || []);
  const core = (state.data.CPILFESL || []);
  if (wages.length >= 13 && core.length >= 13) {
    const wageYoy = (wages[wages.length - 1].value / wages[wages.length - 13].value - 1) * 100;
    const coreYoy = (core[core.length - 1].value / core[core.length - 13].value - 1) * 100;
    const real = wageYoy - coreYoy;
    if (real < 0) flags.push({ kind: 'warn', text: `Real wages negative (${real.toFixed(1)}%)`, link: '/core/macro/real-economy/#section-consumer', linkLabel: 'see consumer balance sheet' });
  }
  // NFCI tightening
  const nfci = state.data.NFCI || [];
  if (nfci.length) {
    const last = nfci[nfci.length - 1].value;
    if (last > 0.5) flags.push({ kind: 'warn', text: `NFCI at ${last.toFixed(2)} — financial conditions tight`, link: '/core/macro/cycle/#cycle-conditions', linkLabel: 'see conditions' });
  }
  // Sticky CPI elevated
  const sticky = state.data.CORESTICKM159SFRBATL || [];
  if (sticky.length) {
    const last = sticky[sticky.length - 1].value;
    if (last > 4) flags.push({ kind: 'warn', text: `Sticky CPI at ${last.toFixed(1)}% — services inflation persistent`, link: '/core/macro/inflation/#section-sticky', linkLabel: 'see inflation persistence' });
    else if (last > 3.5) flags.push({ kind: 'caution', text: `Sticky CPI at ${last.toFixed(1)}% — Fed-uncomfortable`, link: '/core/macro/inflation/#section-sticky', linkLabel: 'see inflation persistence' });
  }
  // Mortgage rate elevated
  const mort = state.data.MORTGAGE30US || [];
  if (mort.length) {
    const last = mort[mort.length - 1].value;
    if (last > 7) flags.push({ kind: 'caution', text: `30Y mortgage at ${last.toFixed(2)}% — affordability constrained`, link: '/core/macro/housing/#section-affordability', linkLabel: 'see affordability' });
  }
  // 5y5y forward expectations unanchored
  const fwd = state.data.T5YIFR || [];
  if (fwd.length) {
    const last = fwd[fwd.length - 1].value;
    if (last > 2.7) flags.push({ kind: 'warn', text: `5y5y inflation breakeven at ${last.toFixed(2)}% — long-run expectations drifting up`, link: '/core/macro/inflation/#section-expectations', linkLabel: 'see expectations' });
  }
  return flags;
}

// One-paragraph tilt recommendation based on the regime + composite scores.
function buildNarrative(regimeLabel, scores) {
  const cycle = scores.cycle?.score;
  const inflation = scores.inflation?.score;
  const housing = scores.housing?.score;
  const consumer = scores.consumer?.score;

  const bits = [];
  bits.push(`<strong>Regime:</strong> ${regimeLabel}`);

  if (cycle != null) {
    if (cycle < 35) bits.push('cycle expanding');
    else if (cycle < 60) bits.push('cycle late-stage');
    else bits.push('cycle in slowdown / contraction');
  }
  if (inflation != null) {
    if (inflation < 35) bits.push('inflation cooling');
    else if (inflation < 65) bits.push('inflation sticky');
    else bits.push('inflation persistent');
  }

  let tilt;
  if ((cycle ?? 50) < 35 && (inflation ?? 50) < 45) {
    tilt = `<strong>Tilt:</strong> pro-cyclical &mdash; favor growth/tech, small-caps, credit carry. Quality over duration.`;
  } else if ((cycle ?? 50) > 60 || (consumer ?? 50) > 55) {
    tilt = `<strong>Tilt:</strong> defensive &mdash; reduce cyclicals, add quality + duration, favor staples + utilities + healthcare.`;
  } else if ((inflation ?? 50) > 60) {
    tilt = `<strong>Tilt:</strong> real-asset bias &mdash; energy + materials + financials; underweight long-duration tech.`;
  } else {
    tilt = `<strong>Tilt:</strong> balanced &mdash; no single dimension is in extreme regime; maintain neutral risk with attention to housing-cycle position (${housing != null ? housing.toFixed(0) : '—'}/100).`;
  }

  return bits.join(' · ') + '. ' + tilt;
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
function renderRose(scoresNow, scores12m) {
  const VIEW = 360;
  const rPx = 130; // max radius in px (the 100 ring)

  // Axes: Cycle top, Inflation right, Housing bottom, Consumer left.
  // Angles in standard math (0 = +x). SVG y is inverted, so for "top" we
  // need angle = -PI/2 (which in SVG y points up).
  const axes = [
    { key: 'cycle',     label: 'CYCLE',     angle: -Math.PI / 2 },
    { key: 'inflation', label: 'INFLATION', angle: 0 },
    { key: 'housing',   label: 'HOUSING',   angle:  Math.PI / 2 },
    { key: 'consumer',  label: 'CONSUMER',  angle:  Math.PI },
  ];

  const ringRadii = [25, 50, 75, 100].map(v => ({ v, r: rPx * v / 100 }));
  const ringHtml = ringRadii.map(({ v, r }) => `
    <circle cx="0" cy="0" r="${r.toFixed(1)}" fill="none" stroke="rgba(138,148,163,${v === 100 ? 0.30 : 0.14})" stroke-width="${v === 100 ? 0.9 : 0.6}"/>
    <text x="3" y="${(r - 2).toFixed(1)}" fill="rgba(138,148,163,0.45)" font-size="9">${v}</text>
  `).join('');

  const axisLineHtml = axes.map(a => {
    const [x, y] = rosePoint(100, a.angle, rPx);
    return `<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(138,148,163,0.30)" stroke-width="0.7"/>`;
  }).join('');

  // Polygon for a score map.
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

  // Score-marker dots on the "Now" polygon, colored by phase per axis.
  const dotHtml = axes.map(a => {
    const sObj = scoresNow[a.key];
    if (!sObj || !Number.isFinite(sObj.score)) return '';
    const ph = phaseFor(a.key, sObj.score);
    const [x, y] = rosePoint(sObj.score, a.angle, rPx);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${ph.color}" stroke="#13171c" stroke-width="1.2"><title>${a.label}: ${sObj.score.toFixed(0)}/100 — ${ph.label}</title></circle>`;
  }).join('');

  // Axis labels — positioned just outside the 100-ring.
  const labelHtml = axes.map(a => {
    const [lx, ly] = rosePoint(100, a.angle, rPx + 18);
    const sObj = scoresNow[a.key];
    const oldObj = scores12m[a.key];
    const sNow = sObj && Number.isFinite(sObj.score) ? sObj.score.toFixed(0) : '—';
    const sOld = oldObj && Number.isFinite(oldObj.score) ? oldObj.score.toFixed(0) : null;
    const anchor = a.key === 'inflation' ? 'start' : a.key === 'consumer' ? 'end' : 'middle';
    const dy1 = a.key === 'cycle' ? -2 : a.key === 'housing' ? 12 : 4;
    const dy2 = a.key === 'cycle' ? -14 : a.key === 'housing' ? 24 : 16;
    const valColor = sObj ? phaseFor(a.key, sObj.score).color : '#e5e9ee';
    const compareTxt = sOld != null ? `<tspan fill="rgba(138,148,163,0.7)" font-size="9"> ← ${sOld}</tspan>` : '';
    return `
      <text x="${lx.toFixed(1)}" y="${(ly + dy1).toFixed(1)}" fill="var(--text, #e5e9ee)" font-size="11" font-weight="700" text-anchor="${anchor}">${a.label}</text>
      <text x="${lx.toFixed(1)}" y="${(ly + dy2).toFixed(1)}" fill="${valColor}" font-size="11" font-weight="700" text-anchor="${anchor}">${sNow}${compareTxt}</text>
    `;
  }).join('');

  // Legend top-left.
  const legendHtml = `
    <g transform="translate(${(-VIEW / 2 + 14).toFixed(1)},${(-VIEW / 2 + 14).toFixed(1)})">
      <line x1="0" y1="0" x2="14" y2="0" stroke="${ACCENT}" stroke-width="2.4"/>
      <text x="18" y="3" fill="var(--text, #e5e9ee)" font-size="9.5">Now</text>
      <line x1="0" y1="14" x2="14" y2="14" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.55"/>
      <text x="18" y="17" fill="rgba(138,148,163,0.85)" font-size="9.5">12m ago</text>
    </g>
  `;

  return `
    <svg class="tr-rose-svg" viewBox="${-VIEW / 2} ${-VIEW / 2} ${VIEW} ${VIEW}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Composite scores radar">
      ${ringHtml}
      ${axisLineHtml}
      <polygon points="${oldPolyD}" fill="rgba(247,167,0,0.08)" stroke="${ACCENT}" stroke-width="1.5" stroke-dasharray="3,3" opacity="0.55"/>
      <polygon points="${nowPolyD}" fill="rgba(247,167,0,0.18)" stroke="${ACCENT}" stroke-width="2.2"/>
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

  // Composite scores: now + 1m ago + 3m ago + 12m ago
  const scoresNow = {
    cycle:     computeCycleScore(state.data),
    inflation: computeInflationScore(state.data),
    housing:   computeHousingScore(state.data),
    consumer:  computeConsumerScore(state.data),
  };
  const cutoff1m  = cutoffForMonthsBack(1);
  const cutoff3m  = cutoffForMonthsBack(3);
  const cutoff12m = cutoffForMonthsBack(12);
  const scores1m = {
    cycle:     computeCycleScore(state.data, cutoff1m),
    inflation: computeInflationScore(state.data, cutoff1m),
    housing:   computeHousingScore(state.data, cutoff1m),
    consumer:  computeConsumerScore(state.data, cutoff1m),
  };
  const scores3m = {
    cycle:     computeCycleScore(state.data, cutoff3m),
    inflation: computeInflationScore(state.data, cutoff3m),
    housing:   computeHousingScore(state.data, cutoff3m),
    consumer:  computeConsumerScore(state.data, cutoff3m),
  };
  const scores12m = {
    cycle:     computeCycleScore(state.data, cutoff12m),
    inflation: computeInflationScore(state.data, cutoff12m),
    housing:   computeHousingScore(state.data, cutoff12m),
    consumer:  computeConsumerScore(state.data, cutoff12m),
  };

  const outliers = findOutliers();
  const narrative = buildNarrative(regimeLabel, scoresNow);

  // Pretty date
  const [y, m] = currentYm.split('-').map(Number);
  const monthName = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  tgt.innerHTML = `
    <div class="tr-eyebrow">TODAY'S READ &middot; ${monthName}</div>
    <div class="tr-narrative">${narrative}</div>

    <div class="tr-rose-wrap">
      <div class="tr-rose-header">
        <div class="tr-rose-title">Composite scores &middot; today vs 12 months ago</div>
        <div class="tr-rose-sub">Polygon shape encodes regime balance: kite = imbalance, diamond = uniform tightening, small = all-clear.</div>
      </div>
      <div class="tr-rose-canvas">${renderRose(scoresNow, scores12m)}</div>
    </div>

    <div class="tr-grid">
      <div class="tr-regime-block" style="--tr-color:${regimeColor}">
        <div class="tr-regime-label">REGIME &middot; 3-MONTH SMOOTHED</div>
        <div class="tr-regime-name" style="color:${regimeColor}">${regimeLabel}</div>
        ${conviction ? `<div class="tr-conviction" style="color:${conviction.color}; border-color:${conviction.color}">CONVICTION: ${conviction.label}</div>
                         <div class="tr-conviction-desc">${conviction.desc}</div>` : ''}
        ${currentInfo ? `<div class="tr-regime-zs">Growth z: ${currentInfo.growthZ >= 0 ? '+' : ''}${fmt(currentInfo.growthZ, 2)} · Inflation z: ${currentInfo.inflationZ >= 0 ? '+' : ''}${fmt(currentInfo.inflationZ, 2)}</div>` : ''}
      </div>
      ${renderScore('Cycle Risk',          'cycle',     scoresNow.cycle,     scores1m.cycle)}
      ${renderScore('Inflation Persistence','inflation', scoresNow.inflation, scores1m.inflation)}
      ${renderScore('Housing Cycle',       'housing',   scoresNow.housing,   scores1m.housing)}
      ${renderScore('Consumer Stress',     'consumer',  scoresNow.consumer,  scores1m.consumer)}
    </div>

    ${outliers.length ? `<div class="tr-outliers">
      <div class="tr-outliers-label">⚠ OUTLIERS / WHAT TO WATCH &middot; click to investigate</div>
      ${outliers.map(o => o.link
        ? `<a class="tr-outlier tr-${o.kind} tr-outlier-link" href="${o.link}"><span class="tr-outlier-text">${o.text}</span><span class="tr-outlier-cta">${o.linkLabel || 'see detail'} &rarr;</span></a>`
        : `<div class="tr-outlier tr-${o.kind}">${o.text}</div>`
      ).join('')}
    </div>` : ''}

    <div class="tr-deltas">
      <div class="tr-deltas-label">SCORE TRAJECTORY (HIGHER = MORE RISK / TIGHTER REGIME)</div>
      <table class="tr-delta-table">
        <thead><tr><th>Composite</th><th>12m ago</th><th>3m ago</th><th>1m ago</th><th>Now</th></tr></thead>
        <tbody>
          ${[
            ['Cycle Risk',           'cycle'],
            ['Inflation Persistence','inflation'],
            ['Housing Cycle',        'housing'],
            ['Consumer Stress',      'consumer'],
          ].map(([label, k]) => `
            <tr>
              <td>${label}</td>
              <td>${scores12m[k]?.score != null ? scores12m[k].score.toFixed(0) : '—'}</td>
              <td>${scores3m[k]?.score != null ? scores3m[k].score.toFixed(0) : '—'}</td>
              <td>${scores1m[k]?.score != null ? scores1m[k].score.toFixed(0) : '—'}</td>
              <td><strong>${scoresNow[k]?.score != null ? scoresNow[k].score.toFixed(0) : '—'}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="tr-quick-jump">
      <a href="/core/macro/cycle/">Cycle &rarr;</a>
      <a href="/core/macro/inflation/">Inflation &rarr;</a>
      <a href="/core/macro/housing/">Housing &rarr;</a>
      <a href="/core/macro/real-economy/">Consumer &rarr;</a>
      <a href="/core/macro/regional/">Regional &rarr;</a>
    </div>
  `;
}
