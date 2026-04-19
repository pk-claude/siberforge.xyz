/* liquidity-data.js — Plug Power liquidity-options model.
   Data sourced from FY2025 10-K (filed 2026-03-02) and EDGAR XBRL companyfacts.

   Exports three globals:
     window.PLUG_LIQUIDITY_SHARES_OUT  — common shares outstanding (millions).
     window.PLUG_LIQUIDITY_OPTIONS     — available/used/pending capital options.
     window.PLUG_LIQUIDITY_DEPS        — shared constraints across those options.
*/

window.PLUG_LIQUIDITY_SHARES_OUT = 1394.0;

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
window.PLUG_LIQUIDITY_DEPS = [
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
