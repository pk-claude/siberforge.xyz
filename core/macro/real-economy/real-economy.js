// Real Economy page — consumer + housing + home-improvement / building-materials.
//
// Same visual pattern as cycle/inflation: composite score hero, three sections
// each with a chart + tile array + interpretation note, then a synthesis
// paragraph. Decision-relevant focus on the housing-exposed P&L (HD/LOW/XHB/
// WOOD + lumber PPI + builders).

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
    return `<div class="cycle-tile ${statusClass}" title="${t.help || ''}">
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
    ['HOUST', 'PERMIT', 'HSN1F', 'EXHOSLUSM495S', 'MSACSR'],
    ['MORTGAGE30US', 'CSUSHPISA', 'WPU081'],
    ['PCE', 'DSPI', 'PSAVERT', 'TDSP'],
    ['CES0500000003', 'CPILFESL', 'IC4WSA', 'DRCCLACBS', 'UMCSENT'],
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

// ---------- Section 1: Housing ----------

function renderHousing() {
  const permit = state.series._permitYoy || [];
  const houst  = state.series._houstYoy  || [];
  const sales  = state.series._hsn1fYoy  || [];
  const supply = state.series.MSACSR     || [];
  const mort   = state.series.MORTGAGE30US || [];
  const hpi    = state.series._hpiYoy    || [];

  // Build chart: permits/starts/sales (left axis) + months supply (right axis)
  timeSeriesChart(el('chart-housing'), [
    { label: 'Building Permits YoY', data: permit.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.4, pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y' },
    { label: 'Housing Starts YoY', data: houst.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', backgroundColor: 'rgba(247, 167, 0, 0.10)', borderWidth: 1.6, pointRadius: 0, fill: true, tension: 0.1, yAxisID: 'y' },
    { label: 'New Home Sales YoY', data: sales.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#3ecf8e', borderWidth: 1.3, borderDash: [3, 3], pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y' },
    { label: 'Months Supply (right axis)', data: supply.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#ef4f5a', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y1' },
  ], {
    yTitle: 'YoY change (%)',
    y2: { yTitle: 'months', yTicks: v => `${v}` },
    extraPlugins: [thresholdLinePlugin([
      { value: 0, label: '0% YoY', color: 'rgba(138, 148, 163, 0.4)' },
    ])],
  });

  const lp = latestValue(permit), lh = latestValue(houst), lsa = latestValue(sales);
  const lms = latestValue(supply), lmt = latestValue(mort), lhp = latestValue(hpi);
  const supplyPct = percentile(supply, lms?.value);

  const tiles = [
    {
      label: 'Months Supply (new homes)',
      value: lms ? `${fmt(lms.value, 1)} mo` : '—',
      meta: supplyPct != null ? `${supplyPct}th %ile post-1990` : '',
      threshold: '&lt; 4 sellers&rsquo; · 4–6 balanced · &gt; 6 buyers&rsquo;',
      status: lms ? (lms.value > 7 ? 'warn' : lms.value > 5 ? 'caution' : 'ok') : '',
      help: 'Inventory of new homes for sale ÷ current monthly sales rate. The cleanest single read on housing-cycle position.',
    },
    {
      label: 'Building permits YoY',
      value: lp ? `${lp.value >= 0 ? '+' : ''}${fmt(lp.value, 1)}%` : '—',
      meta: lp ? `as of ${lp.date.slice(0, 7)}` : '',
      threshold: 'leads starts by 1–2 months · falling permits = cycle rollover',
      status: lp ? (lp.value > 5 ? 'ok' : lp.value > -5 ? 'caution' : 'warn') : '',
    },
    {
      label: '30Y Mortgage rate',
      value: lmt ? `${fmt(lmt.value, 2)}%` : '—',
      meta: 'Freddie Mac PMMS, weekly',
      threshold: 'every 100bp ≈ ~$260/mo on a $400k loan',
      status: lmt ? (lmt.value < 5.5 ? 'ok' : lmt.value < 7 ? 'caution' : 'warn') : '',
    },
    {
      label: 'Case-Shiller HPI YoY',
      value: lhp ? `${lhp.value >= 0 ? '+' : ''}${fmt(lhp.value, 1)}%` : '—',
      meta: 'lags actual price-discovery 6mo',
      threshold: '&gt; 6% = unsustainable · &lt; 0% = stress',
      status: lhp ? (lhp.value > -1 && lhp.value < 6 ? 'ok' : Math.abs(lhp.value) < 8 ? 'caution' : 'warn') : '',
    },
  ];
  renderTiles('tiles-housing', tiles);

  let note = '<strong>Current read:</strong> ';
  if (lms) {
    if (lms.value > 7)        note += `Months supply at ${fmt(lms.value, 1)} — buyers&rsquo; market territory; builders cutting starts. `;
    else if (lms.value > 5)   note += `Months supply at ${fmt(lms.value, 1)} — balanced-to-soft. Builder pricing power moderating. `;
    else                      note += `Months supply at ${fmt(lms.value, 1)} — sellers&rsquo; market; tight inventory supports prices. `;
  }
  if (lp && lh) {
    const trend = lp.value > lh.value ? 'leading starts higher' : 'leading starts lower';
    note += `Permits (${lp.value >= 0 ? '+' : ''}${fmt(lp.value, 1)}%) ${trend} (${lh.value >= 0 ? '+' : ''}${fmt(lh.value, 1)}% YoY). `;
  }
  if (lmt && lhp) {
    if (lmt.value > 6.5 && lhp.value > 3) note += `<em>Affordability squeeze: rates above 6.5% AND prices still rising YoY — pent-up supply will eventually break this.</em>`;
    else if (lmt.value < 5.5 && lhp.value < 3) note += `<em>Affordability normalizing: rates below 6% with cooling prices — typical late-rebalance dynamics.</em>`;
  }
  el('note-housing').innerHTML = note;
}

// ---------- Section 2: Home improvement & building materials ----------

function renderHomeImprovement() {
  // Normalize HD, LOW, XHB, WOOD, BLDR, SPY to 100 at the start of the visible window (~10y)
  const startBase = '2018-01-01';
  const dsForChart = [];
  const colors = { HD: '#f7a700', LOW: '#5a9cff', XHB: '#3ecf8e', WOOD: '#a855f7', BLDR: '#ef4f5a', SPY: '#8a94a3' };
  for (const sym of ['HD', 'LOW', 'XHB', 'WOOD', 'BLDR', 'SPY']) {
    if (!state.stocks[sym]) continue;
    const norm = normalizeSeries(state.stocks[sym], startBase);
    if (!norm.length) continue;
    dsForChart.push({
      label: sym === 'SPY' ? 'SPY (benchmark)' : sym,
      data: norm.map(o => ({ x: o.date, y: o.value })),
      borderColor: colors[sym],
      backgroundColor: 'transparent',
      borderWidth: sym === 'SPY' ? 1.0 : sym === 'HD' || sym === 'LOW' ? 1.8 : 1.3,
      borderDash: sym === 'SPY' ? [4, 4] : [],
      pointRadius: 0,
      tension: 0.1,
    });
  }

  timeSeriesChart(el('chart-home-improvement'), dsForChart, {
    yTitle: 'rebased to 100 at start',
    extraPlugins: [thresholdLinePlugin([
      { value: 100, label: 'base', color: 'rgba(138, 148, 163, 0.4)' },
    ])],
  });

  // Tiles: HD vs LOW relative, lumber PPI YoY, WOOD vs SPY 1y, current builder ETF percentile
  function pctChange(closes, days) {
    if (!closes || closes.length < days + 1) return null;
    const recent = closes[closes.length - 1].value;
    const old = closes[closes.length - 1 - days].value;
    if (!recent || !old) return null;
    return (recent / old - 1) * 100;
  }

  const hd1y = pctChange(state.stocks.HD, 252);
  const low1y = pctChange(state.stocks.LOW, 252);
  const xhb1y = pctChange(state.stocks.XHB, 252);
  const wood1y = pctChange(state.stocks.WOOD, 252);
  const spy1y = pctChange(state.stocks.SPY, 252);
  const lumberYoy = latestValue(state.series._lumberYoy || []);

  // HD vs LOW relative: positive = HD leading, negative = LOW leading
  const hdLowSpread = (hd1y != null && low1y != null) ? hd1y - low1y : null;

  const tiles = [
    {
      label: 'HD 1Y total return',
      value: hd1y != null ? `${hd1y >= 0 ? '+' : ''}${fmt(hd1y, 1)}%` : '—',
      meta: spy1y != null ? `vs SPY: ${(hd1y - spy1y >= 0 ? '+' : '')}${fmt(hd1y - spy1y, 1)}pp` : '',
      threshold: 'home-improvement bellwether',
      status: hd1y != null && spy1y != null ? (hd1y > spy1y + 3 ? 'ok' : hd1y > spy1y - 3 ? 'caution' : 'warn') : '',
    },
    {
      label: 'LOW 1Y total return',
      value: low1y != null ? `${low1y >= 0 ? '+' : ''}${fmt(low1y, 1)}%` : '—',
      meta: spy1y != null ? `vs SPY: ${(low1y - spy1y >= 0 ? '+' : '')}${fmt(low1y - spy1y, 1)}pp` : '',
      threshold: 'second-largest US home-improvement retailer',
      status: low1y != null && spy1y != null ? (low1y > spy1y + 3 ? 'ok' : low1y > spy1y - 3 ? 'caution' : 'warn') : '',
    },
    {
      label: 'HD vs LOW spread',
      value: hdLowSpread != null ? `${hdLowSpread >= 0 ? '+' : ''}${fmt(hdLowSpread, 1)}pp` : '—',
      meta: 'HD 1y minus LOW 1y',
      threshold: 'wide divergence = market is rewarding one over the other',
      status: hdLowSpread != null ? (Math.abs(hdLowSpread) < 5 ? 'ok' : Math.abs(hdLowSpread) < 12 ? 'caution' : 'warn') : '',
    },
    {
      label: 'XHB Homebuilders 1Y',
      value: xhb1y != null ? `${xhb1y >= 0 ? '+' : ''}${fmt(xhb1y, 1)}%` : '—',
      meta: 'leads home-improvement demand by 6-9mo',
      threshold: 'down from highs = housing-cycle rollover',
      status: xhb1y != null ? (xhb1y > 5 ? 'ok' : xhb1y > -10 ? 'caution' : 'warn') : '',
    },
    {
      label: 'Lumber PPI YoY',
      value: lumberYoy ? `${lumberYoy.value >= 0 ? '+' : ''}${fmt(lumberYoy.value, 1)}%` : '—',
      meta: 'producer price index, lumber & wood',
      threshold: 'rising = ticket-size tailwind; falling = pro-mix headwind',
      status: lumberYoy ? (lumberYoy.value > 0 && lumberYoy.value < 15 ? 'ok' : lumberYoy.value < -10 ? 'warn' : 'caution') : '',
    },
    {
      label: 'WOOD ETF 1Y',
      value: wood1y != null ? `${wood1y >= 0 ? '+' : ''}${fmt(wood1y, 1)}%` : '—',
      meta: 'lumber & forestry equity proxy',
      threshold: 'tracks public lumber distributors / forest-product producers',
      status: wood1y != null ? (wood1y > 5 ? 'ok' : wood1y > -10 ? 'caution' : 'warn') : '',
    },
  ];
  renderTiles('tiles-home-improvement', tiles);

  let note = '<strong>Current read:</strong> ';
  if (hd1y != null && low1y != null && spy1y != null) {
    const avgHi = (hd1y + low1y) / 2;
    const vsSpy = avgHi - spy1y;
    if (vsSpy > 3)         note += `Home-improvement retail (HD/LOW avg ${fmt(avgHi, 1)}%) outperforming SPY by ${fmt(vsSpy, 1)}pp. Cycle bid intact. `;
    else if (vsSpy > -3)   note += `Home-improvement retail tracking SPY (avg ${fmt(avgHi, 1)}% vs ${fmt(spy1y, 1)}%). No sector-specific bid. `;
    else                   note += `Home-improvement retail underperforming SPY by ${fmt(-vsSpy, 1)}pp — market pricing demand softness ahead. `;
  }
  if (lumberYoy) {
    if (lumberYoy.value > 5)        note += `<em>Lumber PPI ${lumberYoy.value >= 0 ? '+' : ''}${fmt(lumberYoy.value, 1)}% YoY — input cost tailwind for distributors, ticket-size tailwind for retailers.</em>`;
    else if (lumberYoy.value < -5)  note += `<em>Lumber PPI ${fmt(lumberYoy.value, 1)}% YoY — pro-channel revenue headwind; distributors particularly exposed.</em>`;
    else                            note += `Lumber PPI flat YoY — neutral for distributor revenue.`;
  }
  el('note-home-improvement').innerHTML = note;
}

// ---------- Section 3: Consumer balance sheet ----------

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
      label: 'Real wages',
      value: lrw ? `${lrw.value >= 0 ? '+' : ''}${fmt(lrw.value, 1)}%` : '—',
      meta: 'AHE YoY − Core CPI YoY',
      threshold: '&gt; 0 = rising purchasing power',
      status: lrw ? (lrw.value > 0.5 ? 'ok' : lrw.value > -0.5 ? 'caution' : 'warn') : '',
    },
    {
      label: 'Personal saving rate',
      value: lsav ? `${fmt(lsav.value, 1)}%` : '—',
      meta: 'monthly saving / disposable income',
      threshold: '&lt; 4% = depleted cushion · 5–8% normal · &gt; 10% recession',
      status: lsav ? (lsav.value > 5 ? 'ok' : lsav.value > 3.5 ? 'caution' : 'warn') : '',
    },
    {
      label: 'Debt service ratio',
      value: tdsp ? `${fmt(tdsp.value, 1)}%` : '—',
      meta: 'household debt service / DPI',
      threshold: '&gt; 12% = stretched (2007 peak: 13.2%)',
      status: tdsp ? (tdsp.value < 10 ? 'ok' : tdsp.value < 12 ? 'caution' : 'warn') : '',
    },
    {
      label: 'CC delinquency rate',
      value: ldel ? `${fmt(ldel.value, 2)}%` : '—',
      meta: 'commercial banks, 30+ days past due',
      threshold: 'leads consumer slowdown by 1–2Q',
      status: ldel ? (ldel.value < 2.5 ? 'ok' : ldel.value < 4 ? 'caution' : 'warn') : '',
    },
    {
      label: 'Jobless claims (4wk MA)',
      value: lcla ? `${(lcla.value / 1000).toFixed(0)}K` : '—',
      meta: 'real-time labor demand',
      threshold: '&gt; 300K historically marks turning points',
      status: lcla ? (lcla.value < 240000 ? 'ok' : lcla.value < 300000 ? 'caution' : 'warn') : '',
    },
    {
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

  // Pull a few key reads for the paragraph
  const lms = latestValue(state.series.MSACSR || []);
  const lmt = latestValue(state.series.MORTGAGE30US || []);
  const lumberYoy = latestValue(state.series._lumberYoy || []);

  let paragraph = '';
  if (score < 35) {
    paragraph = `Consumer-stress composite at <strong>${score.toFixed(0)}/100</strong> — the consumer is in good shape. `;
    paragraph += lms && lms.value < 5 ? `Tight housing inventory (${fmt(lms.value, 1)} months) supports prices and project demand. ` : `Housing inventory at ${lms ? fmt(lms.value, 1) : '—'} months. `;
    paragraph += `For housing-exposed P&L: this is the <strong>upside scenario</strong> — sustained spending power + tight inventory = sustained ticket sizes and pro-channel demand. Lumber PPI ${lumberYoy ? (lumberYoy.value >= 0 ? '+' : '') + fmt(lumberYoy.value, 1) + '%' : '—'} ${lumberYoy && lumberYoy.value > 0 ? 'tailwind on revenue' : 'neutral on input costs'}. <em>Watch:</em> a meaningful uptick in delinquencies or claims would be the first flag this is rolling over.`;
  } else if (score < 55) {
    paragraph = `Consumer-stress composite at <strong>${score.toFixed(0)}/100</strong> — mixed picture. Some indicators healthy (typically employment), others showing strain (savings + delinquencies). `;
    paragraph += lmt && lmt.value > 6 ? `30Y mortgage at ${fmt(lmt.value, 2)}% is the binding constraint — housing turnover suppressed, refi demand near zero. ` : '';
    paragraph += `For housing-exposed P&L: <strong>defensive bias</strong>. DIY mix likely > Pro mix, ticket sizes pressured. Repair/remodel resilient; new-construction-related demand slows. Lumber distributors more cyclical than home-improvement retailers in this regime.`;
  } else if (score < 75) {
    paragraph = `Consumer-stress composite at <strong>${score.toFixed(0)}/100</strong> — stressed. Real wages and savings buffer are eroded; delinquencies elevated; spending power compressed. `;
    paragraph += `For housing-exposed P&L: <strong>brace for revenue compression</strong>. Big-ticket renovations get deferred first, followed by pro-channel demand as builder backlogs work down. Historically, home-improvement retailers see ~5-8% same-store-sales decline in this regime over 2-3 quarters. Inventory discipline > revenue chase.`;
  } else {
    paragraph = `Consumer-stress composite at <strong>${score.toFixed(0)}/100</strong> — distressed. Multiple structural breaks (negative real wages + rising delinquencies + collapsing sentiment). This is the 2008-style regime. `;
    paragraph += `For housing-exposed P&L: <strong>survival mode</strong>. Demand evaporates first in pro-channel and discretionary remodel; staples-of-the-home (paint, hardware, HVAC repair) hold up best. Both HD and LOW historically beat SPY in actual recessions because demand goes from "want" to "fix-it-now" — but the absolute return is still negative.`;
  }

  tgt.innerHTML = `<p class="cycle-synthesis-para">${paragraph}</p>
    <div class="cycle-synthesis-links">
      Related views:
      <a href="/core/macro/">Regime returns table &rarr;</a>
      <a href="/core/macro/cycle/">Cycle position &rarr;</a>
      <a href="/core/macro/inflation/">Inflation persistence &rarr;</a>
      <a href="/core/macro/ticker.html?sym=XLY">XLY (Discretionary) drilldown &rarr;</a>
    </div>`;
}

// ---------- main ----------

async function main() {
  try {
    setStatus('stale', 'Loading consumer + housing data…');
    await Promise.all([loadRecessionRanges(), loadAllData()]);

    renderHealthScore();
    renderHousing();
    renderHomeImprovement();
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
