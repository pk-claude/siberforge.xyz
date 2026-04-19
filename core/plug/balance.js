/* balance.js — Plug Power balance-sheet health view
   All figures in US$ millions unless noted.
   Source: FY2025 10-K (filed 2026-03-02), EDGAR XBRL companyfacts.
*/

(function () {
  "use strict";

  /* ---- shared Plotly defaults (from /core/lib/plotly-theme.js) ---- */
  const theme = window.PlotlyTheme.init();
  const P = theme.C;
  const baseLayout = theme.baseLayout;
  const plotCfg = theme.plotCfg;

  // Local semantic aliases keyed to legacy variable names in this file.
  const C = {
    text: P.text, muted: P.muted, line: P.line, panel: P.panel,
    blue:   P.cfo,        orange: P.cfi,       purple: P.cff,
    red:    P.fcf,        black:  P.capex,     amber:  P.cashTotal,
    cyan:   P.cashBasic,  green:  P.green,
  };

  // Data loaded from ./data/balance-data.js (see <script> tag in balance.html).
  const D = window.PLUG_BALANCE_DATA;

  /* ---------- PANEL 1: CASH COMPOSITION DONUT ---------- */
  // Color mapping lives here (display concern), not in the data file.
  const SLICE_COLORS = [C.cyan, C.orange, C.purple, C.amber];
  const cashSlices = D.cashSlices.map((s, i) => ({ ...s, color: SLICE_COLORS[i] }));
  Plotly.newPlot("chart-cash", [{
    type: "pie", hole: 0.55,
    labels: cashSlices.map(s => s.label),
    values: cashSlices.map(s => s.val),
    marker: { colors: cashSlices.map(s => s.color), line: { color: C.panel, width: 2 } },
    textinfo: "percent",
    texttemplate: "%{percent:.0%}",
    hovertemplate: "<b>%{label}</b><br>$%{value:.1f}M<br>%{percent:.1%}<extra></extra>",
    sort: false,
  }], {
    ...baseLayout,
    margin: { l: 10, r: 10, t: 10, b: 10 },
    showlegend: true,
    legend: { orientation: "v", y: 0.5, x: 1.02, bgcolor: "rgba(0,0,0,0)", font: { size: 11.5, color: C.text } },
    annotations: [{
      text: "<b>" + D.cashTotalLabel + "</b><br><span style='font-size:10.5px;color:" + C.muted + "'>TOTAL CASH</span>",
      showarrow: false, x: 0.5, y: 0.5, xref: "paper", yref: "paper",
      font: { size: 16, color: C.text },
    }],
  }, plotCfg);

  /* ---------- PANEL 1b: TOTAL CASH HISTORY ---------- */
  const cashHist = D.cashHist;
  Plotly.newPlot("chart-cash-history", [
    { type: "bar", name: "Unrestricted", x: cashHist.map(r => r.y), y: cashHist.map(r => r.unrestricted),
      marker: { color: C.cyan },
      hovertemplate: "FY%{x}<br>Unrestricted: $%{y:,.0f}M<extra></extra>" },
    { type: "bar", name: "Restricted",  x: cashHist.map(r => r.y), y: cashHist.map(r => r.restricted),
      marker: { color: C.orange },
      hovertemplate: "FY%{x}<br>Restricted: $%{y:,.0f}M<extra></extra>" },
  ], {
    ...baseLayout,
    barmode: "stack",
    xaxis: { ...baseLayout.xaxis, tickvals: cashHist.map(r => r.y), type: "category" },
    yaxis: { ...baseLayout.yaxis, title: { text: "US$ millions", font: { color: C.muted, size: 11 } }, ticksuffix: "" },
  }, plotCfg);

  /* ---------- PANEL 2: DEBT MATURITY LADDER ---------- */
  const { years, opLease, finLease, finObl, ltDebt, convNotes } = D.maturity;

  Plotly.newPlot("chart-debt", [
    { type: "bar", name: "Operating lease",       x: years, y: opLease,   marker: { color: C.orange },
      hovertemplate: "%{x}<br>Operating lease: $%{y:,.1f}M<extra></extra>" },
    { type: "bar", name: "Finance lease",         x: years, y: finLease,  marker: { color: C.amber },
      hovertemplate: "%{x}<br>Finance lease: $%{y:,.1f}M<extra></extra>" },
    { type: "bar", name: "Finance obligations",   x: years, y: finObl,    marker: { color: C.purple },
      hovertemplate: "%{x}<br>Finance obligations: $%{y:,.1f}M<extra></extra>" },
    { type: "bar", name: "Long-term debt",        x: years, y: ltDebt,    marker: { color: C.black },
      hovertemplate: "%{x}<br>Long-term debt: $%{y:,.1f}M<extra></extra>" },
    { type: "bar", name: "Convertible notes (principal)", x: years, y: convNotes, marker: { color: C.red },
      hovertemplate: "%{x}<br>Convertible notes: $%{y:,.1f}M<extra></extra>" },
  ], {
    ...baseLayout,
    barmode: "stack",
    xaxis: { ...baseLayout.xaxis, title: { text: "Maturity year (undiscounted lease payments; principal for debt)", font: { color: C.muted, size: 11 } }, type: "category" },
    yaxis: { ...baseLayout.yaxis, title: { text: "US$ millions", font: { color: C.muted, size: 11 } } },
    legend: { ...baseLayout.legend, y: -0.22 },
  }, plotCfg);

  /* ---------- PANEL 3: WORKING CAPITAL TURNS ---------- */
  const { years: wcYears, dso, dio, dpo, ccc } = D.workingCapital;

  Plotly.newPlot("chart-wcturns", [
    { type: "bar", name: "DSO (days)",    x: wcYears, y: dso,
      marker: { color: C.blue },
      hovertemplate: "%{x}<br>DSO: %{y:.0f} days<extra></extra>" },
    { type: "bar", name: "DIO (days)",    x: wcYears, y: dio,
      marker: { color: C.orange },
      hovertemplate: "%{x}<br>DIO: %{y:.0f} days<extra></extra>" },
    { type: "bar", name: "DPO (days)",    x: wcYears, y: dpo,
      marker: { color: C.purple },
      hovertemplate: "%{x}<br>DPO: %{y:.0f} days<extra></extra>" },
    { type: "scatter", name: "CCC", mode: "lines+markers", x: wcYears, y: ccc, yaxis: "y2",
      line: { color: C.red, width: 3 }, marker: { size: 9, color: C.red },
      hovertemplate: "%{x}<br>Cash Conv Cycle: %{y:.0f} days<extra></extra>" },
  ], {
    ...baseLayout,
    barmode: "group",
    xaxis: { ...baseLayout.xaxis, type: "category" },
    yaxis: { ...baseLayout.yaxis, title: { text: "Days (DSO/DIO/DPO)", font: { color: C.muted, size: 11 } } },
    yaxis2: {
      overlaying: "y", side: "right",
      title: { text: "Cash conversion cycle (days)", font: { color: C.red, size: 11 } },
      tickfont: { color: C.red },
      gridcolor: "transparent", zerolinecolor: "transparent",
      range: [0, 320],
    },
    legend: { ...baseLayout.legend, y: -0.22 },
  }, plotCfg);

  /* Build the WC table */
  const wcRows = [
    { name: "DSO — Days Sales Outstanding",     vals: dso, fmt: "days" },
    { name: "DIO — Days Inventory Outstanding", vals: dio, fmt: "days" },
    { name: "DPO — Days Payables Outstanding",  vals: dpo, fmt: "days" },
    { name: "CCC — Cash Conversion Cycle",      vals: ccc, fmt: "days", bold: true },
  ];
  const tbody = document.getElementById("wc-tbody");
  wcRows.forEach(r => {
    const tr = document.createElement("tr");
    const delta = r.vals[3] - r.vals[2];
    const deltaCls = (r.name.startsWith("DSO") || r.name.startsWith("DIO") || r.name.startsWith("CCC"))
      ? (delta < 0 ? "pos" : (delta > 0 ? "neg" : "zer"))
      : (delta > 0 ? "pos" : (delta < 0 ? "neg" : "zer")); // higher DPO = better
    const sign = delta > 0 ? "+" : "";
    tr.innerHTML = `
      <td style="text-align:left;${r.bold?'font-weight:600;':''}">${r.name}</td>
      <td>${r.vals[0].toFixed(0)}</td>
      <td>${r.vals[1].toFixed(0)}</td>
      <td>${r.vals[2].toFixed(0)}</td>
      <td style="${r.bold?'font-weight:600;':''}">${r.vals[3].toFixed(0)}</td>
      <td class="${deltaCls}">${sign}${delta.toFixed(0)}</td>
    `;
    tbody.appendChild(tr);
  });

  /* ---------- PANEL 4a: SHARES ISSUED HISTORY ---------- */
  const shareHist = D.shareHist;
  Plotly.newPlot("chart-shares", [{
    type: "bar",
    x: shareHist.map(r => r.y),
    y: shareHist.map(r => r.shares),
    marker: { color: C.orange, line: { color: C.amber, width: 1 } },
    text: shareHist.map(r => r.shares.toFixed(0) + "M"),
    textposition: "outside",
    hovertemplate: "FY%{x}<br>Shares issued: %{y:,.1f}M<extra></extra>",
  }], {
    ...baseLayout,
    xaxis: { ...baseLayout.xaxis, type: "category", tickvals: shareHist.map(r => r.y) },
    yaxis: { ...baseLayout.yaxis, title: { text: "Common shares (millions)", font: { color: C.muted, size: 11 } }, range: [0, 1600] },
    showlegend: false,
  }, plotCfg);

  /* ---------- PANEL 4b: AUTHORIZED HEADROOM & EQUITY CAPACITY ---------- */
  // Issued / Authorized headroom (3.0B total) stacked horizontally
  // + existing equity program capacities.
  const H = D.headroom;
  const barCategory = ["Share<br>authorization", "Potential<br>share increases"];
  Plotly.newPlot("chart-headroom", [
    { type: "bar", orientation: "h", name: "Issued (Feb 2026)",
      x: [H.issued, null], y: barCategory, marker: { color: C.black },
      hovertemplate: "Issued: %{x:,.0f}M shares<extra></extra>" },
    { type: "bar", orientation: "h", name: "Authorized but unissued",
      x: [H.unissued, null], y: barCategory, marker: { color: C.line },
      hovertemplate: "Unissued authorized: %{x:,.0f}M shares<extra></extra>" },
    { type: "bar", orientation: "h", name: "$7.75 Warrants",
      x: [null, H.warrants775], y: barCategory, marker: { color: C.red },
      hovertemplate: "$7.75 Warrants: %{x:,.0f}M shares<br>(strike $7.75, exp 2028)<extra></extra>" },
    { type: "bar", orientation: "h", name: "ATM remaining ($944M)",
      x: [null, H.atmShares], y: barCategory, marker: { color: C.purple },
      hovertemplate: "ATM: ~%{x:,.0f}M shares at $1.62<br>(i.e., FY25 avg sale price)<extra></extra>" },
    { type: "bar", orientation: "h", name: "SEPA ($1.0B)",
      x: [null, H.sepaShares], y: barCategory, marker: { color: C.orange },
      hovertemplate: "SEPA: ~%{x:,.0f}M shares at $1.62<extra></extra>" },
  ], {
    ...baseLayout,
    barmode: "stack",
    xaxis: { ...baseLayout.xaxis, title: { text: "Common shares (millions)", font: { color: C.muted, size: 11 } } },
    yaxis: { ...baseLayout.yaxis, automargin: true },
    legend: { ...baseLayout.legend, y: -0.30 },
    margin: { l: 110, r: 18, t: 10, b: 70 },
  }, plotCfg);

})();
