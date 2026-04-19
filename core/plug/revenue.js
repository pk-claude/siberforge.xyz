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

  const CSS = getComputedStyle(document.documentElement);
  const C = {
    text:  CSS.getPropertyValue("--text").trim()  || "#0f172a",
    muted: CSS.getPropertyValue("--muted").trim() || "#64748b",
    line:  CSS.getPropertyValue("--line").trim()  || "#e2e6ec",
    panel: CSS.getPropertyValue("--panel").trim() || "#ffffff",
    green: CSS.getPropertyValue("--green").trim() || "#15803d",
    red:   CSS.getPropertyValue("--red").trim()   || "#b91c1c",
  };

  // Palette — softened / muted tones
  const PC = {
    eq:  "#7ba4cf",  // soft steel blue — equipment
    sv:  "#8cbfc7",  // soft teal — services
    ppa: "#e2b87f",  // soft amber — PPA
    fuel:"#b39ddb",  // soft lavender — fuel
    other:"#b0b7c0", // soft cool grey — other
    total:"#6b7280", // muted slate — total/net line
  };

  // Revenue and COGS data by year. Values in $ thousands.
  // Each row: rev.{eq, sv, ppa, fuel, other} and cogs.{eq, sv, svLoss, ppa, fuel, other}
  const DATA = [
    { year: 2015,
      rev:  { eq:  78002, sv: 14012, ppa:  5718, fuel:  5075, other:  481 },
      cogs: { eq:  67703, sv: 22937, svLoss: 10050, ppa:  5253, fuel:  6695, other:  540 } },
    { year: 2016,
      rev:  { eq:  39985, sv: 17347, ppa: 13687, fuel: 10916, other:  884 },
      cogs: { eq:  29543, sv: 19071, svLoss: -1071, ppa: 16601, fuel: 13864, other:  865 } },
    { year: 2017,
      rev:  { eq:  62631, sv: 16202, ppa: 12869, fuel:  8167, other:  284 },
      cogs: { eq:  54815, sv: 19814, svLoss:     0, ppa: 31292, fuel: 22013, other:  308 } },
    { year: 2018,
      rev:  { eq: 107175, sv: 22002, ppa: 22569, fuel: 22469, other:    0 },
      cogs: { eq:  85205, sv: 32271, svLoss:  5345, ppa: 41361, fuel: 36037, other:    0 } },
    { year: 2019,
      rev:  { eq: 149920, sv: 25217, ppa: 25553, fuel: 29099, other:  186 },
      cogs: { eq:  97915, sv: 34582, svLoss:  -394, ppa: 41777, fuel: 45247, other:  200 } },
    { year: 2020,
      rev:  { eq: -94295, sv: -9801, ppa: 26620, fuel:-16072, other:  311 },
      cogs: { eq: 171404, sv: 42524, svLoss: 35473, ppa: 64640, fuel: 61815, other:  323 } },
    { year: 2021,
      rev:  { eq: 392777, sv: 26706, ppa: 35153, fuel: 46917, other:  789 },
      cogs: { eq: 307157, sv: 63729, svLoss: 71988, ppa:102417, fuel:127196, other: 1165 } },
    { year: 2022,
      rev:  { eq: 558932, sv: 35280, ppa: 47183, fuel: 57196, other: 2849 },
      cogs: { eq: 468057, sv: 59365, svLoss: 26801, ppa:144696, fuel:194255, other: 2622 } },
    { year: 2023,
      rev:  { eq: 711433, sv: 39093, ppa: 63731, fuel: 66246, other:10837 },
      cogs: { eq: 765575, sv: 75412, svLoss: 86346, ppa:218936, fuel:246318, other: 6544 } },
    { year: 2024,
      rev:  { eq: 390335, sv: 52169, ppa: 77842, fuel: 97882, other:10586 },
      cogs: { eq: 696087, sv: 57766, svLoss: 48539, ppa:216947, fuel:228827, other: 5535 } },
    { year: 2025,
      rev:  { eq: 371081, sv: 94462, ppa:107572, fuel:133411, other: 3393 },
      cogs: { eq: 477741, sv: 70353, svLoss:-24607, ppa:178733, fuel:248061, other: 1678 } },
  ];

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

  // Common layout bits
  const commonLayout = {
    paper_bgcolor: C.panel,
    plot_bgcolor: C.panel,
    font: { family: "Inter, system-ui, sans-serif", size: 12, color: C.text },
    margin: { l: 70, r: 40, t: 20, b: 60 },
    hoverlabel: { bgcolor: "#475569", font: { color: "#f8fafc" } },
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
      zerolinecolor: "#94a3b8",
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
  }, { displayModeBar: false, responsive: true });

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
      zerolinecolor: "#94a3b8",
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
  }, { displayModeBar: false, responsive: true });

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
  }, { displayModeBar: false, responsive: true });

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
