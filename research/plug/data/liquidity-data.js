/* liquidity-data.js — Plug Power liquidity-options model.
   Sources:
     - FY2025 10-K (filed 2026-03-02) and EDGAR XBRL companyfacts (capital structure)
     - Q2 2026 10-Q (filed 2026-08-10): cash, warrant FV, ATM/SEPA status,
       restricted-cash detail, DOE termination (subsequent event Aug 4, 2026)
     - Q2 2026 press release (Aug 10, 2026) and Jul 13, 2026 Stream 8-K:
       Graham TX sale + New York Gateway staged closing; $275M monetization target.

   Exports three globals:
     window.PLUG_LIQUIDITY_SHARES_OUT  — common shares outstanding (millions).
     window.PLUG_LIQUIDITY_OPTIONS     — available/used/pending capital options.
     window.PLUG_LIQUIDITY_DEPS        — shared constraints across those options.
*/

window.PLUG_LIQUIDITY_SHARES_OUT = 1396.9;  // Jun 30, 2026: 1,397,924,047 issued – 1,025,649 treasury

/* --------- Liquidity options data model --------- */
window.PLUG_LIQUIDITY_OPTIONS = [
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
    body: "B. Riley + Yorkville agents. Plug directs sales into open market at prevailing prices. $55.9M used in FY25 at $1.62 avg; zero usage in H1 2026 — burn has been funded from cash and asset sales instead. Terminates Aug 15, 2027.",
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
    deps: ["Share price", "Auth headroom", "$10M/day cap", "Expires Feb 2027"],
    body: "Standby Equity Purchase Agreement with Yorkville. Plug has the right (not obligation) to direct Yorkville to buy up to $10M per trading day. No shares sold through Q2 2026. Expires Feb 10, 2027 — the clock is now inside 7 months, so unused capacity lapses first among the equity levers.",
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
    body: "185,430,464 warrants @ $7.75 strike. Issued Oct 2025 as part of warrant-exercise inducement. Liability-classified due to Change-of-Control Cash Election under ASC 815; fair value stepped up again from $107.0M (Mar 31) to $136.3M at Jun 30, 2026 (stock $2.71). Exercisable through Mar 20, 2028; no exercises through Q2 2026 — deep out-of-the-money at current prices.",
    scenarioType: "warrant", strike: 7.75, shares: 185.43
  },
  {
    id: "wny",
    name: "NY Gateway Staged Closing (Stream)",
    type: "Asset sale",
    statusKey: "committed", statusLabel: "Committed — staged",
    cap: 142.0,
    controller: "Pending closings",
    dilutive: false,
    interest: 0,
    horizon: "Staged, outside date Mar 31, 2027",
    primaryDep: "closing",
    deps: ["Interim & final closings", "Stream execution"],
    body: "Genesee County, NY plant sale to Stream US Data Centers (agreement Feb 24, 2026). The June 2026 single closing slipped; a Jul 9, 2026 amendment restructured it as a staged closing with the price fixed at $142.0M and the outside date moved to Mar 31, 2027. ~$6.5M deposit plus interest released to Plug in July; a further $10M deposits at the interim real-property closing. Amounts received credit against the price.",
    scenarioType: "none"
  },
  {
    id: "graham",
    name: "Graham TX Project Sale (Stream)",
    type: "Asset sale",
    statusKey: "committed", statusLabel: "Committed — $40M received",
    cap: 76.5,  // $50M base + up to $26.5M earnout
    controller: "Pending closing",
    dilutive: false,
    interest: 0,
    horizon: "Outside date Mar 31, 2027",
    primaryDep: "closing",
    deps: ["Final closing", "Earnout vs 164 MW reference"],
    body: "Sale of the never-built Graham, TX green-H2 project site to Stream US Data Centers (PSA Jul 2026): $50M base price plus an earnout up to $26.5M tied to a 164 MW reference capacity. High-voltage infrastructure closed Aug 7, 2026 for $40M — non-refundable, credited against the price; $10M more sits in deposit escrow. Part of the $275M data-center asset-monetization initiative (~$52M collected program-to-date through Aug 2026).",
    scenarioType: "none"
  },
  {
    id: "itc",
    name: "St. Gabriel ITC Sale",
    type: "Tax-credit monetization",
    statusKey: "committed", statusLabel: "Closed Q2 2026",
    cap: 39.2,
    controller: "Closed",
    dilutive: false,
    interest: 0,
    horizon: "Done",
    primaryDep: "closing",
    deps: ["Closed"],
    body: "Closed in Q2 2026: investment tax credit on the St. Gabriel, LA JV liquefier sold for $39.2M gross ($36.1M net of $3.1M fees, received in CFI). Caveat on the consolidated view: the Hidrogenii JV distributed $16.5M to each member, so Olin's Niloco took $16.5M out via financing activities — net new cash to Plug shareholders was roughly $20M, not $39M.",
    scenarioType: "none"
  },
  {
    id: "doe",
    name: "DOE Loan Guarantee",
    type: "Debt",
    statusKey: "suspended", statusLabel: "Terminated Aug 2026",
    cap: 0.0,
    controller: "None — terminated",
    dilutive: false,
    interest: 0,
    horizon: "Dead",
    primaryDep: "federal_policy",
    deps: ["Terminated by DOE"],
    body: "Finalized Jan 16, 2025 for up to $1.66B via Federal Financing Bank; Plug suspended activities Nov 7, 2025 and charged off $13.2M of fees. On Aug 4, 2026 DOE exercised its termination right because the first advance had not occurred by the longstop date — termination is automatic and self-executing after a 10-business-day notice period. The $1.66B is gone; the NY and TX sites it was to fund are being sold to Stream instead.",
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
    body: "Historic source of ~$200–400M per year. Each deal ties up restricted cash ($279.2M S/LB collateral at Jun 30, 2026 per the Q2 10-Q, down from $352.3M at FY25 end as leases run off) and creates ongoing lease obligations. Net cash released depends on collateral haircut.",
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
    body: "Nov 2025 precedent: issued $431.3M 6.75% notes due 2033 at ~3x book-runner coverage. Those notes are fair-value accounted and now carried at $578.0M — the $145M H1 2026 FV loss tracks the stock's rise, a reminder that convert capacity prices off equity upside. Further tranches add interest expense and convert-dilution overhang.",
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
    body: "Inventory $493.4M at Jun 30, 2026 (~204 DIO TTM) — down $27.5M from year-end but still the biggest trapped-cash pool; each 10% drawdown releases ~$49M. DSO re-widened to ~62 days (from 53 at Q1) as AR rebuilt with the revenue ramp. DIO reduction remains the primary lever.",
    scenarioType: "none"
  },
  {
    id: "opex",
    name: "Cost Reductions (Project Quantum Leap)",
    type: "Operating",
    statusKey: "internal", statusLabel: "Delivering",
    cap: 100.0, // illustrative annualized
    controller: "Plug management",
    dilutive: false,
    interest: 0,
    horizon: "Quarters",
    primaryDep: "execution",
    deps: ["Workforce reductions", "Footprint realignment", "Vendor renegotiation"],
    body: "2025 Restructuring Plan completed during Q4 2025. Now visible in the P&L: Q2 2026 opex of $62.4M vs $123.5M a year earlier (~50% lower, flattered by a $39.7M one-time recovery of previously impaired assets — underlying decline nearer 20%). Preserves cash rather than generating it.",
    scenarioType: "none"
  }
];

/* --------- Dependencies (shared constraints) --------- */
window.PLUG_LIQUIDITY_DEPS = [
  {
    id: "share_price",
    name: "Share price level",
    levers: ["ATM", "SEPA", "$7.75 Warrants", "Additional converts"],
    atRisk: 944.1 + 1000 + 1437.1 + 500, // if low
    statusKey: "yellow", statusLabel: "$2.71 at Jun 30",
    note: "Drives ATM/SEPA proceeds per share and determines whether $7.75 Warrants are in-the-money. At $2.71 the equity programs are usable (at ~2x the FY25 ATM price) but the warrants remain far out-of-the-money."
  },
  {
    id: "auth_headroom",
    name: "Authorized-share headroom",
    levers: ["ATM", "SEPA", "$7.75 Warrants", "Convertible-note conversion"],
    atRisk: 944.1 + 1000 + 1437.1 + 431.0,
    statusKey: "green", statusLabel: "1.6B unissued",
    note: "Shareholders doubled authorization to 3.0B on Feb 12, 2026. 1,397.9M issued at Jun 30, 2026 leaves ~1,602M unissued, enough to cover ATM+SEPA+Warrants at current prices."
  },
  {
    id: "federal_policy",
    name: "DOE / federal energy policy",
    levers: ["DOE Loan"],
    atRisk: 0.0,
    statusKey: "red", statusLabel: "Terminated",
    note: "Resolved against Plug: DOE exercised its termination right Aug 4, 2026 (first advance missed the longstop date). The $1.66B facility is dead and federal-policy risk no longer gates any live lever — the monetization pivot replaced it with counterparty risk on Stream."
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
    levers: ["$7.75 Warrants", "NY Gateway", "Graham TX"],
    atRisk: 1437.1 + 142.0 + 76.5,
    statusKey: "yellow", statusLabel: "Stream-dependent",
    note: "Warrant exercise is at holder discretion (Plug cannot compel). Both asset sales now depend on a single buyer — Stream US Data Centers — with outside dates of Mar 31, 2027. Mitigant: ~$46.5M received to date is non-refundable or released."
  },
  {
    id: "execution",
    name: "Internal operational execution",
    levers: ["Working-capital release", "Cost reductions"],
    atRisk: 150 + 100,
    statusKey: "green", statusLabel: "Delivering",
    note: "Quantum Leap savings visible in the P&L (Q2 opex ~50% lower YoY). Inventory down $27.5M since year-end; further release is demand-linked."
  }
];
