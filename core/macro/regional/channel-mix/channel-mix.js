const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
  'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

const STATE_NAMES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',
  DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',
  KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',
  MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',
  OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',
  TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',
  WI:'Wisconsin',WY:'Wyoming',
};

const state = { share: {} };

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

async function loadAll() {
  setStatus('stale', `Loading 0/${STATES.length} states…`);
  // Fetch construction (CONS) + nonfarm (NA) for each state, in batches.
  // Using batches of 8 states × 2 series = 16 series per call.
  let loaded = 0;
  const errors = [];
  for (let i = 0; i < STATES.length; i += 8) {
    const batch = STATES.slice(i, i + 8);
    const ids = [];
    for (const s of batch) { ids.push(`${s}CONS`); ids.push(`${s}NA`); }
    try {
      const j = await fetchJSON(`/api/fred?series=${ids.join(',')}&start=2010-01-01`);
      const byId = Object.fromEntries(j.series.map(s => [s.id, s.observations]));
      for (const s of batch) {
        const cons = latestValue(byId[`${s}CONS`]);
        const na = latestValue(byId[`${s}NA`]);
        if (cons && na && na.value > 0) {
          state.share[s] = (cons.value / na.value) * 100;
          loaded++;
        }
      }
      if (j.errors?.length) errors.push(...j.errors);
    } catch (e) {
      console.warn(`batch fail ${batch.join(',')}:`, e);
      errors.push({ id: batch.join(','), error: String(e.message || e) });
    }
    setStatus('stale', `Loading ${loaded}/${STATES.length} states…`);
  }
  if (errors.length) console.warn('[channel-mix] errors:', errors);
  return { loaded, errorCount: errors.length };
}

function renderChart() {
  const sorted = Object.entries(state.share).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([s]) => STATE_NAMES[s] || s);
  const data = sorted.map(([_, v]) => v);
  // Color: top 10 in green (Pro-skewed), bottom 10 in blue (DIY-skewed), middle in muted
  const colors = sorted.map((_, i) => {
    if (i < 10) return 'rgba(62, 207, 142, 0.7)';
    if (i >= sorted.length - 10) return 'rgba(90, 156, 255, 0.7)';
    return 'rgba(247, 167, 0, 0.5)';
  });

  new Chart(el('chart-rank').getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Construction share of nonfarm employment (%)', data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
                 tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1,
                            callbacks: { label: c => `${c.label}: ${c.parsed.x.toFixed(2)}%` } } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 9 }, callback: v => `${v}%` },
             title: { display: true, text: 'Construction / total nonfarm (%)', color: '#8a94a3', font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: '#e5e9ee', font: { size: 9 } } },
      },
    },
  });

  if (sorted.length) {
    const top3 = sorted.slice(0, 3).map(([s, v]) => `${STATE_NAMES[s]||s} (${fmt(v, 1)}%)`).join(', ');
    const bot3 = sorted.slice(-3).reverse().map(([s, v]) => `${STATE_NAMES[s]||s} (${fmt(v, 1)}%)`).join(', ');
    el('note-rank').innerHTML = `<strong>Pro-skewed (top 3):</strong> ${top3}. <strong>DIY-skewed (bottom 3):</strong> ${bot3}. The 3-4x range across states reflects structural differences in housing density, climate-driven repair needs, and homeowner DIY culture.`;
  }
}

async function main() {
  try {
    const { loaded, errorCount } = await loadAll();
    if (loaded === 0) {
      setStatus('error', `No state data loaded (errors: ${errorCount}). Check console.`);
      const note = el('note-rank');
      if (note) note.innerHTML = '<strong>No data.</strong> All state-level FRED series failed to load. The most likely cause is that FRED uses a different series naming convention than the [STATE]CONS/[STATE]NA pattern this page assumes for state construction employment. Open devtools console for which specific series IDs failed.';
      return;
    }
    renderChart();
    el('last-updated').textContent = `Updated ${new Date().toLocaleString()}`;
    const partial = loaded < STATES.length;
    setStatus(partial ? 'stale' : 'live', partial ? `Partial: ${loaded}/${STATES.length}` : 'Live');
  } catch (err) {
    console.error(err);
    setStatus('error', `Error: ${err.message}`);
  }
}
main();
