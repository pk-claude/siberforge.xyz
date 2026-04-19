/* balance-data.js — Plug Power balance-sheet health data.
   All figures in US$ millions unless noted.
   Source: FY2025 10-K (filed 2026-03-02), EDGAR XBRL companyfacts.

   This file holds the numeric data. Chart configuration (colors,
   traces, layout) stays in balance.js. When a 10-K is refiled,
   only this file should need updates.
*/

window.PLUG_BALANCE_DATA = {
  /* ---------- Cash composition at period-end (FY2025) ---------- */
  // Label is purely presentational; val is in $M.
  cashSlices: [
    { label: "Unrestricted cash & equivalents",       val: 368.5 },
    { label: "Restricted — sale/leaseback collateral", val: 352.3 },
    { label: "Restricted — LC / bank guarantees",      val: 193.1 },
    { label: "Restricted — construction escrow",       val:  80.0 },
  ],
  // Annotation shown inside donut center
  cashTotalLabel: "$994.0M",

  /* ---------- Total-cash history ---------- */
  cashHist: [
    { y: 2021, unrestricted: 2481.3, restricted: 650.9 },
    { y: 2022, unrestricted:  690.6, restricted: 858.7 },
    { y: 2023, unrestricted:  135.0, restricted:1034.1 },
    { y: 2024, unrestricted:  205.7, restricted: 835.0 },
    { y: 2025, unrestricted:  368.5, restricted: 625.4 },
  ],

  /* ---------- Debt & lease maturity ladder ($M) ----------
     Columns: 2026, 2027, 2028, 2029, 2030, thereafter (2031+)
     Finance obligations: $76.2M current, $191.8M beyond.
       Beyond-cap spread evenly across 2027-2029 ($63.9M each)
       since the 10-K classifies the remainder in aggregate.
  */
  maturity: {
    years:     ["2026", "2027", "2028", "2029", "2030", "2031+"],
    opLease:   [94.4, 79.1, 56.1, 32.3, 14.3, 128.9],
    finLease:  [12.6,  9.1,  2.8,  1.3,  1.3,   7.4],
    finObl:    [76.2, 63.9, 63.9, 63.9,  0.0,   0.0],
    ltDebt:    [ 0.6,  1.3,  0.0,  0.0,  0.0,   0.0],
    // 7.00% Conv. Notes (2026) in 2026; 6.75% Conv. Notes (2033) in 2031+.
    convNotes: [ 2.6,  0.0,  0.0,  0.0,  0.0, 431.3],
  },

  /* ---------- Working capital turns (days) ----------
     DSO = AR / Revenue * 365
     DIO = Inventory / COGS * 365
     DPO = AP / COGS * 365
     CCC = DSO + DIO - DPO
  */
  workingCapital: {
    years: ["FY2022", "FY2023", "FY2024", "FY2025"],
    dso:   [ 67.4,  99.9,  91.3,  69.3],
    dio:   [263.1, 250.8, 198.8, 199.8],
    dpo:   [ 78.2,  67.3,  52.7,  64.7],
    ccc:   [252.3, 283.4, 237.4, 204.4],
  },

  /* ---------- Share count history (millions of common shares) ---------- */
  shareHist: [
    { y: 2019, shares:  318.6 },
    { y: 2020, shares:  474.0 },
    { y: 2021, shares:  594.7 },
    { y: 2022, shares:  608.4 },
    { y: 2023, shares:  625.3 },
    { y: 2024, shares:  934.1 },
    { y: 2025, shares: 1394.2 },
  ],

  /* ---------- Authorization / equity capacity (millions of shares) ---------- */
  // Feb 12, 2026 shareholder vote doubled authorization 1.5B -> 3.0B.
  headroom: {
    issued:      1394,        // issued as of Feb 2026
    unissued:    1606,        // authorized but unissued = 3000 - 1394
    warrants775: 185,         // $7.75 warrants, exp 2028
    atmShares:   583,         // ATM ($944M remaining) at FY25 avg sale price $1.62
    sepaShares:  617,         // SEPA ($1.0B) at $1.62
  },
};
