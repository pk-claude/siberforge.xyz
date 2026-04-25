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
  renderTable();
}
main();
