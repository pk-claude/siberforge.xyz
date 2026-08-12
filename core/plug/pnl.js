/* pnl.js — Plug Power quarterly P&L turnaround view, Q1 2024 – Q2 2026.
   Data loaded from ./data/pnl-data.js ($ thousands; scaled to $M here).
   Chart configuration only — numbers live in the data file.
*/
(function () {
  "use strict";

  /* ---- shared Plotly defaults (from /core/lib/plotly-theme.js) ---- */
  const theme = window.PlotlyTheme.init();
  const P = theme.C;
  const baseLayout = theme.baseLayout;
  const plotCfg = theme.plotCfg;

  // Product-line palette — matches revenue.js so segment colors are
  // consistent across the annual and quarterly views.
  const PC = {
    eq:   "#7ba4cf",  // soft steel blue — equipment
    sv:   "#8cbfc7",  // soft teal — services
    ppa:  "#e2b87f",  // soft amber — PPA
    fuel: "#b39ddb",  // soft lavender — fuel
    other:"#b0b7c0",  // soft cool grey — other
    total:"#6b7280",  // muted slate — total line
  };

  const DATA = window.PLUG_PNL_DATA;
  const toM = v => v / 1000;
  const q = DATA.map(d => d.q);

  const rev = {
    eq:    DATA.map(d => toM(d.rev.eq)),
    sv:    DATA.map(d => toM(d.rev.sv)),
    ppa:   DATA.map(d => toM(d.rev.ppa)),
    fuel:  DATA.map(d => toM(d.rev.fuel)),
    other: DATA.map(d => toM(d.rev.other)),
    total: DATA.map(d => toM(d.rev.eq + d.rev.sv + d.rev.ppa + d.rev.fuel + d.rev.other)),
  };
  const cogsTotal = DATA.map(d =>
    toM(d.cogs.eq + d.cogs.sv + d.cogs.svLoss + d.cogs.ppa + d.cogs.fuel + d.cogs.other));
  const grossM = rev.total.map((r, i) => r - cogsTotal[i]);          // $M
  const gmPct  = rev.total.map((r, i) => (grossM[i] / r) * 100);     // %

  // Segment gross margins. Services shown EX loss-contract provision —
  // the provision/benefit line is a reserve true-up for future-period
  // contracts, and including it makes quarterly service margin swing
  // between -100% and +80% for reasons unrelated to unit economics.
  const gmSeg = {
    eq:   DATA.map(d => (d.rev.eq   - d.cogs.eq)   / d.rev.eq   * 100),
    sv:   DATA.map(d => (d.rev.sv   - d.cogs.sv)   / d.rev.sv   * 100),
    ppa:  DATA.map(d => (d.rev.ppa  - d.cogs.ppa)  / d.rev.ppa  * 100),
    fuel: DATA.map(d => (d.rev.fuel - d.cogs.fuel) / d.rev.fuel * 100),
  };

  const opex = {
    rd:    DATA.map(d => toM(d.opex.rd)),
    sga:   DATA.map(d => toM(d.opex.sga)),
    restr: DATA.map(d => toM(d.opex.restr)),
    impair:DATA.map(d => toM(d.opex.impair)),
    cc:    DATA.map(d => toM(d.opex.cc)),
    core:  DATA.map(d => toM(d.opex.rd + d.opex.sga + d.opex.restr)),
    total: DATA.map(d => toM(d.opex.rd + d.opex.sga + d.opex.restr + d.opex.impair + d.opex.cc)),
  };

  // Core operating loss = gross profit - R&D - SG&A (ex restructuring,
  // impairment, contingent-consideration FV). The recurring-cost view.
  const coreOpLoss = DATA.map((d, i) => grossM[i] - toM(d.opex.rd + d.opex.sga));
  const opLoss = DATA.map((d, i) => grossM[i] - opex.total[i]);
  const nlPlug = DATA.map(d => toM(d.nlPlug));

  /* ---------- CHART 1: Revenue by segment + total GM% ---------- */
  const segDefs = [
    ["eq",   "Equipment"], ["sv", "Services"], ["ppa", "PPA"],
    ["fuel", "Fuel"], ["other", "Other"],
  ];
  Plotly.newPlot("chart-pnl-rev",
    segDefs.map(([k, name]) => ({
      type: "bar", name, x: q, y: rev[k], marker: { color: PC[k] },
      hovertemplate: "%{x}<br>" + name + ": $%{y:,.1f}M<extra></extra>",
    })).concat([{
      type: "scatter", mode: "lines+markers", name: "Gross margin %", yaxis: "y2",
      x: q, y: gmPct, line: { color: P.fcf, width: 3 }, marker: { size: 7 },
      hovertemplate: "%{x}<br>Gross margin: %{y:.1f}%<extra></extra>",
    }]), {
    ...baseLayout,
    barmode: "stack",
    xaxis: { ...baseLayout.xaxis, type: "category" },
    yaxis: { ...baseLayout.yaxis, title: { text: "Revenue (US$ millions)", font: { color: P.muted, size: 11 } } },
    yaxis2: {
      overlaying: "y", side: "right", range: [-150, 25],
      title: { text: "Gross margin %", font: { color: P.fcf, size: 11 } },
      tickfont: { color: P.fcf }, ticksuffix: "%",
      gridcolor: "transparent", zerolinecolor: P.fcf, zerolinewidth: 1,
    },
    legend: { ...baseLayout.legend, y: -0.22 },
  }, plotCfg);

  /* ---------- CHART 2: Segment gross margins ---------- */
  const segGmDefs = [
    ["eq",   "Equipment"], ["sv", "Services (ex-provision)"],
    ["ppa",  "PPA"], ["fuel", "Fuel"],
  ];
  Plotly.newPlot("chart-pnl-gm",
    segGmDefs.map(([k, name]) => ({
      type: "scatter", mode: "lines+markers", name,
      x: q, y: gmSeg[k], line: { color: PC[k], width: 2.5 }, marker: { size: 6 },
      hovertemplate: "%{x}<br>" + name + ": %{y:.1f}%<extra></extra>",
    })), {
    ...baseLayout,
    xaxis: { ...baseLayout.xaxis, type: "category" },
    yaxis: { ...baseLayout.yaxis, title: { text: "Gross margin % by segment", font: { color: P.muted, size: 11 } }, ticksuffix: "%", zerolinecolor: P.muted, zerolinewidth: 1.5 },
    legend: { ...baseLayout.legend, y: -0.22 },
  }, plotCfg);

  /* ---------- CHART 3: Core operating expenses ---------- */
  Plotly.newPlot("chart-pnl-opex", [
    { type: "bar", name: "SG&A", x: q, y: opex.sga, marker: { color: P.cff },
      hovertemplate: "%{x}<br>SG&A: $%{y:,.1f}M<extra></extra>" },
    { type: "bar", name: "R&D", x: q, y: opex.rd, marker: { color: P.cfo },
      hovertemplate: "%{x}<br>R&D: $%{y:,.1f}M<extra></extra>" },
    { type: "bar", name: "Restructuring", x: q, y: opex.restr, marker: { color: P.cfi },
      hovertemplate: "%{x}<br>Restructuring: $%{y:,.1f}M<extra></extra>" },
  ], {
    ...baseLayout,
    barmode: "stack",
    xaxis: { ...baseLayout.xaxis, type: "category" },
    yaxis: { ...baseLayout.yaxis, title: { text: "Core opex (US$ millions)", font: { color: P.muted, size: 11 } } },
    legend: { ...baseLayout.legend, y: -0.22 },
  }, plotCfg);

  /* ---------- CHART 4: Core operating loss trend ---------- */
  Plotly.newPlot("chart-pnl-oploss", [
    { type: "bar", name: "Core operating loss (ex impairment / restructuring / CC)",
      x: q, y: coreOpLoss,
      marker: { color: coreOpLoss.map(v => v >= 0 ? P.green : P.fcf) },
      hovertemplate: "%{x}<br>Core operating loss: $%{y:,.1f}M<extra></extra>" },
  ], {
    ...baseLayout,
    xaxis: { ...baseLayout.xaxis, type: "category" },
    yaxis: { ...baseLayout.yaxis, title: { text: "US$ millions", font: { color: P.muted, size: 11 } }, zerolinecolor: P.text, zerolinewidth: 1.5 },
    showlegend: false,
    annotations: [{
      x: "Q2'26", y: 0, xref: "x", yref: "y",
      text: "Company target:<br>EBITDAS positive in Q4'26",
      showarrow: true, arrowhead: 2, ax: -10, ay: -60,
      font: { size: 11, color: P.text },
      bgcolor: P.panel, bordercolor: P.line, borderwidth: 1, borderpad: 4,
    }],
  }, plotCfg);

  /* ---------- Data table ---------- */
  const tbody = document.getElementById("pnl-tbody");
  const f1 = v => (v < 0 ? "(" + Math.abs(v).toFixed(1) + ")" : v.toFixed(1));
  DATA.forEach((d, i) => {
    const tr = document.createElement("tr");
    const impairRestr = toM(d.opex.impair + d.opex.restr + d.opex.cc);
    tr.innerHTML = `
      <td style="text-align:left; font-weight:600">${d.q}</td>
      <td>${f1(rev.total[i])}</td>
      <td class="${gmPct[i] >= 0 ? 'pos' : 'neg'}">${gmPct[i].toFixed(1)}%</td>
      <td>${f1(opex.core[i] - opex.restr[i])}</td>
      <td>${f1(impairRestr)}</td>
      <td>${f1(coreOpLoss[i])}</td>
      <td>${f1(opLoss[i])}</td>
      <td>${f1(nlPlug[i])}</td>
    `;
    tbody.appendChild(tr);
  });

})();
