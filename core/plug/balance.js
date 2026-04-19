/* balance.js — Plug Power balance-sheet health view
   All figures in US$ millions unless noted.
   Source: FY2025 10-K (filed 2026-03-02), EDGAR XBRL companyfacts.
*/

(function () {
  "use strict";

  /* ---- shared Plotly defaults ---- */
  const CSS = getComputedStyle(document.documentElement);
  const C = {
    text:  CSS.getPropertyValue("--text").trim()  || "#0f172a",
    muted: CSS.getPropertyValue("--muted").trim() || "#64748b",
    line:  CSS.getPropertyValue("--line").trim()  || "#e2e6ec",
    panel: CSS.getPropertyValue("--panel").trim() || "#ffffff",
    blue:  CSS.getPropertyValue("--cat-cfo").trim()   || "#1d4ed8",
    orange:CSS.getPropertyValue("--cat-cfi").trim()   || "#c47f00",
    purple:CSS.getPropertyValue("--cat-cff").trim()   || "#7c3aed",
    red:   CSS.getPropertyValue("--cat-fcf").trim()   || "#dc2626",
    black: CSS.getPropertyValue("--cat-capex").trim() || "#0f172a",
    amber: CSS.getPropertyValue("--cat-cash-total").trim() || "#d97706",
    cyan:  CSS.getPropertyValue("--cat-cash-basic").trim() || "#0891b2",
    green: CSS.getPropertyValue("--green").trim() || "#16a34a",
  };

  const baseLayout = {
    paper_bgcolor: C.panel,
    plot_bgcolor:  C.panel,
    font: { family: "Inter, system-ui, sans-serif", size: 12.5, color: C.text },
    margin: { l: 56, r: 18, t: 10, b: 48 },
    xaxis: { gridcolor: C.line, zerolinecolor: C.line, tickfont: { color: C.muted } },
    yaxis: { gridcolor: C.line, zerolinecolor: C.line, tickfont: { color: C.muted } },
    legend: { orientation: "h", y: -0.18, x: 0, bgcolor: "rgba(0,0,0,0)", font: { color: C.text } },
    hoverlabel: { bgcolor: "#1e293b", font: { color: "#f8fafc" } },
  };

  const plotCfg = { displayModeBar: false, responsive: true };

  /* ---------- PANEL 1: CASH COMPOSITION DONUT ---------- */
  const cashSlices = [
    { label: "Unrestricted cash & equivalents", val: 368.5, color: C.cyan },
    { label: "Restricted — sale/leaseback collateral", val: 352.3, color: C.orange },
    { label: "Restricted — LC / bank guarantees", val: 193.1, color: C.purple },
    { label: "Restricted — construction escrow", val:  80.0, color: C.amber },
  ];
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
      text: "<b>$994.0M</b><br><span style='font-size:10.5px;color:" + C.muted + "'>TOTAL CASH</span>",
      showarrow: false, x: 0.5, y: 0.5, xref: "paper", yref: "paper",
      font: { size: 16, color: C.text },
    }],
  }, plotCfg);

  /* ---------- PANEL 1b: TOTAL CASH HISTORY ---------- */
  const cashHist = [
    { y: 2021, unrestricted: 2481.3, restricted: 650.9 },
    { y: 2022, unrestricted:  690.6, restricted: 858.7 },
    { y: 2023, unrestricted:  135.0, restricted:1034.1 },
    { y: 2024, unrestricted:  205.7, restricted: 835.0 },
    { y: 2025, unrestricted:  368.5, restricted: 625.4 },
  ];
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
  /* Columns: 2026, 2027, 2028, 2029, 2030, thereafter (2031+)
     Buckets (in $M):
       Operating lease   : 94.4, 79.1, 56.1, 32.3, 14.3, 128.9 (undiscounted)
       Finance lease     : 12.6,  9.1,  2.8,  1.3,  1.3,   7.4
       Finance obligations (sale/leaseback): 76.2 current, remaining 191.8 beyond
         — split estimate: assume balance of 191.8 evenly over 2027-2029 ($63.9M each) since 10-K classifies in aggregate
       Long-term debt    : 0.6 current, 1.3 beyond (assume 2027)
       6.75% Conv. Notes (2033) : 431.3 — put in "2030+ (through 2033)" bucket
       7.00% Conv. Notes (2026) : 2.6 — in 2026
  */
  const years = ["2026", "2027", "2028", "2029", "2030", "2031+"];
  const opLease   = [94.4, 79.1, 56.1, 32.3, 14.3, 128.9];
  const finLease  = [12.6,  9.1,  2.8,  1.3,  1.3,   7.4];
  // Finance obligations: $76.2M current, $191.8M beyond. Spread beyond evenly 2027-2029.
  const finObl    = [76.2, 63.9, 63.9, 63.9,  0.0,   0.0];
  const ltDebt    = [ 0.6,  1.3,  0.0,  0.0,  0.0,   0.0];
  const convNotes = [ 2.6,  0.0,  0.0,  0.0,  0.0, 431.3];

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
  /* Formulas:
       DSO = AR / Revenue * 365
       DIO = Inventory / COGS * 365
       DPO = AP / COGS * 365
       CCC = DSO + DIO - DPO
     Values computed from FY annual data (10-Ks).
  */
  const wcYears = ["FY2022", "FY2023", "FY2024", "FY2025"];
  const dso = [67.4, 99.9, 91.3, 69.3];
  const dio = [263.1, 250.8, 198.8, 199.8];
  const dpo = [78.2, 67.3, 52.7, 64.7];
  const ccc = [252.3, 283.4, 237.4, 204.4];

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
  const shareHist = [
    { y: 2019, shares:  318.6 },
    { y: 2020, shares:  474.0 },
    { y: 2021, shares:  594.7 },
    { y: 2022, shares:  608.4 },
    { y: 2023, shares:  625.3 },
    { y: 2024, shares:  934.1 },
    { y: 2025, shares: 1394.2 },
  ];
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
  // Issued (1,394M) / Authorized headroom (1,606M = 3,000 - 1,394) stacked horizontally
  // + existing equity program capacities
  const barCategory = ["Share<br>authorization", "Potential<br>share increases"];
  Plotly.newPlot("chart-headroom", [
    { type: "bar", orientation: "h", name: "Issued (Feb 2026)",
      x: [1394, null], y: barCategory, marker: { color: C.black },
      hovertemplate: "Issued: %{x:,.0f}M shares<extra></extra>" },
    { type: "bar", orientation: "h", name: "Authorized but unissued",
      x: [1606, null], y: barCategory, marker: { color: C.line },
      hovertemplate: "Unissued authorized: %{x:,.0f}M shares<extra></extra>" },
    { type: "bar", orientation: "h", name: "$7.75 Warrants",
      x: [null, 185], y: barCategory, marker: { color: C.red },
      hovertemplate: "$7.75 Warrants: %{x:,.0f}M shares<br>(strike $7.75, exp 2028)<extra></extra>" },
    { type: "bar", orientation: "h", name: "ATM remaining ($944M)",
      x: [null, 583], y: barCategory, marker: { color: C.purple },
      hovertemplate: "ATM: ~%{x:,.0f}M shares at $1.62<br>(i.e., FY25 avg sale price)<extra></extra>" },
    { type: "bar", orientation: "h", name: "SEPA ($1.0B)",
      x: [null, 617], y: barCategory, marker: { color: C.orange },
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
