// Economic Indicators dashboard — controller.
//
// Responsibilities:
//   1. Render skeleton cards for all indicators.
//   2. Batch-fetch FRED series in parallel with the release calendar.
//   3. Apply per-indicator transforms; cache transformed series for derivation.
//   4. Compute 'derived' indicators (real wages) from the cache.
//   5. Render release-calendar chip strip above the grid.
//   6. Per-card error handling — one failure doesn't wipe the page.

import { INDICATORS, INDICATORS_BY_CATEGORY } from './indicators.js';
import { renderSparkline, renderContextStrip } from './sparklines.js';
import { renderReleaseStrip } from './releases.js';

const BATCH_SIZE = 8;              // max series per /api/fred call
const HISTORY_START = '2017-01-01'; // enough runway for 5yr YoY windows

const state = {
  loaded: 0,
  failed: 0,
  // Cache transformed observations by indicator id — used by 'derived' sources.
  transformed: {},
};

// ============================================================================
// DOM helpers
// ============================================================================
const $ = (id) => document.getElementById(id);

function setStatus(cls, text) {
  const dot = $('status-dot');
  dot.classList.remove('live', 'stale', 'error');
  if (cls) dot.classList.add(cls);
  $('status-text').textContent = text;
}

// ============================================================================
// Formatters
// ============================================================================
function fmt(value, decimals = 1) {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtSigned(value, decimals = 1) {
  if (!Number.isFinite(value)) return '—';
  const s = fmt(Math.abs(value), decimals);
  return value >= 0 ? `+${s}` : `−${s}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // "2026-03-14" → "Mar 2026"
  const isoMatch = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(String(iso).trim());
  if (isoMatch) {
    const y = isoMatch[1];
    const m = Number(isoMatch[2]);
    if (m >= 1 && m <= 12) return `${months[m - 1]} ${y}`;
  }
  // Accept other formats as-is (e.g. "Mar 2026", "2026 Q1")
  return String(iso);
}

// ============================================================================
// Transforms
// ============================================================================
// Each transform takes an ascending-by-date observations array and returns a
// new observations array with the transformed values. Observations that can't
// be transformed (no lookback) are dropped — so the result is shorter than input.

function transformLevel(obs) {
  return obs.map(o => ({ date: o.date, value: o.value }));
}

function transformLevelK(obs) {
  // Display in thousands (divide raw by 1000)
  return obs.map(o => ({ date: o.date, value: o.value / 1000 }));
}

function transformLevelBps(obs) {
  // Display in basis points (multiply raw % by 100)
  return obs.map(o => ({ date: o.date, value: o.value * 100 }));
}

function transformYoy(obs) {
  // Align by looking back approximately 12 months by date.
  // FRED returns observations at native frequency — monthly series have ~12
  // obs per year, weekly have ~52. Rather than compute by index, pair each
  // observation with the one whose date is closest to 365 days earlier.
  const dates = obs.map(o => new Date(o.date).getTime());
  const out = [];
  for (let i = 0; i < obs.length; i++) {
    const target = dates[i] - 365 * 24 * 3600 * 1000;
    // Binary search is overkill for ~200 points; linear scan is fine.
    let j = -1;
    for (let k = i - 1; k >= 0; k--) {
      if (dates[k] <= target) { j = k; break; }
    }
    if (j < 0) continue;
    const prior = obs[j].value;
    if (prior === 0 || !Number.isFinite(prior)) continue;
    const v = (obs[i].value / prior - 1) * 100;
    out.push({ date: obs[i].date, value: v });
  }
  return out;
}

function transformMomDiff(obs) {
  const out = [];
  for (let i = 1; i < obs.length; i++) {
    out.push({ date: obs[i].date, value: obs[i].value - obs[i - 1].value });
  }
  return out;
}

// MoM diff expressed in thousands (e.g. PAYEMS: series in thousands of persons,
// so raw diff is already thousands — but we keep the explicit transform for clarity)
function transformMomDiffK(obs) {
  return transformMomDiff(obs);
}

const TRANSFORMS = {
  'level':        transformLevel,
  'level_k':      transformLevelK,
  'level_bps':    transformLevelBps,
  'yoy':          transformYoy,
  'mom_diff':     transformMomDiff,
  'mom_diff_k':   transformMomDiffK,
};

function applyTransform(obs, transform) {
  const fn = TRANSFORMS[transform];
  if (!fn) {
    console.warn(`Unknown transform: ${transform}`);
    return obs;
  }
  return fn(obs);
}

// ============================================================================
// Historical slicing
// ============================================================================
// Keep last 5 years of transformed observations. Returns the slice.
function lastNYears(obs, years = 5) {
  if (obs.length === 0) return [];
  const lastDate = new Date(obs[obs.length - 1].date).getTime();
  const cutoff = lastDate - years * 365 * 24 * 3600 * 1000;
  return obs.filter(o => new Date(o.date).getTime() >= cutoff);
}

// ============================================================================
// Sentiment classification (for color coding the delta)
// ============================================================================
function changeSentiment(delta, direction) {
  if (!Number.isFinite(delta) || delta === 0) return 'neutral';
  if (direction === 'neutral' || direction === 'target_band') return 'neutral';
  if (direction === 'higher_better') return delta > 0 ? 'up' : 'down';
  if (direction === 'lower_better')  return delta > 0 ? 'down' : 'up';
  return 'neutral';
}

// ============================================================================
// Card rendering
// ============================================================================
function buildSkeletonCards() {
  for (const [cat, inds] of Object.entries(INDICATORS_BY_CATEGORY)) {
    const grid = $(`grid-${cat}`);
    if (!grid) continue;

    for (const ind of inds) {
      const card = document.createElement('div');
      card.className = 'card loading';
      card.dataset.cat = ind.category;
      card.dataset.id = ind.id;
      if (ind.placeholder) card.classList.add('placeholder');

      const badge = ind.placeholder
        ? 'Phase 3'
        : ind.source === 'nowcast' ? 'Nowcast'
        : ind.source === 'derived' ? 'Derived'
        : ind.id;
      const idHint = ind.fredId || ind.id;
      const sparkBlock = ind.cardType === 'compact'
        ? ''
        : `<div class="card-spark"></div>
           <div class="card-context">
             <div class="strip"></div>
             <span class="pctl">—</span>
           </div>`;

      card.innerHTML = `
        <div class="card-header">
          <span class="card-label" title="${idHint}">${ind.shortLabel}</span>
          <span class="card-badge">${badge}</span>
        </div>
        <div class="card-value">
          <span class="primary">—</span><span class="unit">${ind.unit}</span>
        </div>
        <div class="card-change">
          <span class="delta neutral">—</span>
          <span class="as-of"></span>
        </div>
        ${sparkBlock}
        <div class="card-note">${ind.context}</div>
      `;

      // Click-through to future drill-down (Phase 3)
      if (!ind.placeholder) {
        card.addEventListener('click', () => {
          // Phase 3 will implement ?id=ID drill-down page
          console.log(`Drill-down (not yet wired): ${ind.id}`);
        });
      }

      grid.appendChild(card);
    }

    $(`count-${cat}`).textContent = `${inds.length} indicator${inds.length === 1 ? '' : 's'}`;
  }
}

function populateCard(ind, observations) {
  const card = document.querySelector(`.card[data-id="${ind.id}"]`);
  if (!card) return;
  card.classList.remove('loading');

  if (!observations || observations.length === 0) {
    renderCardError(ind, 'No data returned');
    return;
  }

  // Transform
  let transformed;
  try {
    transformed = applyTransform(observations, ind.transform);
  } catch (err) {
    renderCardError(ind, `Transform failed: ${err.message}`);
    return;
  }

  if (transformed.length < 2) {
    renderCardError(ind, 'Insufficient history');
    return;
  }

  // Cache transformed series for derived indicators to consume.
  state.transformed[ind.id] = transformed;

  renderCardFromTransformed(ind, transformed);
}

/**
 * Render a standard card from an already-transformed series. Used by both
 * the FRED fetch path (after applyTransform) and the 'derived' path
 * (where deriveFn returns a ready series).
 */
function renderCardFromTransformed(ind, transformed) {
  const card = document.querySelector(`.card[data-id="${ind.id}"]`);
  if (!card) return;
  card.classList.remove('loading');

  // Slice last 5yr for spark + percentile
  const recent = lastNYears(transformed, 5);
  if (recent.length < 2) {
    renderCardError(ind, 'Insufficient recent data');
    return;
  }

  const latest = recent[recent.length - 1];
  const prior  = recent[recent.length - 2];
  const latestValue = latest.value;
  const delta = latestValue - prior.value;

  // Update primary value
  card.querySelector('.card-value .primary').textContent = fmt(latestValue, ind.decimals);

  // Delta meaning depends on transform:
  //   - mom_diff / mom_diff_k  → latest value IS the monthly change; compare to 3mo avg
  //   - yoy                    → show change in YoY rate vs prior period (ppt)
  //   - level and level_*      → change vs prior period (raw units)
  let deltaForSentiment = delta;
  let deltaText;
  if (ind.transform === 'mom_diff' || ind.transform === 'mom_diff_k') {
    const window3 = recent.slice(-4, -1);
    const avg3 = window3.length
      ? window3.reduce((s, o) => s + o.value, 0) / window3.length
      : NaN;
    const vs3 = latestValue - avg3;
    deltaForSentiment = vs3;
    deltaText = Number.isFinite(vs3) ? `${fmtSigned(vs3, 0)}${ind.unit} vs 3mo avg` : '—';
  } else if (ind.transform === 'yoy') {
    deltaText = `${fmtSigned(delta, 2)}ppt MoM`;
  } else {
    deltaText = `${fmtSigned(delta, ind.decimals)}${ind.unit}`;
  }

  const changeEl = card.querySelector('.card-change .delta');
  const asOfEl   = card.querySelector('.card-change .as-of');
  changeEl.textContent = deltaText;
  const sent = changeSentiment(deltaForSentiment, ind.direction);
  changeEl.classList.remove('up', 'down', 'neutral');
  changeEl.classList.add(sent);

  // As-of
  asOfEl.textContent = `as of ${fmtDate(latest.date)}`;

  // Sparkline — uses raw transformed slice, color derived from category accent
  const catColor = {
    growth: '#3b82f6', inflation: '#ef4444', consumer: '#10b981', housing: '#a855f7',
  }[ind.category] || '#e5e9ee';

  const sparkEl = card.querySelector('.card-spark');
  renderSparkline(sparkEl, recent, {
    width: 248, height: 36,
    stroke: catColor,
    zeroLine: true,
    fill: true,
  });

  // Context strip
  const stripEl = card.querySelector('.card-context .strip');
  const pctlEl  = card.querySelector('.card-context .pctl');
  const historyValues = recent.slice(0, -1).map(o => o.value);
  renderContextStrip(stripEl, latestValue, historyValues, {
    width: 180,
    height: 10,
    direction: ind.direction,
    target: ind.target,
  });
  const pctl = stripEl.dataset.percentile;
  pctlEl.textContent = pctl != null ? `${pctl}th pctl` : '';

  state.loaded++;
}

function renderCardError(ind, msg) {
  const card = document.querySelector(`.card[data-id="${ind.id}"]`);
  if (!card) return;
  card.classList.remove('loading');
  card.classList.add('error');
  card.querySelector('.card-value .primary').textContent = 'err';
  card.querySelector('.card-change .delta').textContent = msg;
  card.querySelector('.card-change .delta').classList.add('neutral');
  state.failed++;
}

// ============================================================================
// Fetch
// ============================================================================
async function fetchBatch(indicators) {
  const ids = indicators.map(i => i.fredId).join(',');
  const url = `/api/fred?series=${ids}&start=${HISTORY_START}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.series || [];
}

function computeDerived() {
  const derivedInds = INDICATORS.filter(i => i.source === 'derived');
  for (const ind of derivedInds) {
    try {
      const deps = {};
      let missing = false;
      for (const depId of ind.dependsOn || []) {
        if (!state.transformed[depId]) { missing = true; break; }
        deps[depId] = state.transformed[depId];
      }
      if (missing) {
        renderCardError(ind, 'Missing dependency');
        continue;
      }
      const series = ind.deriveFn(deps);
      if (!series || series.length < 2) {
        renderCardError(ind, 'Not enough derived data');
        continue;
      }
      state.transformed[ind.id] = series;
      renderCardFromTransformed(ind, series);
    } catch (err) {
      console.error(`Derive failed for ${ind.id}:`, err);
      renderCardError(ind, 'Derive failed');
    }
  }
}

async function loadFredSeries() {
  const fredInds = INDICATORS.filter(i => i.source === 'fred');

  const batches = [];
  for (let i = 0; i < fredInds.length; i += BATCH_SIZE) {
    batches.push(fredInds.slice(i, i + BATCH_SIZE));
  }

  await Promise.all(batches.map(async (batch) => {
    try {
      const results = await fetchBatch(batch);
      const byId = Object.fromEntries(results.map(r => [r.id, r]));
      for (const ind of batch) {
        const payload = byId[ind.fredId];
        if (!payload) {
          renderCardError(ind, 'Missing in response');
          continue;
        }
        populateCard(ind, payload.observations);
      }
    } catch (err) {
      for (const ind of batch) renderCardError(ind, 'Fetch failed');
      console.error('Batch failed:', err);
    }
  }));
}

async function loadAll() {
  // Kick off release strip in parallel with data fetches (non-blocking)
  const stripEl = $('release-strip');
  if (stripEl) renderReleaseStrip(stripEl).catch(err => console.error('Strip failed:', err));

  // FRED batches
  await loadFredSeries();

  // Derived indicators depend on transformed FRED data being ready
  computeDerived();

  // Status summary
  const totalReal = INDICATORS.filter(i => !i.placeholder).length;
  if (state.failed === 0) {
    setStatus('live', `All ${totalReal} indicators loaded`);
  } else if (state.loaded > 0) {
    setStatus('stale', `${state.loaded}/${totalReal} loaded · ${state.failed} errors`);
  } else {
    setStatus('error', 'No data loaded');
  }
  const now = new Date();
  $('last-updated').textContent = `Last refresh: ${now.toLocaleString()}.`;
}

// ============================================================================
// Main
// ============================================================================
function main() {
  buildSkeletonCards();
  setStatus('stale', 'Fetching series…');
  loadAll().catch(err => {
    console.error(err);
    setStatus('error', `Load failed: ${err.message}`);
  });
}

main();
