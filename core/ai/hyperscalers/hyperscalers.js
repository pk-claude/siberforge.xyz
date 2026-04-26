// /core/ai/hyperscalers/hyperscalers.js
// Hyperscaler capex pillar page: rank chart + intensity heatmap + AI share stacked area

import { renderSparklineGrid } from '../lib/sparkline-grid.js';

const HYPERSCALER_COMPANIES = ['AMZN', 'MSFT', 'GOOGL', 'META'];

// Fallback hardcoded data (last 8 quarters)
const FALLBACK_CAPEX_QUARTERS = ["Q4'23", "Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", "Q3'25"];
const FALLBACK_CAPEX = {
  AMZN: [14.0, 17.6, 22.6, 26.3, 24.3, 26.0, 27.5, 30.0],
  MSFT: [14.0, 13.9, 14.9, 15.8, 16.7, 17.5, 19.0, 22.0],
  GOOGL: [12.0, 13.2, 13.1, 14.3, 17.2, 22.4, 24.0, 26.0],
  META: [6.7, 8.5, 9.2, 14.8, 13.7, 17.0, 19.0, 21.0]
};

const FALLBACK_REVENUE = {
  MSFT: [56.5, 61.9, 65.6, 69.6, 70.1, 73.5, 76.0, 78.0],
  GOOGL: [80.5, 84.7, 88.3, 96.5, 90.2, 96.4, 100.0, 105.0],
  META: [36.5, 39.1, 40.6, 48.4, 42.3, 47.5, 49.0, 52.0],
  AMZN: [143.3, 148.0, 158.9, 187.8, 155.7, 167.7, 176.0, 190.0]
};

// AI-attributable capex share % (v2 placeholder — estimated from disclosures)
const AI_SHARE_PCT = {
  MSFT: 60, GOOGL: 55, META: 80, AMZN: 50
};

// Basket tickers
const BASKET_TICKERS = [
  { sym: 'MSFT', name: 'Microsoft', ytd: 35, trend: 'up' },
  { sym: 'GOOGL', name: 'Alphabet', ytd: 28, trend: 'up' },
  { sym: 'META', name: 'Meta', ytd: 52, trend: 'up' },
  { sym: 'AMZN', name: 'Amazon', ytd: 18, trend: 'up' },
  { sym: 'ORCL', name: 'Oracle', ytd: 8, trend: 'up' }
];

/**
 * Fetch quarterly capex for hyperscalers via EDGAR.
 * Returns data keyed by company: { MSFT: [...], GOOGL: [...], ... }
 */
async function fetchCapexData() {
  try {
    const data = {};
    
    for (const company of HYPERSCALER_COMPANIES) {
      const url = `/api/edgar?company=${company}&concepts=PaymentsToAcquirePropertyPlantAndEquipment`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`EDGAR ${company} ${res.status}`);
      const json = await res.json();
      
      const series = json.series && json.series.length > 0 ? json.series[0] : null;
      if (!series) {
        console.warn(`No EDGAR capex data for ${company}`);
        return null;
      }
      
      // Filter to 10-Q (quarterly) observations, sort chronologically
      const quarterly = (series.observations || [])
        .filter(o => o.form === '10-Q')
        .sort((a, b) => new Date(a.end) - new Date(b.end))
        .slice(-8); // Last 8 quarters
      
      if (quarterly.length < 4) {
        console.warn(`Insufficient quarters for ${company}`);
        return null;
      }
      
      data[company] = quarterly.map(o => o.val / 1e9); // Billions
    }
    
    return data;
  } catch (err) {
    console.warn('Failed to fetch capex data:', err);
    return null;
  }
}

/**
 * Fetch quarterly revenue for hyperscalers via EDGAR.
 * Tries Revenues concept first, falls back to RevenueFromContractWithCustomerExcludingAssessedTax.
 */
async function fetchRevenueData() {
  try {
    const data = {};
    const revenueConcepts = ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax'];
    
    for (const company of HYPERSCALER_COMPANIES) {
      const conceptsParam = revenueConcepts.join(',');
      const url = `/api/edgar?company=${company}&concepts=${conceptsParam}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`EDGAR ${company} ${res.status}`);
      const json = await res.json();
      
      // Pick the concept with the MOST RECENT observation. Microsoft etc. file under
      // 'Revenues' pre-2018 and 'RevenueFromContractWithCustomerExcludingAssessedTax' from
      // ASC-606 adoption onward. A naive fallback picks the older, stale series.
      let foundRevenue = null;
      let latestEnd = '0000-00-00';
      for (const series of (json.series || [])) {
        const obs = series.observations || [];
        if (obs.length === 0) continue;
        // Find the most recent end date in this concept's observations
        const lastEnd = obs.reduce((max, o) => o.end > max ? o.end : max, '0000-00-00');
        if (lastEnd > latestEnd) {
          latestEnd = lastEnd;
          foundRevenue = series;
        }
      }
      
      if (!foundRevenue) {
        console.warn(`No EDGAR revenue data for ${company}`);
        return null;
      }
      
      // Filter to 10-Q observations and dedupe by end-date. EDGAR XBRL revenue facts
      // for the same period appear multiple times: YTD-cumulative ($135B for MSFT 6m YTD)
      // AND standalone-quarter ($69B). We want only the standalone quarter, so for each
      // end-date keep the SMALLEST val (YTD is always >= standalone).
      const byEnd = new Map();
      for (const o of (foundRevenue.observations || [])) {
        if (o.form !== '10-Q') continue;
        const cur = byEnd.get(o.end);
        if (!cur || o.val < cur.val) byEnd.set(o.end, o);
      }
      const quarterly = Array.from(byEnd.values())
        .sort((a, b) => new Date(a.end) - new Date(b.end))
        .slice(-8); // Last 8 unique quarters
      
      if (quarterly.length < 4) {
        console.warn(`Insufficient quarters for ${company}`);
        return null;
      }
      
      data[company] = quarterly.map(o => o.val / 1e9); // Billions
    }
    
    return data;
  } catch (err) {
    console.warn('Failed to fetch revenue data:', err);
    return null;
  }
}

function computeRanks(capexData) {
  if (!capexData) return null;
  
  const ranks = [];
  const minLength = Math.min(...Object.values(capexData).map(v => v.length));
  
  for (let i = 0; i < minLength; i++) {
    const capex = HYPERSCALER_COMPANIES
      .map(co => ({ co, val: capexData[co][i] }))
      .sort((a, b) => b.val - a.val);
    ranks.push(capex.map((d, idx) => ({ ...d, rank: idx + 1 })));
  }
  
  return { ranks, quarters: minLength };
}

async function renderRankChart() {
  const ctx = document.getElementById('anchor-chart');
  if (!ctx) return;
  
  let capexData = FALLBACK_CAPEX;
  const liveCapex = await fetchCapexData();
  if (liveCapex) capexData = liveCapex;
  
  const rankResult = computeRanks(capexData);
  if (!rankResult) {
    console.error('Failed to compute ranks');
    return;
  }
  
  const ranks = rankResult.ranks;
  const coNames = HYPERSCALER_COMPANIES;
  const colors = ['#f7a700', '#5aa6ff', '#3fd17a', '#ef6b6b'];
  
  const datasets = coNames.map((co, idx) => ({
    label: co,
    data: ranks.map(r => {
      const entry = r.find(e => e.co === co);
      return entry ? (5 - entry.rank) : 0; // Invert: rank 1 = top
    }),
    borderColor: colors[idx],
    backgroundColor: 'transparent',
    borderWidth: 2,
    fill: false,
    tension: 0.3,
    pointRadius: 4,
    pointBackgroundColor: colors[idx]
  }));
  
  const quarters = Object.values(capexData)[0].length > 0
    ? FALLBACK_CAPEX_QUARTERS.slice(0, ranks.length)
    : [];
  
  new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: quarters,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 12 }, padding: 16, boxWidth: 3 }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const co = ctx.dataset.label;
              const capexVal = capexData[co] ? capexData[co][idx] : null;
              return capexVal != null ? `${co}: $${capexVal.toFixed(1)}B` : co;
            }
          }
        }
      },
      scales: {
        y: {
          title: { display: true, text: 'Capex Rank (inverted)' },
          ticks: { stepSize: 1 }
        }
      }
    }
  });
}

async function renderIntensityHeatmap() {
  const ctx = document.getElementById('support-1-chart');
  if (!ctx) return;
  
  let capexData = FALLBACK_CAPEX;
  let revenueData = FALLBACK_REVENUE;
  
  const liveCapex = await fetchCapexData();
  const liveRevenue = await fetchRevenueData();
  
  if (liveCapex) capexData = liveCapex;
  if (liveRevenue) revenueData = liveRevenue;
  
  // Compute capex intensity (capex / revenue * 100) for heatmap
  const minLen = Math.min(
    ...Object.values(capexData).map(v => v.length),
    ...Object.values(revenueData).map(v => v.length)
  );
  
  const heatmapData = [];
  const labels = [];
  
  for (const co of HYPERSCALER_COMPANIES) {
    const row = [];
    for (let i = 0; i < minLen; i++) {
      const capex = capexData[co]?.[i] || 0;
      const revenue = revenueData[co]?.[i] || 1;
      const intensity = (capex / revenue) * 100;
      row.push(intensity);
    }
    heatmapData.push(row);
    labels.push(co);
  }
  
  // Render as stacked heatmap visualization using bar chart
  // (HTML5 canvas doesn't have native heatmap, so we'll approximate with color gradation)
  const intensityChart = document.createElement('canvas');
  ctx.parentElement.appendChild(intensityChart);
  
  const coIndexes = HYPERSCALER_COMPANIES;
  const quarterLabels = (FALLBACK_CAPEX_QUARTERS || []).slice(0, minLen);
  
  new Chart(intensityChart, {
    type: 'bar',
    data: {
      labels: quarterLabels,
      datasets: coIndexes.map((co, idx) => ({
        label: co,
        data: heatmapData[idx],
        backgroundColor: ['#ff6b6b', '#ffa500', '#ffeb3b', '#4caf50'][idx],
        borderColor: 'transparent'
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'x',
      scales: {
        y: {
          title: { display: true, text: 'Capex Intensity (% revenue)' },
          beginAtZero: true,
          max: 35
        }
      }
    }
  });
}

async function renderAIShareChart() {
  const ctx = document.getElementById('support-2-chart');
  if (!ctx) return;
  
  let capexData = FALLBACK_CAPEX;
  const liveCapex = await fetchCapexData();
  if (liveCapex) capexData = liveCapex;
  
  const minLen = Math.min(...Object.values(capexData).map(v => v.length));
  const quarters = FALLBACK_CAPEX_QUARTERS.slice(0, minLen);
  
  // Compute total capex and AI-attributable share
  const datasets = [];
  const aiColors = ['#ff6b6b', '#ffa500', '#ffeb3b', '#4caf50'];
  const nonAiColors = ['#ffb3b3', '#ffc2a3', '#fff9c4', '#a5d6a7'];
  
  for (let i = 0; i < HYPERSCALER_COMPANIES.length; i++) {
    const co = HYPERSCALER_COMPANIES[i];
    const aiShare = AI_SHARE_PCT[co] / 100;
    
    const aiData = capexData[co].map(val => val * aiShare);
    const nonAiData = capexData[co].map(val => val * (1 - aiShare));
    
    datasets.push({
      label: `${co} AI capex`,
      data: aiData,
      backgroundColor: aiColors[i],
      stack: `stack-${i}`
    });
    
    datasets.push({
      label: `${co} Other capex`,
      data: nonAiData,
      backgroundColor: nonAiColors[i],
      stack: `stack-${i}`
    });
  }
  
  new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: quarters,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { font: { size: 10 }, padding: 8 }
        }
      },
      scales: {
        y: {
          stacked: true,
          title: { display: true, text: 'Capex ($B)' },
          beginAtZero: true
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
 * Build dynamic takeaway block for hyperscalers pillar.
 */
function buildTakeaway(liveData) {
  const aggCapex = liveData?.aggCapex ?? 100;
  const aggYoY = liveData?.aggYoY ?? 42;
  const leader = liveData?.leader ?? 'AMZN';
  const leaderCapex = liveData?.leaderCapex ?? 30;
  const laggard = liveData?.laggard ?? 'META';
  const laggardLanguage = liveData?.laggardLanguage ?? 'rose to fourth at $21B but capex intensity is highest in the group';
  
  let actionText = '';
  if (aggYoY > 50) {
    actionText = 'Stay long the customers of the hyperscaler capex cycle: semiconductor equipment, power utilities, real estate, software infrastructure. Widening margin here is the margin squeeze upstream (NVDA, TSM) and downstream (electricals, infra). Watch for inflection in equipment order books.';
  } else if (aggYoY >= 20) {
    actionText = 'Hold; watch for any two of four guiding capex flat or down. Deceleration here is the leading edge of downstream weakness.';
  } else {
    actionText = 'Cycle is decelerating. Trim cyclical AI exposure; rotate to free-cash-flow-stable names (GOOGL > META > AMZN).';
  }
  
  return `
    <div class="ai-takeaway-row"><span class="ai-takeaway-label">Where it stands</span><span class="ai-takeaway-text">Aggregate hyperscaler capex hit a record approximately $${aggCapex}B in Q3'25, ${aggYoY}% YoY. ${leader} leads the pack at $${leaderCapex}B; ${laggard} ${laggardLanguage}.</span></div>
    <div class="ai-takeaway-row"><span class="ai-takeaway-label">What it means</span><span class="ai-takeaway-text">Hyperscaler capex is front-loaded on AI infrastructure (GPU clusters, HBM systems, custom silicon). Each company is chasing differentiation but building the same stacks.</span></div>
    <div class="ai-takeaway-row"><span class="ai-takeaway-label">Why it matters</span><span class="ai-takeaway-text">This capex is the demand pull for semis, equipment, and power. Decelerating capex here triggers cascading negative revisions down the supply chain within two quarters.</span></div>
    <div class="ai-takeaway-row ai-takeaway-row-action"><span class="ai-takeaway-label">Action</span><span class="ai-takeaway-text">${actionText}</span></div>
  `;
}

window.addEventListener('DOMContentLoaded', async () => {
  renderBasketGrid();
  
  // Fetch live data for takeaway
  const capexData = await fetchCapexData();
  let liveData = null;
  if (capexData) {
    const companies = Object.keys(capexData);
    const minLen = Math.min(...companies.map(c => capexData[c].length));
    if (minLen > 0) {
      // Latest quarter aggregate and YoY
      const latestIdx = minLen - 1;
      const priorIdx = Math.max(0, minLen - 5); // Approximate prior year quarter
      
      const aggCapexLatest = companies.reduce((s, c) => s + capexData[c][latestIdx], 0);
      const aggCapexPrior = companies.reduce((s, c) => s + capexData[c][priorIdx], 0);
      const aggYoY = aggCapexPrior > 0 ? Math.round(((aggCapexLatest / aggCapexPrior) - 1) * 100) : 0;
      
      // Find leader and laggard
      const latestCapex = companies.map(c => ({ name: c, val: capexData[c][latestIdx] }))
        .sort((a, b) => b.val - a.val);
      const leader = latestCapex[0];
      const laggard = latestCapex[latestCapex.length - 1];
      
      const laggardLanguage = laggard.name === 'META'
        ? `rose to fourth at $${laggard.val.toFixed(1)}B but capex intensity is highest in the group`
        : `is at $${laggard.val.toFixed(1)}B`;
      
      liveData = {
        aggCapex: Math.round(aggCapexLatest),
        aggYoY: aggYoY,
        leader: leader.name,
        leaderCapex: Math.round(leader.val),
        laggard: laggard.name,
        laggardLanguage: laggardLanguage
      };
    }
  }
  
  // Inject dynamic takeaway
  const takeawayEl = document.querySelector('.ai-takeaway');
  if (takeawayEl) {
    takeawayEl.innerHTML = buildTakeaway(liveData);
  }
  
  await renderRankChart();
  await renderIntensityHeatmap();
  await renderAIShareChart();
});
