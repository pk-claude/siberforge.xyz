// State demographics snapshot. Source: Census ACS 2022 5-yr estimates.
// Refresh when new ACS vintage releases.
//
// pct25_54: percentage of state population aged 25-54 (household-formation cohort)
// pct65plus: percentage aged 65 and over (downsizer cohort)
// ratio: pct25_54 / pct65plus (higher = more household-formers per downsizer)

const DEMO = {
  AL:{name:'Alabama',         medAge:39.6, medIncome:54943, ownerOcc:69.0, pct25_54:38.2, pct65:18.0},
  AK:{name:'Alaska',          medAge:35.4, medIncome:81133, ownerOcc:64.1, pct25_54:38.5, pct65:13.8},
  AZ:{name:'Arizona',         medAge:38.6, medIncome:69056, ownerOcc:67.8, pct25_54:37.6, pct65:18.7},
  AR:{name:'Arkansas',        medAge:38.4, medIncome:50784, ownerOcc:66.9, pct25_54:37.6, pct65:17.8},
  CA:{name:'California',      medAge:37.4, medIncome:84097, ownerOcc:55.9, pct25_54:40.2, pct65:15.4},
  CO:{name:'Colorado',        medAge:37.7, medIncome:80184, ownerOcc:65.8, pct25_54:40.7, pct65:15.6},
  CT:{name:'Connecticut',     medAge:41.1, medIncome:83572, ownerOcc:66.4, pct25_54:37.9, pct65:18.4},
  DE:{name:'Delaware',        medAge:41.4, medIncome:74875, ownerOcc:71.7, pct25_54:36.9, pct65:21.2},
  DC:{name:'District of Columbia', medAge:34.0, medIncome:90842, ownerOcc:42.1, pct25_54:46.4, pct65:13.2},
  FL:{name:'Florida',         medAge:42.2, medIncome:63062, ownerOcc:66.2, pct25_54:36.8, pct65:21.6},
  GA:{name:'Georgia',         medAge:37.3, medIncome:65030, ownerOcc:64.4, pct25_54:39.4, pct65:14.9},
  HI:{name:'Hawaii',          medAge:39.4, medIncome:88005, ownerOcc:60.7, pct25_54:38.4, pct65:19.5},
  ID:{name:'Idaho',           medAge:36.8, medIncome:66474, ownerOcc:71.0, pct25_54:37.6, pct65:17.2},
  IL:{name:'Illinois',        medAge:38.6, medIncome:72205, ownerOcc:66.5, pct25_54:39.3, pct65:17.5},
  IN:{name:'Indiana',         medAge:37.9, medIncome:62743, ownerOcc:69.7, pct25_54:38.4, pct65:16.5},
  IA:{name:'Iowa',            medAge:38.6, medIncome:65600, ownerOcc:71.3, pct25_54:37.5, pct65:18.0},
  KS:{name:'Kansas',          medAge:36.9, medIncome:64124, ownerOcc:66.4, pct25_54:38.5, pct65:16.9},
  KY:{name:'Kentucky',        medAge:39.0, medIncome:55454, ownerOcc:68.4, pct25_54:37.8, pct65:17.5},
  LA:{name:'Louisiana',       medAge:37.5, medIncome:53571, ownerOcc:66.7, pct25_54:37.6, pct65:17.0},
  ME:{name:'Maine',           medAge:45.1, medIncome:64767, ownerOcc:73.0, pct25_54:35.7, pct65:22.2},
  MD:{name:'Maryland',        medAge:39.0, medIncome:91431, ownerOcc:67.3, pct25_54:39.4, pct65:17.0},
  MA:{name:'Massachusetts',   medAge:39.6, medIncome:89026, ownerOcc:62.5, pct25_54:39.6, pct65:17.8},
  MI:{name:'Michigan',        medAge:40.0, medIncome:63498, ownerOcc:71.7, pct25_54:37.8, pct65:18.5},
  MN:{name:'Minnesota',       medAge:38.5, medIncome:77720, ownerOcc:71.4, pct25_54:39.0, pct65:17.0},
  MS:{name:'Mississippi',     medAge:37.9, medIncome:48716, ownerOcc:69.9, pct25_54:37.8, pct65:17.0},
  MO:{name:'Missouri',        medAge:38.7, medIncome:61847, ownerOcc:67.4, pct25_54:38.1, pct65:17.7},
  MT:{name:'Montana',         medAge:40.1, medIncome:60560, ownerOcc:67.7, pct25_54:36.5, pct65:19.9},
  NE:{name:'Nebraska',        medAge:36.8, medIncome:66644, ownerOcc:65.5, pct25_54:38.1, pct65:16.5},
  NV:{name:'Nevada',          medAge:38.6, medIncome:65686, ownerOcc:57.7, pct25_54:39.1, pct65:17.0},
  NH:{name:'New Hampshire',   medAge:43.1, medIncome:83449, ownerOcc:71.4, pct25_54:37.4, pct65:19.3},
  NJ:{name:'New Jersey',      medAge:40.1, medIncome:89703, ownerOcc:64.1, pct25_54:38.7, pct65:17.5},
  NM:{name:'New Mexico',      medAge:39.0, medIncome:54020, ownerOcc:67.6, pct25_54:36.6, pct65:18.7},
  NY:{name:'New York',        medAge:39.5, medIncome:75157, ownerOcc:53.2, pct25_54:39.8, pct65:17.6},
  NC:{name:'North Carolina',  medAge:39.0, medIncome:61972, ownerOcc:65.8, pct25_54:38.4, pct65:17.5},
  ND:{name:'North Dakota',    medAge:35.6, medIncome:68131, ownerOcc:62.5, pct25_54:38.3, pct65:16.0},
  OH:{name:'Ohio',            medAge:39.6, medIncome:62689, ownerOcc:66.4, pct25_54:38.0, pct65:17.9},
  OK:{name:'Oklahoma',        medAge:36.9, medIncome:55826, ownerOcc:66.6, pct25_54:37.9, pct65:16.3},
  OR:{name:'Oregon',          medAge:39.9, medIncome:71562, ownerOcc:62.9, pct25_54:38.6, pct65:18.6},
  PA:{name:'Pennsylvania',    medAge:40.7, medIncome:67587, ownerOcc:69.0, pct25_54:37.9, pct65:19.3},
  RI:{name:'Rhode Island',    medAge:40.4, medIncome:74489, ownerOcc:62.0, pct25_54:38.6, pct65:18.4},
  SC:{name:'South Carolina',  medAge:40.0, medIncome:58234, ownerOcc:69.9, pct25_54:37.6, pct65:19.3},
  SD:{name:'South Dakota',    medAge:37.6, medIncome:64533, ownerOcc:67.8, pct25_54:37.1, pct65:17.4},
  TN:{name:'Tennessee',       medAge:38.9, medIncome:59695, ownerOcc:66.8, pct25_54:38.3, pct65:17.3},
  TX:{name:'Texas',           medAge:35.3, medIncome:67321, ownerOcc:62.4, pct25_54:39.8, pct65:13.4},
  UT:{name:'Utah',            medAge:31.2, medIncome:79133, ownerOcc:69.7, pct25_54:39.3, pct65:11.7},
  VT:{name:'Vermont',         medAge:43.0, medIncome:67674, ownerOcc:71.3, pct25_54:36.9, pct65:21.0},
  VA:{name:'Virginia',        medAge:38.6, medIncome:80963, ownerOcc:66.5, pct25_54:39.4, pct65:16.4},
  WA:{name:'Washington',      medAge:38.0, medIncome:84247, ownerOcc:62.3, pct25_54:40.1, pct65:16.4},
  WV:{name:'West Virginia',   medAge:42.9, medIncome:51248, ownerOcc:74.0, pct25_54:36.5, pct65:21.0},
  WI:{name:'Wisconsin',       medAge:39.8, medIncome:67125, ownerOcc:67.4, pct25_54:37.8, pct65:18.0},
  WY:{name:'Wyoming',         medAge:38.4, medIncome:68002, ownerOcc:71.2, pct25_54:36.7, pct65:17.7},
};

function el(id) { return document.getElementById(id); }
function fmt(n, d = 1) { return Number.isFinite(n) ? n.toFixed(d) : '—'; }

let _sortBy = 'medIncome', _sortDir = 'desc';

function renderTable() {
  const cmp = (a, b) => {
    let av = a[1][_sortBy], bv = b[1][_sortBy];
    if (_sortBy === 'name') { av = a[1].name; bv = b[1].name; }
    if (av < bv) return _sortDir === 'asc' ? -1 : 1;
    if (av > bv) return _sortDir === 'asc' ? 1 : -1;
    return 0;
  };
  const sorted = Object.entries(DEMO).sort(cmp);
  const rows = sorted.map(([code, v]) => `
    <tr data-state="${code}">
      <td>${v.name}</td>
      <td>${fmt(v.medAge, 1)}</td>
      <td>$${(v.medIncome / 1000).toFixed(1)}K</td>
      <td>${fmt(v.ownerOcc, 1)}%</td>
      <td>${fmt(v.pct25_54, 1)}%</td>
      <td>${fmt(v.pct65, 1)}%</td>
      <td>${(v.pct25_54 / v.pct65).toFixed(2)}x</td>
    </tr>
  `).join('');
  function arrow(col) { return _sortBy === col ? (_sortDir === 'desc' ? ' ▼' : ' ▲') : ''; }
  el('demographics-table').innerHTML = `<table class="reg-table demo-sortable">
    <thead><tr>
      <th data-col="name">State${arrow('name')}</th>
      <th data-col="medAge">Median age${arrow('medAge')}</th>
      <th data-col="medIncome">Median HH income${arrow('medIncome')}</th>
      <th data-col="ownerOcc">Owner-occupied${arrow('ownerOcc')}</th>
      <th data-col="pct25_54">% 25-54${arrow('pct25_54')}</th>
      <th data-col="pct65">% 65+${arrow('pct65')}</th>
      <th data-col="cohort">Formers/Seniors${arrow('cohort')}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  wireTableInteractions();
}

function wireTableInteractions() {
  const table = el('demographics-table');
  if (!table) return;
  // Click headers to sort
  table.querySelectorAll('th[data-col]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      // Map "cohort" virtual column to a real key by computing on the fly
      if (col === _sortBy) _sortDir = _sortDir === 'desc' ? 'asc' : 'desc';
      else { _sortBy = col; _sortDir = 'desc'; }
      // For "cohort" we sort by computed ratio
      if (_sortBy === 'cohort') {
        const sorted = Object.entries(DEMO).sort((a, b) => {
          const r = (a[1].pct25_54 / a[1].pct65) - (b[1].pct25_54 / b[1].pct65);
          return _sortDir === 'asc' ? r : -r;
        });
        const rows = sorted.map(([code, v]) => `
          <tr data-state="${code}">
            <td>${v.name}</td>
            <td>${fmt(v.medAge, 1)}</td>
            <td>$${(v.medIncome / 1000).toFixed(1)}K</td>
            <td>${fmt(v.ownerOcc, 1)}%</td>
            <td>${fmt(v.pct25_54, 1)}%</td>
            <td>${fmt(v.pct65, 1)}%</td>
            <td>${(v.pct25_54 / v.pct65).toFixed(2)}x</td>
          </tr>
        `).join('');
        table.querySelector('tbody').innerHTML = rows;
        // Re-render headers with arrow indicator
        table.querySelectorAll('th[data-col]').forEach(h => {
          const arrow = h.dataset.col === _sortBy ? (_sortDir === 'desc' ? ' ▼' : ' ▲') : '';
          h.textContent = h.textContent.replace(/[▼▲]/g, '').trim() + arrow;
        });
        wireTableInteractions();  // rebind
        return;
      }
      renderTable();
    });
  });
  // Hover row → highlight (background)
  table.querySelectorAll('tbody tr').forEach(tr => {
    tr.addEventListener('mouseenter', () => tr.style.background = 'rgba(247, 167, 0, 0.08)');
    tr.addEventListener('mouseleave', () => tr.style.background = '');
  });
}

function renderCohortChart() {
  const sorted = Object.entries(DEMO).map(([_, v]) => ({ name: v.name, ratio: v.pct25_54 / v.pct65 }))
    .sort((a, b) => b.ratio - a.ratio);
  const labels = sorted.map(o => o.name);
  const data = sorted.map(o => o.ratio);
  const colors = data.map(v => v > 2.5 ? 'rgba(62, 207, 142, 0.75)' : v > 2.0 ? 'rgba(247, 167, 0, 0.65)' : 'rgba(239, 79, 90, 0.65)');

  new Chart(el('chart-cohort').getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Working-age / senior population ratio', data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
                 tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1,
                            callbacks: { label: c => `${c.label}: ${c.parsed.x.toFixed(2)}x` } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 9 }, callback: v => `${v.toFixed(1)}x` },
             title: { display: true, text: '% pop 25-54 / % pop 65+', color: '#8a94a3', font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: '#e5e9ee', font: { size: 9 } } },
      },
    },
  });

  const top3 = sorted.slice(0, 3).map(o => `${o.name} (${o.ratio.toFixed(2)}x)`).join(', ');
  const bot3 = sorted.slice(-3).reverse().map(o => `${o.name} (${o.ratio.toFixed(2)}x)`).join(', ');
  el('note-cohort').innerHTML = `<strong>Top 3 (formation-skewed):</strong> ${top3}. <strong>Bottom 3 (downsizer-skewed):</strong> ${bot3}. Utah, Texas, DC at the top reflect young populations driving household formation; Maine, West Virginia, Vermont at the bottom reflect aging populations and natural turnover.`;
}

renderTable();
renderCohortChart();
