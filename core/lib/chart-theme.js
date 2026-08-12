// chart-theme.js -- makes Chart.js respect the light/dark toggle.
//
// THE PROBLEM. 22 of the 25 files that build a Chart hardcode dark-theme hex
// into the chart config: tick colour '#8a94a3', grid 'rgba(255,255,255,0.04)',
// tooltip background '#13171c'. Flipping the site to light mode repaints the
// page chrome from CSS variables but leaves every canvas painting dark-mode
// greys on a white card -- axis labels effectively disappear.
//
// THE OPTIONS, and why this one.
//   (a) Rewrite all 22 files to read CSS variables. Correct, and a ~200-site
//       diff across files with no tests, most of which build their config
//       inline in a render function. High churn, high review cost, easy to
//       miss one and never notice.
//   (b) Set Chart.defaults from CSS variables. Cheap, but a per-chart literal
//       always beats a default, so it fixes almost nothing here.
//   (c) This: a Chart.js plugin that runs before every update, walks the
//       resolved options, and swaps any KNOWN dark-theme literal for the
//       current theme's equivalent. Zero call-site churn, works on charts
//       that do not exist yet, and re-runs on theme flip.
//
// The honest cost of (c): it is a translation layer over hardcoded values
// rather than a removal of them. The literals stay in the source. It is the
// right move only because it makes light mode work today without a risky
// mass edit -- (a) remains the destination, one file at a time.

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.Chart) return;

  // Dark-theme literal -> token name. Every key here was found in the repo;
  // adding a new hardcoded colour to a chart means adding it here too, which
  // is the point at which someone should instead just use the variable.
  var MAP = {
    '#8a94a3': '--muted',
    '#e5e9ee': '--text',
    '#13171c': '--panel',
    '#232b35': '--line',
    '#1a2028': '--panel-2',
    '#0b0d10': '--bg',
    'rgba(255,255,255,0.04)': '--grid',
    'rgba(255,255,255,0.06)': '--grid',
    'rgba(255, 255, 255, 0.04)': '--grid',
    'rgba(255,255,255,0.08)': '--grid',
  };

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function resolve(token) {
    if (token === '--grid') {
      // No --grid token exists; derive a low-alpha line from --line so the
      // grid stays subtle in both themes instead of inverting to near-black.
      var isLight = document.documentElement.getAttribute('data-theme') === 'light';
      return isLight ? 'rgba(26,32,40,0.07)' : 'rgba(255,255,255,0.04)';
    }
    return cssVar(token) || null;
  }

  // Per-chart record of the ORIGINAL literal at each options path, so a
  // second theme flip maps from the source value rather than from whatever
  // we substituted last time.
  var originals = new WeakMap();

  function walk(node, chart, path) {
    if (!node || typeof node !== 'object') return;
    var record = originals.get(chart);
    Object.keys(node).forEach(function (k) {
      var v = node[k];
      var p = path + '.' + k;
      if (typeof v === 'string') {
        var src = record[p] !== undefined ? record[p] : v;
        var token = MAP[src] || MAP[src.replace(/\s+/g, '')];
        if (token) {
          if (record[p] === undefined) record[p] = src;
          var next = resolve(token);
          if (next) node[k] = next;
        }
      } else if (v && typeof v === 'object' && !(v instanceof Date)) {
        // Datasets carry the series colours, which are semantic (blue = IG,
        // amber = HY) rather than chrome. Leave them alone.
        if (k === 'data' || k === 'datasets') return;
        walk(v, chart, p);
      }
    });
  }

  var live = new Set();

  window.Chart.register({
    id: 'siberforgeTheme',
    beforeUpdate: function (chart) {
      if (!originals.has(chart)) originals.set(chart, Object.create(null));
      live.add(chart);
      walk(chart.options, chart, 'options');
    },
    afterDestroy: function (chart) {
      live.delete(chart);
    },
  });

  // Defaults too, for anything that did not set an explicit colour.
  function applyDefaults() {
    var d = window.Chart.defaults;
    d.color = cssVar('--muted') || d.color;
    d.borderColor = resolve('--grid');
    if (d.plugins && d.plugins.tooltip) {
      d.plugins.tooltip.backgroundColor = cssVar('--panel');
      d.plugins.tooltip.borderColor = cssVar('--line');
      d.plugins.tooltip.titleColor = cssVar('--text');
      d.plugins.tooltip.bodyColor = cssVar('--text');
    }
    if (d.plugins && d.plugins.legend && d.plugins.legend.labels) {
      d.plugins.legend.labels.color = cssVar('--text');
    }
  }
  applyDefaults();

  document.addEventListener('siberforge:themechange', function () {
    applyDefaults();
    live.forEach(function (chart) {
      try { chart.update('none'); } catch (_) { live.delete(chart); }
    });
  });
})();
