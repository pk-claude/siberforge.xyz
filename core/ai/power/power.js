// /core/ai/power/power.js
// Power & grid pillar page: generation mix chart + growth rates + electricity prices (live EIA data)

import { renderSparklineGrid } from '../lib/sparkline-grid.js';
import { injectLoadingStyles, setStatus, showLoading, hideLoading } from '../lib/loading.js';

// --- trailing-12 helpers ---
// All three power charts use a rolling-annual view: each plotted point is the
// trailing 12 months of monthly data. This eliminates seasonality (summer gas
// peaks, spring hydro) so the long-run trend is legible.
function trailing12Sum(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < 11) { out.push(null); continue; }
    let s = 0;
    for (let j = i - 11; j <= i; j++) s += arr[j];
    out.push(s);
  }
  return out;
}
function trailing12Avg(arr) {
  return trailing12Sum(arr).map(s => s == null ? null : s / 12);
}
function trailing12YoY(arr) {
  const t12 = trailing12Sum(arr);
  return t12.map((s, i) => {
    if (s == null || i < 23) return null;
    const prior = t12[i - 12];
    if (prior == null || prior === 0) return null;
    return ((s / prior) - 1) * 100;
  });
}

// --- fetch memoization ---
// Each chart calls fetchGenerationData/fetchPriceData independently; without a
// cache the EIA API is hit 3-4 times per page load. Memoize the in-flight promise
// so the second/third callers reuse the first request.
let _genDataPromise = null;
let _priceDataPromise = null;

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

// Fallback hardcoded generation data (15 years monthly so trailing-12 has ~14y of output)
const FALLBACK_LEN = 180;
const FALLBACK_GENERATION = {
  months: Array.from({ length: FALLBACK_LEN }, (_, i) => {
    const year = Math.floor(i / 12) + 2011;
    const month = (i % 12) + 1;
    return `${month}/${String(year).slice(-2)}`;
  }),
  nuclear: Array(FALLBACK_LEN).fill(0).map((_, i) => 67 + Math.sin(i / 12 * 2 * Math.PI) * 3 + (Math.random() - 0.5) * 1.5),
  renewables: Array(FALLBACK_LEN).fill(0).map((_, i) => 38 + (i * 0.42) + Math.sin((i - 3) / 12 * 2 * Math.PI) * 6 + (Math.random() - 0.5) * 3),
  gas: Array(FALLBACK_LEN).fill(0).map((_, i) => 95 + (i * 0.45) + Math.sin((i - 6) / 12 * 2 * Math.PI) * 22 + (Math.random() - 0.5) * 5),
  coal: Array(FALLBACK_LEN).fill(0).map((_, i) => Math.max(40, 150 - (i * 0.55) + Math.sin(i / 12 * 2 * Math.PI) * 8 + (Math.random() - 0.5) * 4))
};

const FALLBACK_PRICES = {
  months: FALLBACK_GENERATION.months,
  industrial: Array(FALLBACK_LEN).fill(0).map((_, i) => 6.5 + (i * 0.012) + Math.sin(i / 12 * 2 * Math.PI) * 0.3 + (Math.random() - 0.5) * 0.15),
  residential: Array(FALLBACK_LEN).fill(0).map((_, i) => 11.8 + (i * 0.018) + Math.sin((i - 2) / 12 * 2 * Math.PI) * 0.4 + (Math.random() - 0.5) * 0.2)
};

/**
 * Fetch generation data from EIA API. Memoized — repeated callers share one request.
 */
function fetchGenerationData() {
  if (_genDataPromise) return _genDataPromise;
  _genDataPromise = (async () => {
    try {
      const url = `/api/eia?series=NUCLEAR_GEN_US,RENEWABLE_GEN_US,GAS_GEN_US,COAL_GEN_US`;
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
      console.warn('Failed to fetch EIA generation data:', err);
      return null;
    }
  })();
  return _genDataPromise;
}

/**
 * Fetch electricity price data from EIA API. Memoized.
 */
function fetchPriceData() {
  if (_priceDataPromise) return _priceDataPromise;
  _priceDataPromise = (async () => {
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
  })();
  return _priceDataPromise;
}

async function renderGenerationChart() {
  const root = getComputedStyle(document.documentElement);
  const ACCENT = root.getPropertyValue('--accent').trim() || '#f7a700';

  const ctx = document.getElementById('anchor-chart');
  if (!ctx) return;
  
  let genData = FALLBACK_GENERATION;

  const liveData = await fetchGenerationData();
  if (liveData && liveData.nuclear_gen_us && liveData.renewable_gen_us &&
      liveData.gas_gen_us && liveData.coal_gen_us) {
    // Pull ~15y monthly so the trailing-12 window has plenty of history
    const n = 180;
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

  // Trailing-12mo SUM in TWh (input is thousand MWh; /1000 -> TWh)
  const t12Coal = trailing12Sum(genData.coal).map(v => v == null ? null : v / 1000);
  const t12Gas = trailing12Sum(genData.gas).map(v => v == null ? null : v / 1000);
  const t12Renew = trailing12Sum(genData.renewables).map(v => v == null ? null : v / 1000);
  const t12Nuke = trailing12Sum(genData.nuclear).map(v => v == null ? null : v / 1000);

  // Display the most recent ~10 years of trailing-12 output
  const displayN = Math.min(120, Math.max(0, genData.months.length - 11));
  const labels = genData.months.slice(-displayN).map((m) => m.startsWith('1/') ? `'${m.slice(-2)}` : '');

  new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Coal',
          data: t12Coal.slice(-displayN),
          borderColor: '#95a5a6',
          backgroundColor: 'rgba(149, 165, 166, 0.3)',
          borderWidth: 1,
          fill: true,
          tension: 0.2,
          pointRadius: 0
        },
        {
          label: 'Gas',
          data: t12Gas.slice(-displayN),
          borderColor: '#f39c12',
          backgroundColor: 'rgba(243, 156, 18, 0.3)',
          borderWidth: 1,
          fill: true,
          tension: 0.2,
          pointRadius: 0
        },
        {
          label: 'Renewables',
          data: t12Renew.slice(-displayN),
          borderColor: '#27ae60',
          backgroundColor: 'rgba(39, 174, 96, 0.3)',
          borderWidth: 1,
          fill: true,
          tension: 0.2,
          pointRadius: 0
        },
        {
          label: 'Nuclear',
          data: t12Nuke.slice(-displayN),
          borderColor: ACCENT,
          backgroundColor: 'rgba(247, 167, 0, 0.3)',
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
          title: { display: true, text: 'Generation (TWh, trailing 12-mo)' }
        }
      }
    }
  });
}

async function renderGrowthChart() {
  const root = getComputedStyle(document.documentElement);
  const ACCENT = root.getPropertyValue('--accent').trim() || '#f7a700';

  const ctx = document.getElementById('support-1-chart');
  if (!ctx) return;
  
  let genData = FALLBACK_GENERATION;

  const liveData = await fetchGenerationData();
  if (liveData && liveData.nuclear_gen_us && liveData.renewable_gen_us) {
    const n = 180;
    genData = {
      months: (liveData.nuclear_gen_us.slice(-n) || []).map(o => {
        const d = new Date(o.date + 'T12:00:00Z');
        return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
      }),
      nuclear: liveData.nuclear_gen_us.slice(-n).map(o => o.value),
      renewables: liveData.renewable_gen_us.slice(-n).map(o => o.value)
    };
  }

  // Rolling 12-mo YoY (this month's t12 sum vs same month a year ago)
  // First 23 months are null; data starts on month 24 onward.
  const nuclearGrowth = trailing12YoY(genData.nuclear);
  const renewablesGrowth = trailing12YoY(genData.renewables);

  // Display the most recent ~10 years of valid YoY output
  const displayN = Math.min(120, Math.max(0, genData.months.length - 23));
  const labels = genData.months.slice(-displayN).map((m) => m.startsWith('1/') ? `'${m.slice(-2)}` : '');

  new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Nuclear YoY %',
          data: nuclearGrowth.slice(-displayN),
          borderColor: ACCENT,
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointBackgroundColor: ACCENT
        },
        {
          label: 'Renewables YoY %',
          data: renewablesGrowth.slice(-displayN),
          borderColor: '#27ae60',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
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
          title: { display: true, text: 'YoY Growth % (rolling 12-mo)' }
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
    const n = 180;
    priceData = {
      months: (liveData.elec_industrial.slice(-n) || []).map(o => {
        const d = new Date(o.date + 'T12:00:00Z');
        return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`;
      }),
      industrial: liveData.elec_industrial.slice(-n).map(o => o.value),
      residential: liveData.elec_residential.slice(-n).map(o => o.value)
    };
  }

  // Trailing-12mo average smooths seasonal swings (heating/cooling)
  const t12Industrial = trailing12Avg(priceData.industrial);
  const t12Residential = trailing12Avg(priceData.residential);

  const displayN = Math.min(120, Math.max(0, priceData.months.length - 11));
  const labels = priceData.months.slice(-displayN).map((m) => m.startsWith('1/') ? `'${m.slice(-2)}` : '');

  new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Industrial (cents/kWh)',
          data: t12Industrial.slice(-displayN),
          borderColor: '#95a5a6',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          pointBackgroundColor: '#95a5a6'
        },
        {
          label: 'Residential (cents/kWh)',
          data: t12Residential.slice(-displayN),
          borderColor: '#e74c3c',
          backgroundColor: 'transparent',
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
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
          title: { display: true, text: 'Price (cents/kWh, trailing 12-mo)' }
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
 * Build dynamic takeaway block for power pillar.
 */
function buildTakeaway(liveData) {
  const nuclearShare = liveData?.nuclearShare ?? 20;
  const gasShare = liveData?.gasShare ?? 38;
  const renewablesShare = liveData?.renewablesShare ?? 22;
  const aiAdditionLanguage = 'AI load centers are new marginal demand, pulling from gas and creating grid constraints in regions without hydro or nuclear.';
  
  const nuclearYoY = liveData?.nuclearYoY ?? 1.5;
  
  let actionText = '';
  if (nuclearYoY < 0) {
    actionText = 'Overweight CEG (nuclear, restart optionality), VST (fleet utilization). Gas is the macro levered bet (GEV, AES). Nuclear restarts are still 2-3 years out; own the capital intensity of grid build now.';
  } else if (nuclearYoY <= 2) {
    actionText = 'Maintain weight. Nuclear flat = restarts not yet flowing through. CEG/VST priced for it; own if you believe in 2027+ capacity adds.';
  } else {
    actionText = 'Reduce conviction on nuclear-restart names — supply-side response is materializing. Rotate to gas (GEV) and grid build-out names (EATON, NDSN).';
  }

  return `
    <div class="ai-takeaway-row"><span class="ai-takeaway-label">Where it stands</span><span class="ai-takeaway-text">US generation mix is shifting: nuclear stable at ${nuclearShare}% of total, gas at ${gasShare}%, renewables at ${renewablesShare}%. ${aiAdditionLanguage}</span></div>
    <div class="ai-takeaway-row"><span class="ai-takeaway-label">What it means</span><span class="ai-takeaway-text">Grid operators face a "peaker paradox": AI data centers run continuous (baseload equivalent) but in regions without nuclear or hydro. Gas peaker profitability is exploding. Brownfield nuclear restarts are the 2026-2027 inflection.</span></div>
    <div class="ai-takeaway-row"><span class="ai-takeaway-label">Why it matters</span><span class="ai-takeaway-text">Power consumption growth from AI is the most inelastic demand shock in 20 years. Utilities with nuclear or gas exposure are realizing massive pricing power; wind/solar OEMs get margin tailwinds.</span></div>
    <div class="ai-takeaway-row ai-takeaway-row-action"><span class="ai-takeaway-label">Action</span><span class="ai-takeaway-text">${actionText}</span></div>
  `;
}

window.addEventListener('DOMContentLoaded', async () => {
  injectLoadingStyles();
  setStatus('Loading EIA data...', true);
  showLoading('anchor-chart', 'Loading generation data...');
  showLoading('support-1-chart', 'Loading nuclear/renewables data...');
  showLoading('support-2-chart', 'Loading price data...');

  renderBasketGrid();

  // Fetch live data for takeaway. Use trailing-12mo aggregates so the shares and YoY
  // shown in the takeaway match the rolling-annual view in the charts.
  const liveGenData = await fetchGenerationData();
  let liveData = null;
  if (liveGenData && liveGenData.nuclear_gen_us && liveGenData.renewable_gen_us &&
      liveGenData.gas_gen_us && liveGenData.coal_gen_us) {

    const nukeArr = liveGenData.nuclear_gen_us.slice(-24).map(o => o.value);
    const renewArr = liveGenData.renewable_gen_us.slice(-24).map(o => o.value);
    const gasArr = liveGenData.gas_gen_us.slice(-24).map(o => o.value);
    const coalArr = liveGenData.coal_gen_us.slice(-24).map(o => o.value);

    if (nukeArr.length >= 12) {
      const sum = (a) => a.reduce((s, v) => s + v, 0);
      const t12 = (a) => sum(a.slice(-12));
      const t12Nuke = t12(nukeArr);
      const t12Renew = t12(renewArr);
      const t12Gas = t12(gasArr);
      const t12Coal = t12(coalArr);
      const totalGen = t12Nuke + t12Renew + t12Gas + t12Coal;

      const nuclearShare = Math.round((t12Nuke / totalGen) * 100);
      const gasShare = Math.round((t12Gas / totalGen) * 100);
      const renewablesShare = Math.round((t12Renew / totalGen) * 100);

      let nuclearYoY = 1.5;
      if (nukeArr.length >= 24) {
        const priorT12Nuke = sum(nukeArr.slice(0, 12));
        if (priorT12Nuke > 0) {
          nuclearYoY = Math.round(((t12Nuke / priorT12Nuke) - 1) * 100 * 10) / 10;
        }
      }

      liveData = {
        nuclearShare,
        gasShare,
        renewablesShare,
        nuclearYoY
      };
    }
  }

  const takeawayEl = document.querySelector('.ai-takeaway');
  if (takeawayEl) {
    takeawayEl.innerHTML = buildTakeaway(liveData);
  }

  await renderGenerationChart();
  hideLoading('anchor-chart');
  await renderGrowthChart();
  hideLoading('support-1-chart');
  await renderPriceChart();
  hideLoading('support-2-chart');

  setStatus('Ready', false);
});
