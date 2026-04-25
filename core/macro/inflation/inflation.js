// Inflation Persistence page controller.
//
// Decomposes the current inflation print into its durable vs. reversible
// components. Answers: "Is this inflation episode structural (sticky/wages/
// shelter) or cyclical (energy/goods/used cars)?"
//
// Same visual pattern as the cycle page: composite score hero, 4 analytical
// sections with charts + tiles + interpretation, synthesis.

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
    ['CORESTICKM159SFRBATL', 'COREFLEXCPIM159SFRBATL', 'CPIHOSSL'],  // Section 2
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
  if (state.series.CPIHOSSL) state.series._shelterYoy  = yoyPct(state.series.CPIHOSSL);
  if (state.series.CES0500000003) state.series._wageYoy = yoyPct(state.series.CES0500000003);
  // Real wages = AHE YoY - Core CPI YoY (aligned by date)
  if (state.series._wageYoy && state.series._coreYoy) {
    const coreMap = new Map(state.series._coreYoy.map(o => [o.date, o.value]));
    state.series._realWages = state.series._wageYoy
      .filter(o => coreMap.has(o.date))
      .map(o => ({ date: o.date, value: o.value - coreMap.get(o.date) }));
  }
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
    { label: 'Core PCE YoY (Fed target)', data: p.map(o => ({ x: o.date, y: o.value })),
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
      label: 'Core PCE (Fed target)',
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
    note += `Core PCE at ${fmt(lp.value, 1)}% (Fed target 2.0%). `;
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
    { label: 'Shelter CPI (YoY)', data: shelter.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', borderWidth: 1.5, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0.1 },
  ], {
    yTitle: 'YoY (%)',
    extraPlugins: [thresholdLinePlugin([
      { value: 2, label: '2% — target', color: 'rgba(62, 207, 142, 0.6)' },
    ])],
  });

  const ls = latestValue(sticky), lf = latestValue(flex), lsh = latestValue(shelter);
  const pctSticky = percentile(sticky.slice(-360), ls?.value); // 30y context

  const tiles = [
    {
      metric: 'STICKY_CPI',
      label: 'Sticky-Price Core CPI',
      value: ls ? `${fmt(ls.value, 1)}%` : '—',
      meta: pctSticky != null ? `${pctSticky}th %ile past 30y` : '',
      threshold: '&lt; 3% = Fed can cut; &gt; 4% = structural problem',
      status: ls ? (ls.value < 3 ? 'ok' : ls.value < 4 ? 'caution' : 'warn') : '',
      help: 'Atlanta Fed: basket components that reprice annually or less often.',
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
      label: 'Shelter CPI',
      value: lsh ? `${fmt(lsh.value, 1)}%` : '—',
      meta: '~35% of core basket · lags real rents by 6-12mo',
      threshold: 'rolling over = sticky will follow',
      status: lsh ? (lsh.value < 3.5 ? 'ok' : lsh.value < 5 ? 'caution' : 'warn') : '',
    },
  ];
  renderTiles('tiles-sticky', tiles);

  let note = '<strong>Current read:</strong> ';
  if (ls && lf) {
    const diff = ls.value - lf.value;
    if (diff > 2)      note += `Sticky (${fmt(ls.value, 1)}%) materially above flexible (${fmt(lf.value, 1)}%) — the inflation problem is services/shelter, not goods. Fed can't fix this with rate cuts; requires sustained restrictive policy. `;
    else if (diff > 0) note += `Sticky (${fmt(ls.value, 1)}%) moderately above flexible (${fmt(lf.value, 1)}%) — disinflation is progressing but slowly on the services side. `;
    else               note += `Flexible (${fmt(lf.value, 1)}%) above sticky (${fmt(ls.value, 1)}%) — inflation driver is reversible goods/energy, not structural. `;
    if (lsh) note += `<em>Shelter at ${fmt(lsh.value, 1)}% ${lsh.value > 4 ? '— still well above trend, expect it to feed sticky for another 6-12 months' : lsh.value > 3 ? '— normalizing' : '— at or below trend'}.</em>`;
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
    { label: 'Real Wages (AHE − Core CPI)', data: real.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#3ecf8e', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.1 },
  ], {
    yTitle: 'YoY (%)',
    extraPlugins: [thresholdLinePlugin([
      { value: 0, label: '0% — real-wage breakeven', color: 'rgba(138, 148, 163, 0.6)' },
      { value: 3.5, label: '3.5% — Fed comfort for nominal wages', color: 'rgba(62, 207, 142, 0.5)' },
    ])],
  });

  const lw = latestValue(wage), lr = latestValue(real);
  const tiles = [
    {
      metric: 'AHE_YOY',
      label: 'Nominal wage growth (AHE)',
      value: lw ? `${fmt(lw.value, 1)}%` : '—',
      meta: 'private sector YoY',
      threshold: '&gt; 4% = hard to achieve 2% core inflation',
      status: lw ? (lw.value < 3.5 ? 'ok' : lw.value < 4.5 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'REAL_WAGES',
      label: 'Real wages',
      value: lr ? `${lr.value >= 0 ? '+' : ''}${fmt(lr.value, 1)}%` : '—',
      meta: 'nominal AHE − Core CPI',
      threshold: '&gt; 0% = purchasing power rising',
      status: lr ? (lr.value > 0.5 ? 'ok' : lr.value > -0.5 ? 'caution' : 'warn') : '',
    },
  ];
  renderTiles('tiles-wages', tiles);

  let note = '<strong>Current read:</strong> ';
  if (lw) {
    if (lw.value > 4.5)          note += `Wage growth at ${fmt(lw.value, 1)}% — incompatible with 2% core inflation unless productivity accelerates. Services pricing pressure persists. `;
    else if (lw.value > 3.5)     note += `Wage growth at ${fmt(lw.value, 1)}% — above Fed's comfort zone (~3-3.5% is the consistent-with-2%-inflation threshold). `;
    else                         note += `Wage growth at ${fmt(lw.value, 1)}% — consistent with 2% core inflation. `;
  }
  if (lr) {
    if (lr.value > 1)            note += `<em>Real wages positive (${lr.value >= 0 ? '+' : ''}${fmt(lr.value, 1)}%)</em> — consumer spending power rising, supportive of demand.`;
    else if (lr.value > 0)       note += `Real wages modestly positive (${lr.value >= 0 ? '+' : ''}${fmt(lr.value, 1)}%).`;
    else                         note += `<em>Real wages negative (${fmt(lr.value, 1)}%)</em> — historical precursor to demand destruction (which ultimately breaks the inflation cycle).`;
  }
  el('note-wages').innerHTML = note;
}

// ---------- Persistence score ----------
//
// 0 = pure disinflation momentum / transitory; 100 = entrenched inflation.
// Weighted combination of five signals, each mapped to a 0-100 subscore.

function computePersistenceScore() {
  const signals = [];

  // Sticky CPI (weight 0.30) — primary persistence indicator
  const ls = latestValue(state.series.CORESTICKM159SFRBATL);
  if (ls) {
    const score = Math.min(100, Math.max(0, ((ls.value - 2) / 3) * 100)); // 2% -> 0, 5% -> 100
    signals.push({ name: 'Sticky-Price Core CPI', score, weight: 0.30, raw: `${fmt(ls.value, 1)}%` });
  }

  // 5y5y breakeven (weight 0.20) — market view on persistence
  const lf = latestValue(state.series.T5YIFR);
  if (lf) {
    const score = Math.min(100, Math.max(0, ((lf.value - 1.8) / 1.2) * 100)); // 1.8% -> 0, 3.0% -> 100
    signals.push({ name: '5y5y Forward Breakeven', score, weight: 0.20, raw: `${fmt(lf.value, 2)}%` });
  }

  // Core CPI 6m annualized momentum (weight 0.20) — is it flowing or stuck?
  const l6 = latestValue(state.series._core6m || []);
  if (l6) {
    const score = Math.min(100, Math.max(0, ((l6.value - 2) / 3) * 100));
    signals.push({ name: 'Core CPI 6m annualized', score, weight: 0.20, raw: `${fmt(l6.value, 1)}%` });
  }

  // Wage growth (weight 0.15) — services feeder
  const lw = latestValue(state.series._wageYoy || []);
  if (lw) {
    const score = Math.min(100, Math.max(0, ((lw.value - 3) / 2) * 100)); // 3% -> 0, 5% -> 100
    signals.push({ name: 'Wage growth (AHE)', score, weight: 0.15, raw: `${fmt(lw.value, 1)}%` });
  }

  // Shelter CPI (weight 0.15) — largest services category, lags slowly
  const lsh = latestValue(state.series._shelterYoy || []);
  if (lsh) {
    const score = Math.min(100, Math.max(0, ((lsh.value - 3) / 3) * 100)); // 3% -> 0, 6% -> 100
    signals.push({ name: 'Shelter CPI', score, weight: 0.15, raw: `${fmt(lsh.value, 1)}%` });
  }

  if (!signals.length) return null;
  const totalW = signals.reduce((s, n) => s + n.weight, 0);
  const weighted = signals.reduce((s, n) => s + n.score * n.weight, 0) / totalW;
  return { score: weighted, signals };
}

function renderPersistenceScore() {
  const result = computePersistenceScore();
  const tgt = el('persistence-score-section');
  if (!tgt || !result) { if (tgt) tgt.innerHTML = ''; return; }

  const score = result.score;
  let phase, color;
  if (score < 25)      { phase = 'Disinflationary';      color = '#3ecf8e'; }
  else if (score < 45) { phase = 'Normalizing';          color = '#5a9cff'; }
  else if (score < 65) { phase = 'Sticky';               color = '#f7a700'; }
  else if (score < 80) { phase = 'Persistent';           color = '#ef4f5a'; }
  else                 { phase = 'Accelerating';         color = '#ef4f5a'; }

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
        <div class="cs-weights-note">Weights: Sticky 30% · 5y5y fwd 20% · Core 6m 20% · Wages 15% · Shelter 15%.</div>
      </div>
    </div>
  `;
}

// ---------- Synthesis ----------

function renderSynthesis() {
  const result = computePersistenceScore();
  const tgt = el('inflation-synthesis-content');
  if (!tgt || !result) return;

  const score = result.score;
  let paragraph = '';
  if (score < 25) {
    paragraph = `Persistence composite at <strong>${score.toFixed(0)}/100</strong> — <strong>disinflation momentum dominates</strong>. Sticky and market-priced expectations are both contained; wage growth is within Fed-consistent range. Positioning implication: duration overweight, growth/tech favored, long-duration bond-proxy sectors (utilities, REITs) work. The Fed path is clear — further cuts appropriate. <em>Watch:</em> a re-acceleration in 6m annualized core CPI would be the first flag to change this view.`;
  } else if (score < 45) {
    paragraph = `Persistence composite at <strong>${score.toFixed(0)}/100</strong> — <strong>normalizing toward target</strong>. Most signals are in the constructive half of the range but sticky or shelter components are above target. Positioning: balanced duration, modest growth tilt, keep an eye on services inflation. The Fed has runway for measured cuts but isn't racing. <em>Watch:</em> sticky-CPI above 3.5% would pause the normalization story.`;
  } else if (score < 65) {
    paragraph = `Persistence composite at <strong>${score.toFixed(0)}/100</strong> — <strong>sticky regime</strong>. Services, wages, and shelter are materially above target and showing limited improvement. The Fed can't cut aggressively without losing credibility; any cuts are tactical, not structural. Positioning: underweight duration, tilt toward value and real-asset beneficiaries (energy, materials), avoid long-duration growth. <em>Watch:</em> a break below 3% on sticky CPI would materially shift this view.`;
  } else if (score < 80) {
    paragraph = `Persistence composite at <strong>${score.toFixed(0)}/100</strong> — <strong>persistent regime</strong>. Multiple structural components are well above target and not moderating. Historical episodes (late 1970s, 2022) show this regime requires sustained restrictive policy and creates material equity drawdowns. Positioning: defensive equity (staples, healthcare), energy overweight, commodities, short duration. Avoid long-duration growth and interest-rate-sensitive sectors. <em>Watch:</em> the Fed's willingness to stay restrictive despite growth slowdown is the key variable.`;
  } else {
    paragraph = `Persistence composite at <strong>${score.toFixed(0)}/100</strong> — <strong>re-accelerating / unanchored</strong>. This is the 1970s-style regime, or a new supply-shock episode. All structural components are elevated and momentum is getting worse. Expect materially higher policy rates, a stronger dollar (initially), commodity/energy outperformance, and compressed equity multiples across most sectors. Real assets > financial assets. The <a href="/core/macro/">regime dashboard</a> likely shows Stagflation conditions.`;
  }

  tgt.innerHTML = `<p class="cycle-synthesis-para">${paragraph}</p>
    <div class="cycle-synthesis-links">
      Related views:
      <a href="/core/macro/">Regime returns table &rarr;</a>
      <a href="/core/macro/cycle/">Cycle position &rarr;</a>
      <a href="/core/econ/">Indicator library &rarr;</a>
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

    el('last-updated').textContent = `Updated ${new Date().toLocaleString()}`;
    setStatus('live', 'Live');
  } catch (err) {
    console.error(err);
    setStatus('error', `Error: ${err.message}`);
  }
}

main();


// ---------- per-page export hook (T16.6) ----------
// Wires window.__downloadPageData so the universal "Download data" button can
// export THIS page's in-memory series as a wide-format CSV.
import('/core/lib/csv-export.js').then(({ seriesToCSV }) => {
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
