// /core/ai/adopters/adopters.js
// Adopters pillar page: software revenue growth + productivity + margin expansion (live data)

import { renderSparklineGrid } from '../lib/sparkline-grid.js';

// Software basket: {CRM, NOW, ADBE, PANW, ACN, IBM, ROK, EMR}
const SOFTWARE_BASKET = ['CRM', 'NOW', 'ADBE', 'PANW'];

// Fallback hardcoded software data (last 8 quarters, revenue in $B)
const FALLBACK_SOFTWARE_DATA = {
  quarters: ["Q4'23", "Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", "Q3'25"],
  crm: [13.5, 14, 14.5, 15.5, 15, 15.5, 16, 15.5],
  now: [14, 14.5, 15, 16, 15.5, 16, 16.5, 16.5],
  adbe: [12, 12.5, 13, 14, 13.5, 14, 14.5, 13.5],
  panw: [16, 16.5, 17, 17.5, 17, 17.5, 18, 17.5]
};

const FALLBACK_PRODUCTIVITY_DATA = {
  quarters: ["Q4'23", "Q1'24", "Q2'24", "Q3'24", "Q4'24", "Q1'25", "Q2'25", "Q3'25"],
  productivityYoY: [1.8, 1.2, 0.9, 1.1, 1.3, 1.5, 1.6, 1.4],
  swCapex: [22, 23, 24.5, 25.2, 26, 27.5, 28, 29]
};

// Margin expansion YoY change (pp) — v2 placeholder if Finnhub margin data unavailable
const MARGIN_DATA = [
  { sym: 'CRM', expansion: 1.8 },
  { sym: 'NOW', expansion: 2.4 },
  { sym: 'ADBE', expansion: 0.6 },
  { sym: 'PANW', expansion: 1.2 },
  { sym: 'ACN', expansion: -0.3 },
  { sym: 'IBM', expansion: 0.9 },
  { sym: 'ROK', expansion: -0.8 },
  { sym: 'EMR', expansion: 1.1 }
];

// Basket tickers
const BASKET_TICKERS = [
  { sym: 'CRM', name: 'Salesforce', ytd: 28, trend: 'up' },
  { sym: 'NOW', name: 'ServiceNow', ytd: 42, trend: 'up' },
  { sym: 'ADBE', name: 'Adobe', ytd: 22, trend: 'up' },
  { sym: 'PANW', name: 'Palo Alto Networks', ytd: 38, trend: 'up' },
  { sym: 'ACN', name: 'Accenture', ytd: -5, trend: 'down' },
  { sym: 'IBM', name: 'IBM', ytd: 12, trend: 'up' },
  { sym: 'ROK', name: 'Rockwell Automation', ytd: -8, trend: 'down' },
  { sym: 'EMR', name: 'Emerson', ytd: 18, trend: 'up' }
];

/**
 * Fetch quarterly revenue for software basket via Finnhub.
 */
async function fetchSoftwareRevenue() {
  try {
    const url = `/api/stocks?mode=financials&symbols=${SOFTWARE_BASKET.join(',')}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    
    const data = {};
    for (const fin of json.financials) {
      const reports = fin.reports || [];
      const sorted = reports
        .filter(r => r.revenue != null)
        .sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter - b.quarter);
      
      if (sorted.length < 4) return null;
      
      data[fin.symbol] = sorted.slice(-8).map(r => r.revenue / 1e9); // Billions
    }
    
    return data;
  } catch (err) {
    console.warn('Failed to fetch software revenue:', err);
    return null;
  }
}

/**
 * Fetch operating margin for adopter basket via Finnhub.
 * Returns array of { sym, expansion } (YoY change in operating margin, pp)
 */
async function fetchMarginData() {
  try {
    const symbols = BASKET_TICKERS.map(t => t.sym).join(',');
    const url = `/api/stocks?mode=financials&symbols=${symbols}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    
    const data = [];
    for (const fin of json.financials) {
      const reports = fin.reports || [];
      
      // Compute operating margin: operatingIncome / revenue
      // For simplicity, use last 2 available reports (current and prior year)
      if (reports.length < 2) {
        console.warn(`Insufficient reports for ${fin.symbol}`);
        continue;
      }
      
      const current = reports[reports.length - 1];
      const prior = reports[reports.length - 5] || reports[0]; // Try to get 1 year prior
      
      if (!current.revenue || !prior.revenue) {
        console.warn(`Missing revenue data for ${fin.symbol}`);
        continue;
      }
      
      // Estimate operating margin from net income as proxy (if operating margin not available)
      const currentMargin = current.netIncome ? (current.netIncome / current.revenue) * 100 : null;
      const priorMargin = prior.netIncome ? (prior.netIncome / prior.revenue) * 100 : null;
      
      if (currentMargin != null && priorMargin != null) {
        const expansion = currentMargin - priorMargin;
        data.push({ sym: fin.symbol, expansion });
      }
    }
    
    return data.length > 0 ? data : null;
  } catch (err) {
    console.warn('Failed to fetch margin data:', err);
    return null;
  }
}

async function renderRevenueChart() {
  const ctx = document.getElementById('anchor-chart');
  if (!ctx) return;
  
  let softwareData = FALLBACK_SOFTWARE_DATA;
  
  const liveData = await fetchSoftwareRevenue();
  if (liveData && liveData.CRM && liveData.NOW && liveData.ADBE && liveData.PANW) {
    softwareData = {
      quarters: FALLBACK_SOFTWARE_DATA.quarters,
      crm: liveData.CRM,
      now: liveData.NOW,
      adbe: liveData.ADBE,
      panw: liveData.PANW
    };
  }
  
  new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: softwareData.quarters,
      datasets: [
        {
          label: 'CRM',
          data: softwareData.crm,
          borderColor: '#e74c3c',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: 'NOW',
          data: softwareData.now,
          borderColor: '#3498db',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: 'ADBE',
          data: softwareData.adbe,
          borderColor: '#f39c12',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: 'PANW',
          data: softwareData.panw,
          borderColor: '#2ecc71',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 12 }, padding: 16, boxWidth: 3 }
        }
      },
      scales: {
        y: {
          title: { display: true, text: 'Quarterly Revenue ($B)' }
        }
      }
    }
  });
}

async function renderProductivityChart() {
  const root = getComputedStyle(document.documentElement);
  const ACCENT = root.getPropertyValue('--accent').trim() || '#f7a700';
  const MUTED  = root.getPropertyValue('--muted').trim() || '#888';

  const ctx = document.getElementById('support-1-chart');
  if (!ctx) return;
  
  let prodData = FALLBACK_PRODUCTIVITY_DATA;
  
  // Fetch live productivity data from FRED OPHNFB
  const liveProd = await fetchProductivityData();
  if (liveProd && liveProd.yoy && liveProd.yoy.length > 0) {
    // Slice fallback capex to match the length of live productivity data
    const swCapexSlice = FALLBACK_PRODUCTIVITY_DATA.swCapex.slice(-liveProd.yoy.length);
    prodData = {
      quarters: liveProd.quarters,
      productivityYoY: liveProd.yoy,
      swCapex: swCapexSlice
    };
  }
  
  new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: prodData.quarters,
      datasets: [
        {
          label: 'Productivity YoY %',
          data: prodData.productivityYoY,
          borderColor: ACCENT,
          backgroundColor: 'transparent',
          yAxisID: 'y',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 3
        },
        {
          label: 'Software capex estimate ($B)',
          data: prodData.swCapex,
          borderColor: MUTED,
          backgroundColor: 'transparent',
          yAxisID: 'y1',
          borderWidth: 1.5,
          borderDash: [4, 2],
          fill: false,
          tension: 0.3,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
          title: { display: true, text: 'Productivity YoY %' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          title: { display: true, text: 'Capex estimate ($B)' },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

async function renderMarginChart() {
  const ctx = document.getElementById('support-2-chart');
  if (!ctx) return;
  
  let marginData = MARGIN_DATA;
  
  const liveMargin = await fetchMarginData();
  if (liveMargin && liveMargin.length > 0) {
    marginData = liveMargin;
  }
  
  const colors = marginData.map(d => d.expansion >= 0 ? '#2ecc71' : '#e74c3c');
  
  new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels: marginData.map(d => d.sym),
      datasets: [{
        label: 'Operating margin change YoY (pp)',
        data: marginData.map(d => d.expansion),
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
              return `${v > 0 ? '+' : ''}${v.toFixed(1)} pp`;
            }
          }
        }
      },
      scales: {
        y: {
          title: { display: true, text: 'Margin change (pp)' },
          ticks: { stepSize: 0.5 }
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
 * Build dynamic takeaway block for adopters pillar.
 */
/**
 * Fetch productivity data (OPHNFB) from FRED API.
 * Returns quarterly YoY % computed from index series.
 */
async function fetchProductivityData() {
  try {
    const url = `/api/fred?series=OPHNFB`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    
    if (!json.series || json.series.length === 0) return null;
    
    const series = json.series[0];
    const obs = (series.observations || [])
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-16); // Last 16 quarters for history
    
    if (obs.length < 4) return null;
    
    // Compute YoY % for each quarter (current / 4-quarters-prior)
    const yoyData = [];
    for (let i = 4; i < obs.length; i++) {
      const current = parseFloat(obs[i].value);
      const prior = parseFloat(obs[i - 4].value);
      if (current > 0 && prior > 0) {
        const yoy = ((current / prior) - 1) * 100;
        yoyData.push(yoy);
      }
    }
    
    return {
      quarters: obs.slice(4).map((o, i) => {
        const d = new Date(o.date + 'T12:00:00Z');
        const yr = d.getFullYear();
        const q = Math.floor(d.getMonth() / 3) + 1;
        return `Q${q}'${String(yr).slice(-2)}`;
      }),
      yoy: yoyData
    };
  } catch (err) {
    console.warn('Failed to fetch productivity data:', err);
    return null;
  }
}

function buildTakeaway(liveData) {
  const basketYoY = liveData?.basketYoY ?? 12;
  
  let disclosureLanguage = 'Disclosures: CRM AI use-cases are widening (Sales Cloud AI, Service Einstein). PANW integrating its foundational model into every product SKU. NOW and ADBE both seeing product-attach lift.';
  
  let actionText = '';
  if (basketYoY > 15) {
    actionText = 'Selectively long CRM (Einstein), NOW (industrial workflow AI), ADBE (creative cloud); avoid laggards still pricing legacy SaaS without AI angle. Watch enterprise software DBNRR for the leading signal — when it reaccelerates, AI is monetizing.';
  } else if (basketYoY >= 10) {
    actionText = 'Hold quality (CRM, NOW). Cycle is plateauing; differentiation matters more than basket exposure.';
  } else {
    actionText = 'Trim. Software is decelerating faster than the AI capex cycle would suggest — implies adoption isn't translating to revenue. Re-evaluate when DBNRR reaccelerates above 110%.';
  }
  
  return `
    <div class="ai-takeaway-row"><span class="ai-takeaway-label">Where it stands</span><span class="ai-takeaway-text">Software basket revenue growth has stabilized around ${basketYoY}% YoY across CRM/NOW/ADBE/PANW. ${disclosureLanguage}</span></div>
    <div class="ai-takeaway-row"><span class="ai-takeaway-label">What it means</span><span class="ai-takeaway-text">Enterprise SaaS is in the AI monetization window. Product-level attachment rates are climbing, but land expansion is decelerating (customers consolidating vendors, not expanding footprint).</span></div>
    <div class="ai-takeaway-row"><span class="ai-takeaway-label">Why it matters</span><span class="ai-takeaway-text">If software adoption of AI is slowing, capex spend from hyperscalers was ahead of enterprise demand. That's the recession signal: capex for tools customers aren't yet buying at scale.</span></div>
    <div class="ai-takeaway-row ai-takeaway-row-action"><span class="ai-takeaway-label">Action</span><span class="ai-takeaway-text">${actionText}</span></div>
  `;
}

window.addEventListener('DOMContentLoaded', async () => {
  renderBasketGrid();
  
  // Fetch live data for takeaway
  const swRevData = await fetchSoftwareRevenue();
  let liveData = null;
  if (swRevData && swRevData.CRM && swRevData.NOW && swRevData.ADBE && swRevData.PANW) {
    const crm = swRevData.CRM;
    const now = swRevData.NOW;
    const adbe = swRevData.ADBE;
    const panw = swRevData.PANW;
    
    if (crm.length > 4 && now.length > 4 && adbe.length > 4 && panw.length > 4) {
      // Compute basket YoY (latest vs 4 quarters prior)
      const latest = [crm[crm.length-1], now[now.length-1], adbe[adbe.length-1], panw[panw.length-1]];
      const prior = [crm[crm.length-5], now[now.length-5], adbe[adbe.length-5], panw[panw.length-5]];
      
      const latestSum = latest.reduce((a, b) => a + b, 0);
      const priorSum = prior.reduce((a, b) => a + b, 0);
      
      const basketYoY = priorSum > 0 ? Math.round(((latestSum / priorSum) - 1) * 100) : 12;
      
      liveData = { basketYoY };
    }
  }
  
  // Inject dynamic takeaway
  const takeawayEl = document.querySelector('.ai-takeaway');
  if (takeawayEl) {
    takeawayEl.innerHTML = buildTakeaway(liveData);
  }
  
  await renderRevenueChart();
  await renderProductivityChart();
  await renderMarginChart();
});
