/* revenue.js — Plug Power revenue-by-product-line, FY2015-FY2025
   Sources:
     FY2015-FY2016: FY2016 10-K filed 2017-03-10 (pre-restatement)
     FY2017:        FY2018 10-K filed 2019-03-13 (pre-restatement)
     FY2018-FY2020: FY2020 10-K (restated) filed 2021-05-14
     FY2021-FY2022: FY2022 10-K filed 2023-03-01
     FY2023-FY2025: FY2025 10-K filed 2026-03-02
   All figures in $ thousands as reported; scaled to $ millions here.
   Services COGS combines the separately disclosed "provision for loss contracts
   related to service" with the main services COGS line.
*/
(function () {
  "use strict";

  /* ---- shared palette (from /core/lib/plotly-theme.js) ---- */
  const C = window.PlotlyTheme.readPalette();

  // View-specific palette — softened / muted tones chosen for the stacked
  // revenue-by-product-line bars. Not part of the standard flow-statement
  // palette in CSS because these are product categories, not accounting
  // categories.
  const PC = {
    eq:  "#7ba4cf",  // soft steel blue — equipment
    sv:  "#8cbfc7",  // soft teal — services
    ppa: "#e2b87f",  // soft amber — PPA
    fuel:"#b39ddb",  // soft lavender — fuel
    other:"#b0b7c0", // soft cool grey — other
    total:"#6b7280", // muted slate — total/net line
  };

  // Data loaded from ./data/revenue-data.js (see <script> tag in revenue.html).
  const DATA = window.PLUG_REVENUE_DATA;

  // Scale helpers
  const toM = v => v / 1000;  // k → M
  const years  = DATA.map(d => d.year);
  const rev    = {
    eq:    DATA.map(d => toM(d.rev.eq)),
    sv:    DATA.map(d => toM(d.rev.sv)),
    ppa:   DATA.map(d => toM(d.rev.ppa)),
    fuel:  DATA.map(d => toM(d.rev.fuel)),
    other: DATA.map(d => toM(d.rev.other)),
    total: DATA.map(d => toM(d.rev.eq + d.rev.sv + d.rev.ppa + d.rev.fuel + d.rev.other)),
  };
  const cogs   = {
    eq:    DATA.map(d => toM(d.cogs.eq)),
    sv:    DATA.map(d => toM(d.cogs.sv + d.cogs.svLoss)),
    ppa:   DATA.map(d => toM(d.cogs.ppa)),
    fuel:  DATA.map(d => toM(d.cogs.fuel)),
    other: DATA.map(d => toM(d.cogs.other)),
    total: DATA.map(d => toM(d.cogs.eq + d.cogs.sv + d.cogs.svLoss + d.cogs.ppa + d.cogs.fuel + d.cogs.other)),
  };

  // Gross margin % per line (line-level rev - cogs) / rev.
  // GM is suppressed for any line where reported revenue is negative (FY2020
  // warrant contra-revenue) since the resulting percentage is not meaningful —
  // the gap is driven by the warrant charge, not true margin economics.
  function gm(revArr, cogsArr) {
    return revArr.map((r, i) => {
      if (r === 0 || r == null || r < 0) return null;
      return ((r - cogsArr[i]) / r) * 100;
    });
  }
  const gmLine = {
    eq:    gm(rev.eq,    cogs.eq),
    sv:    gm(rev.sv,    cogs.sv),
    ppa:   gm(rev.ppa,   cogs.ppa),
    fuel:  gm(rev.fuel,  cogs.fuel),
    total: gm(rev.total, cogs.total),
  };

  // View-specific layout: starts from the shared base, then overrides margins
  // and legend placement for revenue's wider y-axis labels.
  const commonLayout = {
    ...window.PlotlyTheme.baseLayout(C),
    margin: { l: 70, r: 40, t: 20, b: 60 },
    legend: { orientation: "h", y: -0.16, x: 0.5, xanchor: "center" },
  };

  /* ============================================================
     Panel 1: Stacked revenue by product line
  ============================================================ */
  function bar(name, yArr, color) {
    return {
      type: "bar",
      x: years,
      y: yArr,
      name,
      marker: { color },
      hovertemplate: `<b>${name}</b><br>%{x}: $%{y:,.1f}M<extra></extra>`,
    };
  }

  const totalLine = {
    type: "scatter",
    mode: "lines+markers",
    x: years,
    y: rev.total,
    name: "Net revenue (total)",
    line: { color: PC.total, width: 2, dash: "dot" },
    marker: { size: 6, color: PC.total },
    yaxis: "y2",
    hovertemplate: "<b>Net revenue</b><br>%{x}: $%{y:,.1f}M<extra></extra>",
  };

  const revTraces = [
    bar("Equipment",   rev.eq,    PC.eq),
    bar("Services",    rev.sv,    PC.sv),
    bar("PPA",         rev.ppa,   PC.ppa),
    bar("Fuel",        rev.fuel,  PC.fuel),
    bar("Other",       rev.other, PC.other),
    totalLine,
  ];

  Plotly.newPlot("chart-rev", revTraces, {
    ...commonLayout,
    barmode: "relative",  // stacks positive and negative separately
    xaxis: { tickmode: "linear", dtick: 1, gridcolor: C.line, linecolor: C.line },
    yaxis: {
      title: { text: "Revenue ($M)", font: { size: 12 } },
      gridcolor: C.line,
      linecolor: C.line,
      zeroline: true,
      zerolinecolor: C.muted2,
      zerolinewidth: 1.5,
      tickformat: ",",
    },
    yaxis2: {
      overlaying: "y",
      side: "right",
      showgrid: false,
      visible: false,
      zeroline: false,
    },
    margin: { l: 70, r: 40, t: 20, b: 80 },
  }, window.PlotlyTheme.plotCfg);

  /* ============================================================
     Panel 2: Gross margin by product line (line chart, %)
  ============================================================ */
  function gmTrace(name, yArr, color, dash) {
    return {
      type: "scatter",
      mode: "lines+markers",
      x: years,
      y: yArr,
      name,
      line: { color, width: dash ? 2.5 : 2, dash: dash || "solid" },
      marker: { size: 6, color },
      connectgaps: false,
      hovertemplate: `<b>${name}</b><br>%{x}: %{y:,.1f}%<extra></extra>`,
    };
  }

  const gmTraces = [
    gmTrace("Equipment",   gmLine.eq,    PC.eq),
    gmTrace("Services",    gmLine.sv,    PC.sv),
    gmTrace("PPA",         gmLine.ppa,   PC.ppa),
    gmTrace("Fuel",        gmLine.fuel,  PC.fuel),
    gmTrace("Total GM%",   gmLine.total, PC.total, "dot"),
  ];

  Plotly.newPlot("chart-gm", gmTraces, {
    ...commonLayout,
    xaxis: { tickmode: "linear", dtick: 1, gridcolor: C.line, linecolor: C.line },
    yaxis: {
      title: { text: "Gross margin (%)", font: { size: 12 } },
      gridcolor: C.line,
      linecolor: C.line,
      zeroline: true,
      zerolinecolor: C.muted2,
      zerolinewidth: 1.5,
      tickformat: ",",
      ticksuffix: "%",
      range: [-600, 100],
    },
    margin: { l: 70, r: 40, t: 20, b: 80 },
    shapes: [{
      type: "rect",
      xref: "paper", yref: "y",
      x0: 0, x1: 1,
      y0: 0, y1: -600,
      fillcolor: "rgba(180, 95, 95, 0.035)",
      line: { width: 0 },
      layer: "below",
    }],
  }, window.PlotlyTheme.plotCfg);

  /* ============================================================
     Panel 3: Revenue mix (100% stacked bar)
  ============================================================ */
  // Compute absolute-basis shares (so 2020 doesn't blow up)
  const absTotal = years.map((_, i) => {
    return Math.abs(rev.eq[i]) + Math.abs(rev.sv[i]) + Math.abs(rev.ppa[i]) + Math.abs(rev.fuel[i]) + Math.abs(rev.other[i]);
  });
  function share(arr) {
    return arr.map((v, i) => absTotal[i] === 0 ? 0 : (Math.abs(v) / absTotal[i]) * 100);
  }

  const mixTraces = [
    { type: "bar", x: years, y: share(rev.eq),    name: "Equipment", marker: { color: PC.eq },
      hovertemplate: "<b>Equipment</b><br>%{x}: %{y:,.1f}%<extra></extra>" },
    { type: "bar", x: years, y: share(rev.sv),    name: "Services",  marker: { color: PC.sv },
      hovertemplate: "<b>Services</b><br>%{x}: %{y:,.1f}%<extra></extra>" },
    { type: "bar", x: years, y: share(rev.ppa),   name: "PPA",       marker: { color: PC.ppa },
      hovertemplate: "<b>PPA</b><br>%{x}: %{y:,.1f}%<extra></extra>" },
    { type: "bar", x: years, y: share(rev.fuel),  name: "Fuel",      marker: { color: PC.fuel },
      hovertemplate: "<b>Fuel</b><br>%{x}: %{y:,.1f}%<extra></extra>" },
    { type: "bar", x: years, y: share(rev.other), name: "Other",     marker: { color: PC.other },
      hovertemplate: "<b>Other</b><br>%{x}: %{y:,.1f}%<extra></extra>" },
  ];

  Plotly.newPlot("chart-mix", mixTraces, {
    ...commonLayout,
    barmode: "stack",
    xaxis: { tickmode: "linear", dtick: 1, gridcolor: C.line, linecolor: C.line },
    yaxis: {
      title: { text: "Share of gross billings (abs-value basis)", font: { size: 12 } },
      gridcolor: C.line,
      linecolor: C.line,
      ticksuffix: "%",
      range: [0, 100],
    },
    margin: { l: 70, r: 40, t: 20, b: 80 },
  }, window.PlotlyTheme.plotCfg);

  /* ============================================================
     Panel 4: Data Table
  ============================================================ */
  const tbody = document.getElementById("rev-tbody");
  const fmtM = v => v == null ? "—" : (v < 0 ? "(" : "") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + (v < 0 ? ")" : "");
  const fmtPct = v => v == null ? "—" : (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
  const cls = v => v == null ? "" : (v < 0 ? "neg" : "pos");

  // Build the table rows
  DATA.forEach(d => {
    const tRev = d.rev.eq + d.rev.sv + d.rev.ppa + d.rev.fuel + d.rev.other;
    const tCogs = d.cogs.eq + d.cogs.sv + d.cogs.svLoss + d.cogs.ppa + d.cogs.fuel + d.cogs.other;
    const gp = tRev - tCogs;
    const gmPct = tRev === 0 ? null : (gp / Math.abs(tRev)) * 100;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="text-align:left; font-weight:600">${d.year}</td>
      <td class="c-num ${cls(d.rev.eq)}">${fmtM(toM(d.rev.eq))}</td>
      <td class="c-num ${cls(d.rev.sv)}">${fmtM(toM(d.rev.sv))}</td>
      <td class="c-num ${cls(d.rev.ppa)}">${fmtM(toM(d.rev.ppa))}</td>
      <td class="c-num ${cls(d.rev.fuel)}">${fmtM(toM(d.rev.fuel))}</td>
      <td class="c-num ${cls(d.rev.other)}">${fmtM(toM(d.rev.other))}</td>
      <td class="c-num ${cls(tRev)}" style="font-weight:700">${fmtM(toM(tRev))}</td>
      <td class="c-num">${fmtM(toM(tCogs))}</td>
      <td class="c-num ${cls(gp)}" style="font-weight:700">${fmtM(toM(gp))}</td>
      <td class="c-num ${cls(gmPct)}" style="font-weight:700">${fmtPct(gmPct)}</td>
    `;
    tbody.appendChild(tr);
  });

})();
