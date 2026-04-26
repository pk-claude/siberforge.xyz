// /core/ai/power/power.js
// Power & grid pillar page: generation mix chart + growth rates + electricity prices (live EIA data)

import { renderSparklineGrid } from '../lib/sparkline-grid.js';

// Basket tickers
const BASKET_TICKERS = [
  { sym: 'CEG', name: 'Constellation Energy', ytd: 45, trend: 'up' },
  { sym: 'VST', name: 'Vistra', ytd: 38, trend: 'up' },
  { sym: 'NEE', name: 'NextEra Energy', ytd: 12, trend: 'up' },
  { sym: 'GEV', name: 'GE Vernova', ytd: 62, trend: 'up' },
  { sym: 'ETR', name: 'Entergy', ytd: 8, trend: 'up' },
  { sym: 'SO', name: 'Southern Co', ytd: 5, trend: 'up' },
  { sym: 'DUK', name: 'Duke Energy', ytd: 2, trend: 'up' }
];

// Fallback hardcoded generation data (5 years monthly)
const FALLBACK_GENERATION = {
  months: Array.from({ length: 60 }, (_, i) => {
    const year = Math.floor(i / 12) + 2021;
    const month = (i % 12) + 1;
    return `${month}/${year % 2 > 0 ? '21' : String(year).slice(-2)}`;
  }),
  nuclear: Array(60).fill(0).map((_, i) => 170 + Math.sin(i / 12) * 5 + Math.random() * 2),
  renewables: Array(60).fill(0).map((_, i) => 140 + (i * 0.5) + Math.sin(i / 6) * 8 + Math.random() * 2),
  gas: Array(60).fill(0).map((_, i) => 200 + (i * 0.7) + Math.sin((i - 3) / 12) * 12 + Math.random() * 2),
  coal: Array(60).fill(0).map((_, i) => 120 - (i * 0.5) - Math.sin(i / 12) * 8 + Math.random() * 2)
};

const FALLBACK_PRICES = {
  months: FALLBACK_GENERATION.months,
  industrial: Array(60).fill(0).map((_, i) => 6.5 + (i * 0.01) + Math.sin(i / 12) * 0.3 + Math.random() * 0.15),
  residential: Array(60).fill(0).map((_, i) => 13.8 + (i * 0.015) + Math.sin((i - 2) / 12) * 0.4 + Math.random() * 0.2)
};

/**
 * Fetch generation data from EIA API.
 */
async function fetchGenerationData() {
  try {
    const url = `/api/eia?series=NUCLEAR_GEN_US,RENEWABLE_GEN_US,GAS_GEN_US,COAL_GEN_US`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    
    const data = {};
    for (const series of json.series || []) {
      const obs = series.observations || [];
      // Sort chronologically
      obs.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Normalize ID to lowercase key
      const key = series.id.toLowerCase();
      data[key] = obs;
    }
    
    return data;
  } catch (err) {
    console.warn('Failed to fetch EIA generation data:', err);
    return null;
  }
}

/**
 * Fetch electricity price data from EIA API.
 */
async function fetchPriceData() {
  try {
    const url = `/api/eia?series=ELEC_INDUSTRIAL,ELEC_RESIDENTIAL`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const json = await res.json();
    
    const data = {};
    for (const series of json.series || []) {
      const obs = series.observations || [];
      obs.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      const key = series.id.toLowerCase();
      data[key] = obs;
    }
    
    return data;
  } catch (err) {
    console.warn('Failed to fetch EIA price data:', err);
    return null;
  }
}

async function renderGenerationChart() {
  const ctx = document.getElementById('anchor-chart');
  if (!ctx) return;
  
  let genData = FALLBACK_GENERATION;
  
  const liveData = await fetchGenerationData();
  if (liveData && liveData.nuclear_gen_us && liveData.renewable_gen_us && 
      liveData.gas_gen_us && liveData.coal_gen_us) {
    
    // Extract latest 60 points
    const n = 60;
    genData = {
      months: (liveData.nuclear_gen_us.slice(-n) || []).map(o => {
        const d = new Date(o.date + 'T12:00:00Z');
        return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
      }),
      nuclear: liveData.nuclear_gen_us.slice(-n).map(o => o.value),
      renewables: liveData.renewable_gen_us.slice(-n).map(o => o.value),
      gas: liveData.gas_gen_us.slice(-n).map(o => o.value),
      coal: liveData.coal_gen_us.slice(-n).map(o => o.value)
    };
  }
  
  new Chart(ctx.getContext('2d'), {
    type: 'area',
    data: {
      labels: genData.months.map((m, i) => i % 6 === 0 ? m : ''),
      datasets: [
        {
          label: 'Coal',
          data: genData.coal,
          borderColor: '#95a5a6',
          backgroundColor: 'rgba(149, 165, 166, 0.3)',
          borderWidth: 1,
          fill: true,
          tension: 0.2,
          pointRadius: 0
        },
        {
          label: 'Gas',
          data: genData.gas,
          borderColor: '#f39c12',
          backgroundColor: 'rgba(243, 156, 18, 0.3)',
          borderWidth: 1,
          fill: true,
          tension: 0.2,
          pointRadius: 0
        },
        {
          label: 'Renewables',
          data: genData.renewables,
          borderColor: '#27ae60',
          backgroundColor: 'rgba(39, 174, 96, 0.3)',
          borderWidth: 1,
          fill: true,
          tension: 0.2,
          pointRadius: 0
        },
        {
          label: 'Nuclear',
          data: genData.nuclear,
          borderColor: 'var(--accent)',
          backgroundColor: 'rgba(var(--accent-rgb), 0.3)',
          borderWidth: 1,
          fill: true,
          tension: 0.2,
          pointRadius: 0
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
          stacked: true,
          title: { display: true, text: 'Generation (thousand MWh)' }
        }
      }
    }
  });
}

async function renderGrowthChart() {
  const ctx = document.getElementById('support-1-chart');
  if (!ctx) return;
  
  let genData = FALLBACK_GENERATION;
  
  const liveData = await fetchGenerationData();
  if (liveData && liveData.nuclear_gen_us && liveData.renewable_gen_us) {
    const n = 60;
    genData = {
      months: (liveData.nuclear_gen_us.slice(-n) || []).map(o => {
        const d = new Date(o.date + 'T12:00:00Z');
        return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
      }),
      nuclear: liveData.nuclear_gen_us.slice(-n).map(o => o.value),
      renewables: liveData.renewable_gen_us.slice(-n).map(o => o.value)
    };
  }
  
  // Compute YoY growth (last 12 months vs prior 12 months)
  const nuclearGrowth = genData.nuclear.slice(-12).map((v, i) => 
    ((v - genData.nuclear[genData.nuclear.length - 24 + i]) / genData.nuclear[genData.nuclear.length - 24 + i]) * 100
  );
  
  const renewablesGrowth = genData.renewables.slice(-12).map((v, i) => 
    ((v - genData.renewables[genData.renewables.length - 24 + i]) / genData.renewables[genData.renewables.length - 24 + i]) * 100
  );
  
  new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: Array.from({ length: 12 }, (_, i) => `M${i + 1}`),
      datasets: [
        {
          label: 'Nuclear YoY %',
          data: nuclearGrowth,
          borderColor: 'var(--accent)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: 'var(--accent)'
        },
        {
          label: 'Renewables YoY %',
          data: renewablesGrowth,
          borderColor: '#27ae60',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#27ae60'
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
          title: { display: true, text: 'YoY Growth %' }
        }
      }
    }
  });
}

async function renderPriceChart() {
  const ctx = document.getElementById('support-2-chart');
  if (!ctx) return;
  
  let priceData = FALLBACK_PRICES;
  
  const liveData = await fetchPriceData();
  if (liveData && liveData.elec_industrial && liveData.elec_residential) {
    const n = 60;
    priceData = {
      months: (liveData.elec_industrial.slice(-n) || []).map(o => {
        const d = new Date(o.date + 'T12:00:00Z');
        return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
      }),
      industrial: liveData.elec_industrial.slice(-n).map(o => o.value),
      residential: liveData.elec_residential.slice(-n).map(o => o.value)
    };
  }
  
  new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: priceData.months.map((m, i) => i % 6 === 0 ? m : ''),
      datasets: [
        {
          label: 'Industrial (cents/kWh)',
          data: priceData.industrial,
          borderColor: '#95a5a6',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 2,
          pointBackgroundColor: '#95a5a6'
        },
        {
          label: 'Residential (cents/kWh)',
          data: priceData.residential,
          borderColor: '#e74c3c',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 2,
          pointBackgroundColor: '#e74c3c'
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
          title: { display: true, text: 'Price (cents/kWh)' }
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
  await renderGenerationChart();
  await renderGrowthChart();
  await renderPriceChart();
});
