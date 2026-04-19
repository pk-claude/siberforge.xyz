/* liquidity.js — Plug Power liquidity-options & dependency graph
   Data sourced from FY2025 10-K (filed 2026-03-02) and EDGAR XBRL companyfacts.
*/
(function () {
  "use strict";

  /* ---- shared Plotly defaults (from /core/lib/plotly-theme.js) ---- */
  const P = window.PlotlyTheme.readPalette();

  // Local semantic aliases keyed to legacy variable names in this file.
  const C = {
    text: P.text, muted: P.muted, line: P.line, panel: P.panel,
    blue:   P.cfo,        orange: P.cfi,       purple: P.cff,
    red:    P.fcf,        black:  P.capex,     amber:  P.cashTotal,
    cyan:   P.cashBasic,  green:  P.green,
  };

  const SHARES_OUT = window.PLUG_LIQUIDITY_SHARES_OUT;

  /* --------- Liquidity options data model --------- */
  // Data loaded from ./data/liquidity-data.js
  const OPTIONS = window.PLUG_LIQUIDITY_OPTIONS;

  /* --------- Dependencies (shared constraints) --------- */
  const DEPS    = window.PLUG_LIQUIDITY_DEPS;

  /* ============================================================
     PANEL 3 — Options detail cards
     ============================================================ */
  const optGrid = document.getElementById("opt-grid");
  OPTIONS.forEach(o => {
    const card = document.createElement("div");
    card.className = "opt-card status-" + o.statusKey;
    const interestStr = o.interest > 0 ? (o.interest*100).toFixed(1) + "% interest" : "no interest";
    const dilutStr = o.dilutive ? "dilutive" : "non-dilutive";
    card.innerHTML = `
      <div class="opt-head">
        <div>
          <div class="opt-name">${o.name}</div>
          <span class="opt-status">${o.statusLabel}</span>
        </div>
        <div class="opt-cap">$${formatCap(o.cap)}</div>
      </div>
      <div class="opt-meta">
        <div><span class="meta-lbl">Type</span><span class="meta-val">${o.type}</span></div>
        <div><span class="meta-lbl">Controller</span><span class="meta-val">${o.controller}</span></div>
        <div><span class="meta-lbl">Horizon</span><span class="meta-val">${o.horizon}</span></div>
        <div><span class="meta-lbl">Cost</span><span class="meta-val">${dilutStr}, ${interestStr}</span></div>
      </div>
      <div class="opt-deps">
        ${o.deps.map(d => `<span class="dep-chip">${d}</span>`).join("")}
      </div>
      <div class="opt-body">${o.body}</div>
    `;
    optGrid.appendChild(card);
  });

  function formatCap(v) {
    if (v >= 1000) return (v/1000).toFixed(2) + "B";
    return v.toFixed(1) + "M";
  }

  /* ============================================================
     PANEL 2 — Scenario model
     ============================================================ */
  const priceInput = document.getElementById("scn-price");
  const priceVal = document.getElementById("scn-price-val");
  const scnTBody = document.getElementById("scn-tbody");
  const scnCash = document.getElementById("scn-total-cash");
  const scnShares = document.getElementById("scn-total-shares");
  const scnDilut = document.getElementById("scn-total-dilut");

  document.querySelectorAll(".scn-presets button").forEach(btn => {
    btn.addEventListener("click", () => {
      priceInput.value = btn.dataset.p;
      renderScenario();
    });
  });
  priceInput.addEventListener("input", renderScenario);

  function renderScenario() {
    const price = parseFloat(priceInput.value);
    priceVal.textContent = "$" + price.toFixed(2);

    let rows = [];
    let totalCash = 0, totalShares = 0;

    OPTIONS.filter(o => o.scenarioType === "atm").forEach(o => {
      // ATM/SEPA: proceeds capped at o.cap; shares = cap/price
      const proceeds = o.cap;
      const shares = proceeds / price; // millions
      totalCash += proceeds;
      totalShares += shares;
      rows.push({
        name: o.name,
        cap: "$" + formatCap(o.cap),
        gate: "Sells at market price (here $" + price.toFixed(2) + ")",
        proceeds: "$" + formatCap(proceeds),
        shares: shares.toFixed(1) + "M",
        active: true
      });
    });

    OPTIONS.filter(o => o.scenarioType === "warrant").forEach(o => {
      const itm = price >= o.strike;
      const proceeds = itm ? (o.shares * o.strike) : 0;
      const shares = itm ? o.shares : 0;
      if (itm) { totalCash += proceeds; totalShares += shares; }
      rows.push({
        name: o.name,
        cap: o.shares.toFixed(1) + "M @ $" + o.strike.toFixed(2),
        gate: itm ? "In-the-money — rational exercise" : "Out-of-the-money at $" + price.toFixed(2),
        proceeds: itm ? "$" + formatCap(proceeds) : "$0",
        shares: itm ? shares.toFixed(1) + "M" : "—",
        active: itm
      });
    });

    scnTBody.innerHTML = "";
    rows.forEach(r => {
      const tr = document.createElement("tr");
      tr.style.opacity = r.active ? 1 : 0.55;
      tr.innerHTML = `
        <td>${r.name}</td>
        <td class="dval">${r.cap}</td>
        <td>${r.gate}</td>
        <td class="dval" style="font-weight:600">${r.proceeds}</td>
        <td class="dval">${r.shares}</td>
      `;
      scnTBody.appendChild(tr);
    });

    scnCash.textContent = "$" + formatCap(totalCash);
    scnShares.textContent = totalShares.toFixed(0) + "M";
    scnDilut.textContent = ((totalShares / SHARES_OUT) * 100).toFixed(1) + "%";
  }
  renderScenario();

  /* ============================================================
     PANEL 4 — Sankey
     ============================================================ */
  /* Nodes: options (left) -> primary dep (middle) -> controllability tier (right) */
  const depByOption = {
    atm: "Share price",
    sepa: "Share price",
    warr: "Share price + holder",
    wny: "Closing conditions",
    doe: "Federal policy",
    sl:  "Market access",
    conv:"Market access",
    wc:  "Internal execution",
    opex:"Internal execution"
  };
  const tierByDep = {
    "Share price": "Market-dependent",
    "Share price + holder": "Counterparty",
    "Closing conditions": "Counterparty",
    "Federal policy": "Policy",
    "Market access": "Market-dependent",
    "Internal execution": "Plug-controlled"
  };
  const tierColor = {
    "Plug-controlled": C.blue,
    "Market-dependent": C.orange,
    "Counterparty": C.amber,
    "Policy": C.red
  };

  // Build node list
  const nodeNames = [];
  const nodeColors = [];
  const nodeValues = {}; // name -> running $M total
  function idx(name, color) {
    let i = nodeNames.indexOf(name);
    if (i < 0) { nodeNames.push(name); nodeColors.push(color); i = nodeNames.length - 1; }
    return i;
  }
  OPTIONS.forEach(o => { idx(o.name, C.black); nodeValues[o.name] = o.cap; });
  Object.values(depByOption).forEach(d => { idx(d, C.muted); if (!(d in nodeValues)) nodeValues[d] = 0; });
  Object.values(tierByDep).forEach(t => { idx(t, tierColor[t] || C.muted); if (!(t in nodeValues)) nodeValues[t] = 0; });

  const src = [], tgt = [], val = [], lbl = [];
  OPTIONS.forEach(o => {
    const dep = depByOption[o.id];
    const tier = tierByDep[dep];
    src.push(idx(o.name, C.black));
    tgt.push(idx(dep, C.muted));
    val.push(o.cap);
    lbl.push(`${o.name} → ${dep}`);
    src.push(idx(dep, C.muted));
    tgt.push(idx(tier, tierColor[tier]));
    val.push(o.cap);
    lbl.push(`${dep} → ${tier}`);
    nodeValues[dep]  = (nodeValues[dep]  || 0) + o.cap;
    nodeValues[tier] = (nodeValues[tier] || 0) + o.cap;
  });

  // Helper: format $M with thousands-separator and no decimals
  const fmtM = v => "$" + Math.round(v).toLocaleString("en-US") + "M";

  // Append $M totals to every node label
  const nodeLabels = nodeNames.map(n => `${n}  ${fmtM(nodeValues[n] || 0)}`);

  Plotly.newPlot("chart-sankey", [{
    type: "sankey",
    orientation: "h",
    arrangement: "snap",
    valueformat: ",.0f",
    valuesuffix: "M",
    node: {
      pad: 14,
      thickness: 18,
      line: { color: C.line, width: 0.5 },
      label: nodeLabels,
      color: nodeColors,
      hovertemplate: "%{label}<extra></extra>"
    },
    link: {
      source: src, target: tgt, value: val, label: lbl,
      color: "rgba(100, 116, 139, 0.25)",
      hovertemplate: "%{label}<br>$%{value:,.0f}M<extra></extra>"
    }
  }], {
    ...window.PlotlyTheme.baseLayout(P),
    margin: { l: 12, r: 12, t: 10, b: 10 },
  }, window.PlotlyTheme.plotCfg);

  /* ============================================================
     PANEL 5 — Shared dependency table
     ============================================================ */
  const depTBody = document.getElementById("dep-tbody");
  DEPS.forEach(d => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="text-align:left; font-weight:600">${d.name}<br><span style="color:var(--muted); font-weight:400; font-size:11.5px">${d.note}</span></td>
      <td class="dep-levers">${d.levers.join(" · ")}</td>
      <td class="dep-cap">$${formatCap(d.atRisk)}</td>
      <td><span class="status-pill ${d.statusKey}">${d.statusLabel}</span></td>
    `;
    depTBody.appendChild(tr);
  });

})();
