// /core/ai/compute/compute.js
// Compute & semis pillar page: charts + sparkline grid with live data fetches

import { renderSparklineGrid } from '../lib/sparkline-grid.js';

// Basket definitions (symbols for sparkline grid)
const BASKET_TICKERS = [
  { sym: 'NVDA', name: 'NVIDIA', ytd: 82, trend: 'up' },
  { sym: 'AMD', name: 'AMD', ytd: 42, trend: 'up' },
  { sym: 'AVGO', name: 'Broadcom', ytd: 28, trend: 'up' },
  { sym: 'TSM', name: 'TSMC', ytd: 15, trend: 'up' },
  { sym: 'ASML', name: 'ASML', ytd: -8, trend: 'down' },
  { sym: 'MU', name: 'Micron', ytd: 35, trend: 'up' },
  { sym: 'ARM', name: 'Arm Holdings', ytd: 72, trend: 'up' },
  { sym: 'MRVL', name: 'Marvell', ytd: 38, trend: 'up' }
];

const HYPERSCALER_SYMBOLS = ['MSFT', 'GOOGL', 'META', 'AMZN', 'ORCL'];
const COMPUTE_BASKET_SYMBOLS = ['NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'MU'];

// Book-to-bill ratios (v2 placeholder — manually updated from filings)
const BOOK_TO_BILL = [
  { name: 'NVDA', value: 1.42 },
  { name: 'AMD', value: 1.18 },
  { name: 'AVGO', value: 1.31 },
  { name: 'TSM', value: 1.09 },
  { name: 'ASML', value: 0.96 },
  { name: 'MU', value: 1.22 }
];

// Fallback hardcoded data (Q4'23-Q3'25) — used if live fetch fails
const FALLBACK_DATA = {
  quarters: ["Q4'23", "Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", "Q3'25"],
  basketRevYoY: [22, 28, 35, 42, 48, 50, 48, 47],
  hyperscalerCapexLTM: [180, 215, 248, 285, 315, 340, 365, 390]
};

// NVDA DC revenue share (v2 placeholder — segment data from 10-Q, manual update)
const NVDA_DC_SHARE = {
  quarters: ["Q4'23", "Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", "Q3'25"],
  dcShare: [60, 65, 72, 78, 82, 85, 86, 88],
  other: [40, 35, 28, 22, 18, 15, 14, 12]
};

/**
 * Fetch quarterly revenue for compute basket via Finnhub.
 * Returns { quarters, symbols, data: { NVDA: [q1, q2, ...], ... } }
 * Falls back to null on error.
 */
async function fetchComputeBasketRevenue() {
  try {
    const symbols = COMPUTE_BASKET_SYMBOLS.join(',');
    const url = `/api/stocks?mode=financials&symbols=${symbols}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    
    // Aggregate by company
    const data = {};
    for (const fin of json.financials) {
      const reports = fin.reports || [];
      // Sort by year + quarter to get chronological order
      const sorted = reports
        .filter(r => r.revenue != null)
        .sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter - b.quarter);
      data[fin.symbol] = sorted.map(r => r.revenue);
    }
    
    // Compute YoY for basket (sum of all symbols' revenue per quarter)
    // This is simplified: we'd ideally align quarters across all companies
    // For now, use the hardcoded fallback if any symbol is missing
    for (const sym of COMPUTE_BASKET_SYMBOLS) {
      if (!data[sym] || data[sym].length < 4) {
        console.warn(`Incomplete data for ${sym}, falling back to hardcoded`);
        return null;
      }
    }
    
    return data;
  } catch (err) {
    console.warn('Failed to fetch compute basket revenue:', err);
    return null;
  }
}

/**
 * Fetch quarterly capex for hyperscalers via EDGAR.
 * Returns { quarters, symbols, data: { MSFT: [q1, q2, ...], ... } }
 * Falls back to null on error.
 */
async function fetchHyperscalerCapex() {
  try {
    // EDGAR API: /api/edgar?company=MSFT&concepts=PaymentsToAcquirePropertyPlantAndEquipment
    // We need to call for each company and extract quarterly capex
    const data = {};
    
    for (const company of HYPERSCALER_SYMBOLS) {
      const url = `/api/edgar?company=${company}&concepts=PaymentsToAcquirePropertyPlantAndEquipment`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`EDGAR ${company} ${res.status}`);
      const json = await res.json();
      
      const series = json.series && json.series.length > 0 ? json.series[0] : null;
      if (!series) {
        console.warn(`No EDGAR data for ${company}`);
        return null;
      }
      
      // Filter to 10-Q (quarterly) observations, sort chronologically
      const quarterly = (series.observations || [])
        .filter(o => o.form === '10-Q')
        .sort((a, b) => new Date(a.end) - new Date(b.end))
        .slice(-8); // Last 8 quarters
      
      data[company] = quarterly.map(o => o.val / 1e9); // Convert to billions
    }
    
    // Verify we have enough quarters for all companies
    for (const sym of HYPERSCALER_SYMBOLS) {
      if (!data[sym] || data[sym].length < 4) {
        console.warn(`Incomplete EDGAR data for ${sym}`);
        return null;
      }
    }
    
    return data;
  } catch (err) {
    console.warn('Failed to fetch hyperscaler capex:', err);
    return null;
  }
}

/**
 * Compute basket revenue YoY % from quarterly revenue data.
 */
function computeBasketRevYoY(data) {
  if (!data) return null;
  
  const symbols = Object.keys(data);
  const lengths = symbols.map(s => data[s].length);
  const minLength = Math.min(...lengths);
  
  if (minLength < 5) return null; // Need at least 5 quarters for 4-quarter YoY
  
  const yoyPcts = [];
  for (let i = 4; i < minLength; i++) {
    const qSum = symbols.reduce((s, sym) => s + data[sym][i], 0);
    const qPrevSum = symbols.reduce((s, sym) => s + data[sym][i - 4], 0);
    const yoy = qPrevSum > 0 ? ((qSum / qPrevSum) - 1) * 100 : 0;
    yoyPcts.push(yoy);
  }
  
  return yoyPcts;
}

/**
 * Compute hyperscaler capex LTM (trailing 4 quarters sum) per company, then aggregate.
 */
function computeCapexLTM(data) {
  if (!data) return null;
  
  const companies = Object.keys(data);
  const lengths = companies.map(c => data[c].length);
  const minLength = Math.min(...lengths);
  
  if (minLength < 4) return null; // Need at least 4 quarters for LTM
  
  const ltms = [];
  for (let i = 3; i < minLength; i++) {
    const ltm = companies.reduce((s, co) => {
      const qSum = data[co].slice(i - 3, i + 1).reduce((a, b) => a + b, 0);
      return s + qSum;
    }, 0);
    ltms.push(ltm);
  }
  
  return ltms;
}

async function renderAnchorChart() {
  const ctx = document.getElementById('anchor-chart');
  if (!ctx) return;
  
  // Fetch live data
  const basketRevData = await fetchComputeBasketRevenue();
  const capexData = await fetchHyperscalerCapex();
  
  let basketRevYoY = FALLBACK_DATA.basketRevYoY;
  let capexLTM = FALLBACK_DATA.hyperscalerCapexLTM;
  let quarters = FALLBACK_DATA.quarters;
  
  if (basketRevData && capexData) {
    const yoy = computeBasketRevYoY(basketRevData);
    const ltm = computeCapexLTM(capexData);
    
    if (yoy && ltm && yoy.length === ltm.length && yoy.length > 0) {
      basketRevYoY = yoy;
      capexLTM = ltm;
    }
  }
  
  const ctxEl = ctx.getContext('2d');
  
  new Chart(ctxEl, {
    type: 'line',
    data: {
      labels: quarters,
      datasets: [
        {
          label: 'Basket revenue YoY (%)',
          data: basketRevYoY,
          borderColor: 'var(--accent)',
          backgroundColor: 'rgba(var(--accent-rgb), 0.1)',
          yAxisID: 'y',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: 'var(--accent)'
        },
        {
          label: 'Hyperscaler capex LTM ($B)',
          data: capexLTM,
          borderColor: 'var(--muted)',
          backgroundColor: 'transparent',
          yAxisID: 'y1',
          borderWidth: 1.5,
          borderDash: [4, 2],
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: 'var(--muted)'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 12 }, padding: 16, boxWidth: 3 }
        }
      },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          title: { display: true, text: 'Revenue YoY %' },
          min: 0,
          max: 100
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Capex ($B)' },
          min: 100,
          max: 450,
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function renderBookToBillChart() {
  const ctx = document.getElementById('support-1-chart');
  if (!ctx) return;
  
  // v2 placeholder: manually curated book-to-bill ratios from company filings
  const colors = BOOK_TO_BILL.map(d => d.value >= 1.0 ? '#2ecc71' : '#e74c3c');
  
  new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: BOOK_TO_BILL.map(d => d.name),
      datasets: [{
        label: 'Book-to-bill',
        data: BOOK_TO_BILL.map(d => d.value),
        backgroundColor: colors,
        borderColor: 'transparent',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'x',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.raw;
              const suffix = v >= 1.0 ? ' (backlog growing)' : ' (backlog shrinking)';
              return v.toFixed(2) + suffix;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 1.6,
          ticks: { stepSize: 0.2 }
        }
      }
    }
  });
}

function renderDCShareChart() {
  const ctx = document.getElementById('support-2-chart');
  if (!ctx) return;
  
  // v2 placeholder: NVDA DC revenue % from latest 10-Q, manually tracked
  new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: NVDA_DC_SHARE.quarters,
      datasets: [
        {
          label: 'DC revenue %',
          data: NVDA_DC_SHARE.dcShare,
          backgroundColor: 'var(--accent)',
          borderColor: 'transparent',
          borderRadius: 4,
          stack: 'Group 1'
        },
        {
          label: 'Other revenue %',
          data: NVDA_DC_SHARE.other,
          backgroundColor: 'var(--line)',
          borderColor: 'transparent',
          borderRadius: 4,
          stack: 'Group 1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 12 }, padding: 16 }
        }
      },
      scales: {
        y: {
          stacked: true,
          beginAtZero: true,
          max: 100,
          ticks: { callback: (v) => v + '%' }
        }
      }
    }
  });
}

function renderBasketGrid() {
  renderSparklineGrid({
    tickers: BASKET_TICKERS,
    targetEl: document.getElementById('basket-grid')
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  renderBasketGrid();
  await renderAnchorChart();
  renderBookToBillChart();
  renderDCShareChart();
});
