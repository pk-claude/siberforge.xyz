// Universal x-axis range controls for Chart.js time-axis charts.
//
// Auto-attaches a small button bar (1Y / 3Y / 5Y / 10Y / Max) above every
// time-axis canvas on the page. No per-chart wiring required — script polls
// for new charts after page load and binds them.
//
// Skips:
//   - Non-time-axis charts (scatter, bar with category axis)
//   - Canvases already wrapped in custom period selectors (ticker page)
//   - Canvases that explicitly opt out via data-no-range attribute

(function () {
  'use strict';

  const RANGES = [
    { label: '1Y',  years: 1 },
    { label: '3Y',  years: 3 },
    { label: '5Y',  years: 5 },
    { label: '10Y', years: 10 },
    { label: 'Max', years: null },
  ];
  const DEFAULT_RANGE = 'Max';  // preserve existing behavior; user can compress

  function isTimeAxis(chart) {
    return chart && chart.config && chart.config.options
      && chart.config.options.scales
      && chart.config.options.scales.x
      && chart.config.options.scales.x.type === 'time';
  }

  function applyRange(chart, years) {
    const xScale = chart.options && chart.options.scales && chart.options.scales.x;
    if (!xScale) return;
    if (years == null) {
      delete xScale.min;
      delete xScale.max;
    } else {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - years);
      xScale.min = cutoff.toISOString().slice(0, 10);
      delete xScale.max;
    }
    chart.update('none');  // 'none' = no animation; faster
  }

  // Already-wired? Skip pages with their own period selectors (ticker page).
  function hasExistingRangeControl(canvas) {
    const wrap = canvas.parentElement;
    if (!wrap) return false;
    // Walk up max 3 levels checking for period-tab or chart-mode-tab cousins
    let n = wrap;
    for (let i = 0; i < 3 && n; i++) {
      if (n.querySelector && n.querySelector('.period-tab, .chart-mode-tab, .h-tab[data-h]')) {
        // The h-tab on the regime returns table is for FORWARD horizon, not chart range.
        // Allow our range-bar there too (it doesn't conflict).
        const onlyHTab = n.querySelectorAll('.period-tab, .chart-mode-tab').length === 0;
        if (!onlyHTab) return true;
      }
      n = n.parentElement;
    }
    return false;
  }

  function attachRangeControls(canvas, chart) {
    if (canvas.dataset.rangeAttached) return;
    if (canvas.dataset.noRange === 'true') return;
    if (hasExistingRangeControl(canvas)) {
      canvas.dataset.rangeAttached = 'skip';
      return;
    }
    canvas.dataset.rangeAttached = '1';

    const bar = document.createElement('div');
    bar.className = 'chart-range-controls';
    for (const r of RANGES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'crc-btn' + (r.label === DEFAULT_RANGE ? ' active' : '');
      btn.dataset.range = r.label;
      btn.textContent = r.label;
      btn.addEventListener('click', () => {
        bar.querySelectorAll('.crc-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyRange(chart, r.years);
      });
      bar.appendChild(btn);
    }
    // Insert bar immediately before the canvas
    canvas.parentElement.insertBefore(bar, canvas);
  }

  function autoAttach() {
    if (typeof Chart === 'undefined') return 0;
    let attached = 0;
    document.querySelectorAll('canvas').forEach(canvas => {
      if (canvas.dataset.rangeAttached) return;
      const chart = Chart.getChart(canvas);
      if (!chart) return;
      if (!isTimeAxis(chart)) {
        canvas.dataset.rangeAttached = 'not-time';
        return;
      }
      attachRangeControls(canvas, chart);
      attached++;
    });
    return attached;
  }

  // Poll for ~30 seconds — enough for slow first-paint dashboards.
  let polls = 0;
  const interval = setInterval(() => {
    autoAttach();
    if (++polls > 60) clearInterval(interval);  // 60 * 500ms = 30s
  }, 500);

  // Also expose globally for manual re-runs after dynamic chart creation.
  window.__chartRangeAutoAttach = autoAttach;
})();
