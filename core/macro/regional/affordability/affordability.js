// Top 25 MSAs — median home value (Zillow ZHVI) + median HH income (Census ACS).
// Snapshot vintage; refresh annually.

const METROS = {
  'New York-Newark-Jersey City':           { homeValue: 715000, hhIncome: 95000 },
  'Los Angeles-Long Beach-Anaheim':        { homeValue: 945000, hhIncome: 89000 },
  'Chicago-Naperville-Elgin':              { homeValue: 305000, hhIncome: 80000 },
  'Dallas-Fort Worth-Arlington':           { homeValue: 380000, hhIncome: 86000 },
  'Houston-The Woodlands-Sugar Land':      { homeValue: 305000, hhIncome: 78000 },
  'Washington-Arlington-Alexandria':       { homeValue: 575000, hhIncome:114000 },
  'Philadelphia-Camden-Wilmington':        { homeValue: 365000, hhIncome: 86000 },
  'Miami-Fort Lauderdale-West Palm Beach': { homeValue: 480000, hhIncome: 73000 },
  'Atlanta-Sandy Springs-Roswell':         { homeValue: 380000, hhIncome: 87000 },
  'Boston-Cambridge-Newton':               { homeValue: 695000, hhIncome:108000 },
  'Phoenix-Mesa-Scottsdale':               { homeValue: 470000, hhIncome: 82000 },
  'San Francisco-Oakland-Hayward':         { homeValue:1180000, hhIncome:135000 },
  'Riverside-San Bernardino-Ontario':      { homeValue: 565000, hhIncome: 85000 },
  'Detroit-Warren-Dearborn':               { homeValue: 250000, hhIncome: 73000 },
  'Seattle-Tacoma-Bellevue':               { homeValue: 750000, hhIncome:108000 },
  'Minneapolis-St. Paul-Bloomington':      { homeValue: 365000, hhIncome: 90000 },
  'San Diego-Carlsbad':                    { homeValue: 925000, hhIncome: 96000 },
  'Tampa-St. Petersburg-Clearwater':       { homeValue: 395000, hhIncome: 73000 },
  'Denver-Aurora-Lakewood':                { homeValue: 615000, hhIncome:101000 },
  'Baltimore-Columbia-Towson':             { homeValue: 380000, hhIncome: 95000 },
  'St. Louis':                             { homeValue: 245000, hhIncome: 75000 },
  'Charlotte-Concord-Gastonia':            { homeValue: 395000, hhIncome: 80000 },
  'Orlando-Kissimmee-Sanford':             { homeValue: 400000, hhIncome: 70000 },
  'Portland-Vancouver-Hillsboro':          { homeValue: 545000, hhIncome: 92000 },
  'Austin-Round Rock-Georgetown':          { homeValue: 470000, hhIncome: 95000 },
};

const state = { mortgageRate: 6.8 };  // fallback; will fetch live

function el(id) { return document.getElementById(id); }
function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}
function pAndIMultiplier(annualRate, years = 30) {
  const r = (annualRate / 100) / 12, n = years * 12;
  return r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}

async function loadMortgageRate() {
  try {
    const j = await fetchJSON('/api/fred?series=MORTGAGE30US&start=2025-01-01');
    const obs = j.series[0]?.observations || [];
    const last = obs[obs.length - 1];
    if (last) state.mortgageRate = last.value;
  } catch (err) { console.warn('mortgage rate fetch failed:', err); }
}

function renderChart() {
  const rows = Object.entries(METROS).map(([name, d]) => ({
    name, pti: d.homeValue / d.hhIncome, ...d,
  })).sort((a, b) => b.pti - a.pti);

  const labels = rows.map(r => r.name);
  const data = rows.map(r => r.pti);
  const colors = data.map(v => v > 6 ? 'rgba(239, 79, 90, 0.75)' : v > 4 ? 'rgba(247, 167, 0, 0.65)' : 'rgba(62, 207, 142, 0.65)');

  new Chart(el('chart-pti').getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Home value / household income', data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
                 tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1,
                            callbacks: { label: c => `${c.label}: ${c.parsed.x.toFixed(1)}x` } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 9 }, callback: v => `${v.toFixed(1)}x` },
             title: { display: true, text: 'Price-to-income ratio', color: '#8a94a3', font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: '#e5e9ee', font: { size: 9 } } },
      },
    },
  });

  const worst = rows.slice(0, 3);
  const best = rows.slice(-3).reverse();
  el('note-pti').innerHTML = `<strong>Most stretched:</strong> ${worst.map(r => `${r.name} (${r.pti.toFixed(1)}x)`).join(', ')}. <strong>Most affordable:</strong> ${best.map(r => `${r.name} (${r.pti.toFixed(1)}x)`).join(', ')}. <em>Implication:</em> stretched markets have suppressed turnover, weak existing-home sales, and pent-up demand for new-build affordable product.`;
}

function renderTable() {
  const rows = Object.entries(METROS).map(([name, d]) => ({
    name, pti: d.homeValue / d.hhIncome, ...d,
  })).sort((a, b) => b.pti - a.pti);

  const tbody = rows.map(r => {
    const cls = r.pti > 6 ? 'neg' : r.pti < 4 ? 'pos' : '';
    const loanAmt = r.homeValue * 0.80;
    const monthlyPI = loanAmt * pAndIMultiplier(state.mortgageRate);
    const piPctIncome = (monthlyPI / (r.hhIncome / 12)) * 100;
    const piCls = piPctIncome > 32 ? 'neg' : piPctIncome < 25 ? 'pos' : '';
    return `<tr>
      <td>${r.name}</td>
      <td>$${(r.homeValue / 1000).toFixed(0)}K</td>
      <td>$${(r.hhIncome / 1000).toFixed(1)}K</td>
      <td class="${cls}">${r.pti.toFixed(1)}x</td>
      <td>$${monthlyPI.toFixed(0)}</td>
      <td class="${piCls}">${piPctIncome.toFixed(1)}%</td>
    </tr>`;
  }).join('');

  el('affordability-table').innerHTML = `<table class="reg-table">
    <thead><tr><th>Metro</th><th>Home value</th><th>HH income</th><th>P/I ratio</th><th>Monthly P&I</th><th>P&I / income</th></tr></thead>
    <tbody>${tbody}</tbody>
  </table>`;
}

async function main() {
  await loadMortgageRate();
  renderChart();
  if (window.__renderChartChained) window.__renderChartChained();
  renderTable();
}
main();


// =================================================================
// Metro detail snapshot (for click-to-expand panel).
// Population YoY, employment YoY, demographics, migration tag.
// IRS SOI / Census ACS / BLS LAUS most-recent vintage.
// =================================================================

const METRO_DETAIL = {
  'New York-Newark-Jersey City':           { popYoy: -0.8, jobYoy: +0.7, medAge: 39.4, ownerOcc: 51.8, migrationTag: 'Net outflow', notes: 'Largest US metro; high-tax exodus tempered by immigration. SF rent index falling.' },
  'Los Angeles-Long Beach-Anaheim':        { popYoy: -0.4, jobYoy: +0.3, medAge: 38.0, ownerOcc: 49.2, migrationTag: 'Net outflow', notes: 'Affordability + climate-risk-driven outmigration. Second-highest unaffordable major metro.' },
  'Chicago-Naperville-Elgin':              { popYoy: -0.5, jobYoy: +0.5, medAge: 38.5, ownerOcc: 65.3, migrationTag: 'Net outflow', notes: 'Net domestic migration negative for 10+ years; corporate HQ relocations to FL/TX.' },
  'Dallas-Fort Worth-Arlington':           { popYoy: +1.6, jobYoy: +2.2, medAge: 35.4, ownerOcc: 60.0, migrationTag: 'Net inflow',  notes: 'Major job-growth magnet. Suburbs (Collin, Denton) growing fastest.' },
  'Houston-The Woodlands-Sugar Land':      { popYoy: +1.3, jobYoy: +1.8, medAge: 35.0, ownerOcc: 59.8, migrationTag: 'Net inflow',  notes: 'Energy + healthcare anchor. Diverse industry base; less rate-sensitive than coastal metros.' },
  'Washington-Arlington-Alexandria':       { popYoy: +0.4, jobYoy: +0.6, medAge: 38.5, ownerOcc: 62.5, migrationTag: 'Stable',      notes: 'Federal-spending-anchored. Inner-suburb (Loudoun, Fairfax) more growth than DC core.' },
  'Philadelphia-Camden-Wilmington':        { popYoy: -0.2, jobYoy: +0.4, medAge: 39.2, ownerOcc: 67.1, migrationTag: 'Slight outflow', notes: 'Healthcare + bio anchor. Inner-suburb growth (Bucks, Chester) offsets city losses.' },
  'Miami-Fort Lauderdale-West Palm Beach': { popYoy: +1.0, jobYoy: +1.5, medAge: 41.0, ownerOcc: 60.5, migrationTag: 'Net inflow',  notes: 'High-end inflow from NY/NJ/CA. Inventory rising; price growth moderating from peak.' },
  'Atlanta-Sandy Springs-Roswell':         { popYoy: +1.4, jobYoy: +1.7, medAge: 36.5, ownerOcc: 61.2, migrationTag: 'Net inflow',  notes: 'Forsyth/Cherokee suburbs lead. Diverse anchor industries (Coke, Delta, fintech).' },
  'Boston-Cambridge-Newton':               { popYoy: +0.1, jobYoy: +0.8, medAge: 39.0, ownerOcc: 60.1, migrationTag: 'Stable',      notes: 'Bio + university anchor. Core stable; outer NH suburbs growing.' },
  'Phoenix-Mesa-Scottsdale':               { popYoy: +1.7, jobYoy: +2.0, medAge: 37.2, ownerOcc: 64.7, migrationTag: 'Net inflow',  notes: 'Sunbelt champion. Pinal County fastest-growing in metro. Climate risk: heat + wildfire.' },
  'San Francisco-Oakland-Hayward':         { popYoy: -0.6, jobYoy: -0.2, medAge: 39.0, ownerOcc: 53.7, migrationTag: 'Net outflow', notes: 'Tech-layoff + remote-work outmigration. PTI ratio worst in the country.' },
  'Riverside-San Bernardino-Ontario':      { popYoy: +0.8, jobYoy: +1.0, medAge: 35.8, ownerOcc: 64.5, migrationTag: 'Net inflow',  notes: 'CA Inland Empire — affordability-driven flight from coastal CA. Logistics employment heavy.' },
  'Detroit-Warren-Dearborn':               { popYoy: -0.5, jobYoy: +0.2, medAge: 40.1, ownerOcc: 70.5, migrationTag: 'Net outflow', notes: 'Auto-anchored economy. Suburban (Oakland, Macomb) stable; Detroit core stabilizing.' },
  'Seattle-Tacoma-Bellevue':               { popYoy: +0.5, jobYoy: +1.0, medAge: 37.8, ownerOcc: 60.2, migrationTag: 'Slowing',     notes: 'Tech-anchored. King County losing some, Pierce + Snohomish absorbing.' },
  'Minneapolis-St. Paul-Bloomington':      { popYoy: +0.3, jobYoy: +0.7, medAge: 38.0, ownerOcc: 70.0, migrationTag: 'Stable',      notes: 'Diverse Fortune-500 anchor. Stable, moderate-growth metro.' },
  'San Diego-Carlsbad':                    { popYoy: -0.2, jobYoy: +0.3, medAge: 36.5, ownerOcc: 53.6, migrationTag: 'Slight outflow', notes: 'Defense + biotech anchor. Affordability stretched; net domestic outflow but military rotation supports demand.' },
  'Tampa-St. Petersburg-Clearwater':       { popYoy: +1.5, jobYoy: +1.8, medAge: 42.0, ownerOcc: 67.5, migrationTag: 'Net inflow',  notes: 'Sun Belt retiree + remote-worker magnet. Hurricane risk + insurance pricing emerging headwind.' },
  'Denver-Aurora-Lakewood':                { popYoy: +0.4, jobYoy: +0.8, medAge: 36.7, ownerOcc: 64.8, migrationTag: 'Slowing',     notes: 'Energy + tech anchor. Growth slowing from 2010s pace as affordability stretches.' },
  'Baltimore-Columbia-Towson':             { popYoy: -0.1, jobYoy: +0.4, medAge: 39.0, ownerOcc: 65.5, migrationTag: 'Slight outflow', notes: 'Healthcare + government anchor. Stable but slow.' },
  'St. Louis':                             { popYoy: -0.4, jobYoy: +0.3, medAge: 39.0, ownerOcc: 68.7, migrationTag: 'Slight outflow', notes: 'Healthcare + finance anchor. Most affordable major metro on this list.' },
  'Charlotte-Concord-Gastonia':            { popYoy: +1.5, jobYoy: +1.7, medAge: 36.6, ownerOcc: 64.5, migrationTag: 'Net inflow',  notes: 'Banking + fintech anchor. Among fastest-growing East Coast metros.' },
  'Orlando-Kissimmee-Sanford':             { popYoy: +1.6, jobYoy: +1.8, medAge: 37.5, ownerOcc: 65.0, migrationTag: 'Net inflow',  notes: 'Tourism + healthcare. New starts heavy; price growth normalizing.' },
  'Portland-Vancouver-Hillsboro':          { popYoy: -0.3, jobYoy: +0.3, medAge: 39.5, ownerOcc: 62.5, migrationTag: 'Slight outflow', notes: 'Tech + outdoor industry. Affordability + city-policy concerns driving suburban shifts.' },
  'Austin-Round Rock-Georgetown':          { popYoy: +1.3, jobYoy: +1.6, medAge: 35.5, ownerOcc: 60.8, migrationTag: 'Net inflow (slowing)', notes: 'Most-talked-about Sun Belt metro. Inventory built fastest; price growth flat-to-down 2024.' },
};

function renderMetroDetail(metroName) {
  const tgt = document.getElementById('metro-detail-panel');
  if (!tgt) return;
  const d = METRO_DETAIL[metroName];
  const meta = METROS[metroName];
  if (!d || !meta) {
    tgt.style.display = 'none';
    return;
  }
  const pti = meta.homeValue / meta.hhIncome;
  const ptiClass = pti > 6 ? 'neg' : pti < 4 ? 'pos' : '';
  const popClass = d.popYoy >= 0 ? 'pos' : 'neg';
  const jobClass = d.jobYoy >= 0 ? 'pos' : 'neg';
  const migClass = d.migrationTag.includes('inflow') ? 'pos' : d.migrationTag.includes('outflow') ? 'neg' : '';

  tgt.innerHTML = `
    <div class="md-header">
      <div class="md-title">${metroName}</div>
      <button class="md-close" id="md-close" title="Close">&times;</button>
    </div>
    <div class="md-grid">
      <div class="md-tile"><div class="md-label">Median home value</div><div class="md-value">$${(meta.homeValue / 1000).toFixed(0)}K</div></div>
      <div class="md-tile"><div class="md-label">Median HH income</div><div class="md-value">$${(meta.hhIncome / 1000).toFixed(1)}K</div></div>
      <div class="md-tile"><div class="md-label">Price-to-income</div><div class="md-value ${ptiClass}">${pti.toFixed(1)}x</div></div>
      <div class="md-tile"><div class="md-label">Population YoY</div><div class="md-value ${popClass}">${d.popYoy >= 0 ? '+' : ''}${d.popYoy.toFixed(1)}%</div></div>
      <div class="md-tile"><div class="md-label">Employment YoY</div><div class="md-value ${jobClass}">${d.jobYoy >= 0 ? '+' : ''}${d.jobYoy.toFixed(1)}%</div></div>
      <div class="md-tile"><div class="md-label">Median age</div><div class="md-value">${d.medAge.toFixed(1)}</div></div>
      <div class="md-tile"><div class="md-label">Owner-occupied</div><div class="md-value">${d.ownerOcc.toFixed(1)}%</div></div>
      <div class="md-tile"><div class="md-label">Migration</div><div class="md-value ${migClass}" style="font-size:13px">${d.migrationTag}</div></div>
    </div>
    <div class="md-notes"><strong>Context:</strong> ${d.notes}</div>
  `;
  tgt.style.display = 'block';
  document.getElementById('md-close').addEventListener('click', () => { tgt.style.display = 'none'; });
}

// Patch renderChart to wire click handler. We do this by overriding after definition.
const _origRenderChart = renderChart;
window.__renderChartChained = function() {
  _origRenderChart();
  const canvas = document.getElementById('chart-pti');
  if (!canvas) return;
  canvas.addEventListener('click', (evt) => {
    const ch = Chart.getChart(canvas);
    if (!ch) return;
    const points = ch.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
    if (!points.length) return;
    const idx = points[0].index;
    const metroName = ch.data.labels[idx];
    renderMetroDetail(metroName);
    document.getElementById('metro-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  canvas.style.cursor = 'pointer';
};
