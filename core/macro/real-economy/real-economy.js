// Real Economy page — consumer indicators: income, spending, credit health.
//
// Same visual pattern as cycle/inflation: composite score hero, three sections
// each with a chart + tile array + interpretation note, then a synthesis
// paragraph. Decision-relevant for consumer-discretionary and staples retail,
// consumer finance, and credit-sensitive businesses (XLY/XLP/consumer finance names).

const state = {
  series: {},
  stocks: {},
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

function latestValue(s) { return s && s.length ? s[s.length - 1] : null; }
function valueMonthsAgo(s, n) { return s && s.length > n ? s[s.length - 1 - n] : null; }
function percentile(s, val) {
  if (!s || !s.length || !Number.isFinite(val)) return null;
  const sorted = s.map(o => o.value).filter(Number.isFinite).sort((a, b) => a - b);
  let lo = 0;
  for (let i = 0; i < sorted.length; i++) { if (sorted[i] <= val) lo = i + 1; else break; }
  return Math.round((lo / sorted.length) * 100);
}

function yoyPct(series) {
  const out = [];
  for (let i = 12; i < series.length; i++) {
    const cur = series[i].value, prev = series[i - 12].value;
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) continue;
    out.push({ date: series[i].date, value: (cur / prev - 1) * 100 });
  }
  return out;
}

// Normalize a price series to 100 at a given start date. Used for HD/LOW/XHB
// performance comparison against SPY over the same window.
function normalizeSeries(closes, baseDate) {
  if (!closes || !closes.length) return [];
  const idx = closes.findIndex(o => o.date >= baseDate);
  const start = idx >= 0 ? idx : 0;
  const base = closes[start].value;
  if (!base) return [];
  return closes.slice(start).map(o => ({ date: o.date, value: (o.value / base) * 100 }));
}

// NBER ranges + shading plugin (shared pattern).
async function loadRecessionRanges() {
  const j = await fetchJSON('/api/fred?series=USREC&start=1960-01-01');
  const obs = j.series[0]?.observations || [];
  const ranges = []; let inR = false, rs = null;
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
      ctx.save(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
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
      x: { type: 'time', time: { unit: opts.xUnit || 'year' },
           grid: { color: 'rgba(255,255,255,0.04)' },
           ticks: { color: '#8a94a3', font: { size: 10 } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' },
           ticks: { color: '#8a94a3', font: { size: 10 }, callback: opts.yTicks },
           title: { display: !!opts.yTitle, text: opts.yTitle, color: '#8a94a3', font: { size: 11 } } },
    },
  };
  if (opts.yMin !== undefined) chartOpts.scales.y.min = opts.yMin;
  if (opts.yMax !== undefined) chartOpts.scales.y.max = opts.yMax;
  if (opts.y2) {
    chartOpts.scales.y1 = { position: 'right',
      grid: { display: false }, ticks: { color: '#8a94a3', font: { size: 10 }, callback: opts.y2.yTicks },
      title: { display: !!opts.y2.yTitle, text: opts.y2.yTitle, color: '#8a94a3', font: { size: 11 } } };
  }
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

// ---------- data load ----------

async function loadAllData() {
  const startMacro = '1990-01-01';
  // Batched FRED fetches — partial-failure tolerant.
  const fredBatches = [
    ['HOUST', 'PERMIT', 'HSN1F', 'EXHOSLUSM495S', 'HOSSUPUSM673N'],
    ['MORTGAGE30US', 'CSUSHPISA', 'WPU081'],
    ['PCE', 'DSPI', 'PSAVERT', 'TDSP'],
    ['CES0500000003', 'CPILFESL', 'IC4WSA', 'DRCCLACBS', 'UMCSENT'],
    ['DSPIC96', 'REVOLSL', 'DRALACBS'],
  ];
  const errors = [];
  for (const b of fredBatches) {
    try {
      const j = await fetchJSON(`/api/fred?series=${b.join(',')}&start=${startMacro}`);
      for (const s of j.series) state.series[s.id] = s.observations;
      if (j.errors && j.errors.length) errors.push(...j.errors);
    } catch (err) {
      console.warn(`Batch ${b.join(',')} failed:`, err);
      errors.push({ id: b.join(','), error: String(err.message || err) });
    }
  }
  if (errors.length) console.warn('[real-economy] missing series:', errors);

  // Stock history: HD, LOW, XHB, WOOD, BLDR, BCC, SPY (benchmark)
  try {
    const j = await fetchJSON('/api/stocks?mode=history&years=10&symbols=HD,LOW,XHB,WOOD,BLDR,BCC,SPY');
    for (const s of j.series) state.stocks[s.symbol] = s.closes;
  } catch (err) {
    console.warn('stocks fetch failed:', err);
  }

  // Derived series
  if (state.series.PCE)  state.series._pceYoy  = yoyPct(state.series.PCE);
  if (state.series.DSPI) state.series._dspiYoy = yoyPct(state.series.DSPI);
  if (state.series.WPU081) state.series._lumberYoy = yoyPct(state.series.WPU081);
  if (state.series.HOUST)  state.series._houstYoy  = yoyPct(state.series.HOUST);
  if (state.series.PERMIT) state.series._permitYoy = yoyPct(state.series.PERMIT);
  if (state.series.HSN1F)  state.series._hsn1fYoy  = yoyPct(state.series.HSN1F);
  if (state.series.CSUSHPISA) state.series._hpiYoy = yoyPct(state.series.CSUSHPISA);
  if (state.series.CES0500000003) state.series._wageYoy = yoyPct(state.series.CES0500000003);
  if (state.series.CPILFESL) state.series._coreYoy = yoyPct(state.series.CPILFESL);
  // Real wages = AHE - Core CPI
  if (state.series._wageYoy && state.series._coreYoy) {
    const coreMap = new Map(state.series._coreYoy.map(o => [o.date, o.value]));
    state.series._realWages = state.series._wageYoy
      .filter(o => coreMap.has(o.date))
      .map(o => ({ date: o.date, value: o.value - coreMap.get(o.date) }));
  }
}


// ---------- Section 2: Income & Purchasing Power ----------

function renderIncome() {
  const dspicYoy = state.series._dspic96Yoy || [];
  const realWageYoy = state.series._realWageIndexYoy || [];
  const savings = state.series.PSAVERT || [];

  timeSeriesChart(el('chart-income'), [
    { label: 'Real Disposable Income YoY', data: dspicYoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.1 },
    { label: 'Real Wages YoY', data: realWageYoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#3ecf8e', backgroundColor: 'rgba(62, 207, 142, 0.10)', borderWidth: 1.6, pointRadius: 0, fill: true, tension: 0.1 },
  ], {
    yTitle: 'YoY (%)',
    extraPlugins: [thresholdLinePlugin([
      { value: 0, label: '0% YoY', color: 'rgba(138, 148, 163, 0.5)' },
    ])],
  });

  const ldspic = latestValue(dspicYoy), lrw = latestValue(realWageYoy);
  const lsav = latestValue(savings);
  const dspic12m = valueMonthsAgo(dspicYoy, 12), rw12m = valueMonthsAgo(realWageYoy, 12);
  const sav12m = valueMonthsAgo(savings, 12);

  const tiles = [
    {
      metric: 'DSPIC96',
      label: 'Real disposable income YoY',
      value: ldspic ? `${ldspic.value >= 0 ? '+' : ''}${fmt(ldspic.value, 1)}%` : '—',
      meta: dspic12m && ldspic ? `12m change: ${(ldspic.value - dspic12m.value >= 0 ? '+' : '')}${fmt(ldspic.value - dspic12m.value, 1)}pp` : '',
      threshold: '&gt; 0 = rising spending power',
      status: ldspic ? (ldspic.value > 1 ? 'ok' : ldspic.value > -1 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'REAL_WAGES',
      label: 'Real wages YoY',
      value: lrw ? `${lrw.value >= 0 ? '+' : ''}${fmt(lrw.value, 1)}%` : '—',
      meta: rw12m && lrw ? `12m change: ${(lrw.value - rw12m.value >= 0 ? '+' : '')}${fmt(lrw.value - rw12m.value, 1)}pp` : '',
      threshold: 'excludes inflation · reflects purchasing power gains',
      status: lrw ? (lrw.value > 0.5 ? 'ok' : lrw.value > -0.5 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'PSAVERT',
      label: 'Personal saving rate',
      value: lsav ? `${fmt(lsav.value, 1)}%` : '—',
      meta: sav12m && lsav ? `12m ago: ${fmt(sav12m.value, 1)}%` : '',
      threshold: '&gt; 5% healthy · &lt; 3% stretched',
      status: lsav ? (lsav.value > 5 ? 'ok' : lsav.value > 3.5 ? 'caution' : 'warn') : '',
    },
  ];
  renderTiles('tiles-income', tiles);

  let note = '<strong>Current read:</strong> ';
  if (ldspic && lrw) {
    if (ldspic.value > 1 && lrw.value > 0) 
      note += `Both real disposable income (+${fmt(ldspic.value, 1)}%) and real wages (+${fmt(lrw.value, 1)}%) positive — purchasing power expanding. Consumers can spend more in real terms. `;
    else if (ldspic.value < 0 && lrw.value < 0)
      note += `Both real disposable income (${fmt(ldspic.value, 1)}%) and real wages (${fmt(lrw.value, 1)}%) negative — purchasing power contracting. `;
    else
      note += `Mixed signal: real disposable income ${ldspic.value >= 0 ? '+' : ''}${fmt(ldspic.value, 1)}%, real wages ${lrw.value >= 0 ? '+' : ''}${fmt(lrw.value, 1)}%. `;
  }
  if (ldspic && lrw && lsav) {
    if (ldspic.value > 1 && lrw.value >= 0 && lsav.value > 5)
      note += `<em>Benign scenario: income growing, wages keeping up with inflation, saving rate healthy. Consumers have room to spend or build cushion.</em>`;
    else if (ldspic.value < 0 && lsav.value < 3.5)
      note += `<em>Squeeze scenario: real income falling AND saving rate depleted. Consumers will cut discretionary spending or increase borrowing.</em>`;
  }
  el('note-income').innerHTML = note;
}

// ---------- Section 3: Credit Health & Stress ----------

function renderCredit() {
  const revolvingYoy = state.series._revolvingYoy || [];
  const ccDelinq = state.series.DRCCLACBS || [];
  const autoDelinq = state.series.DRALACBS || [];
  const tdsp = state.series.TDSP || [];

  timeSeriesChart(el('chart-credit'), [
    { label: 'Revolving Credit YoY', data: revolvingYoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.1 },
    { label: 'Credit Card Delinquency Rate', data: ccDelinq.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', borderWidth: 1.4, pointRadius: 0, fill: false, tension: 0.1 },
    { label: 'Auto Loan Delinquency Rate', data: autoDelinq.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#ef4f5a', backgroundColor: 'rgba(239, 79, 90, 0.08)', borderWidth: 1.6, pointRadius: 0, fill: true, tension: 0.1 },
  ], {
    yTitle: 'YoY credit growth (%) / Delinquency (%)',
    extraPlugins: [thresholdLinePlugin([
      { value: 0, label: '0% growth', color: 'rgba(138, 148, 163, 0.5)' },
    ])],
  });

  const lrevolving = latestValue(revolvingYoy), lccDelinq = latestValue(ccDelinq);
  const lautoDelinq = latestValue(autoDelinq), ltdsp = latestValue(tdsp);
  const ccDelinqPct = percentile(ccDelinq, lccDelinq?.value);
  const autoDelinqPct = percentile(autoDelinq, lautoDelinq?.value);
  const tdspPct = percentile(tdsp, ltdsp?.value);
  const revolving12m = valueMonthsAgo(revolvingYoy, 12);

  const tiles = [
    {
      metric: 'REVOLSL',
      label: 'Revolving credit YoY',
      value: lrevolving ? `${lrevolving.value >= 0 ? '+' : ''}${fmt(lrevolving.value, 1)}%` : '—',
      meta: revolving12m && lrevolving ? `12m change: ${(lrevolving.value - revolving12m.value >= 0 ? '+' : '')}${fmt(lrevolving.value - revolving12m.value, 1)}pp` : '',
      threshold: '&gt; 5% = aggressive borrowing · &lt; 0% = paydown',
      status: lrevolving ? (lrevolving.value > 3 ? 'warn' : lrevolving.value > 0 ? 'caution' : 'ok') : '',
    },
    {
      metric: 'DRCCLACBS',
      label: 'Credit card delinquency',
      value: lccDelinq ? `${fmt(lccDelinq.value, 2)}%` : '—',
      meta: ccDelinqPct != null ? `${ccDelinqPct}th %ile post-1990` : '',
      threshold: 'leads spending slowdown by 1–2Q · 2007 peak: 5.5%',
      status: lccDelinq ? (lccDelinq.value < 2.5 ? 'ok' : lccDelinq.value < 4 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'DRALACBS',
      label: 'Auto loan delinquency',
      value: lautoDelinq ? `${fmt(lautoDelinq.value, 2)}%` : '—',
      meta: autoDelinqPct != null ? `${autoDelinqPct}th %ile post-1990` : '',
      threshold: 'leads credit card delinq by 2–3Q · 2008-09 peak: 3.8%',
      status: lautoDelinq ? (lautoDelinq.value < 1.8 ? 'ok' : lautoDelinq.value < 2.5 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'TDSP',
      label: 'Debt service ratio',
      value: ltdsp ? `${fmt(ltdsp.value, 1)}%` : '—',
      meta: tdspPct != null ? `${tdspPct}th %ile post-1990` : '',
      threshold: '&gt; 12% = stretched (2007 peak: 13.2%) · &lt; 10% healthy',
      status: ltdsp ? (ltdsp.value < 10 ? 'ok' : ltdsp.value < 12 ? 'caution' : 'warn') : '',
    },
  ];
  renderTiles('tiles-credit', tiles);

  let note = '<strong>Current read:</strong> ';
  if (lrevolving && lccDelinq) {
    if (lrevolving.value > 5 && lccDelinq.value > 3)
      note += `Late-cycle pattern: revolving credit growing (${lrevolving.value >= 0 ? '+' : ''}${fmt(lrevolving.value, 1)}%) AND delinquencies elevated (${fmt(lccDelinq.value, 2)}%). Consumers borrowing AND defaulting at the margin. `;
    else if (lrevolving.value < 0 && lccDelinq.value < 2.5)
      note += `Healthy pattern: consumers paying down revolving credit (${fmt(lrevolving.value, 1)}%) with low delinquencies (${fmt(lccDelinq.value, 2)}%). `;
    else
      note += `Mixed: revolving credit ${lrevolving.value >= 0 ? '+' : ''}${fmt(lrevolving.value, 1)}%, CC delinquency ${fmt(lccDelinq.value, 2)}%. `;
  }
  if (lautoDelinq && lccDelinq) {
    const gap = lautoDelinq.value - lccDelinq.value;
    if (gap > 0.5)
      note += `<em>Auto delinquency (${fmt(lautoDelinq.value, 2)}%) leading credit card delinquency (${fmt(lccDelinq.value, 2)}%) by +${fmt(gap, 2)}pp — watch for CC delinquency to follow in next 2-3 quarters.</em>`;
  }
  el('note-credit').innerHTML = note;
}

// ---------- Section 4: Consumer balance sheet ----------

function renderConsumer() {
  const pceYoy = state.series._pceYoy || [];
  const dspiYoy = state.series._dspiYoy || [];
  const savings = state.series.PSAVERT || [];
  const realW = state.series._realWages || [];
  const delinq = state.series.DRCCLACBS || [];
  const claims = state.series.IC4WSA || [];
  const sentiment = state.series.UMCSENT || [];

  timeSeriesChart(el('chart-consumer'), [
    { label: 'PCE YoY', data: pceYoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.4, pointRadius: 0, fill: false, tension: 0.1 },
    { label: 'Real Wages YoY (AHE − Core CPI)', data: realW.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#3ecf8e', backgroundColor: 'rgba(62, 207, 142, 0.10)', borderWidth: 1.7, pointRadius: 0, fill: true, tension: 0.1 },
    { label: 'Personal Saving Rate (right axis)', data: savings.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', borderWidth: 1.4, pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y1' },
  ], {
    yTitle: 'YoY (%)',
    y2: { yTitle: 'savings rate (%)', yTicks: v => `${v}%` },
    extraPlugins: [thresholdLinePlugin([
      { value: 0, label: '0% real wages', color: 'rgba(138, 148, 163, 0.5)' },
    ])],
  });

  const lpce = latestValue(pceYoy), ldspi = latestValue(dspiYoy), lsav = latestValue(savings);
  const lrw = latestValue(realW), ldel = latestValue(delinq), lcla = latestValue(claims), lsent = latestValue(sentiment);
  const tdsp = latestValue(state.series.TDSP || []);

  const tiles = [
    {
      metric: 'REAL_WAGES',
      label: 'Real wages',
      value: lrw ? `${lrw.value >= 0 ? '+' : ''}${fmt(lrw.value, 1)}%` : '—',
      meta: 'AHE YoY − Core CPI YoY',
      threshold: '&gt; 0 = rising purchasing power',
      status: lrw ? (lrw.value > 0.5 ? 'ok' : lrw.value > -0.5 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'PSAVERT',
      label: 'Personal saving rate',
      value: lsav ? `${fmt(lsav.value, 1)}%` : '—',
      meta: 'monthly saving / disposable income',
      threshold: '&lt; 4% = depleted cushion · 5–8% normal · &gt; 10% recession',
      status: lsav ? (lsav.value > 5 ? 'ok' : lsav.value > 3.5 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'TDSP',
      label: 'Debt service ratio',
      value: tdsp ? `${fmt(tdsp.value, 1)}%` : '—',
      meta: 'household debt service / DPI',
      threshold: '&gt; 12% = stretched (2007 peak: 13.2%)',
      status: tdsp ? (tdsp.value < 10 ? 'ok' : tdsp.value < 12 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'DRCCLACBS',
      label: 'CC delinquency rate',
      value: ldel ? `${fmt(ldel.value, 2)}%` : '—',
      meta: 'commercial banks, 30+ days past due',
      threshold: 'leads consumer slowdown by 1–2Q',
      status: ldel ? (ldel.value < 2.5 ? 'ok' : ldel.value < 4 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'IC4WSA',
      label: 'Jobless claims (4wk MA)',
      value: lcla ? `${(lcla.value / 1000).toFixed(0)}K` : '—',
      meta: 'real-time labor demand',
      threshold: '&gt; 300K historically marks turning points',
      status: lcla ? (lcla.value < 240000 ? 'ok' : lcla.value < 300000 ? 'caution' : 'warn') : '',
    },
    {
      metric: 'UMCSENT',
      label: 'UMich Consumer Sentiment',
      value: lsent ? `${fmt(lsent.value, 0)}` : '—',
      meta: '1985 Q1 = 100 baseline',
      threshold: '&gt; 90 healthy · &lt; 70 recessionary',
      status: lsent ? (lsent.value > 80 ? 'ok' : lsent.value > 65 ? 'caution' : 'warn') : '',
    },
  ];
  renderTiles('tiles-consumer', tiles);

  let note = '<strong>Current read:</strong> ';
  if (lrw && lsav) {
    if (lrw.value > 0.5 && lsav.value > 5)            note += `Consumer in healthy shape: real wages ${lrw.value >= 0 ? '+' : ''}${fmt(lrw.value, 1)}%, saving rate ${fmt(lsav.value, 1)}%. Spending power supportive of demand. `;
    else if (lrw.value < 0 && lsav.value < 4)         note += `<em>Consumer stretched: real wages ${fmt(lrw.value, 1)}% (negative) AND saving rate ${fmt(lsav.value, 1)}% (depleted). Spending will need to slow.</em> `;
    else                                              note += `Consumer mixed: real wages ${lrw.value >= 0 ? '+' : ''}${fmt(lrw.value, 1)}%, saving ${fmt(lsav.value, 1)}%. `;
  }
  if (ldel && ldel.value > 3.5) note += `<em>Credit card delinquency at ${fmt(ldel.value, 2)}% — elevated, historically leads spending slowdown by 1-2 quarters.</em>`;
  else if (ldel && ldel.value > 2.5) note += `Credit card delinquency at ${fmt(ldel.value, 2)}% — normalizing back toward historical average.`;
  el('note-consumer').innerHTML = note;
}

// ---------- Consumer Health composite ----------

function computeHealthScore() {
  const signals = [];
  const lrw = latestValue(state.series._realWages || []);
  if (lrw) {
    // -2% = 100 (bad), 0% = 50, +2% = 0 (good)
    const score = Math.min(100, Math.max(0, 50 - (lrw.value * 25)));
    signals.push({ name: 'Real wages', score, weight: 0.25, raw: `${lrw.value >= 0 ? '+' : ''}${fmt(lrw.value, 1)}%` });
  }
  const lsav = latestValue(state.series.PSAVERT || []);
  if (lsav) {
    // 12% saving = 0 (very healthy), 5% = 50, 2% = 100 (depleted)
    const score = Math.min(100, Math.max(0, 100 - (lsav.value - 2) * 10));
    signals.push({ name: 'Personal saving rate', score, weight: 0.20, raw: `${fmt(lsav.value, 1)}%` });
  }
  const ldel = latestValue(state.series.DRCCLACBS || []);
  if (ldel) {
    // 1.5% = 0 (healthy), 3% = 50, 5% = 100 (stress)
    const score = Math.min(100, Math.max(0, ((ldel.value - 1.5) / 3.5) * 100));
    signals.push({ name: 'CC delinquency', score, weight: 0.20, raw: `${fmt(ldel.value, 2)}%` });
  }
  const lcla = latestValue(state.series.IC4WSA || []);
  if (lcla) {
    // 200K = 0 (tight), 280K = 50, 380K = 100 (recession)
    const score = Math.min(100, Math.max(0, ((lcla.value - 200000) / 180000) * 100));
    signals.push({ name: 'Jobless claims (4wk)', score, weight: 0.15, raw: `${(lcla.value / 1000).toFixed(0)}K` });
  }
  const lsent = latestValue(state.series.UMCSENT || []);
  if (lsent) {
    // 100 sentiment = 0, 75 = 50, 50 = 100
    const score = Math.min(100, Math.max(0, (100 - lsent.value) * 2));
    signals.push({ name: 'UMich sentiment', score, weight: 0.10, raw: `${fmt(lsent.value, 0)}` });
  }
  const tdsp = latestValue(state.series.TDSP || []);
  if (tdsp) {
    // 9% = 0, 11% = 50, 13% = 100
    const score = Math.min(100, Math.max(0, ((tdsp.value - 9) / 4) * 100));
    signals.push({ name: 'Debt service ratio', score, weight: 0.10, raw: `${fmt(tdsp.value, 1)}%` });
  }

  if (!signals.length) return null;
  const totalW = signals.reduce((s, n) => s + n.weight, 0);
  const weighted = signals.reduce((s, n) => s + n.score * n.weight, 0) / totalW;
  return { score: weighted, signals };
}

function renderHealthScore() {
  const result = computeHealthScore();
  const tgt = el('consumer-health-section');
  if (!tgt || !result) return;
  const score = result.score;

  // Note the inverted scale: HIGHER score = MORE stress (like cycle/inflation)
  let phase, color;
  if (score < 25)      { phase = 'Robust';   color = '#3ecf8e'; }
  else if (score < 45) { phase = 'Healthy';  color = '#5a9cff'; }
  else if (score < 65) { phase = 'Mixed';    color = '#f7a700'; }
  else if (score < 80) { phase = 'Stressed'; color = '#ef4f5a'; }
  else                 { phase = 'Distressed'; color = '#ef4f5a'; }

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
        <div class="cs-score-label">CONSUMER STRESS SCORE</div>
        <div class="cs-score-value">${score.toFixed(0)}<span class="cs-score-scale">/100</span></div>
        <div class="cs-score-phase" style="color:${color}">${phase}</div>
        <div class="cs-score-desc">0 = robust consumer (full purchasing power, low delinquency, tight labor); 100 = distressed (negative real wages, depleted savings, rising defaults).</div>
      </div>
      <div class="cs-signals">
        <div class="cs-signals-title">Component readings</div>
        ${bars}
        <div class="cs-weights-note">Weights: real wages 25% · saving rate 20% · CC delinq. 20% · jobless claims 15% · sentiment 10% · debt service 10%.</div>
      </div>
    </div>
  `;
}

// ---------- Synthesis ----------

function renderSynthesis() {
  const result = computeHealthScore();
  const tgt = el('re-synthesis-content');
  if (!tgt || !result) return;
  const score = result.score;

  // Pull key reads for consumer-focused narrative
  const ldspic = latestValue(state.series._dspic96Yoy || []);
  const lrevolving = latestValue(state.series._revolvingYoy || []);
  const lccDelinq = latestValue(state.series.DRCCLACBS || []);

  let paragraph = '';
  if (score < 35) {
    paragraph = `Consumer-stress composite at <strong>${score.toFixed(0)}/100</strong> — the consumer is in robust shape. `;
    paragraph += ldspic && ldspic.value > 1 ? `Real disposable income running positive (+${fmt(ldspic.value, 1)}%), spending power expanding. ` : '';
    paragraph += `For consumer-exposed P&L (XLY/XLP retail, consumer finance): this is the <strong>upside scenario</strong> — sustained income growth + low delinquencies = resilient discretionary spending. Watch credit-card and auto delinquencies for early warning signs of rolling over.`;
  } else if (score < 55) {
    paragraph = `Consumer-stress composite at <strong>${score.toFixed(0)}/100</strong> — mixed picture. Some income metrics stable, but delinquencies rising at the margin. `;
    paragraph += lrevolving && lrevolving.value > 5 ? `Revolving credit growing (+${fmt(lrevolving.value, 1)}%) — consumers increasingly leaning on credit. ` : '';
    paragraph += `For consumer-exposed P&L: <strong>defensive positioning</strong>. Discretionary retail under pressure; staple retailers resilient. Consumer-finance businesses see rising charge-offs.`;
  } else if (score < 75) {
    paragraph = `Consumer-stress composite at <strong>${score.toFixed(0)}/100</strong> — stressed. Income pressure + rising delinquencies = household buffer eroding. `;
    if (lccDelinq && lccDelinq.value > 3.5) paragraph += `Credit card delinquency at ${fmt(lccDelinq.value, 2)}% — elevated and accelerating. `;
    paragraph += `For consumer-exposed P&L: <strong>brace for spending slowdown</strong>. Discretionary categories (apparel, furniture, furnishings) see 5-10% same-store-sales declines. Necessity goods and services (food, pharmacy, discount retail) hold up better.`;
  } else {
    paragraph = `Consumer-stress composite at <strong>${score.toFixed(0)}/100</strong> — distressed. Negative real wages + elevated delinquencies + collapsing sentiment. This is the 2008-style recession regime. `;
    paragraph += `For consumer-exposed P&L: <strong>survival mode</strong>. Discretionary spending evaporates; staples dominate. XLP significantly outperforms XLY. Consumer-finance defaults spike. Recovery comes only when labor market stabilizes and real wages resume positive growth.`;
  }

  tgt.innerHTML = `<p class="cycle-synthesis-para">${paragraph}</p>
    <div class="cycle-synthesis-links">
      Related views:
      <a href="/core/macro/">Regime returns table &rarr;</a>
      <a href="/core/macro/cycle/">Cycle position &rarr;</a>
      <a href="/core/macro/inflation/">Inflation persistence &rarr;</a>
      <a href="/core/macro/ticker.html?sym=XLY">XLY (Discretionary) drilldown &rarr;</a>
      <a href="/core/macro/ticker.html?sym=XLP">XLP (Staples) drilldown &rarr;</a>
    </div>`;
}

// ---------- main ----------

async function main() {
  try {
    setStatus('stale', 'Loading consumer + housing data…');
    await Promise.all([loadRecessionRanges(), loadAllData()]);

    renderHealthScore();
    renderIncome();
    renderCredit();
    renderConsumer();
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
    seriesToCSV('siberforge-real-economy.csv', series);
  };
}).catch(err => console.warn('export hook load failed:', err));
