// Inflation Persistence page controller.
//
// Decomposes the current inflation print into its durable vs. reversible
// components. Answers: "Is this inflation episode structural (sticky/wages/
// shelter) or cyclical (energy/goods/used cars)?"
//
// Same visual pattern as the cycle page: composite score hero, 4 analytical
// sections with charts + tiles + interpretation, synthesis.

import { computeInflationScore as shared_computeInflationScore, phaseFor as shared_phaseFor, renderMethodology as shared_renderMethodology, renderMethodology, synthesisHtml, ordinal, realWages as shared_realWages, shelterIndex } from '/lib/composite-scores.js';

const state = {
  series: {},
  recessionRanges: [],
};
const charts = {};

function el(id) { return document.getElementById(id); }
function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }
function setStatus(kind, text) {
  el('refresh-indicator').className = `dot ${kind}`;
  el('refresh-text').textContent = text;
}
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}
// Mean of a series over 2015-2019, the last stretch of low, stable inflation.
function avg1519(s) {
  const x = (s || []).filter(o => o.date >= '2015-01-01' && o.date <= '2019-12-31' && Number.isFinite(o.value));
  return x.length ? x.reduce((a, o) => a + o.value, 0) / x.length : null;
}
function latestValue(series) { return series && series.length ? series[series.length - 1] : null; }
function percentile(series, val) {
  if (!series || !series.length || !Number.isFinite(val)) return null;
  const sorted = series.map(o => o.value).filter(Number.isFinite).sort((a, b) => a - b);
  let lo = 0;
  for (let i = 0; i < sorted.length; i++) { if (sorted[i] <= val) lo = i + 1; else break; }
  return Math.round((lo / sorted.length) * 100);
}

// Year-over-year % change from a monthly INDEX-LEVEL series (e.g., CPIAUCSL).
function yoyPct(series) {
  const out = [];
  for (let i = 12; i < series.length; i++) {
    const cur = series[i].value, prev = series[i - 12].value;
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) continue;
    out.push({ date: series[i].date, value: (cur / prev - 1) * 100 });
  }
  return out;
}

// 6-month annualized change from monthly index-level series (captures momentum
// better than YoY which smears 12 months of base effects).
function sixMonthAnnualized(series) {
  const out = [];
  for (let i = 6; i < series.length; i++) {
    const cur = series[i].value, prev = series[i - 6].value;
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) continue;
    const ann = (Math.pow(cur / prev, 2) - 1) * 100;
    out.push({ date: series[i].date, value: ann });
  }
  return out;
}

// Align two monthly series by date: return [{date, a, b}].
function pairByDate(a, b) {
  const map = new Map(a.map(o => [o.date, o.value]));
  const out = [];
  for (const o of b) {
    if (map.has(o.date)) out.push({ date: o.date, a: map.get(o.date), b: o.value });
  }
  return out;
}

// NBER range loading + shading plugin (copied pattern from cycle.js).
async function loadRecessionRanges() {
  const j = await fetchJSON('/api/fred?series=USREC&start=1960-01-01');
  const obs = j.series[0]?.observations || [];
  const ranges = [];
  let inR = false, rs = null;
  for (const o of obs) {
    const v = Number(o.value);
    if (v === 1 && !inR) { rs = o.date; inR = true; }
    else if (v === 0 && inR) { ranges.push({ start: rs, end: o.date }); inR = false; }
  }
  if (inR && rs) ranges.push({ start: rs, end: obs[obs.length - 1].date });
  state.recessionRanges = ranges;
}
const nberShadingPlugin = {
  id: 'nberShading',
  beforeDatasetsDraw(chart, args, opts) {
    const ranges = opts?.ranges;
    if (!ranges || !ranges.length) return;
    const { ctx, chartArea: a, scales: s } = chart;
    if (!a || !s.x) return;
    ctx.save();
    ctx.fillStyle = 'rgba(239, 79, 90, 0.10)';
    for (const r of ranges) {
      const x1 = s.x.getPixelForValue(new Date(r.start).getTime());
      const x2 = s.x.getPixelForValue(new Date(r.end).getTime());
      if (x2 < a.left || x1 > a.right) continue;
      ctx.fillRect(Math.max(x1, a.left), a.top, Math.min(x2, a.right) - Math.max(x1, a.left), a.bottom - a.top);
    }
    ctx.restore();
  },
};

function thresholdLinePlugin(thresholds) {
  return {
    id: `thresholds-${Math.random().toString(36).slice(2)}`,
    afterDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales: s } = chart;
      if (!a) return;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      for (const t of thresholds) {
        const y = s.y.getPixelForValue(t.value);
        if (y < a.top || y > a.bottom) continue;
        ctx.strokeStyle = t.color || 'rgba(138, 148, 163, 0.5)';
        ctx.beginPath(); ctx.moveTo(a.left, y); ctx.lineTo(a.right, y); ctx.stroke();
        ctx.fillStyle = t.color || 'rgba(138, 148, 163, 0.8)';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(t.label, a.left + 4, y - 3);
      }
      ctx.restore();
    },
  };
}

function timeSeriesChart(canvas, datasets, opts = {}) {
  if (charts[canvas.id]) charts[canvas.id].destroy();
  const pluginOpts = { nberShading: { ranges: state.recessionRanges } };
  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#e5e9ee', font: { size: 11 }, boxWidth: 12 } },
      tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1 },
      ...pluginOpts,
    },
    scales: {
      x: { type: 'time', time: { unit: 'year' },
           grid: { color: 'rgba(255,255,255,0.04)' },
           ticks: { color: '#8a94a3', font: { size: 10 } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' },
           ticks: { color: '#8a94a3', font: { size: 10 }, callback: opts.yTicks },
           title: { display: !!opts.yTitle, text: opts.yTitle, color: '#8a94a3', font: { size: 11 } } },
    },
  };
  if (opts.yMin !== undefined) chartOpts.scales.y.min = opts.yMin;
  if (opts.yMax !== undefined) chartOpts.scales.y.max = opts.yMax;
  charts[canvas.id] = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { datasets },
    options: chartOpts,
    plugins: [nberShadingPlugin, ...(opts.extraPlugins || [])],
  });
  return charts[canvas.id];
}

function renderTiles(containerId, tiles) {
  const tgt = el(containerId);
  if (!tgt) return;
  tgt.innerHTML = tiles.map(t => {
    const statusClass = t.status ? `cycle-tile-${t.status}` : '';
    const metricAttr = t.metric ? ` data-tile-metric="${t.metric}"` : '';
    return `<div class="cycle-tile ${statusClass}"${metricAttr} title="${t.help || ''}">
      <div class="cycle-tile-label">${t.label}</div>
      <div class="cycle-tile-value">${t.value}</div>
      <div class="cycle-tile-meta">${t.meta || ''}</div>
      ${t.threshold ? `<div class="cycle-tile-threshold">${t.threshold}</div>` : ''}
    </div>`;
  }).join('');
}

// ---------- data load (batched, partial-failure tolerant) ----------

async function loadSeries() {
  const start = '1990-01-01';
  const batches = [
    ['CPIAUCSL', 'CPILFESL', 'PCEPILFE'],           // Section 1
    ['CORESTICKM159SFRBATL', 'COREFLEXCPIM159SFRBATL', 'CPIHOSSL', 'CUSR0000SAH1'],  // Section 2
    ['T5YIE', 'T10YIE', 'T5YIFR', 'MICH'],          // Section 3
    ['CES0500000003'],                               // Section 4
  ];
  const errors = [];
  for (const b of batches) {
    try {
      const j = await fetchJSON(`/api/fred?series=${b.join(',')}&start=${start}`);
      for (const s of j.series) state.series[s.id] = s.observations;
      if (j.errors && j.errors.length) errors.push(...j.errors);
    } catch (err) {
      console.warn(`Batch ${b.join(',')} failed entirely:`, err);
      errors.push({ id: b.join(','), error: String(err.message || err) });
    }
  }
  if (errors.length) console.warn('[inflation] missing series:', errors);

  // Precompute derived series.
  if (state.series.CPIAUCSL) state.series._headlineYoy = yoyPct(state.series.CPIAUCSL);
  if (state.series.CPILFESL) state.series._coreYoy     = yoyPct(state.series.CPILFESL);
  if (state.series.PCEPILFE) state.series._pceYoy      = yoyPct(state.series.PCEPILFE);
  if (state.series.CPILFESL) state.series._core6m      = sixMonthAnnualized(state.series.CPILFESL);
  state.shelterIsTrue = !!(state.series.CUSR0000SAH1 && state.series.CUSR0000SAH1.length);
  state.series._shelterYoy = yoyPct(shelterIndex(state.series));
  if (state.series.CES0500000003) state.series._wageYoy = yoyPct(state.series.CES0500000003);
  // Real wages = hourly earnings YoY minus headline CPI YoY (shared definition).
  state.series._realWages = shared_realWages(state.series);
}

// ---------- Section 1: Headline vs Core vs PCE ----------

function renderHeadlineSection() {
  const h = state.series._headlineYoy || [];
  const c = state.series._coreYoy     || [];
  const p = state.series._pceYoy      || [];

  timeSeriesChart(el('chart-headline'), [
    { label: 'Headline CPI YoY', data: h.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.1 },
    { label: 'Core CPI YoY', data: c.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', backgroundColor: 'rgba(247, 167, 0, 0.10)', borderWidth: 1.8, pointRadius: 0, fill: true, tension: 0.1 },
    { label: 'Core PCE YoY (Fed’s preferred gauge)', data: p.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#3ecf8e', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.1 },
  ], {
    yTitle: 'YoY (%)',
    extraPlugins: [thresholdLinePlugin([
      { value: 2, label: '2% — Fed target', color: 'rgba(62, 207, 142, 0.7)' },
    ])],
  });

  const lh = latestValue(h), lc = latestValue(c), lp = latestValue(p);
  const l6 = latestValue(state.series._core6m || []);
  const tiles = [
    {
      label: 'Headline CPI',
      value: lh ? `${fmt(lh.value, 1)}%` : '—',
      meta: lh ? `as of ${lh.date.slice(0, 7)}` : '',
      threshold: 'volatile — driven by food/energy',
      status: lh ? (Math.abs(lh.value - 2) < 0.5 ? 'ok' : Math.abs(lh.value - 2) < 1.5 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'CORE_CPI_YOY',
      label: 'Core CPI',
      value: lc ? `${fmt(lc.value, 1)}%` : '—',
      meta: lc ? `as of ${lc.date.slice(0, 7)}` : '',
      threshold: 'strips food/energy; market focus',
      status: lc ? (lc.value < 2.5 ? 'ok' : lc.value < 3.5 ? 'caution' : 'warn') : '',
    },
    {
      label: 'Core PCE (Fed’s preferred gauge)',
      value: lp ? `${fmt(lp.value, 1)}%` : '—',
      meta: lp ? `target: 2.0%` : '',
      threshold: '&gt; 2.5% = restrictive stance justified',
      status: lp ? (lp.value < 2.3 ? 'ok' : lp.value < 3.0 ? 'caution' : 'warn') : '',
    },
    {
      label: 'Core CPI 6m annualized',
      value: l6 ? `${fmt(l6.value, 1)}%` : '—',
      meta: 'momentum view (strips base effects)',
      threshold: '&lt; YoY = disinflation in progress',
      status: (l6 && lc) ? (l6.value < lc.value - 0.3 ? 'ok' : l6.value > lc.value + 0.3 ? 'warn' : 'caution') : '',
    },
  ];
  renderTiles('tiles-headline', tiles);

  let note = '<strong>Current read:</strong> ';
  if (lh && lc && lp) {
    const gap = lh.value - lc.value;
    if (Math.abs(gap) < 0.3)   note += `Headline and core converged at ${fmt((lh.value+lc.value)/2, 1)}% — food/energy no longer a net contributor. `;
    else if (gap > 0)          note += `Headline (${fmt(lh.value, 1)}%) running hotter than core (${fmt(lc.value, 1)}%) — energy/food pushing up total. `;
    else                       note += `Headline (${fmt(lh.value, 1)}%) below core (${fmt(lc.value, 1)}%) — energy/food deflationary. `;
    note += `Core PCE at ${fmt(lp.value, 1)}%, against the Fed's 2% goal for headline PCE. `;
    if (l6) {
      if (l6.value < lc.value - 0.3) note += `<em>6m annualized core (${fmt(l6.value, 1)}%) below YoY — disinflation trajectory intact.</em>`;
      else if (l6.value > lc.value + 0.3) note += `<em>6m annualized core (${fmt(l6.value, 1)}%) above YoY — inflation is re-accelerating.</em>`;
      else                                note += `6m annualized core tracking YoY — trend stable.`;
    }
  }
  el('note-headline').innerHTML = note;
}

// ---------- Section 2: Sticky vs Flexible ----------

function renderStickySection() {
  const sticky = state.series.CORESTICKM159SFRBATL || [];
  const flex   = state.series.COREFLEXCPIM159SFRBATL || [];
  const shelter = state.series._shelterYoy || [];

  timeSeriesChart(el('chart-sticky'), [
    { label: 'Sticky-Price Core CPI (YoY)', data: sticky.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#ef4f5a', backgroundColor: 'rgba(239, 79, 90, 0.10)', borderWidth: 1.8, pointRadius: 0, fill: true, tension: 0.1 },
    { label: 'Flex-Price Core CPI (YoY)', data: flex.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.1 },
    { label: state.shelterIsTrue ? 'Shelter CPI (YoY)' : 'Housing CPI (YoY)', data: shelter.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0.1 },
  ], {
    yTitle: 'YoY (%)',
    extraPlugins: [thresholdLinePlugin([
      { value: 2, label: '2% — target', color: 'rgba(62, 207, 142, 0.6)' },
    ])],
  });

  const ls = latestValue(sticky), lf = latestValue(flex), lsh = latestValue(shelter);
  const pctSticky = percentile(sticky.slice(-360), ls?.value); // last 30y of monthly obs

  const tiles = [
    {
      metric: 'STICKY_CPI',
      label: 'Sticky-Price Core CPI',
      value: ls ? `${fmt(ls.value, 1)}%` : '—',
      meta: pctSticky != null ? `${ordinal(pctSticky)} %ile past 30y` : '',
      threshold: avg1519(sticky) != null ? `2015–19 average ${fmt(avg1519(sticky), 1)}%` : '',
      status: ls ? (ls.value < 3 ? 'ok' : ls.value < 4 ? 'caution' : 'warn') : '',
      help: 'Atlanta Fed: CPI components whose prices change less often than about every 4.3 months, excluding food and energy.',
    },
    {
      label: 'Flex-Price Core CPI',
      value: lf ? `${fmt(lf.value, 1)}%` : '—',
      meta: 'volatile, reverses fast',
      threshold: 'rarely sticky beyond 6mo',
      status: lf ? (Math.abs(lf.value - 2) < 1.5 ? 'ok' : Math.abs(lf.value - 2) < 3 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'SHELTER_CPI',
      label: state.shelterIsTrue ? 'Shelter CPI' : 'Housing CPI',
      value: lsh ? `${fmt(lsh.value, 1)}%` : '—',
      meta: state.shelterIsTrue ? 'about 35% of CPI, 44% of core · lags market rents by 6-12mo' : 'shelter plus utilities and furnishings · about 44% of CPI',
      threshold: avg1519(shelter) != null ? `2015–19 average ${fmt(avg1519(shelter), 1)}%` : '',
      status: lsh ? (lsh.value < 3.5 ? 'ok' : lsh.value < 5 ? 'caution' : 'warn') : '',
    },
  ];
  renderTiles('tiles-sticky', tiles);

  let note = '<strong>Current read:</strong> ';
  if (ls && lf) {
    const diff = ls.value - lf.value;
    if (diff > 2)      note += `Sticky (${fmt(ls.value, 1)}%) materially above flexible (${fmt(lf.value, 1)}%) — the pressure is in slow-moving services and shelter prices, which respond slowly to policy. `;
    else if (diff > 0) note += `Sticky (${fmt(ls.value, 1)}%) moderately above flexible (${fmt(lf.value, 1)}%) — slow-moving prices are rising faster than fast-moving ones. `;
    else               note += `Flexible (${fmt(lf.value, 1)}%) above sticky (${fmt(ls.value, 1)}%) — the pressure is in fast-moving goods and energy prices, which tend to reverse. `;
    const shAvg = avg1519(shelter);
    if (lsh && shAvg != null) note += `${state.shelterIsTrue ? 'Shelter' : 'Housing'} inflation is ${fmt(lsh.value, 1)}%, ${lsh.value - shAvg > 1 ? 'well above' : lsh.value - shAvg > 0.3 ? 'above' : lsh.value - shAvg > -0.3 ? 'close to' : 'below'} its 2015–19 average of ${fmt(shAvg, 1)}%.`;
  } else {
    note += `Data loading or unavailable.`;
  }
  el('note-sticky').innerHTML = note;
}

// ---------- Section 3: Market expectations ----------

function renderExpectationsSection() {
  const be5 = state.series.T5YIE  || [];
  const be10 = state.series.T10YIE || [];
  const fwd = state.series.T5YIFR || [];
  const mich = state.series.MICH || [];

  timeSeriesChart(el('chart-expectations'), [
    { label: '5Y Breakeven', data: be5.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.1 },
    { label: '10Y Breakeven', data: be10.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.1 },
    { label: '5y5y Forward (Fed-watched)', data: fwd.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#3ecf8e', backgroundColor: 'rgba(62, 207, 142, 0.10)', borderWidth: 1.8, pointRadius: 0, fill: true, tension: 0.1 },
    { label: 'UMich 1y (consumer)', data: mich.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#ef4f5a', borderWidth: 1.3, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0.1 },
  ], {
    yTitle: 'expected inflation (%)',
    extraPlugins: [thresholdLinePlugin([
      { value: 2, label: '2% — Fed target', color: 'rgba(62, 207, 142, 0.6)' },
    ])],
  });

  const l5 = latestValue(be5), l10 = latestValue(be10), lf = latestValue(fwd), lm = latestValue(mich);
  const anchored = lf && Math.abs(lf.value - 2.3) < 0.4; // 5y5y typically sits near 2.3% when anchored

  const tiles = [
    {
      metric: 'T5YIE',
      label: '5Y Breakeven',
      value: l5 ? `${fmt(l5.value, 2)}%` : '—',
      meta: 'expected avg inflation, next 5yr',
      threshold: 'includes short-term base effects',
      status: l5 ? (Math.abs(l5.value - 2.3) < 0.3 ? 'ok' : Math.abs(l5.value - 2.3) < 0.6 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'T5YIFR',
      label: '5y5y Forward',
      value: lf ? `${fmt(lf.value, 2)}%` : '—',
      meta: 'years 5-10 — Fed-watched',
      threshold: 'anchored ≈ 2.2–2.5%; drift &gt; 2.7% = loss of credibility',
      status: lf ? (Math.abs(lf.value - 2.3) < 0.3 ? 'ok' : Math.abs(lf.value - 2.3) < 0.6 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'MICH',
      label: 'UMich 1y Expectation',
      value: lm ? `${fmt(lm.value, 1)}%` : '—',
      meta: 'consumer survey · noisy',
      threshold: 'tracks grocery/gas prices as much as policy',
      status: lm ? (lm.value < 3.5 ? 'ok' : lm.value < 4.5 ? 'caution' : 'warn') : '',
    },
  ];
  renderTiles('tiles-expectations', tiles);

  let note = '<strong>Current read:</strong> ';
  if (lf) {
    if (anchored)                    note += `5y5y forward at ${fmt(lf.value, 2)}% — long-run expectations <strong>anchored</strong> near the Fed's 2% target. Policy credibility intact. `;
    else if (lf.value > 2.7)         note += `5y5y forward at ${fmt(lf.value, 2)}% — <strong>unanchored</strong>; market pricing a structurally higher inflation regime through the next decade. This is the nightmare scenario for the Fed. `;
    else if (lf.value < 1.7)         note += `5y5y forward at ${fmt(lf.value, 2)}% — deflation / secular-stagnation pricing. Not the current regime concern. `;
    else                              note += `5y5y forward at ${fmt(lf.value, 2)}% — within range but softer than typical anchored readings. `;
  }
  if (lm) {
    if (lm.value > 4.5)              note += `UMich 1y consumer expectation at ${fmt(lm.value, 1)}% — consumer perception well above market pricing. Historically consumer expectations are noisier but DO matter for wage negotiations.`;
    else                              note += `UMich 1y at ${fmt(lm.value, 1)}%.`;
  }
  el('note-expectations').innerHTML = note;
}

// ---------- Section 4: Wages ----------

function renderWagesSection() {
  const wage = state.series._wageYoy   || [];
  const real = state.series._realWages || [];

  timeSeriesChart(el('chart-wages'), [
    { label: 'Avg Hourly Earnings (YoY)', data: wage.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', backgroundColor: 'rgba(247, 167, 0, 0.10)', borderWidth: 1.8, pointRadius: 0, fill: true, tension: 0.1 },
    { label: 'Real wages (AHE − CPI)', data: real.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#3ecf8e', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.1 },
  ], {
    yTitle: 'YoY (%)',
    extraPlugins: [thresholdLinePlugin([
      { value: 0, label: '0% — real-wage breakeven', color: 'rgba(138, 148, 163, 0.6)' },
      { value: 3.5, label: '3.5% — roughly 2% inflation plus trend productivity', color: 'rgba(62, 207, 142, 0.5)' },
    ])],
  });

  const lw = latestValue(wage), lr = latestValue(real);
  const tiles = [
    {
      metric: 'AHE_YOY',
      label: 'Nominal wage growth (AHE)',
      value: lw ? `${fmt(lw.value, 1)}%` : '—',
      meta: 'private sector YoY',
      threshold: 'about 3.5% is consistent with 2% inflation at trend productivity',
      status: lw ? (lw.value < 3.5 ? 'ok' : lw.value < 4.5 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'REAL_WAGES',
      label: 'Real wages',
      value: lr ? `${lr.value >= 0 ? '+' : ''}${fmt(lr.value, 1)}%` : '—',
      meta: 'hourly earnings YoY − CPI YoY',
      threshold: '&gt; 0% = purchasing power rising',
      status: lr ? (lr.value > 0.5 ? 'ok' : lr.value > -0.5 ? 'caution' : 'warn') : '',
    },
  ];
  renderTiles('tiles-wages', tiles);

  let note = '<strong>Current read:</strong> ';
  if (lw) {
    if (lw.value > 4.5)          note += `Wage growth at ${fmt(lw.value, 1)}% — faster than is consistent with 2% inflation unless productivity accelerates. `;
    else if (lw.value > 3.5)     note += `Wage growth at ${fmt(lw.value, 1)}% — a little above the roughly 3.5% consistent with 2% inflation at trend productivity. `;
    else                         note += `Wage growth at ${fmt(lw.value, 1)}% — consistent with 2% inflation at trend productivity. `;
  }
  if (lr) {
    if (lr.value > 1)            note += `<em>Real wages positive (${lr.value >= 0 ? '+' : ''}${fmt(lr.value, 1)}%)</em>: pay is outpacing prices.`;
    else if (lr.value > 0)       note += `Real wages modestly positive (${lr.value >= 0 ? '+' : ''}${fmt(lr.value, 1)}%).`;
    else                         note += `<em>Real wages negative (${fmt(lr.value, 1)}%)</em>: prices are outpacing pay.`;
  }
  el('note-wages').innerHTML = note;
}

// ---------- Persistence score ----------
//
// 0 = pure disinflation momentum / transitory; 100 = entrenched inflation.
// Weighted combination of five signals, each mapped to a 0-100 subscore.

// Single implementation: lib/composite-scores.js (percentile-based, point-in-time).
function computePersistenceScore() {
  return shared_computeInflationScore(state.series);
}

function renderPersistenceScore() {
  const result = computePersistenceScore();
  const tgt = el('persistence-score-section');
  if (!tgt || !result) { if (tgt) tgt.innerHTML = ''; return; }

  const score = result.score;
  const { label: phase, color } = shared_phaseFor('inflation', score);

  const bars = result.signals.map(s => {
    const sevColor = s.score < 33 ? '#3ecf8e' : s.score < 66 ? '#f7a700' : '#ef4f5a';
    return `<div class="cs-signal">
      <div class="cs-signal-name">${s.name}</div>
      <div class="cs-signal-bar"><div class="cs-signal-fill" style="width:${s.score.toFixed(0)}%;background:${sevColor}"></div></div>
      <div class="cs-signal-value">${s.raw}</div>
    </div>`;
  }).join('');

  tgt.innerHTML = `
    <div class="cs-score-card">
      <div class="cs-score-dial" style="--cs-color:${color}">
        <div class="cs-score-label">INFLATION PERSISTENCE SCORE</div>
        <div class="cs-score-value">${score.toFixed(0)}<span class="cs-score-scale">/100</span></div>
        <div class="cs-score-phase" style="color:${color}">${phase}</div>
        <div class="cs-score-desc">0 = disinflation momentum (transitory forces dominate); 100 = entrenched inflation (structural drivers dominate).</div>
      </div>
      <div class="cs-signals">
        <div class="cs-signals-title">Component readings</div>
        ${bars}
        <div class="cs-weights-note">Each signal is scored as its percentile within its own last 20 years (100 = most risk); weights and transforms under "How this score is built".${result.stale && result.stale.length ? " Stale input: " + result.stale.join(", ") + "." : ""}</div>
      </div>
    </div>
  `;
  // The weights were already visible; the 0-100 anchors behind each signal
  // were not. A reader cannot argue with a mapping they cannot see.
  renderMethodology(tgt, 'inflation');
}

// ---------- Synthesis ----------

function renderSynthesis() {
  const result = computePersistenceScore();
  const tgt = el('inflation-synthesis-content');
  if (!tgt || !result) return;

  const paragraph = synthesisHtml('inflation', state.series, result);

  tgt.innerHTML = `<p class="cycle-synthesis-para">${paragraph}</p>
    <div class="cycle-synthesis-links">
      Related views:
      <a href="/macro/regime/">Regime returns table &rarr;</a>
      <a href="/macro/cycle/">Cycle position &rarr;</a>
      <a href="/macro/indicators/">Indicator library &rarr;</a>
    </div>`;
}

// ---------- main ----------

async function main() {
  try {
    setStatus('stale', 'Loading inflation data…');
    await Promise.all([loadRecessionRanges(), loadSeries()]);

    renderPersistenceScore();
    renderHeadlineSection();
    renderStickySection();
    renderExpectationsSection();
    renderWagesSection();
    renderSynthesis();

    el('last-updated').textContent = `Fetched ${new Date().toLocaleString()} \u2014 series carry their own observation dates`;
    setStatus('live', 'Snapshot data');
  } catch (err) {
    console.error(err);
    setStatus('error', `Error: ${err.message}`);
  }
}

main();


// ---------- per-page export hook (T16.6) ----------
// Wires window.__downloadPageData so the universal "Download data" button can
// export THIS page's in-memory series as a wide-format CSV.
import('/lib/csv-export.js').then(({ seriesToCSV }) => {
  window.__downloadPageData = (btn) => {
    if (btn) { btn.disabled = true; const orig = btn.textContent; btn.textContent = 'Exporting…'; setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500); }
    const series = [];
    for (const [id, obs] of Object.entries(state.series || {})) {
      if (id.startsWith('_')) continue;
      if (Array.isArray(obs) && obs.length) {
        series.push({ id, label: id, observations: obs });
      }
    }
    if (!series.length) { alert('No data loaded yet — wait for the page to finish loading.'); return; }
    seriesToCSV('siberforge-inflation.csv', series);
  };
}).catch(err => console.warn('export hook load failed:', err));
