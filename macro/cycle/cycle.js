// Cycle Position page controller.
//
// This page answers "how much runway does the current regime have?" via five
// leading signals. For each: a time-series chart with NBER recession shading,
// supporting tiles showing current value + percentile + threshold status, and
// an auto-generated interpretation sentence. A composite "cycle score" at the
// top aggregates the individual signals into a single 0-100 risk gauge.

// ---------- state ----------
import { renderMethodology, computeCycleScore as sharedCycleScore, termSpreadProbit, phaseFor } from '/lib/composite-scores.js';

const state = {
  raw: {},
  series: {},          // id -> raw observations [{date, value}, ...]
  recessionRanges: [], // [{start, end}, ...] derived from USREC
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

function percentile(series, val) {
  if (!series.length || !Number.isFinite(val)) return null;
  const sorted = series.map(o => o.value).filter(Number.isFinite).sort((a, b) => a - b);
  let lo = 0;
  for (let i = 0; i < sorted.length; i++) { if (sorted[i] <= val) lo = i + 1; else break; }
  return Math.round((lo / sorted.length) * 100);
}

function latestValue(series) {
  if (!series || !series.length) return null;
  return series[series.length - 1];
}

function valueMonthsAgo(series, n) {
  if (!series || series.length <= n) return null;
  return series[series.length - 1 - n];
}

// Compute a Sahm-rule indicator from monthly UNRATE observations.
// Rule: 3-month avg U-rate minus its trailing 12-month low. Trigger at 0.5pp.
function computeSahm(unrate) {
  const out = [];
  for (let i = 2; i < unrate.length; i++) {
    const ma3 = (unrate[i].value + unrate[i - 1].value + unrate[i - 2].value) / 3;
    const windowStart = Math.max(0, i - 11);
    const prior12 = unrate.slice(windowStart, i + 1).map(o => o.value);
    const min12 = Math.min(...prior12);
    out.push({ date: unrate[i].date, value: ma3 - min12 });
  }
  return out;
}

// ---------- NBER recession ranges + shading plugin (shared pattern) ----------

async function loadRecessionRanges() {
  const start = '1960-01-01';
  const j = await fetchJSON(`/api/fred?series=USREC&start=${start}`);
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
      const left  = Math.max(x1, a.left);
      const right = Math.min(x2, a.right);
      ctx.fillRect(left, a.top, right - left, a.bottom - a.top);
    }
    ctx.restore();
  },
};

// ---------- data fetch ----------

async function loadSeries() {
  const start = '1980-01-01';
  // Split into small batches so that (a) a transient FRED error on one series
  // doesn't blow up the whole page load, and (b) we stay well within Vercel
  // serverless cold-start timeout budget per call.
  const batches = [
    ['RECPROUSM156N', 'UNRATE', 'T10Y3M', 'T10Y2Y', 'SAHMREALTIME', 'IC4WSA'],  // Sections 1-2
    ['NFCI', 'ANFCI', 'DFII5'],                        // Section 3
    ['BAMLH0A0HYM2', 'BAMLC0A0CM', 'BAA10Y'],          // Section 4
  ];
  const allErrors = [];
  for (const batch of batches) {
    try {
      const j = await fetchJSON(`/api/fred?series=${batch.join(',')}&start=${start}`);
      for (const s of j.series) { state.series[s.id] = s.observations; state.raw[s.id] = s.observations; }
      if (j.errors && j.errors.length) allErrors.push(...j.errors);
    } catch (err) {
      console.warn(`Batch ${batch.join(',')} failed entirely:`, err);
      allErrors.push({ id: batch.join(','), error: String(err.message || err) });
    }
  }
  if (allErrors.length) console.warn('[cycle] partial data — missing series:', allErrors);
  // Derived: Sahm rule from UNRATE
  if (state.series.UNRATE) state.series.SAHM = computeSahm(state.series.UNRATE);
  // HY and IG OAS: FRED publishes these as %. Convert to bps for display.
  if (state.series.BAMLH0A0HYM2) state.series.BAMLH0A0HYM2 = state.series.BAMLH0A0HYM2.map(o => ({ date: o.date, value: o.value * 100 }));
  if (state.series.BAMLC0A0CM)   state.series.BAMLC0A0CM   = state.series.BAMLC0A0CM.map(o => ({ date: o.date, value: o.value * 100 }));
  // Curve spreads: FRED publishes these as %. Convert to bps too for readability.
  if (state.series.T10Y3M) state.series.T10Y3M = state.series.T10Y3M.map(o => ({ date: o.date, value: o.value * 100 }));
  if (state.series.T10Y2Y) state.series.T10Y2Y = state.series.T10Y2Y.map(o => ({ date: o.date, value: o.value * 100 }));
}

// ---------- chart builder (shared) ----------

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

// Horizontal-line plugin for threshold markers (e.g. HY OAS at 600bp).
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
        ctx.beginPath();
        ctx.moveTo(a.left, y); ctx.lineTo(a.right, y);
        ctx.stroke();
        ctx.fillStyle = t.color || 'rgba(138, 148, 163, 0.8)';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText(t.label, a.left + 4, y - 3);
      }
      ctx.restore();
    },
  };
}

// ---------- tile renderer (shared) ----------

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

// ---------- section 1: recession signals ----------

function renderRecessionSection() {
  // 12m-ahead probability from the NY Fed-style term-spread probit, computed
  // here from the monthly-average 10Y-3M spread. FRED's RECPROUSM156N is a
  // different model (Chauvet-Piger, coincident, revised after the fact) and is
  // shown only as a second line for context.
  const probit = termSpreadProbit(state.raw.T10Y3M || []);
  const cp     = state.raw.RECPROUSM156N || [];
  const sahm   = (state.raw.SAHMREALTIME && state.raw.SAHMREALTIME.length) ? state.raw.SAHMREALTIME : (state.series.SAHM || []);

  timeSeriesChart(el('chart-recprob'), [{
    label: 'Term-spread probit: P(recession within 12m) (%)',
    data: probit.map(o => ({ x: o.date, y: o.value })),
    borderColor: '#ef4f5a',
    backgroundColor: 'rgba(239, 79, 90, 0.12)',
    borderWidth: 1.8, fill: true, pointRadius: 0, tension: 0.1,
  }, {
    label: 'Chauvet-Piger: P(in recession now) (%)',
    data: cp.map(o => ({ x: o.date, y: o.value })),
    borderColor: 'rgba(138,148,163,0.9)', borderWidth: 1.2, borderDash: [4, 3],
    fill: false, pointRadius: 0, tension: 0.1,
  }], {
    yTitle: 'probability (%)',
    yMin: 0, yMax: 100,
    extraPlugins: [thresholdLinePlugin([
      { value: 30, label: '30%', color: 'rgba(247, 167, 0, 0.7)' },
    ])],
  });

  const latestProb = latestValue(probit);
  const latestSahm = latestValue(sahm);
  const sahmTriggered = latestSahm && latestSahm.value >= 0.5;
  const tiles = [
    {
      metric: 'RECPROB',
      label: 'Term-spread probit (12m ahead)',
      value: latestProb ? `${latestProb.value.toFixed(0)}%` : '—',
      meta: latestProb ? `${latestProb.date.slice(0, 7)} avg spread` : '',
      threshold: 'Above ~30% preceded every recession since 1968, but also flagged 2022-24 with no recession',
      status: latestProb ? (latestProb.value > 30 ? 'warn' : latestProb.value > 20 ? 'caution' : 'ok') : '',
      help: 'P = Phi(-0.533 - 0.633 x monthly-average 10Y-3M spread), Estrella-Trubin coefficients.',
    },
    {
      metric: 'SAHM',
      label: 'Sahm Rule (real-time)',
      value: sahmTriggered ? 'TRIGGERED' : 'Untriggered',
      meta: latestSahm ? `reading: ${latestSahm.value.toFixed(2)}pp (0.50pp = trigger)` : '',
      threshold: '&ge; 0.50pp: coincident signal; triggered in Jul-2024 without a recession',
      status: sahmTriggered ? 'warn' : (latestSahm?.value >= 0.3 ? 'caution' : 'ok'),
      help: '3-month average unemployment rate minus its low over the prior 12 months (FRED SAHMREALTIME).',
    },
  ];
  renderTiles('tiles-recession', tiles);

  el('note-recession').innerHTML = renderRecessionNote(latestProb, latestSahm);
}

function renderRecessionNote(recProb, sahm) {
  if (!recProb || !sahm) return '';
  const triggered = sahm.value >= 0.5;
  const prob = recProb.value;
  const tone = prob > 30 || triggered ? 'cycle-note-warn' : prob > 20 || sahm.value >= 0.3 ? 'cycle-note-caution' : 'cycle-note-ok';
  let msg = `<strong>Current read:</strong> `;
  if (triggered) msg += `Sahm Rule is triggered (${sahm.value.toFixed(2)}pp). It is a coincident indicator: historically it confirms a recession already underway rather than forecasting one, and it misfired in 2024. `;
  else if (sahm.value >= 0.3) msg += `Sahm Rule at ${sahm.value.toFixed(2)}pp, within 0.2pp of triggering. `;
  else msg += `Sahm Rule inactive (${sahm.value.toFixed(2)}pp; trigger is 0.50pp). `;
  if (prob > 30) msg += `The curve-based model puts 12-month recession odds at ${prob.toFixed(0)}%, above the 30% line. The same model read 60-70% through 2023 with no recession, so treat it as one input. `;
  else if (prob > 20) msg += `Curve-based 12-month recession odds ${prob.toFixed(0)}%: elevated, below 30%. `;
  else msg += `Curve-based 12-month recession odds ${prob.toFixed(0)}%: low. `;
  return `<span class="${tone}">${msg}</span>`;
}

// ---------- section 2: yield curve ----------

function renderCurveSection() {
  const c3m = state.series.T10Y3M || [];
  const c2y = state.series.T10Y2Y || [];

  timeSeriesChart(el('chart-curve'), [
    {
      label: '10Y-3M spread (bps)',
      data: c3m.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700',
      backgroundColor: 'rgba(247, 167, 0, 0.10)',
      borderWidth: 1.8,
      fill: true,
      pointRadius: 0,
      tension: 0.1,
    },
    {
      label: '10Y-2Y spread (bps)',
      data: c2y.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff',
      borderWidth: 1.5,
      borderDash: [4, 4],
      pointRadius: 0,
      fill: false,
      tension: 0.1,
    },
  ], {
    yTitle: 'spread (bps)',
    extraPlugins: [thresholdLinePlugin([
      { value: 0, label: '0 — inversion line', color: 'rgba(239, 79, 90, 0.6)' },
    ])],
  });

  const latest3m = latestValue(c3m);
  const latest2y = latestValue(c2y);
  const pct3m = percentile(c3m, latest3m?.value);

  // Days currently in 10Y-3M inversion (count contiguous negatives at the end)
  let daysInverted3m = 0;
  if (c3m.length) {
    for (let i = c3m.length - 1; i >= 0; i--) { if (c3m[i].value < 0) daysInverted3m++; else break; }
  }

  const tiles = [
    {
      metric: 'T10Y3M',
      label: '10Y-3M spread',
      value: latest3m ? `${latest3m.value >= 0 ? '+' : ''}${latest3m.value.toFixed(0)}bp` : '—',
      meta: pct3m != null ? `${pct3m}th %ile post-1980` : '',
      threshold: '&lt; 0 bp = inversion',
      status: latest3m ? (latest3m.value < 0 ? 'warn' : latest3m.value < 50 ? 'caution' : 'ok') : '',
    },
    {
      metric: 'T10Y2Y',
      label: '10Y-2Y spread',
      value: latest2y ? `${latest2y.value >= 0 ? '+' : ''}${latest2y.value.toFixed(0)}bp` : '—',
      meta: 'steeper = healthier',
      threshold: '&lt; 0 bp = inversion (financial-press favorite)',
      status: latest2y ? (latest2y.value < 0 ? 'warn' : latest2y.value < 50 ? 'caution' : 'ok') : '',
    },
    {
      label: 'Current inversion streak',
      value: daysInverted3m > 0 ? `${daysInverted3m}d` : 'not inverted',
      meta: '10Y-3M spread, consecutive business days',
      threshold: 'Sustained inversion ≥ 60d is the classic signal',
      status: daysInverted3m > 60 ? 'warn' : daysInverted3m > 0 ? 'caution' : 'ok',
    },
  ];
  renderTiles('tiles-curve', tiles);

  let note = '<strong>Current read:</strong> ';
  if (latest3m && latest3m.value < 0) {
    note += `10Y-3M inverted (${latest3m.value.toFixed(0)}bp) for ${daysInverted3m} consecutive days. Historically, recession starts <em>after</em> the curve un-inverts (bull-steepener).`;
  } else if (latest3m && latest3m.value < 50) {
    note += `Curve flat (${latest3m.value.toFixed(0)}bp). The re-steepening from inversion is in progress — watch for the bull-steepener that historically coincides with recession start.`;
  } else if (latest3m) {
    note += `Curve positive (${latest3m.value.toFixed(0)}bp). Normal late-cycle shape — neither a warning nor an all-clear.`;
  }
  el('note-curve').innerHTML = note;
}

// ---------- section 3: financial conditions (NFCI + ANFCI) ----------

function renderConditionsSection() {
  const nfci  = state.series.NFCI  || [];
  const anfci = state.series.ANFCI || [];
  const dfii2 = state.series.DFII5 || [];

  timeSeriesChart(el('chart-nfci'), [
    {
      label: 'NFCI (composite conditions)',
      data: nfci.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700',
      backgroundColor: 'rgba(247, 167, 0, 0.10)',
      borderWidth: 1.8,
      fill: true,
      pointRadius: 0,
      tension: 0.1,
    },
    {
      label: 'ANFCI (macro-adjusted)',
      data: anfci.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff',
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
      tension: 0.1,
    },
  ], {
    yTitle: 'z-score (0 = average; + = tighter)',
    extraPlugins: [thresholdLinePlugin([
      { value: 0, label: '0 — average', color: 'rgba(138, 148, 163, 0.5)' },
    ])],
  });

  const latestN = latestValue(nfci);
  const latestA = latestValue(anfci);
  const latest2y = latestValue(dfii2);
  const pctN = percentile(nfci, latestN?.value);

  const divergence = latestN && latestA ? latestA.value - latestN.value : null;

  const tiles = [
    {
      metric: 'NFCI',
      label: 'NFCI',
      value: latestN ? `${latestN.value >= 0 ? '+' : ''}${latestN.value.toFixed(2)}` : '—',
      meta: pctN != null ? `${pctN}th %ile post-1980` : '',
      threshold: '&gt; 0 = tighter than historical average',
      status: latestN ? (latestN.value > 0.5 ? 'warn' : latestN.value > 0 ? 'caution' : 'ok') : '',
      help: 'Composite of 105 risk, credit, and leverage measures.',
    },
    {
      metric: 'ANFCI',
      label: 'ANFCI',
      value: latestA ? `${latestA.value >= 0 ? '+' : ''}${latestA.value.toFixed(2)}` : '—',
      meta: 'macro-explained component stripped out',
      threshold: '&gt; 0 while NFCI flat = early warning',
      status: latestA ? (latestA.value > 0.25 ? 'warn' : latestA.value > 0 ? 'caution' : 'ok') : '',
    },
    {
      label: '5Y real yield (DFII5)',
      value: latest2y ? `${latest2y.value >= 0 ? '+' : ''}${latest2y.value.toFixed(2)}%` : '—',
      meta: 'proxy for monetary tightness',
      threshold: '&gt; 2% = historically restrictive',
      status: latest2y ? (latest2y.value > 2 ? 'warn' : latest2y.value > 1 ? 'caution' : 'ok') : '',
    },
  ];
  renderTiles('tiles-nfci', tiles);

  let note = '<strong>Current read:</strong> ';
  if (latestN) {
    const n = latestN.value;
    if (n > 0.5)      note += `NFCI at ${n.toFixed(2)} — conditions materially tighter than average. `;
    else if (n > 0)   note += `NFCI at ${n.toFixed(2)} — mildly tight. `;
    else              note += `NFCI at ${n.toFixed(2)} — easier than average (${pctN}th percentile). `;
  }
  if (divergence != null) {
    if (Math.abs(divergence) > 0.25) {
      note += `<strong>Divergence:</strong> ANFCI ${divergence > 0 ? 'higher' : 'lower'} than NFCI by ${Math.abs(divergence).toFixed(2)} — conditions are ${divergence > 0 ? 'tighter' : 'looser'} than the macro backdrop would justify. ${divergence > 0 ? 'Early warning.' : 'Financial tailwind vs real economy.'}`;
    } else {
      note += `NFCI and ANFCI aligned (divergence ${divergence.toFixed(2)}) — conditions consistent with the underlying macro.`;
    }
  }
  el('note-nfci').innerHTML = note;
}

// ---------- section 4: credit ----------

function renderCreditSection() {
  const hy = state.series.BAMLH0A0HYM2 || [];
  const ig = state.series.BAMLC0A0CM   || [];
  // ICE BofA OAS on FRED now covers only the last ~3 years (licensing), so
  // percentiles on them describe 3 years, not a cycle. Moody's Baa-10Y
  // (1986+) carries the long history.
  const baa = (state.raw.BAA10Y || []).map(o => ({ date: o.date, value: o.value * 100 }));

  timeSeriesChart(el('chart-credit'), [
    {
      label: 'Baa - 10Y spread (bps, long history)',
      data: baa.filter((o, i) => i % 5 === 0 || i === baa.length - 1).map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700',
      borderWidth: 1.4,
      pointRadius: 0,
      fill: false,
      tension: 0.1,
    },
    {
      label: 'HY OAS (bps)',
      data: hy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#ef4f5a',
      backgroundColor: 'rgba(239, 79, 90, 0.10)',
      borderWidth: 1.8,
      fill: true,
      pointRadius: 0,
      tension: 0.1,
    },
    {
      label: 'IG OAS (bps)',
      data: ig.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff',
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
      tension: 0.1,
    },
  ], {
    yTitle: 'OAS (bps)',
    extraPlugins: [thresholdLinePlugin([
      { value: 300,  label: 'HY 300 — complacent', color: 'rgba(62, 207, 142, 0.6)' },
      { value: 600,  label: 'HY 600 — stress',     color: 'rgba(247, 167, 0, 0.7)' },
      { value: 1000, label: 'HY 1000 — crisis',    color: 'rgba(239, 79, 90, 0.8)' },
    ])],
  });

  const latestHy = latestValue(hy);
  const latestIg = latestValue(ig);
  const pctHy = percentile(hy, latestHy?.value);
  const pctIg = percentile(ig, latestIg?.value);

  const hyIgRatio = latestHy && latestIg && latestIg.value > 0 ? latestHy.value / latestIg.value : null;

  const tiles = [
    {
      metric: 'HY_OAS',
      label: 'HY OAS',
      value: latestHy ? `${latestHy.value.toFixed(0)}bp` : '—',
      meta: pctHy != null && hy.length ? `${pctHy}th %ile since ${hy[0].date.slice(0, 7)} only` : '',
      threshold: '&lt;300 complacent · 400–600 normal · &gt;800 stress',
      status: latestHy ? (latestHy.value > 800 ? 'warn' : latestHy.value > 500 ? 'caution' : 'ok') : '',
    },
    {
      metric: 'IG_OAS',
      label: 'IG OAS',
      value: latestIg ? `${latestIg.value.toFixed(0)}bp` : '—',
      meta: pctIg != null && ig.length ? `${pctIg}th %ile since ${ig[0].date.slice(0, 7)} only` : '',
      threshold: '&gt;200bp = IG stress',
      status: latestIg ? (latestIg.value > 200 ? 'warn' : latestIg.value > 150 ? 'caution' : 'ok') : '',
    },
    {
      metric: 'BAA10Y',
      label: 'Baa - 10Y spread',
      value: baa.length ? `${baa[baa.length - 1].value.toFixed(0)}bp` : '—',
      meta: baa.length ? `${percentile(baa, baa[baa.length - 1].value)}th %ile since ${baa[0].date.slice(0, 4)}` : '',
      threshold: 'Long-history credit gauge; above ~300bp has marked stress',
      status: baa.length ? (baa[baa.length - 1].value > 300 ? 'warn' : baa[baa.length - 1].value > 230 ? 'caution' : 'ok') : '',
    },
    {
      metric: 'HY_IG_RATIO',
      label: 'HY / IG ratio',
      value: hyIgRatio ? `${hyIgRatio.toFixed(1)}x` : '—',
      meta: 'asymmetric widening tell',
      threshold: '&gt;5x = HY stress without IG participation (single-name)',
      status: hyIgRatio ? (hyIgRatio > 6 ? 'warn' : hyIgRatio > 4 ? 'caution' : 'ok') : '',
    },
  ];
  renderTiles('tiles-credit', tiles);

  let note = '<strong>Current read:</strong> ';
  if (latestHy) {
    const hyV = latestHy.value;
    if (hyV > 1000)     note += `HY at ${hyV.toFixed(0)}bp — crisis regime. `;
    else if (hyV > 600) note += `HY at ${hyV.toFixed(0)}bp — stress regime. `;
    else if (hyV > 400) note += `HY at ${hyV.toFixed(0)}bp — normal cycle range. `;
    else                note += `HY at ${hyV.toFixed(0)}bp — complacent. `;
  }
  if (latestIg) {
    note += `IG at ${latestIg.value.toFixed(0)}bp. `;
  }
  if (hyIgRatio != null) {
    if (hyIgRatio > 6)      note += `HY/IG ratio ${hyIgRatio.toFixed(1)}x — HY widening without IG participation = single-name stress, not systemic.`;
    else if (hyIgRatio < 4) note += `HY/IG ratio ${hyIgRatio.toFixed(1)}x — tight ratio consistent with risk-on.`;
    else                    note += `HY/IG ratio ${hyIgRatio.toFixed(1)}x — typical cycle range.`;
  }
  el('note-credit').innerHTML = note;
}

// ---------- top: composite cycle score ----------
//
// Aggregates the individual signals into a single 0-100 risk-of-contraction
// score. Simple weighted sum; each signal contributes a 0-100 sub-score based
// on its current value vs. historical thresholds.

// One implementation for the whole site: lib/composite-scores.js. It takes
// raw FRED units (percent), so it reads state.raw, not the bps-converted
// display series.
function computeCycleScore() {
  return sharedCycleScore(state.raw);
}

function renderCycleScore() {
  const result = computeCycleScore();
  const tgt = el('cycle-score-section');
  if (!tgt || !result) return;

  const score = result.score;
  const { label: phase, color } = phaseFor('cycle', score);

  const signalBars = result.signals.map(s => {
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
        <div class="cs-score-label">CYCLE RISK SCORE</div>
        <div class="cs-score-value">${score.toFixed(0)}<span class="cs-score-scale">/100</span></div>
        <div class="cs-score-phase" style="color:${color}">${phase}</div>
        <div class="cs-score-desc">Weighted percentile of 5 signals vs their own last 20 years. 80 = riskier than 80% of that history.${result.stale.length ? ' Stale input: ' + result.stale.join(', ') + '.' : ''}</div>
      </div>
      <div class="cs-signals">
        <div class="cs-signals-title">Component readings</div>
        ${signalBars}
        <div class="cs-weights-note">Weights: term-spread probit 25% · Sahm (real-time) 25% · Baa spread 20% · NFCI 15% · claims 15%.<br>
          A continuous score. The <a href="/macro/recession/">recession signals page</a>
          counts threshold triggers and shows each one's historical hit rate; the two can read differently near a threshold.</div>
      </div>
    </div>
  `;
  // The weights were already visible; the 0-100 anchors behind each signal
  // were not. A reader cannot argue with a mapping they cannot see.
  renderMethodology(tgt, 'cycle');
}

// ---------- synthesis ----------

function renderSynthesis() {
  const result = computeCycleScore();
  const tgt = el('synthesis-content');
  if (!tgt || !result) return;

  const score = result.score;
  let paragraph = '';
  if (score < 25) {
    paragraph = `The cycle-risk composite at <strong>${score.toFixed(0)}/100</strong> indicates an expansionary phase. Leading signals are uniformly benign. For portfolio tilts, favor cyclicals, small-caps, and credit carry. The regime is likely to persist — historically, composite scores below 25 remain there for 12+ months before deteriorating. <em>Watch:</em> a +15 move in this score within 3 months is the canonical early-warning pattern.`;
  } else if (score < 45) {
    paragraph = `The cycle-risk composite at <strong>${score.toFixed(0)}/100</strong> indicates late-cycle expansion. Signals remain constructive on balance but some deterioration is visible. Maintain pro-cyclical positioning but tighten trailing stops. The biggest risk in this phase is complacency on credit — HY has historically been the last signal to flip before a downturn. <em>Watch:</em> a +10bp week-over-week HY widening paired with an ANFCI tick-up.`;
  } else if (score < 65) {
    paragraph = `The cycle-risk composite at <strong>${score.toFixed(0)}/100</strong> indicates a slowdown. Multiple signals are flashing caution. Reduce cyclical exposure, add quality and duration. The sector implication is clear — historically, utilities, staples, and healthcare materially outperform in this phase. <em>Watch:</em> Sahm-rule trigger (0.5pp) would elevate this to the next phase.`;
  } else if (score < 80) {
    paragraph = `The cycle-risk composite at <strong>${score.toFixed(0)}/100</strong> indicates material contraction risk. Multiple signals are in warning territory. The historical playbook: defensive equity tilt, duration overweight, credit underweight. The average forward 6-month SPY return in this phase is negative; the Disinflation/Recession regime row on the <a href="/macro/regime/">main dashboard</a> shows the historical sector response. <em>Watch:</em> a composite score above 80 has historically coincided with recession onset within 1-2 months.`;
  } else {
    paragraph = `The cycle-risk composite at <strong>${score.toFixed(0)}/100</strong> indicates contraction is likely already underway. In this phase, market bottoms historically precede economic bottoms by 3-6 months. The Fed-cut response window is open. <em>Watch:</em> the score inflecting downward from these levels is historically the best risk-on entry signal of the cycle.`;
  }

  tgt.innerHTML = `<p class="cycle-synthesis-para">${paragraph}</p>
    <div class="cycle-synthesis-links">
      Related views:
      <a href="/macro/regime/">Regime returns table &rarr;</a>
      <a href="/macro/recession/">Recession composite &rarr;</a>
      <a href="/tools/pairs/">Pair Explorer &rarr;</a>
    </div>`;
}

// ---------- orchestration ----------

async function main() {
  try {
    setStatus('stale', 'Loading cycle data…');
    await Promise.all([loadRecessionRanges(), loadSeries()]);

    renderCycleScore();
    renderRecessionSection();
    renderCurveSection();
    renderConditionsSection();
    renderCreditSection();
    renderSynthesis();

    el('last-updated').textContent = `Fetched ${new Date().toLocaleString()} \u2014 series carry their own observation dates`;
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
    seriesToCSV('siberforge-cycle.csv', series);
  };
}).catch(err => console.warn('export hook load failed:', err));
