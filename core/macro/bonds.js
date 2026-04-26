// bonds.js — orchestrator for all six bond market sections on /core/macro/bonds.html
// Sections: SBC (moved from regime), Yield curve, Real yields, Credit spreads, Cross-asset vol, Breakeven inflation

import { renderStockBondCorrelation } from './stock-bond-corr.js';
import { fetchFred } from '/core/lib/fred-client.js';
import { applyTransform } from '/core/lib/transforms.js';

const theme = { light: '#1a1a1a', dark: '#e8e8e8', gridLight: '#f5f5f5', gridDark: '#2a2a2a' };

let currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
document.addEventListener('themechange', (e) => { currentTheme = e.detail; });

// ============== HELPERS ==============

function getThemeColor() {
  return currentTheme === 'dark' ? theme.dark : theme.light;
}

function getGridColor() {
  return currentTheme === 'dark' ? theme.gridDark : theme.gridLight;
}

function percentile(arr, p) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)];
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// Compute 30-day rolling standard deviation (annualized)
function rollingYieldVol(dates, yields) {
  const vol = [];
  for (let i = 30; i < yields.length; i++) {
    const window = yields.slice(i - 30, i);
    const diffs = [];
    for (let j = 1; j < window.length; j++) {
      diffs.push(window[j] - window[j-1]);
    }
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    const variance = diffs.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / diffs.length;
    const stdev = Math.sqrt(variance) * Math.sqrt(252) * 100; // annualized in bps
    vol.push(stdev);
  }
  return vol;
}

// ============== SECTION: YIELD CURVE ==============

async function renderYieldCurve() {
  try {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const start = twoMonthsAgo.toISOString().split('T')[0];

    const { series, errors } = await fetchFred(
      ['DTB3', 'DGS2', 'DGS5', 'DGS10', 'DGS30'],
      { start }
    );

    if (series.length === 0) {
      document.getElementById('yc-note').textContent = 'Yield curve data unavailable.';
      return;
    }

    const dataMap = {};
    series.forEach(s => {
      dataMap[s.id] = s.observations.sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    // Get latest, 3m ago, 12m ago dates
    const latest = new Date();
    const threeMonthsAgo = addMonths(latest, -3);
    const twelveMonthsAgo = addMonths(latest, -12);

    // Tenors: 0.25 (3m), 2, 5, 10, 30
    const tenors = [0.25, 2, 5, 10, 30];
    const seriesIds = ['DTB3', 'DGS2', 'DGS5', 'DGS10', 'DGS30'];

    function findClosestObs(id, targetDate) {
      const obs = dataMap[id] || [];
      if (obs.length === 0) return null;
      let best = obs[0];
      for (const o of obs) {
        const d = new Date(o.date);
        if (d <= targetDate) best = o;
        if (d > targetDate) break;
      }
      return best && best.value ? parseFloat(best.value) : null;
    }

    // Build curve data
    const curveLatest = tenors.map((t, i) => findClosestObs(seriesIds[i], latest)).filter(v => v !== null);
    const curve3m = tenors.map((t, i) => findClosestObs(seriesIds[i], threeMonthsAgo)).filter(v => v !== null);
    const curve12m = tenors.map((t, i) => findClosestObs(seriesIds[i], twelveMonthsAgo)).filter(v => v !== null);

    const ctx = document.getElementById('yc-curve-chart').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: tenors.map(t => t === 0.25 ? '3m' : t + 'y'),
        datasets: [
          {
            label: 'Latest',
            data: curveLatest,
            borderColor: getThemeColor(),
            borderWidth: 2.5,
            backgroundColor: 'transparent',
            pointRadius: 4,
            pointHoverRadius: 5,
            tension: 0.3,
            fill: false
          },
          {
            label: '3m ago',
            data: curve3m,
            borderColor: getThemeColor(),
            borderWidth: 1,
            borderDash: [5, 5],
            backgroundColor: 'transparent',
            pointRadius: 2,
            opacity: 0.5,
            tension: 0.3,
            fill: false
          },
          {
            label: '12m ago',
            data: curve12m,
            borderColor: getThemeColor(),
            borderWidth: 1,
            borderDash: [10, 5],
            backgroundColor: 'transparent',
            pointRadius: 2,
            opacity: 0.3,
            tension: 0.3,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          y: { beginAtZero: false, grid: { color: getGridColor() }, ticks: { color: getThemeColor() } },
          x: { grid: { display: false }, ticks: { color: getThemeColor() } }
        }
      }
    });

    // Spreads table: 2s10s, 3m10y, 5s30s
    const dgs2 = findClosestObs('DGS2', latest);
    const dgs10 = findClosestObs('DGS10', latest);
    const dtb3 = findClosestObs('DTB3', latest);
    const dgs5 = findClosestObs('DGS5', latest);
    const dgs30 = findClosestObs('DGS30', latest);

    const dgs2_1m = findClosestObs('DGS2', addMonths(latest, -1));
    const dgs10_1m = findClosestObs('DGS10', addMonths(latest, -1));
    const dtb3_1m = findClosestObs('DTB3', addMonths(latest, -1));
    const dgs5_1m = findClosestObs('DGS5', addMonths(latest, -1));
    const dgs30_1m = findClosestObs('DGS30', addMonths(latest, -1));

    const spreadsTable = document.getElementById('yc-spreads-table');
    spreadsTable.innerHTML = '';

    // 2s10s spread
    if (dgs2 !== null && dgs10 !== null) {
      const current = (dgs10 - dgs2) * 100;
      const prev = dgs2_1m !== null && dgs10_1m !== null ? (dgs10_1m - dgs2_1m) * 100 : null;
      const delta = prev !== null ? (current - prev).toFixed(1) : 'N/A';
      const row = document.createElement('div');
      row.className = 'yc-spread-row';
      row.innerHTML = `
        <span class="yc-spread-label">2s10s</span>
        <span class="yc-spread-name">2Y–10Y spread</span>
        <span class="yc-spread-val">${current.toFixed(1)} bps</span>
        <span class="yc-spread-pct">${delta} Δ1m</span>
      `;
      spreadsTable.appendChild(row);
    }

    // 3m10y spread
    if (dtb3 !== null && dgs10 !== null) {
      const current = (dgs10 - dtb3) * 100;
      const prev = dtb3_1m !== null && dgs10_1m !== null ? (dgs10_1m - dtb3_1m) * 100 : null;
      const delta = prev !== null ? (current - prev).toFixed(1) : 'N/A';
      const row = document.createElement('div');
      row.className = 'yc-spread-row';
      row.innerHTML = `
        <span class="yc-spread-label">3m10y</span>
        <span class="yc-spread-name">3M–10Y spread</span>
        <span class="yc-spread-val">${current.toFixed(1)} bps</span>
        <span class="yc-spread-pct">${delta} Δ1m</span>
      `;
      spreadsTable.appendChild(row);
    }

    // 5s30s spread
    if (dgs5 !== null && dgs30 !== null) {
      const current = (dgs30 - dgs5) * 100;
      const prev = dgs5_1m !== null && dgs30_1m !== null ? (dgs30_1m - dgs5_1m) * 100 : null;
      const delta = prev !== null ? (current - prev).toFixed(1) : 'N/A';
      const row = document.createElement('div');
      row.className = 'yc-spread-row';
      row.innerHTML = `
        <span class="yc-spread-label">5s30s</span>
        <span class="yc-spread-name">5Y–30Y spread</span>
        <span class="yc-spread-val">${current.toFixed(1)} bps</span>
        <span class="yc-spread-pct">${delta} Δ1m</span>
      `;
      spreadsTable.appendChild(row);
    }

    document.getElementById('yc-note').textContent = 'Curve steepness is a recession predictor. Inversion typically precedes slowdown by 12–24 months.';
  } catch (err) {
    console.error('Yield curve failed:', err);
    document.getElementById('yc-note').textContent = 'Yield curve unavailable.';
  }
}

// ============== SECTION: REAL YIELDS ==============

async function renderRealYields() {
  try {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 10);
    const start = oneYearAgo.toISOString().split('T')[0];

    const { series } = await fetchFred(['DFII5', 'DFII10', 'DFII30'], { start });
    if (series.length === 0) {
      document.getElementById('ry-note').textContent = 'Real yield data unavailable.';
      return;
    }

    const dataMap = {};
    series.forEach(s => {
      dataMap[s.id] = s.observations.map(o => ({ date: o.date, value: parseFloat(o.value) })).filter(o => !isNaN(o.value)).sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    const latest = new Date();

    // Chart: 3 lines for DFII5, DFII10, DFII30
    const ctx = document.getElementById('ry-chart').getContext('2d');
    const tenors = ['DFII5', 'DFII10', 'DFII30'];
    const labels = tenors.map(t => t === 'DFII5' ? '5Y' : t === 'DFII10' ? '10Y' : '30Y');
    const colors = [getThemeColor(), getThemeColor(), getThemeColor()];

    const datasets = tenors.map((tid, idx) => {
      const obs = dataMap[tid] || [];
      return {
        label: labels[idx],
        data: obs.map(o => ({ x: o.date, y: o.value })),
        borderColor: colors[idx],
        borderWidth: 2,
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.2,
        fill: false,
        opacity: 1 - idx * 0.2
      };
    });

    new Chart(ctx, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' }, tooltip: { enabled: true } },
        scales: {
          x: { type: 'time', time: { unit: 'month' }, grid: { display: false }, ticks: { color: getThemeColor() } },
          y: { beginAtZero: false, grid: { color: getGridColor() }, ticks: { color: getThemeColor() } }
        }
      }
    });

    // Table: 5y, 10y, 30y with percentiles
    const ryTable = document.getElementById('ry-table');
    ryTable.innerHTML = '';

    const fetchPercentiles = async (id) => {
      const obs = dataMap[id] || [];
      if (obs.length === 0) return null;
      const values = obs.map(o => o.value);
      const pct10 = percentile(values, 0.1);
      const pct90 = percentile(values, 0.9);
      const latest_val = values[values.length - 1];
      const pct_rank = values.filter(v => v <= latest_val).length / values.length;
      const avg5y = values.slice(-252 * 5).reduce((a, b) => a + b, 0) / Math.min(252 * 5, values.length);
      return { latest: latest_val, pct10, pct90, pct_rank: Math.round(pct_rank * 100), avg5y };
    };

    const ryData = {
      DFII5: await fetchPercentiles('DFII5'),
      DFII10: await fetchPercentiles('DFII10'),
      DFII30: await fetchPercentiles('DFII30')
    };

    Object.entries(ryData).forEach(([id, data]) => {
      if (!data) return;
      const label = id === 'DFII5' ? '5Y' : id === 'DFII10' ? '10Y' : '30Y';
      const cell = document.createElement('div');
      cell.className = 'ry-cell';
      cell.innerHTML = `
        <div class="ry-cell-label">${label} Real</div>
        <div class="ry-cell-val">${data.latest.toFixed(2)}%</div>
        <div class="ry-cell-meta">Pct: ${data.pct_rank}th | Avg5y: ${data.avg5y.toFixed(2)}%</div>
      `;
      ryTable.appendChild(cell);
    });

    const dfii10_latest = ryData.DFII10?.latest || 0;
    const note = dfii10_latest > 2.0 ? 'Real yields > 2% signal restrictive policy. Equity multiples typically compress in this regime.' : 'Current real yields support valuation. Monitor for rapid tightening.';
    document.getElementById('ry-note').textContent = note;
  } catch (err) {
    console.error('Real yields failed:', err);
    document.getElementById('ry-note').textContent = 'Real yield data unavailable.';
  }
}

// ============== SECTION: CREDIT SPREADS ==============

async function renderCreditSpreads() {
  try {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const start = tenYearsAgo.toISOString().split('T')[0];

    const { series } = await fetchFred(['BAMLC0A0CM', 'BAMLH0A0HYM2'], { start });
    if (series.length === 0) {
      document.getElementById('cs-note').textContent = 'Credit spread data unavailable.';
      return;
    }

    const dataMap = {};
    series.forEach(s => {
      dataMap[s.id] = s.observations.map(o => ({ date: o.date, value: parseFloat(o.value) })).filter(o => !isNaN(o.value)).sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    // Chart: IG and HY with recession shading
    const ctx = document.getElementById('cs-chart').getContext('2d');
    const igData = dataMap['BAMLC0A0CM'] || [];
    const hyData = dataMap['BAMLH0A0HYM2'] || [];

    const datasets = [
      {
        label: 'IG OAS',
        data: igData.map(o => ({ x: o.date, y: o.value })),
        borderColor: getThemeColor(),
        borderWidth: 2,
        backgroundColor: 'transparent',
        pointRadius: 0,
        yAxisID: 'y',
        tension: 0.1
      },
      {
        label: 'HY OAS',
        data: hyData.map(o => ({ x: o.date, y: o.value })),
        borderColor: getThemeColor(),
        borderWidth: 2,
        backgroundColor: 'transparent',
        pointRadius: 0,
        yAxisID: 'y1',
        tension: 0.1,
        opacity: 0.7
      }
    ];

    new Chart(ctx, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' }, tooltip: { enabled: true } },
        scales: {
          x: { type: 'time', time: { unit: 'month' }, grid: { display: false }, ticks: { color: getThemeColor() } },
          y: { beginAtZero: false, position: 'left', grid: { color: getGridColor() }, ticks: { color: getThemeColor() }, title: { display: true, text: 'IG OAS (bps)' } },
          y1: { beginAtZero: false, position: 'right', grid: { display: false }, ticks: { color: getThemeColor() }, title: { display: true, text: 'HY OAS (bps)' } }
        }
      }
    });

    // Regime classifier on HY OAS
    const hyLatest = hyData.length > 0 ? hyData[hyData.length - 1].value : null;
    const regimeEl = document.getElementById('cs-regime');
    if (hyLatest !== null) {
      let regimeClass = 'cs-regime-neutral';
      let regimeText = 'NEUTRAL';
      if (hyLatest < 350) {
        regimeClass = 'cs-regime-tight';
        regimeText = 'TIGHT — risk-on, complacency';
      } else if (hyLatest >= 500 && hyLatest < 700) {
        regimeClass = 'cs-regime-stressed';
        regimeText = 'STRESSED — risk-off building';
      } else if (hyLatest >= 700) {
        regimeClass = 'cs-regime-panic';
        regimeText = 'PANIC — recession likely';
      }
      regimeEl.className = `cs-regime ${regimeClass}`;
      regimeEl.textContent = regimeText;
    }

    document.getElementById('cs-note').textContent = 'Tight spreads + positive correlation = late-cycle warning. Tight spreads + negative correlation = capital-preservation opportunity.';
  } catch (err) {
    console.error('Credit spreads failed:', err);
    document.getElementById('cs-note').textContent = 'Credit spread data unavailable.';
  }
}

// ============== SECTION: CROSS-ASSET VOL ==============

async function renderCrossAssetVol() {
  try {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const start = fiveYearsAgo.toISOString().split('T')[0];

    const { series } = await fetchFred(['VIXCLS', 'DGS10'], { start });
    if (series.length === 0) {
      document.getElementById('cav-note').textContent = 'Cross-asset vol data unavailable.';
      return;
    }

    const dataMap = {};
    series.forEach(s => {
      dataMap[s.id] = s.observations.map(o => ({ date: o.date, value: parseFloat(o.value) })).filter(o => !isNaN(o.value)).sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    const vixData = dataMap['VIXCLS'] || [];
    const dgs10Data = dataMap['DGS10'] || [];

    // Compute realized yield vol
    const yieldVol = rollingYieldVol(
      dgs10Data.map(o => o.date),
      dgs10Data.map(o => o.value)
    );

    // Align dates for dual-axis chart
    const vixAligned = vixData.slice(30); // Start after 30-day window
    const yieldVolForChart = yieldVol.slice(0, vixAligned.length);

    const ctx = document.getElementById('cav-chart').getContext('2d');
    new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'VIX',
            data: vixAligned.map((o, i) => ({ x: o.date, y: o.value })),
            borderColor: getThemeColor(),
            borderWidth: 2,
            backgroundColor: 'transparent',
            pointRadius: 0,
            yAxisID: 'y',
            tension: 0.1
          },
          {
            label: '10Y Yield Vol (bps)',
            data: yieldVolForChart.map((v, i) => ({ x: vixAligned[i].date, y: v })),
            borderColor: getThemeColor(),
            borderWidth: 2,
            backgroundColor: 'transparent',
            pointRadius: 0,
            yAxisID: 'y1',
            tension: 0.1,
            opacity: 0.6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' }, tooltip: { enabled: true } },
        scales: {
          x: { type: 'time', time: { unit: 'month' }, grid: { display: false }, ticks: { color: getThemeColor() } },
          y: { beginAtZero: false, position: 'left', grid: { color: getGridColor() }, ticks: { color: getThemeColor() }, title: { display: true, text: 'VIX' } },
          y1: { beginAtZero: false, position: 'right', grid: { display: false }, ticks: { color: getThemeColor() }, title: { display: true, text: 'Yield Vol (bps)' } }
        }
      }
    });

    // Ratio
    const ratioEl = document.getElementById('cav-ratio');
    if (yieldVolForChart.length > 0 && vixAligned.length > 0) {
      const vixMean = vixAligned.reduce((a, o) => a + o.value, 0) / vixAligned.length;
      const yieldVolMean = yieldVolForChart.reduce((a, v) => a + v, 0) / yieldVolForChart.length;
      const yieldVolLatest = yieldVolForChart[yieldVolForChart.length - 1];
      const vixLatest = vixAligned[vixAligned.length - 1].value;
      const ratioLatest = yieldVolLatest > 0 ? (yieldVolLatest / vixLatest).toFixed(2) : 'N/A';
      const ratioMean = yieldVolMean / vixMean;
      const ratioNorm = ratioLatest !== 'N/A' ? (ratioLatest / ratioMean).toFixed(2) : 'N/A';
      ratioEl.innerHTML = `Yield vol / VIX ratio: <strong>${ratioLatest}</strong> (normalized: <strong>${ratioNorm}</strong>). Ratio > 1.0 = risk concentrated in rates, not equities.`;
    }

    document.getElementById('cav-note').textContent = 'Realized 10Y yield vol is a proxy for MOVE index (not on FRED). When yield vol > VIX, duration risk dominates. Watch for de-coupling as liquidity shock signal.';
  } catch (err) {
    console.error('Cross-asset vol failed:', err);
    document.getElementById('cav-note').textContent = 'Cross-asset vol data unavailable.';
  }
}

// ============== SECTION: BREAKEVEN INFLATION ==============

async function renderBreaekevenInflation() {
  try {
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const start = tenYearsAgo.toISOString().split('T')[0];

    const { series } = await fetchFred(['T5YIE', 'T10YIE', 'T5YIFR', 'MICH'], { start });
    if (series.length === 0) {
      document.getElementById('bei-note').textContent = 'Inflation expectation data unavailable.';
      return;
    }

    const dataMap = {};
    series.forEach(s => {
      dataMap[s.id] = s.observations.map(o => ({ date: o.date, value: parseFloat(o.value) })).filter(o => !isNaN(o.value)).sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    // Chart: T5YIE, T10YIE, T5YIFR as lines + MICH as dashed
    const ctx = document.getElementById('bei-chart').getContext('2d');
    const datasets = [
      {
        label: '5Y Breakeven',
        data: (dataMap['T5YIE'] || []).map(o => ({ x: o.date, y: o.value })),
        borderColor: getThemeColor(),
        borderWidth: 2,
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.1
      },
      {
        label: '10Y Breakeven',
        data: (dataMap['T10YIE'] || []).map(o => ({ x: o.date, y: o.value })),
        borderColor: getThemeColor(),
        borderWidth: 2,
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.1,
        opacity: 0.8
      },
      {
        label: '5Y5Y Forward',
        data: (dataMap['T5YIFR'] || []).map(o => ({ x: o.date, y: o.value })),
        borderColor: getThemeColor(),
        borderWidth: 2,
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.1,
        opacity: 0.6
      },
      {
        label: 'UMich 1Y (monthly)',
        data: (dataMap['MICH'] || []).map(o => ({ x: o.date, y: o.value })),
        borderColor: getThemeColor(),
        borderWidth: 2,
        borderDash: [5, 5],
        backgroundColor: 'transparent',
        pointRadius: 0,
        tension: 0.1,
        opacity: 0.5
      }
    ];

    new Chart(ctx, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: 'top' }, tooltip: { enabled: true } },
        scales: {
          x: { type: 'time', time: { unit: 'month' }, grid: { display: false }, ticks: { color: getThemeColor() } },
          y: { beginAtZero: false, grid: { color: getGridColor() }, ticks: { color: getThemeColor() } }
        }
      }
    });

    // Table: 5y, 10y, 5y5y, UMich with current, 12m delta, percentile
    const beiTable = document.getElementById('bei-table');
    beiTable.innerHTML = '';

    const fetchBeiStats = async (id) => {
      const obs = dataMap[id] || [];
      if (obs.length === 0) return null;
      const latest = obs[obs.length - 1].value;
      const oneYearAgo = new Date(obs[obs.length - 1].date);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const prev = obs.reverse().find(o => new Date(o.date) <= oneYearAgo);
      const delta12m = prev ? (latest - prev.value).toFixed(2) : 'N/A';
      const values = dataMap[id].map(o => o.value);
      const pct = percentile(values, 0.5);
      const pctRank = values.filter(v => v <= latest).length / values.length;
      return { latest, delta12m, pctRank: Math.round(pctRank * 100) };
    };

    const beiLabels = { T5YIE: '5Y', T10YIE: '10Y', T5YIFR: '5Y5Y', MICH: 'UMich 1Y' };
    const beiIds = ['T5YIE', 'T10YIE', 'T5YIFR', 'MICH'];

    for (const id of beiIds) {
      const data = await fetchBeiStats(id);
      if (!data) continue;
      const cell = document.createElement('div');
      cell.className = 'bei-cell';
      cell.innerHTML = `
        <div class="bei-cell-label">${beiLabels[id]}</div>
        <div class="bei-cell-val">${data.latest.toFixed(2)}%</div>
        <div class="bei-cell-meta">+${data.delta12m}% Δ1y | Pct: ${data.pctRank}th</div>
      `;
      beiTable.appendChild(cell);
    }

    const t5yifr = dataMap['T5YIFR'] && dataMap['T5YIFR'].length > 0 ? dataMap['T5YIFR'][dataMap['T5YIFR'].length - 1].value : null;
    let note = 'Forward expectations anchored near Fed target (2%). ';
    if (t5yifr > 2.5) {
      note += 'Current 5Y5Y > 2.5% signals persistent above-target inflation beliefs.';
    } else if (t5yifr < 2.0) {
      note += 'Current 5Y5Y < 2% signals disinflationary concerns.';
    } else {
      note += 'Expectations near equilibrium.';
    }
    document.getElementById('bei-note').textContent = note;
  } catch (err) {
    console.error('Breakeven inflation failed:', err);
    document.getElementById('bei-note').textContent = 'Inflation expectation data unavailable.';
  }
}

// ============== INITIALIZATION ==============

async function init() {
  document.getElementById('refresh-text').textContent = 'Loading data...';

  await Promise.all([
    renderStockBondCorrelation('sbc-chart').catch(err => console.warn('SBC failed:', err)),
    renderYieldCurve(),
    renderRealYields(),
    renderCreditSpreads(),
    renderCrossAssetVol(),
    renderBreaekevenInflation()
  ]);

  document.getElementById('refresh-text').textContent = 'Updated ' + new Date().toLocaleTimeString();
  document.getElementById('last-updated').textContent = 'Last updated ' + new Date().toLocaleString();
}

init();

// Re-render on theme change
document.addEventListener('themechange', () => {
  init();
});
