const state = { mspus: [], mspnhsus: [], spread: [] };

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

async function loadData() {
  setStatus('stale', 'Loading new + existing home prices…');
  const j = await fetchJSON('/api/fred?series=MSPUS,MSPNHSUS&start=1990-01-01');
  for (const s of j.series) {
    if (s.id === 'MSPUS') state.mspus = s.observations;
    if (s.id === 'MSPNHSUS') state.mspnhsus = s.observations;
  }
  // Compute spread by aligning quarterly dates
  const exMap = new Map(state.mspus.map(o => [o.date, o.value]));
  state.spread = [];
  for (const o of state.mspnhsus) {
    if (!exMap.has(o.date)) continue;
    const ex = exMap.get(o.date), nw = o.value;
    if (!ex || !nw) continue;
    const pct = (nw / ex - 1) * 100;
    state.spread.push({ date: o.date, value: pct });
  }
}

function renderPrices() {
  new Chart(el('chart-prices').getContext('2d'), {
    type: 'line',
    data: { datasets: [
      { label: 'Existing-home median (MSPUS)', data: state.mspus.map(o => ({ x: o.date, y: o.value })),
        borderColor: '#5a9cff', borderWidth: 1.6, pointRadius: 0, fill: false, tension: 0.1 },
      { label: 'New-home median (MSPNHSUS)', data: state.mspnhsus.map(o => ({ x: o.date, y: o.value })),
        borderColor: '#f7a700', backgroundColor: 'rgba(247, 167, 0, 0.10)', borderWidth: 1.8, pointRadius: 0, fill: true, tension: 0.1 },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#e5e9ee', font: { size: 11 } } },
                 tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1 } },
      scales: {
        x: { type: 'time', time: { unit: 'year' }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 }, callback: v => `$${(v/1000).toFixed(0)}K` },
             title: { display: true, text: 'Median price (USD)', color: '#8a94a3', font: { size: 11 } } },
      },
    },
  });
}

function renderSpread() {
  new Chart(el('chart-spread').getContext('2d'), {
    type: 'line',
    data: { datasets: [{ label: 'New / Existing premium (%)',
      data: state.spread.map(o => ({ x: o.date, y: o.value })),
      borderColor: '#f7a700', backgroundColor: 'rgba(247, 167, 0, 0.10)', borderWidth: 1.8, pointRadius: 0, fill: true, tension: 0.1 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#e5e9ee', font: { size: 11 } } },
        tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1 },
      },
      scales: {
        x: { type: 'time', time: { unit: 'year' }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 }, callback: v => `${v >= 0 ? '+' : ''}${v}%` },
             title: { display: true, text: 'New premium over existing (%)', color: '#8a94a3', font: { size: 11 } } },
      },
    },
  });
  const ls = latestValue(state.spread);
  if (ls) {
    let msg;
    if (ls.value > 25)      msg = `New-home premium at <strong>+${fmt(ls.value, 1)}%</strong> &mdash; well above norm. Existing-home affordability advantage; builders losing share.`;
    else if (ls.value > 10) msg = `New-home premium at <strong>+${fmt(ls.value, 1)}%</strong> &mdash; within historical norm (10-25%). Equilibrium share dynamics.`;
    else if (ls.value > 0)  msg = `New-home premium compressed to <strong>+${fmt(ls.value, 1)}%</strong> &mdash; <em>builders share-gaining</em>. New-home demand growing faster than existing turnover.`;
    else                     msg = `New cheaper than existing by <strong>${fmt(-ls.value, 1)}%</strong> &mdash; <em>extreme builder share-gain regime</em>. This level historically only happens in builder-clearing-inventory episodes (e.g., 2009).`;
    el('note-spread').innerHTML = `<strong>Current read:</strong> ${msg}`;
  }
}

async function main() {
  try {
    await loadData();
    renderPrices();
    renderSpread();
    el('last-updated').textContent = `Updated ${new Date().toLocaleString()}`;
    setStatus('live', 'Live');
  } catch (err) {
    console.error(err);
    setStatus('error', `Error: ${err.message}`);
  }
}
main();
