// FEMA National Risk Index composite score by state (2023 release).
// Score 0-100. Higher = more risk exposure. Refresh from FEMA when new vintage releases.

const FEMA_NRI = {
  CA:{name:'California',         score: 100.0, top: 'Wildfire, Earthquake'},
  TX:{name:'Texas',              score:  91.6, top: 'Hurricane, Tornado'},
  FL:{name:'Florida',            score:  87.0, top: 'Hurricane, Coastal Flood'},
  LA:{name:'Louisiana',          score:  80.0, top: 'Hurricane, Riverine Flood'},
  WA:{name:'Washington',         score:  60.0, top: 'Earthquake, Wildfire'},
  NC:{name:'North Carolina',     score:  56.0, top: 'Hurricane, Tornado'},
  IL:{name:'Illinois',           score:  53.0, top: 'Tornado, Riverine Flood'},
  AL:{name:'Alabama',            score:  52.0, top: 'Tornado, Hurricane'},
  NY:{name:'New York',           score:  50.0, top: 'Coastal Flood, Winter Storm'},
  OK:{name:'Oklahoma',           score:  49.0, top: 'Tornado, Hail'},
  MO:{name:'Missouri',           score:  47.0, top: 'Tornado, Riverine Flood'},
  AZ:{name:'Arizona',            score:  44.0, top: 'Heat Wave, Wildfire'},
  KY:{name:'Kentucky',           score:  43.0, top: 'Tornado, Riverine Flood'},
  TN:{name:'Tennessee',          score:  42.0, top: 'Tornado, Riverine Flood'},
  PA:{name:'Pennsylvania',       score:  41.5, top: 'Winter Storm, Riverine Flood'},
  AR:{name:'Arkansas',           score:  41.0, top: 'Tornado, Riverine Flood'},
  MS:{name:'Mississippi',        score:  40.0, top: 'Tornado, Hurricane'},
  GA:{name:'Georgia',            score:  39.0, top: 'Tornado, Hurricane'},
  KS:{name:'Kansas',             score:  38.5, top: 'Tornado, Hail'},
  OH:{name:'Ohio',               score:  37.0, top: 'Tornado, Winter Storm'},
  VA:{name:'Virginia',           score:  36.5, top: 'Hurricane, Coastal Flood'},
  CO:{name:'Colorado',           score:  35.0, top: 'Wildfire, Hail'},
  NJ:{name:'New Jersey',         score:  34.0, top: 'Coastal Flood, Hurricane'},
  IN:{name:'Indiana',            score:  33.0, top: 'Tornado, Riverine Flood'},
  MI:{name:'Michigan',           score:  31.0, top: 'Winter Storm, Tornado'},
  IA:{name:'Iowa',               score:  29.5, top: 'Tornado, Riverine Flood'},
  NE:{name:'Nebraska',           score:  28.0, top: 'Tornado, Hail'},
  WI:{name:'Wisconsin',          score:  26.0, top: 'Winter Storm, Tornado'},
  MN:{name:'Minnesota',          score:  25.5, top: 'Winter Storm, Tornado'},
  SC:{name:'South Carolina',     score:  25.0, top: 'Hurricane, Coastal Flood'},
  OR:{name:'Oregon',             score:  24.0, top: 'Wildfire, Earthquake'},
  WV:{name:'West Virginia',      score:  21.0, top: 'Riverine Flood, Landslide'},
  HI:{name:'Hawaii',             score:  20.0, top: 'Hurricane, Volcanic'},
  NV:{name:'Nevada',             score:  19.0, top: 'Earthquake, Wildfire'},
  ID:{name:'Idaho',              score:  18.0, top: 'Wildfire, Earthquake'},
  AK:{name:'Alaska',             score:  17.0, top: 'Earthquake, Tsunami'},
  NM:{name:'New Mexico',         score:  16.0, top: 'Wildfire, Drought'},
  MT:{name:'Montana',            score:  15.5, top: 'Wildfire, Winter Storm'},
  ME:{name:'Maine',              score:  14.0, top: 'Coastal Flood, Winter Storm'},
  UT:{name:'Utah',               score:  13.5, top: 'Earthquake, Wildfire'},
  WY:{name:'Wyoming',            score:  12.0, top: 'Wildfire, Winter Storm'},
  ND:{name:'North Dakota',       score:  11.5, top: 'Winter Storm, Riverine Flood'},
  SD:{name:'South Dakota',       score:  11.0, top: 'Tornado, Winter Storm'},
  MD:{name:'Maryland',           score:  20.5, top: 'Coastal Flood, Hurricane'},
  CT:{name:'Connecticut',        score:  19.5, top: 'Coastal Flood, Winter Storm'},
  MA:{name:'Massachusetts',      score:  21.0, top: 'Coastal Flood, Winter Storm'},
  NH:{name:'New Hampshire',      score:  10.5, top: 'Winter Storm, Riverine Flood'},
  VT:{name:'Vermont',            score:  10.0, top: 'Winter Storm, Riverine Flood'},
  RI:{name:'Rhode Island',       score:  16.5, top: 'Coastal Flood, Hurricane'},
  DE:{name:'Delaware',           score:  17.5, top: 'Coastal Flood, Hurricane'},
  DC:{name:'District of Columbia', score:  9.0, top: 'Riverine Flood, Heat Wave'},
};

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

function renderRiskChart() {
  const sorted = Object.entries(FEMA_NRI).sort((a, b) => b[1].score - a[1].score);
  const labels = sorted.map(([_, v]) => v.name);
  const data = sorted.map(([_, v]) => v.score);
  const colors = data.map(v => v > 60 ? 'rgba(239, 79, 90, 0.85)' : v > 30 ? 'rgba(247, 167, 0, 0.7)' : 'rgba(62, 207, 142, 0.55)');

  new Chart(el('chart-risk').getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'FEMA National Risk Index score', data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
                 tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1,
                            callbacks: { label: c => {
                              const code = Object.keys(FEMA_NRI)[Object.values(FEMA_NRI).findIndex(v => v.name === c.label)];
                              const top = FEMA_NRI[code]?.top || '';
                              return [`${c.label}: ${c.parsed.x.toFixed(1)}`, `Top hazards: ${top}`];
                            } } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 9 } },
             title: { display: true, text: 'FEMA NRI score (composite)', color: '#8a94a3', font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: '#e5e9ee', font: { size: 9 } } },
      },
    },
  });

  const top5 = sorted.slice(0, 5).map(([_, v]) => `${v.name} (${v.top})`).join(', ');
  el('note-risk').innerHTML = `<strong>Top 5 hazard exposure:</strong> ${top5}. <em>Implication:</em> these states have structurally higher insurance costs and growing carrier-exit risk &mdash; an increasing constraint on home affordability that doesn't show up in price-to-income ratios.`;
}

async function renderInsuranceChart() {
  setStatus('stale', 'Loading insurance CPI…');
  try {
    const j = await fetchJSON('/api/fred?series=CUSR0000SEHE&start=2000-01-01');
    const obs = j.series[0]?.observations || [];
    const yoy = yoyPct(obs);
    new Chart(el('chart-insurance').getContext('2d'), {
      type: 'line',
      data: { datasets: [{ label: "Tenants' & Household Insurance CPI YoY",
        data: yoy.map(o => ({ x: o.date, y: o.value })),
        borderColor: '#ef4f5a', backgroundColor: 'rgba(239, 79, 90, 0.10)', borderWidth: 1.8, pointRadius: 0, fill: true, tension: 0.1 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#e5e9ee', font: { size: 11 } } },
                   tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1 } },
        scales: {
          x: { type: 'time', time: { unit: 'year' }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 }, callback: v => `${v}%` },
               title: { display: true, text: 'YoY (%)', color: '#8a94a3', font: { size: 11 } } },
        },
      },
    });
    const last = latestValue(yoy);
    if (last) {
      let msg;
      if (last.value > 8)       msg = `Insurance inflation at <strong>${fmt(last.value, 1)}%</strong> YoY &mdash; well above any historical norm. Carriers are repricing climate risk; expect this to flow into housing affordability and homeowner P&I + I (insurance) ratios.`;
      else if (last.value > 5)  msg = `Insurance inflation at <strong>${fmt(last.value, 1)}%</strong> YoY &mdash; elevated vs. long-run trend (~3-4%). Climate-risk repricing in progress.`;
      else                       msg = `Insurance inflation at <strong>${fmt(last.value, 1)}%</strong> YoY &mdash; near long-run trend.`;
      el('note-insurance').innerHTML = `<strong>Current read:</strong> ${msg}`;
    }
    el('last-updated').textContent = `Updated ${new Date().toLocaleString()}`;
    setStatus('live', 'Live');
  } catch (err) {
    console.error('insurance fetch failed:', err);
    setStatus('error', err.message);
  }
}

renderRiskChart();
renderInsuranceChart();
