// Housing Cycle dashboard — wires all 20 of the publicly-pullable housing
// metrics into a single decision-relevant view.
//
// Sections follow the housing pipeline causality:
//   1. Activity Pipeline: permits → starts → completions → sales (single-family + multi)
//   2. Inventory & Prices: months supply, HPI, median price, vacancies
//   3. Affordability: 30Y/15Y mortgage, median income, computed monthly-payment ratio
//   4. Stress / Construction / Materials: delinquency, construction employment, lumber, rent
//   5. Market-implied: XHB, ITB, WOOD, HD, LOW, BLDR vs SPY

const state = {
  series: {},
  stocks: {},
  recessionRanges: [],
};
const charts = {};

// ---------- helpers ----------
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
function normalizeSeries(closes, baseDate) {
  if (!closes || !closes.length) return [];
  const idx = closes.findIndex(o => o.date >= baseDate);
  const start = idx >= 0 ? idx : 0;
  const base = closes[start].value;
  if (!base) return [];
  return closes.slice(start).map(o => ({ date: o.date, value: (o.value / base) * 100 }));
}

// ---------- NBER + plugins ----------
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
    const ranges = opts?.ranges; if (!ranges?.length) return;
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
    id: `thr-${Math.random().toString(36).slice(2)}`,
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
    chartOpts.scales.y1 = { position: 'right', grid: { display: false },
      ticks: { color: '#8a94a3', font: { size: 10 }, callback: opts.y2.yTicks },
      title: { display: !!opts.y2.yTitle, text: opts.y2.yTitle, color: '#8a94a3', font: { size: 11 } } };
  }
  charts[canvas.id] = new Chart(canvas.getContext('2d'), {
    type: 'line', data: { datasets }, options: chartOpts,
    plugins: [nberShadingPlugin, ...(opts.extraPlugins || [])],
  });
  return charts[canvas.id];
}
function renderTiles(containerId, tiles) {
  const tgt = el(containerId);
  if (!tgt) return;
  tgt.innerHTML = tiles.map(t => `<div class="cycle-tile ${t.status ? 'cycle-tile-' + t.status : ''}"${t.metric ? ` data-tile-metric="${t.metric}"` : ''} title="${t.help || ''}">
    <div class="cycle-tile-label">${t.label}</div>
    <div class="cycle-tile-value">${t.value}</div>
    <div class="cycle-tile-meta">${t.meta || ''}</div>
    ${t.threshold ? `<div class="cycle-tile-threshold">${t.threshold}</div>` : ''}
  </div>`).join('');
}

// ---------- data load ----------

async function loadAllData() {
  setStatus('stale', 'Loading housing series…');
  const start = '1990-01-01';
  // 11 new + 9 existing housing series, batched for partial-failure tolerance.
  const batches = [
    ['HOUST', 'HOUST1F', 'HOUST5F', 'PERMIT'],          // pipeline 1
    ['COMPUTSA', 'HSN1F', 'EXHOSLUSM495S'],              // pipeline 2
    ['MSACSR', 'CSUSHPISA', 'MSPUS', 'RHVRUSQ156N'],    // inventory + prices
    ['MORTGAGE30US', 'MORTGAGE15US', 'MEHOINUSA672N'],  // affordability
    ['DRSFRMACBS', 'CES2000000001', 'WPU081', 'CUUR0000SEHA', 'PRRESCONS'],  // stress + construction + materials
  ];
  const errors = [];
  for (const b of batches) {
    try {
      const j = await fetchJSON(`/api/fred?series=${b.join(',')}&start=${start}`);
      for (const s of j.series) state.series[s.id] = s.observations;
      if (j.errors?.length) errors.push(...j.errors);
    } catch (err) {
      console.warn(`Batch ${b.join(',')} failed:`, err);
      errors.push({ id: b.join(','), error: String(err.message || err) });
    }
  }
  if (errors.length) console.warn('[housing] missing series:', errors);

  // Stocks
  setStatus('stale', 'Loading housing equities…');
  try {
    const j = await fetchJSON('/api/stocks?mode=history&years=10&symbols=XHB,ITB,WOOD,HD,LOW,BLDR,SPY');
    for (const s of j.series) state.stocks[s.symbol] = s.closes;
  } catch (err) {
    console.warn('stocks fetch failed:', err);
  }

  // Derived YoY series
  const yoyOf = ['HOUST', 'HOUST1F', 'HOUST5F', 'PERMIT', 'COMPUTSA', 'HSN1F',
                 'EXHOSLUSM495S', 'CSUSHPISA', 'WPU081', 'CES2000000001',
                 'PRRESCONS', 'CUUR0000SEHA'];
  for (const id of yoyOf) {
    if (state.series[id]) state.series[`_${id}Yoy`] = yoyPct(state.series[id]);
  }
}

// ---------- Section 1: Activity Pipeline ----------

function renderPipeline() {
  const ds = [];
  function add(seriesId, label, color, opts = {}) {
    const s = state.series[`_${seriesId}Yoy`];
    if (!s?.length) return;
    ds.push({
      label, data: s.map(o => ({ x: o.date, y: o.value })),
      borderColor: color, borderWidth: opts.bw || 1.4, pointRadius: 0, fill: false,
      backgroundColor: opts.fill ? color.replace('rgb', 'rgba').replace(')', ', 0.10)') : 'transparent',
      tension: 0.1, borderDash: opts.dash || [],
    });
  }
  add('PERMIT',         'Permits YoY',          '#5a9cff', { bw: 1.5 });
  add('HOUST1F',        'Starts: SF YoY',       '#f7a700', { bw: 1.8, fill: false });
  add('HOUST5F',        'Starts: MF YoY',       '#a855f7', { bw: 1.2, dash: [3,3] });
  add('COMPUTSA',       'Completions YoY',      '#3ecf8e', { bw: 1.3 });
  add('HSN1F',          'New Sales YoY',        '#ef4f5a', { bw: 1.3 });
  add('EXHOSLUSM495S',  'Existing Sales YoY',   '#8a94a3', { bw: 1.0, dash: [2,2] });

  timeSeriesChart(el('chart-pipeline'), ds, {
    yTitle: 'YoY (%)',
    extraPlugins: [thresholdLinePlugin([{ value: 0, label: '0% YoY', color: 'rgba(138, 148, 163, 0.5)' }])],
  });

  const lp = latestValue(state.series._PERMITYoy || []);
  const lh = latestValue(state.series._HOUSTYoy || []);
  const lh1 = latestValue(state.series._HOUST1FYoy || []);
  const lh5 = latestValue(state.series._HOUST5FYoy || []);
  const lc = latestValue(state.series._COMPUTSAYoy || []);
  const lns = latestValue(state.series._HSN1FYoy || []);
  const les = latestValue(state.series._EXHOSLUSM495SYoy || []);

  const tiles = [
    { metric: 'PERMIT', label: 'Permits YoY', value: lp ? `${lp.value >= 0 ? '+' : ''}${fmt(lp.value, 1)}%` : '—',
      meta: 'leads starts by 1-2mo', threshold: 'falling permits = cycle rollover',
      status: lp ? (lp.value > 5 ? 'ok' : lp.value > -5 ? 'caution' : 'warn') : '' },
    { metric: 'HOUST1F', label: 'SF Starts YoY', value: lh1 ? `${lh1.value >= 0 ? '+' : ''}${fmt(lh1.value, 1)}%` : '—',
      meta: 'cleanest cyclical signal', threshold: 'tracks owner-occupier demand',
      status: lh1 ? (lh1.value > 0 ? 'ok' : lh1.value > -10 ? 'caution' : 'warn') : '' },
    { metric: 'HOUST5F', label: 'MF Starts YoY', value: lh5 ? `${lh5.value >= 0 ? '+' : ''}${fmt(lh5.value, 1)}%` : '—',
      meta: 'driven by rents + cap rates', threshold: 'separate cycle from SF',
      status: lh5 ? (lh5.value > -15 ? 'ok' : lh5.value > -30 ? 'caution' : 'warn') : '' },
    { metric: 'COMPUTSA', label: 'Completions YoY', value: lc ? `${lc.value >= 0 ? '+' : ''}${fmt(lc.value, 1)}%` : '—',
      meta: 'lags starts ~9mo · supply hitting market', threshold: 'rising completions = inventory pressure',
      status: lc ? (lc.value > 0 && lc.value < 10 ? 'ok' : Math.abs(lc.value) > 15 ? 'warn' : 'caution') : '' },
    { metric: 'HSN1F', label: 'New Home Sales YoY', value: lns ? `${lns.value >= 0 ? '+' : ''}${fmt(lns.value, 1)}%` : '—',
      meta: 'volatile but pure builder-demand signal', threshold: '~10% of total volume',
      status: lns ? (lns.value > 0 ? 'ok' : lns.value > -15 ? 'caution' : 'warn') : '' },
    { metric: 'EXHOSLUSM495S', label: 'Existing Sales YoY', value: les ? `${les.value >= 0 ? '+' : ''}${fmt(les.value, 1)}%` : '—',
      meta: '~90% of volume · resale market', threshold: 'rate-lock dynamics dominate',
      status: les ? (les.value > 0 ? 'ok' : les.value > -10 ? 'caution' : 'warn') : '' },
  ];
  renderTiles('tiles-pipeline', tiles);

  let note = '<strong>Pipeline read:</strong> ';
  if (lp && lh1) {
    if (lp.value > lh1.value + 3)      note += `Permits (${lp.value >= 0 ? '+' : ''}${fmt(lp.value, 1)}%) running ahead of SF starts (${lh1.value >= 0 ? '+' : ''}${fmt(lh1.value, 1)}%) — pipeline filling. `;
    else if (lp.value < lh1.value - 3) note += `Permits (${lp.value >= 0 ? '+' : ''}${fmt(lp.value, 1)}%) lagging SF starts (${lh1.value >= 0 ? '+' : ''}${fmt(lh1.value, 1)}%) — <em>builders pulling back; expect starts to follow within 1-2 months</em>. `;
    else                                 note += `Permits (${lp.value >= 0 ? '+' : ''}${fmt(lp.value, 1)}%) and SF starts (${lh1.value >= 0 ? '+' : ''}${fmt(lh1.value, 1)}%) tracking together. `;
  }
  if (lc && lns) {
    if (lc.value > 5 && lns.value < 0) note += `<em>Completions accelerating into a soft sales market — supply pressure building.</em>`;
    else if (lc.value < 0 && lns.value > 0) note += `<em>Completions falling into firm demand — supports prices.</em>`;
    else                                     note += `Completions/sales balance neutral.`;
  }
  el('note-pipeline').innerHTML = note;
}

// ---------- Section 2: Inventory & Prices ----------

function renderInventory() {
  const supply = state.series.MSACSR || [];
  const hpi = state.series._CSUSHPISAYoy || [];
  const vacancy = state.series.RHVRUSQ156N || [];

  timeSeriesChart(el('chart-inventory'), [
    { label: 'Months Supply (left)', data: supply.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#ef4f5a', backgroundColor: 'rgba(239, 79, 90, 0.10)', borderWidth: 1.7, pointRadius: 0, fill: true, tension: 0.1, yAxisID: 'y' },
    { label: 'Case-Shiller HPI YoY (right)', data: hpi.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y1' },
    { label: 'Rental Vacancy % (right)', data: vacancy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.3, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y1' },
  ], {
    yTitle: 'months supply',
    y2: { yTitle: '% (HPI YoY · vacancy)', yTicks: v => `${v}%` },
    extraPlugins: [thresholdLinePlugin([
      { value: 4, label: '4 mo — sellers/balanced line', color: 'rgba(62, 207, 142, 0.5)' },
      { value: 6, label: '6 mo — balanced/buyers line',  color: 'rgba(247, 167, 0, 0.5)' },
    ])],
  });

  const lms = latestValue(supply);
  const lhpi = latestValue(hpi);
  const lvac = latestValue(vacancy);
  const lmsp = latestValue(state.series.MSPUS || []);
  const supplyPct = percentile(supply, lms?.value);

  const tiles = [
    { metric: 'MSACSR', label: 'Months Supply', value: lms ? `${fmt(lms.value, 1)} mo` : '—',
      meta: supplyPct != null ? `${supplyPct}th %ile` : '',
      threshold: '&lt; 4 sellers · 4–6 balanced · &gt; 6 buyers',
      status: lms ? (lms.value > 7 ? 'warn' : lms.value > 5 ? 'caution' : 'ok') : '',
      help: 'Inventory of new homes ÷ monthly sales rate.' },
    { metric: 'CSUSHPISA', label: 'Case-Shiller HPI', value: lhpi ? `${lhpi.value >= 0 ? '+' : ''}${fmt(lhpi.value, 1)}%` : '—',
      meta: 'YoY · lags 6mo · repeat-sales',
      threshold: 'sustainable: 0–6%; bubble territory: &gt; 8%',
      status: lhpi ? (lhpi.value > -1 && lhpi.value < 6 ? 'ok' : Math.abs(lhpi.value) < 9 ? 'caution' : 'warn') : '' },
    { label: 'Median Sales Price', value: lmsp ? `$${(lmsp.value / 1000).toFixed(0)}K` : '—',
      meta: 'quarterly · all sales types',
      threshold: 'level reading; pair with mortgage rate for affordability',
      status: '' },
    { label: 'Rental Vacancy', value: lvac ? `${fmt(lvac.value, 1)}%` : '—',
      meta: 'quarterly · proxy for rental supply pressure',
      threshold: '&lt; 6% tight · &gt; 8% soft',
      status: lvac ? (lvac.value < 6 ? 'caution' : lvac.value < 8 ? 'ok' : 'warn') : '' },
  ];
  renderTiles('tiles-inventory', tiles);

  let note = '<strong>Inventory read:</strong> ';
  if (lms) {
    if (lms.value > 7)        note += `Months supply at ${fmt(lms.value, 1)} — buyers&rsquo; market; expect price weakness if it persists. `;
    else if (lms.value > 5)   note += `Months supply at ${fmt(lms.value, 1)} — balanced-to-soft; builder pricing power moderate. `;
    else                      note += `Months supply at ${fmt(lms.value, 1)} — tight; supports prices and pro-channel demand. `;
  }
  if (lhpi) {
    if (lhpi.value > 6)       note += `<em>HPI ${lhpi.value >= 0 ? '+' : ''}${fmt(lhpi.value, 1)}% YoY — well above wage growth; affordability deteriorating fast.</em>`;
    else if (lhpi.value < 0)  note += `<em>HPI ${fmt(lhpi.value, 1)}% YoY — outright declines, the regime to watch for borrower-equity stress.</em>`;
    else                      note += `HPI ${lhpi.value >= 0 ? '+' : ''}${fmt(lhpi.value, 1)}% — pacing consistent with wage growth.`;
  }
  el('note-inventory').innerHTML = note;
}

// ---------- Section 3: Affordability ----------

// Compute monthly P&I for $1 of mortgage at given annual rate over 30y.
function pAndIMultiplier(annualRatePct, years = 30) {
  const r = (annualRatePct / 100) / 12;
  const n = years * 12;
  if (r === 0) return 1 / n;
  return r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}

function renderAffordability() {
  const m30 = state.series.MORTGAGE30US || [];
  const m15 = state.series.MORTGAGE15US || [];
  const mspus = state.series.MSPUS || [];
  const income = state.series.MEHOINUSA672N || [];

  // Compute "monthly payment as % of monthly income" series.
  // Aligns: monthly mortgage rate (latest of month) × quarterly median price (forward-filled)
  //         ÷ annual median income (forward-filled, /12 for monthly)
  // 80% LTV assumption (typical buyer puts 20% down).
  const paymentRatio = [];
  if (m30.length && mspus.length && income.length) {
    // Build forward-fill maps
    const mspusByMo = new Map();
    let lastP = null;
    const allMonths = new Set();
    for (const o of mspus) { const ym = o.date.slice(0, 7); mspusByMo.set(ym, o.value); }
    const incomeByYear = new Map();
    for (const o of income) incomeByYear.set(o.date.slice(0, 4), o.value);

    // Collect all rate observations and bucket to month-end
    const rateByMo = new Map();
    for (const o of m30) {
      const ym = o.date.slice(0, 7);
      rateByMo.set(ym, o.value); // last value of month wins
    }

    const sortedMonths = [...rateByMo.keys()].sort();
    let currentPrice = null, currentIncome = null;
    for (const ym of sortedMonths) {
      if (mspusByMo.has(ym)) currentPrice = mspusByMo.get(ym);
      const yr = ym.slice(0, 4);
      if (incomeByYear.has(yr)) currentIncome = incomeByYear.get(yr);
      else if (currentIncome == null) {
        // Find closest prior year
        for (const y of [...incomeByYear.keys()].sort().reverse()) {
          if (y <= yr) { currentIncome = incomeByYear.get(y); break; }
        }
      }
      if (currentPrice == null || currentIncome == null) continue;
      const rate = rateByMo.get(ym);
      const loanAmt = currentPrice * 0.80;
      const monthlyPI = loanAmt * pAndIMultiplier(rate);
      const monthlyIncome = currentIncome / 12;
      const ratio = (monthlyPI / monthlyIncome) * 100;
      paymentRatio.push({ date: ym + '-15', value: ratio });
    }
  }

  timeSeriesChart(el('chart-affordability'), [
    { label: '30Y Mortgage', data: m30.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', backgroundColor: 'rgba(247, 167, 0, 0.10)', borderWidth: 1.6, pointRadius: 0, fill: true, tension: 0.1, yAxisID: 'y' },
    { label: '15Y Mortgage', data: m15.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#3ecf8e', borderWidth: 1.4, pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y' },
    { label: 'Monthly P&I as % of income (right)', data: paymentRatio.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#ef4f5a', borderWidth: 1.7, pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y1' },
  ], {
    yTitle: 'mortgage rate (%)',
    y2: { yTitle: 'P&I / income (%)', yTicks: v => `${v}%` },
    extraPlugins: [thresholdLinePlugin([
      { value: 28, label: '28% — Fed mortgage stress threshold', color: 'rgba(239, 79, 90, 0.6)' },
    ])],
  });

  const l30 = latestValue(m30);
  const l15 = latestValue(m15);
  const lmsp = latestValue(state.series.MSPUS || []);
  const linc = latestValue(income);
  const lpr = latestValue(paymentRatio);

  const tiles = [
    { metric: 'MORTGAGE30US', label: '30Y Mortgage', value: l30 ? `${fmt(l30.value, 2)}%` : '—',
      meta: 'Freddie Mac PMMS · weekly',
      threshold: 'each 100bp ≈ +$260/mo on $400K loan',
      status: l30 ? (l30.value < 5.5 ? 'ok' : l30.value < 7 ? 'caution' : 'warn') : '' },
    { metric: 'MORTGAGE15US', label: '15Y Mortgage', value: l15 ? `${fmt(l15.value, 2)}%` : '—',
      meta: 'Freddie Mac PMMS · weekly',
      threshold: 'refi target rate; ~75bp below 30Y typical',
      status: l15 ? (l15.value < 5 ? 'ok' : l15.value < 6.5 ? 'caution' : 'warn') : '' },
    { metric: 'MSPUS', label: 'Median Sales Price', value: lmsp ? `$${(lmsp.value / 1000).toFixed(0)}K` : '—',
      meta: 'quarterly · all-sales',
      threshold: 'pair with rate for affordability check',
      status: '' },
    { label: 'Real Median Family Income', value: linc ? `$${(linc.value / 1000).toFixed(0)}K` : '—',
      meta: 'annual · CPI-deflated',
      threshold: 'denominator of any affordability ratio',
      status: '' },
    { label: 'Monthly P&I / Income', value: lpr ? `${fmt(lpr.value, 1)}%` : '—',
      meta: '20% down · 30Y fixed at current rate',
      threshold: '&lt; 25% healthy · &gt; 30% stretched',
      status: lpr ? (lpr.value < 25 ? 'ok' : lpr.value < 32 ? 'caution' : 'warn') : '' },
    { label: '30Y - 15Y spread', value: l30 && l15 ? `${fmt(l30.value - l15.value, 2)}pp` : '—',
      meta: 'long-end vs short-end mortgage curve',
      threshold: 'wider = duration risk premium expanding',
      status: l30 && l15 ? (Math.abs(l30.value - l15.value - 0.75) < 0.3 ? 'ok' : 'caution') : '' },
  ];
  renderTiles('tiles-affordability', tiles);

  let note = '<strong>Affordability read:</strong> ';
  if (lpr) {
    if (lpr.value > 32)       note += `Monthly P&I at ${fmt(lpr.value, 1)}% of income — <em>severely stretched</em>; marginal buyers locked out of the market. Historically, ratios above this level coincide with collapsed turnover and price softness.`;
    else if (lpr.value > 28)  note += `Monthly P&I at ${fmt(lpr.value, 1)}% of income — stretched; first-time buyer demand suppressed; refi market dead.`;
    else if (lpr.value > 22)  note += `Monthly P&I at ${fmt(lpr.value, 1)}% of income — moderately tight; turnover normal-to-soft.`;
    else                      note += `Monthly P&I at ${fmt(lpr.value, 1)}% of income — affordable; demand-side fundamentals healthy.`;
  }
  el('note-affordability').innerHTML = note;
}

// ---------- Section 4: Stress, Construction & Materials ----------

function renderStress() {
  const delinq = state.series.DRSFRMACBS || [];
  const constrEmp = state.series._CES2000000001Yoy || [];
  const lumber = state.series._WPU081Yoy || [];
  const rent = state.series._CUUR0000SEHAYoy || [];
  const resCons = state.series._PRRESCONSYoy || [];

  timeSeriesChart(el('chart-stress'), [
    { label: 'SF Mortgage Delinquency % (left)', data: delinq.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#ef4f5a', backgroundColor: 'rgba(239, 79, 90, 0.10)', borderWidth: 1.7, pointRadius: 0, fill: true, tension: 0.1, yAxisID: 'y' },
    { label: 'Construction Employment YoY (right)', data: constrEmp.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#3ecf8e', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y1' },
    { label: 'Lumber PPI YoY (right)', data: lumber.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#a855f7', borderWidth: 1.3, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y1' },
    { label: 'Residential Construction Spending YoY (right)', data: resCons.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', borderWidth: 1.5, pointRadius: 0, fill: false, tension: 0.1, yAxisID: 'y1' },
  ], {
    yTitle: 'delinquency (%)',
    y2: { yTitle: 'YoY (%)', yTicks: v => `${v}%` },
    extraPlugins: [thresholdLinePlugin([
      { value: 0, label: '0% YoY', color: 'rgba(138, 148, 163, 0.4)' },
    ])],
  });

  const ld = latestValue(delinq);
  const lce = latestValue(constrEmp);
  const ll = latestValue(lumber);
  const lr = latestValue(rent);
  const lrc = latestValue(resCons);

  const tiles = [
    { metric: 'DRSFRMACBS', label: 'SF Mortgage Delinquency', value: ld ? `${fmt(ld.value, 2)}%` : '—',
      meta: 'quarterly · 30+ days past due',
      threshold: '&lt; 2% benign · &gt; 5% recession-level',
      status: ld ? (ld.value < 2 ? 'ok' : ld.value < 4 ? 'caution' : 'warn') : '' },
    { metric: 'CES2000000001', label: 'Construction Employment YoY', value: lce ? `${lce.value >= 0 ? '+' : ''}${fmt(lce.value, 1)}%` : '—',
      meta: 'monthly · labor-side cycle indicator',
      threshold: 'falls hard 1-2Q before recession',
      status: lce ? (lce.value > 0 ? 'ok' : lce.value > -3 ? 'caution' : 'warn') : '' },
    { metric: 'WPU081', label: 'Lumber PPI YoY', value: ll ? `${ll.value >= 0 ? '+' : ''}${fmt(ll.value, 1)}%` : '—',
      meta: 'monthly · WPU081',
      threshold: 'rising = ticket-size tailwind for HD/LOW',
      status: ll ? (ll.value > 0 && ll.value < 15 ? 'ok' : ll.value < -10 ? 'warn' : 'caution') : '' },
    { label: 'Rent of Primary Residence YoY', value: lr ? `${lr.value >= 0 ? '+' : ''}${fmt(lr.value, 1)}%` : '—',
      meta: 'BLS · lags actual rent dynamics 6-12mo',
      threshold: '~3% trend; &gt; 5% = persistent inflation source',
      status: lr ? (lr.value < 3.5 ? 'ok' : lr.value < 5 ? 'caution' : 'warn') : '' },
    { label: 'Residential Construction Spending YoY', value: lrc ? `${lrc.value >= 0 ? '+' : ''}${fmt(lrc.value, 1)}%` : '—',
      meta: 'monthly · dollar-value activity',
      threshold: 'leading construction labor by 3-6mo',
      status: lrc ? (lrc.value > 0 ? 'ok' : lrc.value > -10 ? 'caution' : 'warn') : '' },
  ];
  renderTiles('tiles-stress', tiles);

  let note = '<strong>Stress read:</strong> ';
  if (ld) {
    if (ld.value > 3.5)      note += `<em>Mortgage delinquency at ${fmt(ld.value, 2)}% — elevated; rising delinquencies precede HPI weakness by 1-2 quarters.</em>`;
    else if (ld.value > 2.5) note += `Mortgage delinquency at ${fmt(ld.value, 2)}% — normalizing back toward historical average. `;
    else                     note += `Mortgage delinquency at ${fmt(ld.value, 2)}% — benign. `;
  }
  if (lce && lrc) {
    if (lce.value < 0 && lrc.value < 0) note += `<em>Construction spending AND employment both contracting — cycle-rollover confirmed.</em>`;
    else if (lce.value > 2 && lrc.value > 5) note += `<em>Construction spending and employment both expanding — cycle-strength confirmed.</em>`;
  }
  el('note-stress').innerHTML = note;
}

// ---------- Section 5: Market-Implied (Equities) ----------

function renderEquities() {
  const baseDate = '2018-01-01';
  const ds = [];
  const colors = { XHB: '#f7a700', ITB: '#5a9cff', WOOD: '#a855f7', HD: '#3ecf8e', LOW: '#ef4f5a', BLDR: '#8a94a3', SPY: '#e5e9ee' };
  for (const sym of ['XHB', 'ITB', 'WOOD', 'HD', 'LOW', 'BLDR', 'SPY']) {
    const s = state.stocks[sym];
    if (!s?.length) continue;
    const norm = normalizeSeries(s, baseDate);
    if (!norm.length) continue;
    ds.push({
      label: sym === 'SPY' ? 'SPY (benchmark)' : sym,
      data: norm.map(o => ({ x: o.date, y: o.value })),
      borderColor: colors[sym],
      borderWidth: sym === 'SPY' ? 1.0 : (sym === 'XHB' || sym === 'ITB') ? 1.8 : 1.3,
      borderDash: sym === 'SPY' ? [4, 4] : [],
      pointRadius: 0, fill: false, tension: 0.1,
    });
  }

  timeSeriesChart(el('chart-equities'), ds, {
    yTitle: 'rebased to 100 at start',
    extraPlugins: [thresholdLinePlugin([
      { value: 100, label: 'base', color: 'rgba(138, 148, 163, 0.4)' },
    ])],
  });

  function pctChange(closes, days) {
    if (!closes || closes.length < days + 1) return null;
    const r = closes[closes.length - 1].value;
    const o = closes[closes.length - 1 - days].value;
    if (!r || !o) return null;
    return (r / o - 1) * 100;
  }
  const xhb1y = pctChange(state.stocks.XHB, 252);
  const itb1y = pctChange(state.stocks.ITB, 252);
  const wood1y = pctChange(state.stocks.WOOD, 252);
  const hd1y = pctChange(state.stocks.HD, 252);
  const low1y = pctChange(state.stocks.LOW, 252);
  const bldr1y = pctChange(state.stocks.BLDR, 252);
  const spy1y = pctChange(state.stocks.SPY, 252);

  const tiles = [
    { label: 'XHB Homebuilders 1Y', value: xhb1y != null ? `${xhb1y >= 0 ? '+' : ''}${fmt(xhb1y, 1)}%` : '—',
      meta: spy1y != null ? `vs SPY: ${(xhb1y - spy1y >= 0 ? '+' : '')}${fmt(xhb1y - spy1y, 1)}pp` : '',
      threshold: 'leads housing-cycle data 6-9mo',
      status: xhb1y != null && spy1y != null ? (xhb1y > spy1y + 3 ? 'ok' : xhb1y > spy1y - 3 ? 'caution' : 'warn') : '' },
    { label: 'ITB Home Construction 1Y', value: itb1y != null ? `${itb1y >= 0 ? '+' : ''}${fmt(itb1y, 1)}%` : '—',
      meta: spy1y != null ? `vs SPY: ${(itb1y - spy1y >= 0 ? '+' : '')}${fmt(itb1y - spy1y, 1)}pp` : '',
      threshold: 'pure-play builder concentration',
      status: itb1y != null && spy1y != null ? (itb1y > spy1y + 3 ? 'ok' : itb1y > spy1y - 3 ? 'caution' : 'warn') : '' },
    { label: 'WOOD Lumber/Forestry 1Y', value: wood1y != null ? `${wood1y >= 0 ? '+' : ''}${fmt(wood1y, 1)}%` : '—',
      meta: 'lumber distributor / forest-products proxy',
      threshold: 'tracks lumber PPI with a lag',
      status: wood1y != null ? (wood1y > 5 ? 'ok' : wood1y > -10 ? 'caution' : 'warn') : '' },
    { label: 'HD 1Y total return', value: hd1y != null ? `${hd1y >= 0 ? '+' : ''}${fmt(hd1y, 1)}%` : '—',
      meta: spy1y != null ? `vs SPY: ${(hd1y - spy1y >= 0 ? '+' : '')}${fmt(hd1y - spy1y, 1)}pp` : '',
      threshold: 'home-improvement bellwether',
      status: hd1y != null && spy1y != null ? (hd1y > spy1y + 3 ? 'ok' : hd1y > spy1y - 3 ? 'caution' : 'warn') : '' },
    { label: 'LOW 1Y total return', value: low1y != null ? `${low1y >= 0 ? '+' : ''}${fmt(low1y, 1)}%` : '—',
      meta: spy1y != null ? `vs SPY: ${(low1y - spy1y >= 0 ? '+' : '')}${fmt(low1y - spy1y, 1)}pp` : '',
      threshold: '#2 home-improvement retailer',
      status: low1y != null && spy1y != null ? (low1y > spy1y + 3 ? 'ok' : low1y > spy1y - 3 ? 'caution' : 'warn') : '' },
    { label: 'BLDR Builders FirstSource 1Y', value: bldr1y != null ? `${bldr1y >= 0 ? '+' : ''}${fmt(bldr1y, 1)}%` : '—',
      meta: 'pure-play lumber/building-materials distributor',
      threshold: 'tracks single-family starts with ~2mo lag',
      status: bldr1y != null && spy1y != null ? (bldr1y > spy1y ? 'ok' : bldr1y > spy1y - 10 ? 'caution' : 'warn') : '' },
  ];
  renderTiles('tiles-equities', tiles);

  let note = '<strong>Market-implied read:</strong> ';
  if (xhb1y != null && spy1y != null) {
    const builderEdge = xhb1y - spy1y;
    if (builderEdge > 5)        note += `<em>Builders (XHB) outperforming SPY by ${fmt(builderEdge, 1)}pp over 1y — market pricing housing-cycle strength ahead of fundamentals.</em>`;
    else if (builderEdge < -5)  note += `<em>Builders (XHB) underperforming SPY by ${fmt(-builderEdge, 1)}pp — market pricing housing-cycle weakness; expect fundamentals to follow.</em>`;
    else                        note += `Builders tracking SPY (within ${fmt(Math.abs(builderEdge), 1)}pp). No directional housing-equity bid.`;
  }
  if (hd1y != null && low1y != null && bldr1y != null) {
    note += ` HD/LOW avg ${fmt((hd1y + low1y) / 2, 1)}% vs BLDR ${fmt(bldr1y, 1)}% — `;
    if (Math.abs((hd1y + low1y) / 2 - bldr1y) > 15) {
      note += `wide retail-vs-distributor divergence; usually tied to channel-mix dynamics.`;
    } else {
      note += `retail and distributors moving together.`;
    }
  }
  el('note-equities').innerHTML = note;
}

// ---------- Composite Housing Cycle Score ----------

function computeHousingScore() {
  const signals = [];

  // Months supply (30%) — primary cycle indicator
  const lms = latestValue(state.series.MSACSR || []);
  if (lms) {
    // 3 = 0 (tight/early-cycle), 5.5 = 50, 8 = 100 (oversupplied/late-cycle)
    const score = Math.min(100, Math.max(0, ((lms.value - 3) / 5) * 100));
    signals.push({ name: 'Months Supply', score, weight: 0.30, raw: `${fmt(lms.value, 1)}mo` });
  }
  // Permits trend (15%) — leading indicator
  const lp = latestValue(state.series._PERMITYoy || []);
  if (lp) {
    // +15% = 0 (strong), 0% = 50, -15% = 100 (collapsing)
    const score = Math.min(100, Math.max(0, 50 - lp.value * (10/3)));
    signals.push({ name: 'Permits YoY', score, weight: 0.15, raw: `${lp.value >= 0 ? '+' : ''}${fmt(lp.value, 1)}%` });
  }
  // 30Y mortgage (15%) — demand pricing
  const lmt = latestValue(state.series.MORTGAGE30US || []);
  if (lmt) {
    // 4% = 0 (cheap), 6% = 50, 9% = 100 (very expensive)
    const score = Math.min(100, Math.max(0, ((lmt.value - 4) / 5) * 100));
    signals.push({ name: '30Y Mortgage', score, weight: 0.15, raw: `${fmt(lmt.value, 2)}%` });
  }
  // Single-family starts trend (15%)
  const lh1 = latestValue(state.series._HOUST1FYoy || []);
  if (lh1) {
    const score = Math.min(100, Math.max(0, 50 - lh1.value * (10/3)));
    signals.push({ name: 'SF Starts YoY', score, weight: 0.15, raw: `${lh1.value >= 0 ? '+' : ''}${fmt(lh1.value, 1)}%` });
  }
  // Case-Shiller HPI YoY (10%) — overheat / undershoot signal
  const lhpi = latestValue(state.series._CSUSHPISAYoy || []);
  if (lhpi) {
    // -3% = 50 (decline = late-cycle/recession), +3% = 0 (sustainable), +10% = 100 (overheating)
    const score = Math.min(100, Math.max(0, lhpi.value > 0 ? (lhpi.value / 10) * 100 : 50 + Math.abs(lhpi.value) * 8));
    signals.push({ name: 'HPI YoY', score, weight: 0.10, raw: `${lhpi.value >= 0 ? '+' : ''}${fmt(lhpi.value, 1)}%` });
  }
  // Mortgage delinquency (10%) — distress
  const ld = latestValue(state.series.DRSFRMACBS || []);
  if (ld) {
    // 1.5% = 0, 3% = 50, 6% = 100
    const score = Math.min(100, Math.max(0, ((ld.value - 1.5) / 4.5) * 100));
    signals.push({ name: 'SF Delinquency', score, weight: 0.10, raw: `${fmt(ld.value, 2)}%` });
  }
  // Construction employment trend (5%)
  const lce = latestValue(state.series._CES2000000001Yoy || []);
  if (lce) {
    // +5% = 0, 0% = 50, -5% = 100
    const score = Math.min(100, Math.max(0, 50 - lce.value * 10));
    signals.push({ name: 'Construction Emp YoY', score, weight: 0.05, raw: `${lce.value >= 0 ? '+' : ''}${fmt(lce.value, 1)}%` });
  }

  if (!signals.length) return null;
  const totalW = signals.reduce((s, n) => s + n.weight, 0);
  const weighted = signals.reduce((s, n) => s + n.score * n.weight, 0) / totalW;
  return { score: weighted, signals };
}

function renderHousingScore() {
  const result = computeHousingScore();
  const tgt = el('housing-score-section');
  if (!tgt || !result) return;
  const score = result.score;
  let phase, color;
  if (score < 25)      { phase = 'Early-Cycle Recovery';  color = '#3ecf8e'; }
  else if (score < 45) { phase = 'Mid-Cycle Expansion';   color = '#5a9cff'; }
  else if (score < 65) { phase = 'Late-Cycle';            color = '#f7a700'; }
  else if (score < 80) { phase = 'Cooling';               color = '#ef4f5a'; }
  else                 { phase = 'Contraction';           color = '#ef4f5a'; }

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
        <div class="cs-score-label">HOUSING CYCLE SCORE</div>
        <div class="cs-score-value">${score.toFixed(0)}<span class="cs-score-scale">/100</span></div>
        <div class="cs-score-phase" style="color:${color}">${phase}</div>
        <div class="cs-score-desc">0 = early-cycle recovery (cheap rates, tight inventory, builders rebuilding); 100 = contraction (oversupplied, expensive rates, falling permits).</div>
      </div>
      <div class="cs-signals">
        <div class="cs-signals-title">Component readings</div>
        ${bars}
        <div class="cs-weights-note">Weights: Months Supply 30% · Permits 15% · 30Y Mortgage 15% · SF Starts 15% · HPI 10% · Delinquency 10% · Construction Emp 5%.</div>
      </div>
    </div>
  `;
}

// ---------- Synthesis ----------

function renderSynthesis() {
  const result = computeHousingScore();
  const tgt = el('housing-synthesis-content');
  if (!tgt || !result) return;
  const score = result.score;
  const lms = latestValue(state.series.MSACSR || []);
  const lmt = latestValue(state.series.MORTGAGE30US || []);

  let para = '';
  if (score < 25) {
    para = `Housing cycle composite at <strong>${score.toFixed(0)}/100</strong> &mdash; <strong>early-cycle recovery</strong>. Tight inventory, falling rates, and rising permits are the typical setup. For housing-exposed P&L: <em>maximum exposure</em>. Builders, materials, home-improvement retailers all benefit. ETF beta highest in this regime.`;
  } else if (score < 45) {
    para = `Housing cycle composite at <strong>${score.toFixed(0)}/100</strong> &mdash; <strong>mid-cycle expansion</strong>. Activity expanding, prices rising, no immediate stress signals. ${lmt ? `30Y mortgage at ${fmt(lmt.value, 2)}% is the swing variable. ` : ''}For housing-exposed P&L: <em>full exposure with attention to inventory</em> &mdash; the mid-cycle is when retailers and builders earn the most.`;
  } else if (score < 65) {
    para = `Housing cycle composite at <strong>${score.toFixed(0)}/100</strong> &mdash; <strong>late-cycle</strong>. ${lms ? `Months supply at ${fmt(lms.value, 1)} indicates inventory building. ` : ''}Affordability stretched, marginal buyers exiting. For housing-exposed P&L: <em>reduce exposure to cyclical names</em>; rotate from builders/distributors toward HD/LOW (more recession-resilient demand). Lumber distributors most exposed to next-leg-down.`;
  } else if (score < 80) {
    para = `Housing cycle composite at <strong>${score.toFixed(0)}/100</strong> &mdash; <strong>cooling</strong>. Multiple indicators in caution territory; expect transactions to slow further. For housing-exposed P&L: <em>defensive bias</em>. Repair/remodel demand resilient; new-construction-tied demand soft. Builder ETFs (XHB/ITB) historically front-run the rebound by 6-9 months &mdash; watch for relative strength inflecting up.`;
  } else {
    para = `Housing cycle composite at <strong>${score.toFixed(0)}/100</strong> &mdash; <strong>contraction</strong>. The 2008-style regime: high rates + oversupply + rising delinquencies. For housing-exposed P&L: <em>survival mode</em>. Demand evaporates first in pro-channel and discretionary remodel; staples-of-the-home (paint, hardware, HVAC repair) hold up best. Bottom of the housing cycle is historically where XHB starts the next 5-year run.`;
  }

  tgt.innerHTML = `<p class="cycle-synthesis-para">${para}</p>
    <div class="cycle-synthesis-links">
      Related views:
      <a href="/core/macro/">Regime returns &rarr;</a>
      <a href="/core/macro/cycle/">Cycle position &rarr;</a>
      <a href="/core/macro/real-economy/">Consumer + HI &rarr;</a>
      <a href="/core/macro/ticker.html?sym=XHB">XHB drilldown &rarr;</a>
    </div>`;
}

// ---------- main ----------

async function main() {
  try {
    setStatus('stale', 'Loading housing data…');
    await Promise.all([loadRecessionRanges(), loadAllData()]);
    renderHousingScore();
    renderPipeline();
    renderInventory();
    renderAffordability();
    renderStress();
    renderEquities();
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
    seriesToCSV('siberforge-housing.csv', series);
  };
}).catch(err => console.warn('export hook load failed:', err));
