// Regional CPI Dispersion — pulls 4 census-region CPI series + key metros from FRED.

const REGIONS = [
  { id: 'CUUR0100SA0', label: 'Northeast', color: '#5a9cff' },
  { id: 'CUUR0200SA0', label: 'Midwest',   color: '#3ecf8e' },
  { id: 'CUUR0300SA0', label: 'South',     color: '#f7a700' },
  { id: 'CUUR0400SA0', label: 'West',      color: '#ef4f5a' },
];
// FRED metro CPI series. IDs are CUURA###SA0 (where ### is BLS area code).
const METROS = [
  { id: 'CUURA101SA0', label: 'New York-Newark-Jersey City' },
  { id: 'CUURA102SA0', label: 'Philadelphia-Camden-Wilmington' },
  { id: 'CUURA103SA0', label: 'Boston-Cambridge-Newton' },
  { id: 'CUURA207SA0', label: 'Chicago-Naperville-Elgin' },
  { id: 'CUURA208SA0', label: 'Detroit-Warren-Dearborn' },
  { id: 'CUURA210SA0', label: 'Minneapolis-St. Paul' },
  { id: 'CUURA319SA0', label: 'Washington-Arlington-Alexandria' },
  { id: 'CUURA311SA0', label: 'Atlanta-Sandy Springs-Roswell' },
  { id: 'CUURA320SA0', label: 'Miami-Fort Lauderdale' },
  { id: 'CUURA316SA0', label: 'Houston-The Woodlands' },
  { id: 'CUURA318SA0', label: 'Dallas-Fort Worth' },
  { id: 'CUURA421SA0', label: 'Los Angeles-Long Beach-Anaheim' },
  { id: 'CUURA422SA0', label: 'San Francisco-Oakland' },
  { id: 'CUURA423SA0', label: 'Seattle-Tacoma-Bellevue' },
  { id: 'CUURA425SA0', label: 'Phoenix-Mesa-Scottsdale' },
];

const state = { regions: {}, metros: {} };

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
function yoyPct(series) {
  const out = [];
  for (let i = 12; i < series.length; i++) {
    const cur = series[i].value, prev = series[i - 12].value;
    if (!Number.isFinite(cur) || !Number.isFinite(prev) || prev <= 0) continue;
    out.push({ date: series[i].date, value: (cur / prev - 1) * 100 });
  }
  return out;
}
function latestValue(s) { return s && s.length ? s[s.length - 1] : null; }

async function loadAll() {
  setStatus('stale', 'Loading regional CPI…');
  // Region series
  const rIds = REGIONS.map(r => r.id).join(',');
  try {
    const j = await fetchJSON(`/api/fred?series=${rIds}&start=1995-01-01`);
    for (const s of j.series) state.regions[s.id] = s.observations;
    if (j.errors?.length) console.warn('region errors:', j.errors);
  } catch (e) { console.warn('region fetch failed:', e); }

  // Metros — batch in groups of 5 to keep request size reasonable
  for (let i = 0; i < METROS.length; i += 5) {
    const batch = METROS.slice(i, i + 5);
    try {
      const j = await fetchJSON(`/api/fred?series=${batch.map(m => m.id).join(',')}&start=2010-01-01`);
      for (const s of j.series) state.metros[s.id] = s.observations;
      if (j.errors?.length) console.warn('metro batch errors:', j.errors);
    } catch (e) { console.warn('metro batch failed:', batch.map(m=>m.id), e); }
  }
}

function renderRegionsChart() {
  const datasets = REGIONS.map(r => {
    const yoy = yoyPct(state.regions[r.id] || []);
    return {
      label: r.label,
      data: yoy.map(o => ({ x: o.date, y: o.value })),
      borderColor: r.color,
      backgroundColor: r.color === '#f7a700' ? 'rgba(247, 167, 0, 0.10)' : 'transparent',
      borderWidth: 1.6,
      pointRadius: 0,
      fill: r.color === '#f7a700',
      tension: 0.1,
    };
  });
  new Chart(el('chart-regions').getContext('2d'), {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#e5e9ee', font: { size: 11 } } },
                 tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1 } },
      scales: {
        x: { type: 'time', time: { unit: 'year' }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 }, callback: v => `${v}%` },
             title: { display: true, text: 'YoY (%)', color: '#8a94a3', font: { size: 11 } } },
      },
    },
  });

  // Note: max-min spread of latest readings
  const latest = REGIONS.map(r => ({ region: r.label, value: latestValue(yoyPct(state.regions[r.id] || []))?.value }))
    .filter(o => Number.isFinite(o.value));
  if (latest.length) {
    latest.sort((a, b) => b.value - a.value);
    const hot = latest[0], cold = latest[latest.length - 1];
    const spread = hot.value - cold.value;
    el('note-regions').innerHTML = `<strong>Current dispersion:</strong> ${hot.region} hottest at ${fmt(hot.value, 1)}% YoY, ${cold.region} coolest at ${fmt(cold.value, 1)}% — ${fmt(spread, 1)}pp regional spread. ${spread > 1 ? '<em>Unusually wide — driven by shelter/labor-cost differences.</em>' : 'Regions converging.'}`;
  }
}

function renderRankedTable() {
  const rows = [
    ...REGIONS.map(r => ({ kind: 'Region', label: r.label, val: latestValue(yoyPct(state.regions[r.id] || []))?.value })),
    ...METROS.map(m => ({ kind: 'Metro', label: m.label, val: latestValue(yoyPct(state.metros[m.id] || []))?.value })),
  ].filter(r => Number.isFinite(r.val));
  rows.sort((a, b) => b.val - a.val);

  const tbody = rows.map(r => {
    const cls = r.val > 4 ? 'neg' : r.val < 2 ? 'pos' : '';
    return `<tr><td>${r.label}</td><td>${r.kind}</td><td class="${cls}">${r.val >= 0 ? '+' : ''}${fmt(r.val, 1)}%</td></tr>`;
  }).join('');
  el('ranked-table').innerHTML = `<table class="reg-table">
    <thead><tr><th>Region / Metro</th><th>Type</th><th>YoY CPI</th></tr></thead>
    <tbody>${tbody}</tbody>
  </table>`;
}

async function main() {
  try {
    await loadAll();
    renderRegionsChart();
    renderRankedTable();
    el('last-updated').textContent = `Updated ${new Date().toLocaleString()}`;
    setStatus('live', 'Live');
  } catch (err) {
    console.error(err);
    setStatus('error', `Error: ${err.message}`);
  }
}
main();
