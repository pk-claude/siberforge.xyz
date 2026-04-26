// Stock-bond correlation regime panel.
//
// The single most decision-relevant cross-asset signal for 60/40 portfolios:
// rolling 24-month correlation of monthly SPY returns and IEF (7-10Y Treasury)
// returns.
//   * Negative correlation = bonds hedge equities = 60/40 works
//   * Positive correlation = bonds amplify equity drawdowns = need other diversifiers
//   * The flip happened in 2022; pre-2000 was also positive
//
// Renders as a time-series chart with green shading below zero and amber above.

import { dailyToMonthEnd } from './regime-returns.js';

let _chart = null;

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function monthlyReturns(monthEndMap) {
  const months = [...monthEndMap.keys()].sort();
  const out = [];
  for (let i = 1; i < months.length; i++) {
    const prev = monthEndMap.get(months[i - 1]).value;
    const cur = monthEndMap.get(months[i]).value;
    if (!prev || !cur) continue;
    out.push({ ym: months[i], value: cur / prev - 1 });
  }
  return out;
}

function rollingCorrelation(seriesA, seriesB, window) {
  // Align by ym, then compute trailing-window Pearson correlation.
  const map = new Map(seriesA.map(o => [o.ym, [o.value, null]]));
  for (const o of seriesB) {
    if (map.has(o.ym)) map.get(o.ym)[1] = o.value;
  }
  const aligned = [...map.entries()]
    .filter(([_, v]) => v[1] != null)
    .sort((a, b) => a[0] < b[0] ? -1 : 1);

  const out = [];
  for (let i = window - 1; i < aligned.length; i++) {
    const slice = aligned.slice(i - window + 1, i + 1);
    const n = slice.length;
    let sumA = 0, sumB = 0;
    for (const [, v] of slice) { sumA += v[0]; sumB += v[1]; }
    const meanA = sumA / n, meanB = sumB / n;
    let num = 0, denomA = 0, denomB = 0;
    for (const [, v] of slice) {
      const da = v[0] - meanA, db = v[1] - meanB;
      num += da * db;
      denomA += da * da;
      denomB += db * db;
    }
    const denom = Math.sqrt(denomA * denomB);
    if (denom > 0) out.push({ ym: aligned[i][0], value: num / denom });
  }
  return out;
}

export async function renderStockBondCorrelation(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Pull 30 years of SPY + IEF (IEF starts 2002, so effectively 22+ years)
  let spyHistory = [], iefHistory = [];
  try {
    const j = await fetchJSON('/api/stocks?mode=history&years=30&symbols=SPY,IEF');
    for (const s of j.series) {
      if (s.symbol === 'SPY') spyHistory = s.closes;
      if (s.symbol === 'IEF') iefHistory = s.closes;
    }
  } catch (err) {
    console.warn('SPY/IEF fetch failed:', err);
    return;
  }

  const spyMonthly = monthlyReturns(dailyToMonthEnd(spyHistory));
  const iefMonthly = monthlyReturns(dailyToMonthEnd(iefHistory));
  const corr = rollingCorrelation(spyMonthly, iefMonthly, 24);

  if (_chart) _chart.destroy();
  _chart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      datasets: [{
        label: 'Rolling 24m correlation (SPY vs IEF)',
        data: corr.map(o => ({ x: o.ym + '-15', y: o.value })),
        borderColor: '#f7a700',
        borderWidth: 1.8,
        pointRadius: 0,
        tension: 0.1,
        fill: { target: 'origin', above: 'rgba(247, 167, 0, 0.15)', below: 'rgba(62, 207, 142, 0.15)' },
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#e5e9ee', font: { size: 11 } } },
        tooltip: { backgroundColor: '#13171c', borderColor: '#232b35', borderWidth: 1,
                   callbacks: { label: c => `r = ${c.parsed.y.toFixed(3)}` } },
      },
      scales: {
        x: { type: 'time', time: { unit: 'year' }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8a94a3', font: { size: 10 }, callback: v => v.toFixed(2) },
             title: { display: true, text: 'correlation (negative = bonds hedge equities)', color: '#8a94a3', font: { size: 11 } },
             min: -1, max: 1 },
      },
    },
    plugins: [{
      id: 'sbcZeroLine',
      afterDatasetsDraw(chart) {
        const { ctx, chartArea: a, scales: s } = chart;
        if (!a) return;
        const y0 = s.y.getPixelForValue(0);
        ctx.save();
        ctx.strokeStyle = 'rgba(138, 148, 163, 0.5)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.left, y0); ctx.lineTo(a.right, y0);
        ctx.stroke();
        ctx.fillStyle = 'rgba(138, 148, 163, 0.7)';
        ctx.font = '10px Inter, sans-serif';
        ctx.fillText('0 — flip line', a.left + 4, y0 - 4);
        ctx.restore();
      },
    }],
  });

  // Auto-interpretation: four-row takeaway block
  const note = document.getElementById('sbc-note');
  if (note && corr.length) {
    const last = corr[corr.length - 1];
    const v = last.value;
    
    // Determine regime label and stand copy
    let standCopy, regimeLabel;
    if (v < -0.20) {
      regimeLabel = 'Strongly negative';
      standCopy = `Strongly negative at <strong>${v.toFixed(2)}</strong>. Bonds are hedging equities — the textbook 60/40 environment.`;
    } else if (v < 0) {
      regimeLabel = 'Mildly negative';
      standCopy = `Mildly negative at <strong>${v.toFixed(2)}</strong>. Bonds still hedge but the cushion is thin.`;
    } else if (v < 0.20) {
      regimeLabel = 'Mildly positive';
      standCopy = `Mildly positive at <strong>${v.toFixed(2)}</strong>. Diversification is degraded — bonds and equities drift together.`;
    } else {
      regimeLabel = 'Strongly positive';
      standCopy = `Strongly positive at <strong>${v.toFixed(2)}</strong>. Broken regime — duration is now a correlated risk, not a hedge.`;
    }
    
    // Add 12-month delta if available
    if (corr.length >= 13) {
      const v12m = corr[corr.length - 13].value;
      const delta = (v - v12m).toFixed(2);
      const sign = delta > 0 ? '+' : '';
      standCopy += `, ${sign}${delta} pts vs 12m ago`;
    }
    
    // Forward copy based on regime
    let forwardCopy;
    if (v > 0.20) {
      forwardCopy = 'Still in the broken regime. Below +0.20 marks a re-anchoring; below -0.10 for two consecutive months is required before treating Treasuries as a durable hedge again.';
    } else if (v >= 0) {
      forwardCopy = 'Re-anchoring underway from the 2024 peak (~+0.75). Mean-reversion path is plausible but not confirmed — needs a print below -0.10 to validate.';
    } else {
      forwardCopy = 'Re-anchoring confirmed. Holds as long as the level stays sub-zero; watch for upward drift back toward zero.';
    }
    
    // Action is always the same playbook
    const actionCopy = 'Reduce long-duration Treasuries as the primary equity hedge. Substitute with managed-futures (DBMF, KMLM), gold (GLD), short-duration cash (BIL, SGOV), or tail-risk overlays. Size equity beta off VIX rather than off the bond ladder. Re-evaluate 60/40 weights when this correlation prints below -0.10 for two consecutive months.';
    
    // Build the four-row takeaway block
    const block = `
  <div class="sbc-takeaway">
    <div class="sbc-row sbc-row-stand">
      <span class="sbc-label">Where it stands</span>
      <span class="sbc-text">${standCopy}</span>
    </div>
    <div class="sbc-row sbc-row-broke">
      <span class="sbc-label">What the break did</span>
      <span class="sbc-text">2022 saw a 60/40 portfolio drawdown of ~17% — the worst since 1937 — because Treasuries fell alongside equities instead of hedging them. The textbook diversification benefit only works when this correlation is negative.</span>
    </div>
    <div class="sbc-row sbc-row-fwd">
      <span class="sbc-label">Going forward</span>
      <span class="sbc-text">${forwardCopy}</span>
    </div>
    <div class="sbc-row sbc-row-act">
      <span class="sbc-label">Action</span>
      <span class="sbc-text">${actionCopy}</span>
    </div>
  </div>
`;
    note.innerHTML = block;
  }
}
