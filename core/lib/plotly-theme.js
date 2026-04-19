/* plotly-theme.js — shared Plotly defaults for Siberforge Plug views.
   Reads palette + chrome from CSS custom properties so charts stay in sync
   with the light theme defined in /core/plug/styles.css.

   Exposes:
     window.PlotlyTheme.readPalette()  -> palette object (C)
     window.PlotlyTheme.baseLayout(C)  -> Plotly layout defaults
     window.PlotlyTheme.plotCfg        -> { displayModeBar:false, responsive:true }
     window.PlotlyTheme.init()         -> { C, baseLayout, plotCfg } in one call
*/

(function (root) {
  "use strict";

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    var g = function (name, fallback) {
      var v = cs.getPropertyValue(name);
      return (v && v.trim()) || fallback;
    };
    return {
      // Chrome
      text:       g("--text",        "#0f172a"),
      muted:      g("--muted",       "#64748b"),
      muted2:     g("--muted-2",     "#94a3b8"),
      line:       g("--line",        "#e2e6ec"),
      lineSoft:   g("--line-soft",   "#eef1f5"),
      panel:      g("--panel",       "#ffffff"),
      panel2:     g("--panel-2",     "#f3f5f8"),
      // Accents
      accent:     g("--accent",      "#c47f00"),
      green:      g("--green",       "#16a34a"),
      red:        g("--red",         "#dc2626"),
      blue:       g("--blue",        "#1d4ed8"),
      // Hover
      tooltipBg:  g("--tooltip-bg",  "#1e293b"),
      tooltipFg:  g("--tooltip-fg",  "#f8fafc"),
      // Category palette (flow statement + cash)
      cfo:        g("--cat-cfo",        "#1d4ed8"),
      cfi:        g("--cat-cfi",        "#c47f00"),
      cff:        g("--cat-cff",        "#7c3aed"),
      fcf:        g("--cat-fcf",        "#dc2626"),
      capex:      g("--cat-capex",      "#0f172a"),
      net:        g("--cat-net",        "#475569"),
      cashTotal:  g("--cat-cash-total", "#d97706"),
      cashBasic:  g("--cat-cash-basic", "#0891b2"),
    };
  }

  function baseLayout(C) {
    return {
      paper_bgcolor: C.panel,
      plot_bgcolor:  C.panel,
      font:    { family: "Inter, system-ui, sans-serif", size: 12.5, color: C.text },
      margin:  { l: 56, r: 18, t: 10, b: 48 },
      xaxis:   { gridcolor: C.line, zerolinecolor: C.line, tickfont: { color: C.muted } },
      yaxis:   { gridcolor: C.line, zerolinecolor: C.line, tickfont: { color: C.muted } },
      legend:  { orientation: "h", y: -0.18, x: 0, bgcolor: "rgba(0,0,0,0)", font: { color: C.text } },
      hoverlabel: { bgcolor: C.tooltipBg, font: { color: C.tooltipFg } },
    };
  }

  var plotCfg = { displayModeBar: false, responsive: true };

  function init() {
    var C = readPalette();
    return { C: C, baseLayout: baseLayout(C), plotCfg: plotCfg };
  }

  root.PlotlyTheme = {
    readPalette: readPalette,
    baseLayout:  baseLayout,
    plotCfg:     plotCfg,
    init:        init,
  };
})(window);
