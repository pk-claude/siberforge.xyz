/* liquidity.js — Plug Power liquidity-options & dependency graph
   Data sourced from FY2025 10-K (filed 2026-03-02) and EDGAR XBRL companyfacts.
*/
(function () {
  "use strict";

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

  const SHARES_OUT = 1394.0; // million, as of Feb 17, 2026

  /* --------- Liquidity options data model --------- */
  const OPTIONS = [
    {
      id: "atm",
      name: "ATM Equity Program",
      type: "Equity",
      statusKey: "available", statusLabel: "Available",
      cap: 944.1,
      controller: "Plug",
      dilutive: true,
      interest: 0,
      horizon: "Months (drip)",
      primaryDep: "share_price",
      deps: ["Share price", "Auth headroom", "Daily trading volume"],
      body: "B. Riley + Yorkville agents. Plug directs sales into open market at prevailing prices. $55.9M used in FY25 at $1.62 avg. Terminates Aug 15, 2027.",
      scenarioType: "atm"
    },
    {
      id: "sepa",
      name: "SEPA (Yorkville Standby Equity)",
      type: "Equity",
      statusKey: "available", statusLabel: "Available",
      cap: 1000.0,
      controller: "Plug",
      dilutive: true,
      interest: 0,
      horizon: "Months (drip, $10M/day cap)",
      primaryDep: "share_price",
      deps: ["Share price", "Auth headroom", "$10M/day cap"],
      body: "Standby Equity Purchase Agreement with Yorkville. Plug has the right (not obligation) to direct Yorkville to buy up to $10M per trading day. Expires Feb 10, 2027. No shares sold in FY25.",
      scenarioType: "atm"
    },
    {
      id: "warr",
      name: "$7.75 Warrants",
      type: "Equity",
      statusKey: "contingent", statusLabel: "Holder-controlled",
      cap: 1437.1,  // 185.43M × $7.75
      controller: "Warrant holder",
      dilutive: true,
      interest: 0,
      horizon: "Feb 2026 – Mar 2028",
      primaryDep: "share_price_7_75",
      deps: ["Stock > $7.75", "Holder election", "No Change-of-Control"],
      body: "185,430,464 warrants @ $7.75 strike. Issued Oct 2025 as part of warrant-exercise inducement. Liability-classified ($52.3M fair value at FY25 end) due to Change-of-Control Cash Election under ASC 815. Exercisable Feb 28, 2026 through Mar 20, 2028.",
      scenarioType: "warrant", strike: 7.75, shares: 185.43
    },
    {
      id: "wny",
      name: "WNY Land Sale (Stream US Data Centers)",
      type: "Asset sale",
      statusKey: "committed", statusLabel: "Committed",
      cap: 137.25,  // midpoint
      controller: "Pending closing",
      dilutive: false,
      interest: 0,
      horizon: "By Jun 30, 2026",
      primaryDep: "closing",
      deps: ["Closing conditions", "Sphere removal"],
      body: "Definitive agreement Feb 24, 2026 to sell real property and assets in Alabama, NY (Genesee County). Purchase price range $132.5M–$142.0M depending on closing timing and whether hydrogen storage spheres are removed.",
      scenarioType: "none"
    },
    {
      id: "doe",
      name: "DOE Loan Guarantee",
      type: "Debt",
      statusKey: "suspended", statusLabel: "Suspended",
      cap: 1660.0,
      controller: "DOE + US admin policy",
      dilutive: false,
      interest: 0.05, // ~Treasury+ (estimated)
      horizon: "Uncertain",
      primaryDep: "federal_policy",
      deps: ["DOE reframe", "Federal clean-energy policy", "Project reallocation"],
      body: "Finalized Jan 16, 2025 for up to $1.66B via Federal Financing Bank. Plug suspended activities Nov 7, 2025 pending DOE discussions to reframe the scope. $13.2M capitalized fees charged off. Outcome uncertain.",
      scenarioType: "none"
    },
    {
      id: "sl",
      name: "Sale/Leaseback Financings",
      type: "Debt / hybrid",
      statusKey: "available", statusLabel: "Ongoing channel",
      cap: 200.0, // illustrative annual capacity
      controller: "Plug + financial institutions",
      dilutive: false,
      interest: 0.10, // blended cost
      horizon: "Transaction-by-transaction",
      primaryDep: "market_access",
      deps: ["Customer pipeline", "FI appetite", "Restricted cash build"],
      body: "Historic source of ~$200–400M per year. Each deal ties up restricted cash ($352.3M at FY25 end) and creates ongoing lease obligations. Net cash released depends on collateral haircut.",
      scenarioType: "none"
    },
    {
      id: "conv",
      name: "Additional Convertible Debt",
      type: "Debt",
      statusKey: "contingent", statusLabel: "Market-dependent",
      cap: 500.0, // illustrative
      controller: "Capital markets",
      dilutive: true,
      interest: 0.07,
      horizon: "3–6 months",
      primaryDep: "market_access",
      deps: ["Credit-market access", "Indenture covenants", "Dilution appetite"],
      body: "Nov 2025 precedent: issued $431.3M 6.75% notes due 2033 at ~3x book-runner coverage. Further capacity depends on Plug's ability to price attractively; each tranche adds interest expense and convert-dilution overhang.",
      scenarioType: "none"
    },
    {
      id: "wc",
      name: "Working-Capital Release",
      type: "Operating",
      statusKey: "internal", statusLabel: "Internal",
      cap: 150.0, // illustrative
      controller: "Plug operations",
      dilutive: false,
      interest: 0,
      horizon: "Quarters",
      primaryDep: "execution",
      deps: ["Inventory sell-through", "AR collection", "Demand"],
      body: "Inventory stands at $521.0M (199.8 DIO). Each 10% drawdown releases ~$52M of cash. DSO already compressed from 91 → 69 days in FY25. DIO reduction is the primary remaining lever.",
      scenarioType: "none"
    },
    {
      id: "opex",
      name: "Cost Reductions (Project Quantum Leap)",
      type: "Operating",
      statusKey: "internal", statusLabel: "In progress",
      cap: 100.0, // illustrative annualized
      controller: "Plug management",
      dilutive: false,
      interest: 0,
      horizon: "Quarters",
      primaryDep: "execution",
      deps: ["Workforce reductions", "Footprint realignment", "Vendor renegotiation"],
      body: "2025 Restructuring Plan announced March 2025. Completed during Q4 2025. Targets: workforce reduction, manufacturing footprint realignment, organizational streamlining. Preserves cash rather than generating it.",
      scenarioType: "none"
    }
  ];

  /* --------- Dependencies (shared constraints) --------- */
  const DEPS = [
    {
      id: "share_price",
      name: "Share price level",
      levers: ["ATM", "SEPA", "$7.75 Warrants", "Additional converts"],
      atRisk: 944.1 + 1000 + 1437.1 + 500, // if low
      statusKey: "yellow", statusLabel: "At risk at <$2",
      note: "Drives ATM/SEPA proceeds per share and determines whether $7.75 Warrants are in-the-money. Sub-$2 share price caps all four."
    },
    {
      id: "auth_headroom",
      name: "Authorized-share headroom",
      levers: ["ATM", "SEPA", "$7.75 Warrants", "Convertible-note conversion"],
      atRisk: 944.1 + 1000 + 1437.1 + 431.0,
      statusKey: "green", statusLabel: "1.6B unissued",
      note: "Shareholders doubled authorization to 3.0B on Feb 12, 2026. 1,394M issued leaves ~1,606M unissued, enough to cover ATM+SEPA+Warrants at current prices."
    },
    {
      id: "federal_policy",
      name: "DOE / federal energy policy",
      levers: ["DOE Loan"],
      atRisk: 1660.0,
      statusKey: "red", statusLabel: "Suspended",
      note: "Activities suspended Nov 2025 pending discussions to reframe scope under new administration priorities. Outcome uncertain."
    },
    {
      id: "market_access",
      name: "Credit / capital market access",
      levers: ["Additional converts", "Sale/leaseback"],
      atRisk: 500 + 200,
      statusKey: "green", statusLabel: "Open (Nov 2025 precedent)",
      note: "$431M Nov 2025 convertible successfully placed. Credit-market access remains available but each raise adds leverage and interest cost."
    },
    {
      id: "counterparty",
      name: "Counterparty / holder decision",
      levers: ["$7.75 Warrants", "WNY Sale"],
      atRisk: 1437.1 + 137.25,
      statusKey: "yellow", statusLabel: "Holder-controlled",
      note: "Warrant exercise is at holder discretion (Plug cannot compel). WNY sale depends on closing conditions and sphere removal."
    },
    {
      id: "execution",
      name: "Internal operational execution",
      levers: ["Working-capital release", "Cost reductions"],
      atRisk: 150 + 100,
      statusKey: "green", statusLabel: "In-flight",
      note: "Project Quantum Leap completed Q4 2025. DIO/DSO already improving. Further inventory drawdown and demand-linked."
    }
  ];

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
    paper_bgcolor: C.panel,
    plot_bgcolor: C.panel,
    font: { family: "Inter, system-ui, sans-serif", size: 12, color: C.text },
    margin: { l: 12, r: 12, t: 10, b: 10 },
    hoverlabel: { bgcolor: "#1e293b", font: { color: "#f8fafc" } }
  }, { displayModeBar: false, responsive: true });

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
