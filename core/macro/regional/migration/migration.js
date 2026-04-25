// Net domestic migration by state, 2019-2023 cumulative (5y).
// Values are net migration as % of state population. Source: IRS SOI / Census ACS.
// Snapshot data — refresh when new vintage releases.

const MIGRATION_DATA = {
  // 5y cumulative net domestic migration % of state population (2019-2023).
  // Positive = net inflow; negative = net outflow.
  FL: { name: 'Florida',          latest: 1.85, cumulative5y:  6.2 },
  TX: { name: 'Texas',            latest: 1.42, cumulative5y:  5.5 },
  SC: { name: 'South Carolina',   latest: 1.38, cumulative5y:  4.8 },
  NC: { name: 'North Carolina',   latest: 1.20, cumulative5y:  4.4 },
  TN: { name: 'Tennessee',        latest: 1.15, cumulative5y:  4.0 },
  ID: { name: 'Idaho',            latest: 1.05, cumulative5y:  5.6 },
  AZ: { name: 'Arizona',          latest: 0.92, cumulative5y:  3.9 },
  GA: { name: 'Georgia',          latest: 0.78, cumulative5y:  2.4 },
  AL: { name: 'Alabama',          latest: 0.55, cumulative5y:  1.6 },
  NV: { name: 'Nevada',           latest: 0.50, cumulative5y:  2.0 },
  UT: { name: 'Utah',             latest: 0.45, cumulative5y:  2.5 },
  OK: { name: 'Oklahoma',         latest: 0.42, cumulative5y:  1.4 },
  AR: { name: 'Arkansas',         latest: 0.40, cumulative5y:  1.2 },
  MT: { name: 'Montana',          latest: 0.38, cumulative5y:  3.0 },
  DE: { name: 'Delaware',         latest: 0.30, cumulative5y:  1.5 },
  WY: { name: 'Wyoming',          latest: 0.28, cumulative5y:  1.1 },
  ME: { name: 'Maine',            latest: 0.25, cumulative5y:  1.8 },
  NH: { name: 'New Hampshire',    latest: 0.22, cumulative5y:  1.5 },
  KY: { name: 'Kentucky',         latest: 0.18, cumulative5y:  0.6 },
  IN: { name: 'Indiana',          latest: 0.15, cumulative5y:  0.4 },
  MO: { name: 'Missouri',         latest: 0.12, cumulative5y:  0.3 },
  WV: { name: 'West Virginia',    latest: 0.10, cumulative5y: -0.2 },
  VA: { name: 'Virginia',         latest: 0.08, cumulative5y: -0.2 },
  NM: { name: 'New Mexico',       latest: 0.05, cumulative5y: -0.5 },
  IA: { name: 'Iowa',             latest: 0.02, cumulative5y: -0.3 },
  MS: { name: 'Mississippi',      latest:-0.05, cumulative5y: -0.4 },
  WI: { name: 'Wisconsin',        latest:-0.08, cumulative5y: -0.5 },
  PA: { name: 'Pennsylvania',     latest:-0.15, cumulative5y: -0.9 },
  OH: { name: 'Ohio',             latest:-0.18, cumulative5y: -1.1 },
  MN: { name: 'Minnesota',        latest:-0.25, cumulative5y: -1.0 },
  KS: { name: 'Kansas',           latest:-0.28, cumulative5y: -1.1 },
  NE: { name: 'Nebraska',         latest:-0.30, cumulative5y: -1.0 },
  CO: { name: 'Colorado',         latest:-0.35, cumulative5y: -0.5 },
  WA: { name: 'Washington',       latest:-0.42, cumulative5y: -0.4 },
  CT: { name: 'Connecticut',      latest:-0.50, cumulative5y: -1.6 },
  MD: { name: 'Maryland',         latest:-0.55, cumulative5y: -2.2 },
  RI: { name: 'Rhode Island',     latest:-0.58, cumulative5y: -1.8 },
  ND: { name: 'North Dakota',     latest:-0.62, cumulative5y: -2.0 },
  MA: { name: 'Massachusetts',    latest:-0.75, cumulative5y: -2.5 },
  HI: { name: 'Hawaii',           latest:-0.85, cumulative5y: -3.5 },
  OR: { name: 'Oregon',           latest:-0.92, cumulative5y: -1.5 },
  MI: { name: 'Michigan',         latest:-0.95, cumulative5y: -2.0 },
  AK: { name: 'Alaska',           latest:-1.05, cumulative5y: -3.8 },
  IL: { name: 'Illinois',         latest:-1.20, cumulative5y: -4.5 },
  NJ: { name: 'New Jersey',       latest:-1.35, cumulative5y: -3.8 },
  CA: { name: 'California',       latest:-1.42, cumulative5y: -3.5 },
  LA: { name: 'Louisiana',        latest:-1.55, cumulative5y: -3.4 },
  NY: { name: 'New York',         latest:-1.95, cumulative5y: -5.8 },
  DC: { name: 'District of Columbia', latest:-1.20, cumulative5y: -3.0 },
  SD: { name: 'South Dakota',     latest: 0.18, cumulative5y:  1.2 },
  VT: { name: 'Vermont',          latest: 0.15, cumulative5y:  0.8 },
};

function el(id) { return document.getElementById(id); }
function fmt(n, d = 2) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }

function renderChart() {
  const sorted = Object.entries(MIGRATION_DATA).sort((a, b) => b[1].latest - a[1].latest);
  const labels = sorted.map(([_, v]) => v.name);
  const data = sorted.map(([_, v]) => v.latest);
  const colors = data.map(v => v >= 0 ? 'rgba(62, 207, 142, 0.75)' : 'rgba(239, 79, 90, 0.75)');

  new Chart(el('chart-migration').getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Net domestic migration (% of state pop)', data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
                 tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1,
                            callbacks: { label: c => `${c.label}: ${c.parsed.x >= 0 ? '+' : ''}${c.parsed.x.toFixed(2)}%` } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 9 }, callback: v => `${v >= 0 ? '+' : ''}${v}%` },
             title: { display: true, text: 'Net migration (% of state population)', color: '#8a94a3', font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: '#e5e9ee', font: { size: 9 } } },
      },
    },
  });

  const top5 = sorted.slice(0, 5).map(([_, v]) => `${v.name} (+${fmt(v.latest, 2)}%)`).join(', ');
  const bot5 = sorted.slice(-5).reverse().map(([_, v]) => `${v.name} (${fmt(v.latest, 2)}%)`).join(', ');
  el('note-migration').innerHTML = `<strong>Top 5 inflows:</strong> ${top5}. <strong>Top 5 outflows:</strong> ${bot5}. <em>Implication:</em> states with sustained inflow have multi-year housing-demand tailwinds (Sun Belt builders win); states with sustained outflow have structural housing-demand headwinds.`;
}

function renderCumulativeTable() {
  const sorted = Object.entries(MIGRATION_DATA).sort((a, b) => b[1].cumulative5y - a[1].cumulative5y);
  const rows = sorted.map(([code, v]) => {
    const cls = v.cumulative5y > 0 ? 'pos' : 'neg';
    return `<tr>
      <td>${v.name}</td>
      <td class="${v.latest >= 0 ? 'pos' : 'neg'}">${v.latest >= 0 ? '+' : ''}${fmt(v.latest, 2)}%</td>
      <td class="${cls}">${v.cumulative5y >= 0 ? '+' : ''}${fmt(v.cumulative5y, 1)}%</td>
    </tr>`;
  }).join('');
  el('cumulative-table').innerHTML = `<table class="reg-table">
    <thead><tr><th>State</th><th>Latest year</th><th>5-year cumulative</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

renderChart();
renderCumulativeTable();
