import { METRIC_CATALOG, CATEGORIES } from './metric-catalog.js';

// Geography page controller.
//
// State-level: pick from 50+DC; pull unemployment, FHFA HPI, employment,
// population from FRED's state-level series ([STATE]UR/STHPI/POP/NA).
// MSA-level: pick from top 25; pull FHFA quarterly HPI (ATNHPIUS#####Q).
// Ranked-states view: load the selected metric across all 50 states and
// show as a sorted bar chart with the user's selected state highlighted.

const STATES = [
  { code: 'US', name: 'United States (national)' },
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' }, { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' }, { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' }, { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' }, { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' }, { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' }, { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' }, { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
];

// Top 25 MSAs with FHFA HPI codes. Format: ATNHPIUS#####Q (quarterly).
const MSAS = [
  { code: '12060', name: 'Atlanta-Sandy Springs-Roswell, GA' },
  { code: '12420', name: 'Austin-Round Rock-Georgetown, TX' },
  { code: '14460', name: 'Boston-Cambridge-Newton, MA-NH' },
  { code: '15380', name: 'Buffalo-Cheektowaga, NY' },
  { code: '16980', name: 'Chicago-Naperville-Elgin, IL-IN-WI' },
  { code: '17140', name: 'Cincinnati, OH-KY-IN' },
  { code: '17460', name: 'Cleveland-Elyria, OH' },
  { code: '19100', name: 'Dallas-Fort Worth-Arlington, TX' },
  { code: '19740', name: 'Denver-Aurora-Lakewood, CO' },
  { code: '19820', name: 'Detroit-Warren-Dearborn, MI' },
  { code: '26420', name: 'Houston-The Woodlands-Sugar Land, TX' },
  { code: '28140', name: 'Kansas City, MO-KS' },
  { code: '31080', name: 'Los Angeles-Long Beach-Anaheim, CA' },
  { code: '33100', name: 'Miami-Fort Lauderdale-West Palm Beach, FL' },
  { code: '33460', name: 'Minneapolis-St. Paul-Bloomington, MN-WI' },
  { code: '34980', name: 'Nashville-Davidson--Murfreesboro, TN' },
  { code: '35620', name: 'New York-Newark-Jersey City, NY-NJ-PA' },
  { code: '36740', name: 'Orlando-Kissimmee-Sanford, FL' },
  { code: '37980', name: 'Philadelphia-Camden-Wilmington, PA-NJ-DE-MD' },
  { code: '38060', name: 'Phoenix-Mesa-Scottsdale, AZ' },
  { code: '38900', name: 'Portland-Vancouver-Hillsboro, OR-WA' },
  { code: '40140', name: 'Riverside-San Bernardino-Ontario, CA' },
  { code: '41740', name: 'San Diego-Carlsbad, CA' },
  { code: '41860', name: 'San Francisco-Oakland-Hayward, CA' },
  { code: '42660', name: 'Seattle-Tacoma-Bellevue, WA' },
  { code: '45300', name: 'Tampa-St. Petersburg-Clearwater, FL' },
  { code: '47900', name: 'Washington-Arlington-Alexandria, DC-VA-MD-WV' },
];

const state = {
  selectedState: 'CA',
  selectedMsa: '12060',
  rankMetric: 'hpi',
  cache: {},        // id -> raw observations
  recessionRanges: [],
  rankedData: null, // { metric, byState: { code -> { value, latest } } }
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
function yoyPct(series) {
  const out = [];
  for (let i = 12; i < series.length; i++) {
    const cur = series[i].value, prev = series[i - 12].value;
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) continue;
    out.push({ date: series[i].date, value: (cur / prev - 1) * 100 });
  }
  return out;
}
// Annual series (state population) — use 1-year diff in absolute terms.
function annualPctChange(series) {
  const out = [];
  for (let i = 1; i < series.length; i++) {
    const cur = series[i].value, prev = series[i - 1].value;
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) continue;
    out.push({ date: series[i].date, value: (cur / prev - 1) * 100 });
  }
  return out;
}
function quarterlyYoy(series) {
  // Quarterly index → YoY: compare to 4 quarters prior
  const out = [];
  for (let i = 4; i < series.length; i++) {
    const cur = series[i].value, prev = series[i - 4].value;
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) continue;
    out.push({ date: series[i].date, value: (cur / prev - 1) * 100 });
  }
  return out;
}

// ---------- NBER ----------
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

// ---------- generic data fetcher (cached) ----------
async function loadFred(id, start = '1990-01-01') {
  const cacheKey = `${id}|${start}`;
  if (state.cache[cacheKey]) return state.cache[cacheKey];
  const j = await fetchJSON(`/api/fred?series=${id}&start=${start}`);
  const obs = j.series[0]?.observations || [];
  state.cache[cacheKey] = obs;
  return obs;
}

// State-level series IDs for a given 2-letter code (US uses national IDs).
function stateSeries(code) {
  if (code === 'US') return { ur: 'UNRATE', hpi: 'USSTHPI', emp: 'PAYEMS', pop: 'POPTHM' };
  return { ur: `${code}UR`, hpi: `${code}STHPI`, emp: `${code}NA`, pop: `${code}POP` };
}

// ---------- chart helpers ----------
function timeSeriesChart(canvas, datasets, opts = {}) {
  if (charts[canvas.id]) charts[canvas.id].destroy();
  const pluginOpts = { nberShading: { ranges: state.recessionRanges } };
  const chartOpts = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#e5e9ee', font: { size: 10 }, boxWidth: 10 } },
      tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1 },
      ...pluginOpts,
    },
    scales: {
      x: { type: 'time', time: { unit: 'year' },
           grid: { color: 'rgba(255,255,255,0.04)' },
           ticks: { color: '#8a94a3', font: { size: 9 } } },
      y: { grid: { color: 'rgba(255,255,255,0.04)' },
           ticks: { color: '#8a94a3', font: { size: 9 }, callback: opts.yTicks },
           title: { display: !!opts.yTitle, text: opts.yTitle, color: '#8a94a3', font: { size: 10 } } },
    },
  };
  charts[canvas.id] = new Chart(canvas.getContext('2d'), {
    type: 'line', data: { datasets }, options: chartOpts,
    plugins: [nberShadingPlugin],
  });
  return charts[canvas.id];
}

// ---------- state charts ----------

async function renderStateCharts() {
  const code = state.selectedState;
  const stateName = STATES.find(s => s.code === code)?.name || code;

  setStatus('stale', `Loading ${stateName} data…`);
  const stateIds = stateSeries(code);
  const usIds = stateSeries('US');

  const fetchAll = async (idMap) => {
    const out = {};
    await Promise.all(Object.entries(idMap).map(async ([k, id]) => {
      try { out[k] = await loadFred(id, '1990-01-01'); } catch (e) { out[k] = []; }
    }));
    return out;
  };

  const [stData, usData] = await Promise.all([fetchAll(stateIds), fetchAll(usIds)]);

  // Unemployment — both already in level (%), monthly
  timeSeriesChart(el('chart-state-ur'), [
    { label: stateName, data: stData.ur.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', backgroundColor: 'rgba(247, 167, 0, 0.10)', borderWidth: 1.7, pointRadius: 0, fill: true, tension: 0.1 },
    { label: 'US', data: usData.ur.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.3, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0.1 },
  ], { yTitle: '%' });

  // HPI YoY (quarterly index → YoY)
  const stHpiYoy = quarterlyYoy(stData.hpi);
  const usHpiYoy = quarterlyYoy(usData.hpi);
  timeSeriesChart(el('chart-state-hpi'), [
    { label: stateName, data: stHpiYoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', backgroundColor: 'rgba(247, 167, 0, 0.10)', borderWidth: 1.7, pointRadius: 0, fill: true, tension: 0.1 },
    { label: 'US', data: usHpiYoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.3, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0.1 },
  ], { yTitle: 'YoY (%)' });

  // Employment YoY (monthly)
  const stEmpYoy = yoyPct(stData.emp);
  const usEmpYoy = yoyPct(usData.emp);
  timeSeriesChart(el('chart-state-emp'), [
    { label: stateName, data: stEmpYoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', backgroundColor: 'rgba(247, 167, 0, 0.10)', borderWidth: 1.7, pointRadius: 0, fill: true, tension: 0.1 },
    { label: 'US', data: usEmpYoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.3, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0.1 },
  ], { yTitle: 'YoY (%)' });

  // Population (annual) — show YoY
  const stPopYoy = annualPctChange(stData.pop);
  const usPopYoy = annualPctChange(usData.pop);
  timeSeriesChart(el('chart-state-pop'), [
    { label: stateName, data: stPopYoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', backgroundColor: 'rgba(247, 167, 0, 0.10)', borderWidth: 1.7, pointRadius: 0, fill: true, tension: 0.1 },
    { label: 'US', data: usPopYoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.3, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0.1 },
  ], { yTitle: 'YoY (%)' });

  // Hero scorecard tile
  renderHeroScorecard(stateName, stData, usData);
  renderStateNote(stateName, stData, usData);
  setStatus('live', 'Live');
}

function renderHeroScorecard(stateName, stData, usData) {
  const ur = latestValue(stData.ur);
  const usUr = latestValue(usData.ur);
  const stHpiYoy = latestValue(quarterlyYoy(stData.hpi));
  const usHpiYoy = latestValue(quarterlyYoy(usData.hpi));
  const stEmpYoy = latestValue(yoyPct(stData.emp));
  const usEmpYoy = latestValue(yoyPct(usData.emp));
  const stPopYoy = latestValue(annualPctChange(stData.pop));
  const usPopYoy = latestValue(annualPctChange(usData.pop));

  function tile(label, val, vsUs, units, lowerBetter) {
    const better = vsUs == null ? null : (lowerBetter ? vsUs < 0 : vsUs > 0);
    const cls = better == null ? '' : better ? 'pos' : 'neg';
    const sign = vsUs == null ? '' : vsUs >= 0 ? '+' : '';
    return `<div class="geo-hero-tile">
      <div class="geo-hero-label">${label}</div>
      <div class="geo-hero-value">${val}</div>
      <div class="geo-hero-vsus ${cls}">${vsUs == null ? '' : `${sign}${vsUs.toFixed(2)}${units} vs US`}</div>
    </div>`;
  }

  const tiles = `
    ${tile('Unemployment', ur ? `${ur.value.toFixed(1)}%` : '—',
           ur && usUr ? ur.value - usUr.value : null, 'pp', true)}
    ${tile('HPI YoY', stHpiYoy ? `${stHpiYoy.value >= 0 ? '+' : ''}${stHpiYoy.value.toFixed(1)}%` : '—',
           stHpiYoy && usHpiYoy ? stHpiYoy.value - usHpiYoy.value : null, 'pp', false)}
    ${tile('Employment YoY', stEmpYoy ? `${stEmpYoy.value >= 0 ? '+' : ''}${stEmpYoy.value.toFixed(1)}%` : '—',
           stEmpYoy && usEmpYoy ? stEmpYoy.value - usEmpYoy.value : null, 'pp', false)}
    ${tile('Population YoY', stPopYoy ? `${stPopYoy.value >= 0 ? '+' : ''}${stPopYoy.value.toFixed(2)}%` : '—',
           stPopYoy && usPopYoy ? stPopYoy.value - usPopYoy.value : null, 'pp', false)}
  `;

  el('geo-hero').innerHTML = `
    <div class="geo-hero-card">
      <div class="geo-hero-head">
        <div class="geo-hero-eyebrow">SELECTED REGION</div>
        <div class="geo-hero-name">${stateName}</div>
        <div class="geo-hero-desc">Latest readings vs. United States benchmark. Greater divergence = stronger state-specific cycle.</div>
      </div>
      <div class="geo-hero-tiles">${tiles}</div>
    </div>
    <div class="geo-rank-card">
      <div class="geo-rank-head">
        <div class="geo-rank-eyebrow">RANKED STATES</div>
        <div class="geo-rank-title" id="geo-rank-title">Loading…</div>
      </div>
      <div class="geo-rank-chart"><canvas id="chart-rank"></canvas></div>
    </div>
  `;
  // Trigger ranked-states fetch + render after the canvas exists.
  renderRankedStates();
}

function renderStateNote(stateName, stData, usData) {
  const ur = latestValue(stData.ur);
  const usUr = latestValue(usData.ur);
  const stHpi = latestValue(quarterlyYoy(stData.hpi));
  const usHpi = latestValue(quarterlyYoy(usData.hpi));
  const stPop = latestValue(annualPctChange(stData.pop));

  let note = `<strong>${stateName}:</strong> `;
  if (ur && usUr) {
    const gap = ur.value - usUr.value;
    if (gap < -1)      note += `unemployment ${ur.value.toFixed(1)}% (${(-gap).toFixed(1)}pp <em>below</em> US) — relatively tight labor market. `;
    else if (gap > 1)  note += `unemployment ${ur.value.toFixed(1)}% (${gap.toFixed(1)}pp <em>above</em> US) — relatively soft labor market. `;
    else                 note += `unemployment ${ur.value.toFixed(1)}%, in line with US. `;
  }
  if (stHpi && usHpi) {
    const gap = stHpi.value - usHpi.value;
    if (gap > 2)        note += `HPI ${stHpi.value >= 0 ? '+' : ''}${stHpi.value.toFixed(1)}% YoY (${gap.toFixed(1)}pp <em>above</em> US) — outsized housing-price tailwind. `;
    else if (gap < -2)  note += `HPI ${stHpi.value >= 0 ? '+' : ''}${stHpi.value.toFixed(1)}% YoY (${(-gap).toFixed(1)}pp <em>below</em> US) — local market underperforming. `;
    else                 note += `HPI ${stHpi.value >= 0 ? '+' : ''}${stHpi.value.toFixed(1)}% YoY, tracking US. `;
  }
  if (stPop) {
    if (stPop.value > 1)      note += `Population +${stPop.value.toFixed(2)}% — among the demographic-tailwind states.`;
    else if (stPop.value < 0) note += `Population ${stPop.value.toFixed(2)}% — losing residents; structural housing-demand headwind.`;
    else                       note += `Population +${stPop.value.toFixed(2)}% — slow growth.`;
  }
  el('note-state').innerHTML = note;
}

// ---------- ranked states ----------

async function renderRankedStates() {
  const metric = state.rankMetric;
  const stateCodes = STATES.filter(s => s.code !== 'US').map(s => s.code);

  // Map metric to series-suffix and processor
  const config = {
    unemployment: { suffix: 'UR',    process: arr => latestValue(arr)?.value, label: 'Unemployment %', unit: '%', lowerBetter: true,  ascending: true },
    hpi:          { suffix: 'STHPI', process: arr => latestValue(quarterlyYoy(arr))?.value, label: 'HPI YoY %', unit: '%', lowerBetter: false, ascending: false },
    employment:   { suffix: 'NA',    process: arr => latestValue(yoyPct(arr))?.value, label: 'Employment YoY %', unit: '%', lowerBetter: false, ascending: false },
    population:   { suffix: 'POP',   process: arr => latestValue(annualPctChange(arr))?.value, label: 'Population YoY %', unit: '%', lowerBetter: false, ascending: false },
  }[metric];

  setStatus('stale', `Loading ranked states (${config.label})…`);
  // Batch in groups of 10 — Promise.all of 50 is risky on serverless cold start.
  const batches = [];
  for (let i = 0; i < stateCodes.length; i += 10) batches.push(stateCodes.slice(i, i + 10));
  const values = {};
  for (const batch of batches) {
    const ids = batch.map(c => `${c}${config.suffix}`).join(',');
    try {
      const j = await fetchJSON(`/api/fred?series=${ids}&start=1995-01-01`);
      for (const s of j.series) {
        const code = s.id.replace(config.suffix, '');
        const val = config.process(s.observations);
        if (Number.isFinite(val)) values[code] = val;
      }
    } catch (err) {
      console.warn(`ranked batch failed: ${ids}`, err);
    }
  }

  const sorted = Object.entries(values).sort((a, b) => config.ascending ? a[1] - b[1] : b[1] - a[1]);
  const labels = sorted.map(([c]) => c);
  const data = sorted.map(([_, v]) => v);
  const colors = sorted.map(([c]) => c === state.selectedState ? '#f7a700' : 'rgba(90, 156, 255, 0.55)');

  if (charts.rank) charts.rank.destroy();
  charts.rank = new Chart(el('chart-rank').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: config.label,
        data,
        backgroundColor: colors,
        borderWidth: 0,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1,
          callbacks: { label: c => `${c.label}: ${c.parsed.x.toFixed(2)}${config.unit}` } },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 9 }, callback: v => `${v}${config.unit}` },
             title: { display: true, text: config.label, color: '#8a94a3', font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: '#e5e9ee', font: { size: 9 } } },
      },
    },
  });

  el('geo-rank-title').textContent = `${config.label} — all states ranked, ${state.selectedState} highlighted`;
  setStatus('live', 'Live');
}

// ---------- MSA chart ----------

async function renderMsaChart() {
  const code = state.selectedMsa;
  const msaName = MSAS.find(m => m.code === code)?.name || code;
  setStatus('stale', `Loading ${msaName} HPI…`);

  const fredId = `ATNHPIUS${code}Q`;
  let msaObs = [], usObs = [];
  try {
    msaObs = await loadFred(fredId, '1990-01-01');
    usObs  = await loadFred('USSTHPI', '1990-01-01');
  } catch (err) {
    console.warn(`MSA fetch failed: ${fredId}`, err);
  }

  const msaYoy = quarterlyYoy(msaObs);
  const usYoy  = quarterlyYoy(usObs);

  timeSeriesChart(el('chart-msa-hpi'), [
    { label: msaName, data: msaYoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', backgroundColor: 'rgba(247, 167, 0, 0.10)', borderWidth: 1.8, pointRadius: 0, fill: true, tension: 0.1 },
    { label: 'US', data: usYoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#5a9cff', borderWidth: 1.3, borderDash: [4, 4], pointRadius: 0, fill: false, tension: 0.1 },
  ], { yTitle: 'YoY (%)' });

  // Note: most-recent vs US gap
  const msaLast = latestValue(msaYoy);
  const usLast = latestValue(usYoy);
  let note = `<strong>${msaName}:</strong> `;
  if (msaLast && usLast) {
    const gap = msaLast.value - usLast.value;
    if (gap > 3)        note += `HPI ${msaLast.value >= 0 ? '+' : ''}${msaLast.value.toFixed(1)}% YoY — running ${gap.toFixed(1)}pp <em>hot</em> vs the national index. `;
    else if (gap < -3)  note += `HPI ${msaLast.value >= 0 ? '+' : ''}${msaLast.value.toFixed(1)}% YoY — running ${(-gap).toFixed(1)}pp <em>cold</em> vs the national index. `;
    else                 note += `HPI ${msaLast.value >= 0 ? '+' : ''}${msaLast.value.toFixed(1)}% YoY, in line with US. `;
  }
  el('note-msa').innerHTML = note;
  setStatus('live', 'Live');
}

// ---------- synthesis ----------

function renderSynthesis() {
  const stateName = STATES.find(s => s.code === state.selectedState)?.name || state.selectedState;
  const msaName = MSAS.find(m => m.code === state.selectedMsa)?.name || state.selectedMsa;
  const para = `
    Geographic dispersion is the most under-appreciated factor in housing-cycle analysis. The national
    aggregate masks regional cycles that can run years out of phase. The Sun Belt (FL, TX, AZ, NV, NC,
    GA) has been the secular winner of the post-2010 era on population growth and housing demand;
    high-tax coastal states (NY, CA, IL, NJ) have lost net domestic migrants for over a decade.
    For housing-exposed P&L, the right unit of analysis is metro, not nation. Currently looking at
    <strong>${stateName}</strong> and <strong>${msaName}</strong>; switch the dropdowns above to
    pivot.
  `;
  el('geo-synthesis-content').innerHTML = `<p class="cycle-synthesis-para">${para}</p>
    <div class="cycle-synthesis-links">
      Related views:
      <a href="/core/macro/housing/">Housing cycle &rarr;</a>
      <a href="/core/macro/real-economy/">Consumer + HI &rarr;</a>
      <a href="/core/macro/">Regime returns &rarr;</a>
    </div>`;
}

// ---------- wire UI ----------

function wireSelectors() {
  const stSel = el('state-select');
  for (const s of STATES) {
    const opt = document.createElement('option');
    opt.value = s.code; opt.textContent = s.name;
    if (s.code === state.selectedState) opt.selected = true;
    stSel.appendChild(opt);
  }
  stSel.addEventListener('change', async () => {
    state.selectedState = stSel.value;
    await renderStateCharts();
    await renderRankedStates();
    renderSynthesis();
  });

  const msaSel = el('msa-select');
  for (const m of MSAS) {
    const opt = document.createElement('option');
    opt.value = m.code; opt.textContent = m.name;
    if (m.code === state.selectedMsa) opt.selected = true;
    msaSel.appendChild(opt);
  }
  msaSel.addEventListener('change', async () => {
    state.selectedMsa = msaSel.value;
    await renderMsaChart();
    renderSynthesis();
  });

  const rankSel = el('rank-metric');
  rankSel.addEventListener('change', async () => {
    state.rankMetric = rankSel.value;
    await renderRankedStates();
  });
}

async function main() {
  try {
    await loadRecessionRanges();
    wireSelectors();
    await renderStateCharts();
    await renderMsaChart();
    renderSynthesis();
    el('last-updated').textContent = `Updated ${new Date().toLocaleString()}`;
    setStatus('live', 'Live');
  } catch (err) {
    console.error(err);
    setStatus('error', `Error: ${err.message}`);
  }
}


// ---------- Metric Library (T13.2) ----------
//
// Renders 25 catalog entries grouped by category as cards with structured
// hover tooltips (what / why / drivers / so-what). Tooltip follows the cursor.

function renderMetricLibrary() {
  const tgt = document.getElementById('metric-library-grid');
  if (!tgt) return;

  // Group by category preserving CATEGORIES order
  const byCat = {};
  for (const c of CATEGORIES) byCat[c] = [];
  for (const m of METRIC_CATALOG) {
    if (!byCat[m.category]) byCat[m.category] = [];
    byCat[m.category].push(m);
  }

  const html = CATEGORIES.map(cat => {
    const entries = byCat[cat] || [];
    if (!entries.length) return '';
    const cards = entries.map(m => `
      <div class="ml-card" data-metric-id="${m.id}">
        <div class="ml-card-label">${m.label}</div>
        <div class="ml-card-source">${m.source}</div>
        <div class="ml-card-sample">${m.sample || ''}</div>
        <div class="ml-card-hint">hover for so-what</div>
      </div>
    `).join('');
    return `
      <div class="ml-cat-block">
        <div class="ml-cat-title">${cat}</div>
        <div class="ml-cat-grid">${cards}</div>
      </div>
    `;
  }).join('');

  tgt.innerHTML = html;
  wireMetricTooltip();
}

function wireMetricTooltip() {
  const lookup = Object.fromEntries(METRIC_CATALOG.map(m => [m.id, m]));
  let popup = document.getElementById('metric-tooltip');
  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'metric-tooltip';
    popup.className = 'metric-tooltip';
    popup.style.display = 'none';
    document.body.appendChild(popup);
  }
  const grid = document.getElementById('metric-library-grid');
  if (!grid) return;

  function position(e) {
    const PAD = 14;
    const w = popup.offsetWidth, h = popup.offsetHeight;
    let x = e.clientX + PAD, y = e.clientY + PAD;
    if (x + w + 8 > window.innerWidth)  x = e.clientX - w - PAD;
    if (y + h + 8 > window.innerHeight) y = e.clientY - h - PAD;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    popup.style.left = x + 'px';
    popup.style.top  = y + 'px';
  }

  grid.addEventListener('mouseover', (e) => {
    const card = e.target.closest('[data-metric-id]');
    if (!card) return;
    const m = lookup[card.dataset.metricId];
    if (!m) return;
    popup.innerHTML = `
      <div class="mt-title">${m.label}</div>
      <div class="mt-source">${m.source}</div>
      <div class="mt-section"><span class="mt-key">What</span> ${m.what}</div>
      <div class="mt-section"><span class="mt-key">Why it matters</span> ${m.why}</div>
      <div class="mt-section"><span class="mt-key">Drivers</span> ${m.drivers}</div>
      <div class="mt-section mt-sowhat"><span class="mt-key">So what</span> ${m.soWhat}</div>
    `;
    popup.style.display = 'block';
    position(e);
  });
  grid.addEventListener('mousemove', (e) => {
    if (popup.style.display !== 'block') return;
    position(e);
  });
  grid.addEventListener('mouseout', (e) => {
    const card = e.target.closest('[data-metric-id]');
    if (!card) return;
    const next = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-metric-id]');
    if (next === card) return;
    popup.style.display = 'none';
  });
}

// Attach renderMetricLibrary call to main() if not already present.

main();
renderMetricLibrary();

