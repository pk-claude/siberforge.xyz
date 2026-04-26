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

// Book-to-bill ratios (v3: externalized to JSON for easier updates)
let BOOK_TO_BILL = [
  { name: 'NVDA', value: 1.42 },
  { name: 'AMD', value: 1.18 },
  { name: 'AVGO', value: 1.31 },
  { name: 'TSM', value: 1.09 },
  { name: 'ASML', value: 0.96 },
  { name: 'MU', value: 1.22 }
];
let BTB_UPDATED = null;

// Fallback hardcoded data (Q4'23-Q3'25) — used if live fetch fails
const FALLBACK_DATA = {
  quarters: ["Q4'23", "Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", "Q3'25"],
  basketRevYoY: [22, 28, 35, 42, 48, 50, 48, 47],
  hyperscalerCapexLTM: [180, 215, 248, 285, 315, 340, 365, 390]
};

// NVDA DC revenue share (v3: externalized to JSON)
let NVDA_DC_SHARE = {
  quarters: ["Q4'23", "Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", "Q3'25"],
  dcShare: [60, 65, 72, 78, 82, 85, 86, 88],
  other: [40, 35, 28, 22, 18, 15, 14, 12]
};
let NVDA_UPDATED = null;

/**
 * Fetch quarterly revenue for compute basket via Finnhub.
 * Finnhub financials-reported is Premium-tier; revenue stays hardcoded until paid or migrated.
 */
async function fetchComputeBasketRevenue() {
  return null;
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
  const root = getComputedStyle(document.documentElement);
  const ACCENT = root.getPropertyValue('--accent').trim() || '#f7a700';
  const MUTED  = root.getPropertyValue('--muted').trim() || '#888';

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
          borderColor: ACCENT,
          backgroundColor: 'rgba(247, 167, 0, 0.1)',
          yAxisID: 'y',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: ACCENT
        },
        {
          label: 'Hyperscaler capex LTM ($B)',
          data: capexLTM,
          borderColor: MUTED,
          backgroundColor: 'transparent',
          yAxisID: 'y1',
          borderWidth: 1.5,
          borderDash: [4, 2],
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: MUTED
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
  
  // Display updated date below chart if available
  if (BTB_UPDATED) {
    const updatedEl = document.createElement('p');
    updatedEl.style.cssText = 'font-size: 0.85rem; color: var(--muted); margin-top: 8px; text-align: center;';
    updatedEl.textContent = `Last updated: ${BTB_UPDATED}`;
    ctx.parentElement.parentElement.appendChild(updatedEl);
  }
  
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
  const root = getComputedStyle(document.documentElement);
  const ACCENT = root.getPropertyValue('--accent').trim() || '#f7a700';
  const LINE   = root.getPropertyValue('--line').trim() || '#444';

  const ctx = document.getElementById('support-2-chart');
  if (!ctx) return;
  
  // Display updated date below chart if available
  if (NVDA_UPDATED) {
    const updatedEl = document.createElement('p');
    updatedEl.style.cssText = 'font-size: 0.85rem; color: var(--muted); margin-top: 8px; text-align: center;';
    updatedEl.textContent = `Last updated: ${NVDA_UPDATED}`;
    ctx.parentElement.parentElement.appendChild(updatedEl);
  }
  
  new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: NVDA_DC_SHARE.quarters,
      datasets: [
        {
          label: 'DC revenue %',
          data: NVDA_DC_SHARE.dcShare,
          backgroundColor: ACCENT,
          borderColor: 'transparent',
          borderRadius: 4,
          stack: 'Group 1'
        },
        {
          label: 'Other revenue %',
          data: NVDA_DC_SHARE.other,
          backgroundColor: LINE,
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


/**
 * Build dynamic takeaway block for compute pillar.
 * Interpolates live data into four-row structure.
 */

/**
 * Fetch book-to-bill ratios from /core/ai/data/book-to-bill.json (manually-updated).
 * Transforms {symbol, ratio} -> {name, value} to match render shape.
 * Falls back to hardcoded BOOK_TO_BILL on failure.
 */
async function fetchBookToBillData() {
  try {
    const res = await fetch('/core/ai/data/book-to-bill.json');
    if (!res.ok) return;
    const json = await res.json();
    if (Array.isArray(json.data)) {
      BOOK_TO_BILL = json.data.map(d => ({ name: d.symbol, value: d.ratio }));
      BTB_UPDATED = json.updated || null;
    }
  } catch (err) {
    console.warn('book-to-bill fetch failed; using fallback', err);
  }
}

/**
 * Fetch NVDA segment shares from /core/ai/data/nvda-segments.json.
 * Transforms [{quarter, dc_share, other_share}] -> {quarters, dcShare, other}.
 * Falls back to hardcoded NVDA_DC_SHARE on failure.
 */
async function fetchNVDASegmentData() {
  try {
    const res = await fetch('/core/ai/data/nvda-segments.json');
    if (!res.ok) return;
    const json = await res.json();
    if (Array.isArray(json.data) && json.data.length > 0) {
      NVDA_DC_SHARE = {
        quarters: json.data.map(d => d.quarter),
        dcShare:  json.data.map(d => d.dc_share),
        other:    json.data.map(d => d.other_share)
      };
      NVDA_UPDATED = json.updated || null;
    }
  } catch (err) {
    console.warn('nvda-segments fetch failed; using fallback', err);
  }
}

function buildTakeaway(liveData) {
  // Extract live values or fall back to hardcoded
  const basketYoY = liveData?.basketYoY ?? 47;
  const latestQ = liveData?.latestQ ?? "Q3'25";
  
  // Count consecutive quarters above +30% threshold
  const yoyHistory = liveData?.yoyHistory ?? [22, 28, 35, 42, 48, 50, 48, 47];
  let streakCount = 0;
  for (let i = yoyHistory.length - 1; i >= 0; i--) {
    if (yoyHistory[i] >= 30) streakCount++;
    else break;
  }
  
  let streakLanguage = '';
  if (streakCount >= 4) {
    streakLanguage = 'fourth consecutive quarter above +30%';
  } else if (streakCount === 3) {
    streakLanguage = 'third consecutive quarter above +30%';
  } else if (streakCount === 2) {
    streakLanguage = 'second consecutive quarter above +30%';
  } else if (streakCount === 1) {
    streakLanguage = 'above the +30% threshold for the first time in several quarters';
  } else {
    streakLanguage = 'below the +30% threshold this quarter — first deceleration since 2024';
  }
  
  // Build action line based on threshold
  let actionText = '';
  if (basketYoY > 40) {
    actionText = 'Stay overweight NVDA, AVGO, TSM. Watch ASML lithography orders for 2026 capacity signal. Trim if NVDA data-center growth prints below +25% YoY for two quarters.';
  } else if (basketYoY >= 25) {
    actionText = 'Maintain position with bias to overweight NVDA, AVGO. Capex cycle decelerating but still expansionary. Watch quarterly capex guides for confirmation.';
  } else {
    actionText = 'Reduce conviction. Capex cycle is materially slowing — favor higher-quality balance sheets (AVGO, TSM) over higher-beta names (AMD, ARM). Re-evaluate if YoY recovers above +30%.';
  }
  
  return `
    <div class="ai-takeaway-row"><span class="ai-takeaway-label">Where it stands</span><span class="ai-takeaway-text">AI compute revenue across the basket grew approximately +${basketYoY}% YoY in ${latestQ}, ${streakLanguage}. Book-to-bill stays above 1.0 across NVDA, AMD, AVGO.</span></div>
    <div class="ai-takeaway-row"><span class="ai-takeaway-label">What it means</span><span class="ai-takeaway-text">Capex cycle still feeding through. NVDA data-center revenue is the cleanest read; AVGO custom-silicon ramp is the second derivative.</span></div>
    <div class="ai-takeaway-row"><span class="ai-takeaway-label">Why it matters</span><span class="ai-takeaway-text">Largest single-purpose capex print in history is flowing through these names. Slowing here is the first leading signal that hyperscaler capex is decelerating.</span></div>
    <div class="ai-takeaway-row ai-takeaway-row-action"><span class="ai-takeaway-label">Action</span><span class="ai-takeaway-text">${actionText}</span></div>
  `;
}

window.addEventListener('DOMContentLoaded', async () => {
  renderBasketGrid();
  
  // Fetch externalized JSON data
  await Promise.all([fetchBookToBillData(), fetchNVDASegmentData()]);
  
  // Fetch live data for takeaway
  const basketRevData = await fetchComputeBasketRevenue();
  let liveData = null;
  if (basketRevData) {
    const yoy = computeBasketRevYoY(basketRevData);
    if (yoy && yoy.length > 0) {
      liveData = {
        basketYoY: Math.round(yoy[yoy.length - 1]),
        latestQ: FALLBACK_DATA.quarters[FALLBACK_DATA.quarters.length - 1],
        yoyHistory: yoy
      };
    }
  }
  
  // Inject dynamic takeaway
  const takeawayEl = document.querySelector('.ai-takeaway');
  if (takeawayEl) {
    takeawayEl.innerHTML = buildTakeaway(liveData);
  }
  
  await renderAnchorChart();
  renderBookToBillChart();
  renderDCShareChart();
});
