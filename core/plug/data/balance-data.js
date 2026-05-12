/* balance-data.js — Plug Power balance-sheet health data.
   All figures in US$ millions unless noted.
   Sources:
     - FY2025 10-K (filed 2026-03-02), EDGAR XBRL companyfacts
     - Q1 2026 press release (filed 2026-05-11) — refreshed cash, AR, inventory,
       AP, shares-issued snapshot. Debt maturity ladder and restricted-cash
       sub-buckets remain FY2025 disclosures pending the Q1 10-Q.

   This file holds the numeric data. Chart configuration (colors,
   traces, layout) stays in balance.js.
*/

window.PLUG_BALANCE_DATA = {
  /* ---------- Cash composition at period-end (Mar 31, 2026) ---------- */
  // Mar 31, 2026 balance sheet discloses cash $223.2M, restricted-current
  // $183.7M, restricted-LT $395.1M (total restricted $578.8M). The three
  // restricted sub-buckets below are ESTIMATED by holding FY2025 mix
  // proportions constant; precise allocation will be disclosed in the Q1 10-Q.
  cashSlices: [
    { label: "Unrestricted cash & equivalents",       val: 223.2 },
    { label: "Restricted — sale/leaseback collateral", val: 326.0 },
    { label: "Restricted — LC / bank guarantees",      val: 178.7 },
    { label: "Restricted — construction escrow",       val:  74.1 },
  ],
  // Annotation shown inside donut center
  cashTotalLabel: "$802.0M",

  /* ---------- Total-cash history (year-end annual; final row is Q1'26 snapshot) ---------- */
  cashHist: [
    { y: 2021, unrestricted: 2481.3, restricted: 650.9 },
    { y: 2022, unrestricted:  690.6, restricted: 858.7 },
    { y: 2023, unrestricted:  135.0, restricted:1034.1 },
    { y: 2024, unrestricted:  205.7, restricted: 835.0 },
    { y: 2025, unrestricted:  368.5, restricted: 625.4 },
    { y: "Q1'26", unrestricted: 223.2, restricted: 578.8 },
  ],

  /* ---------- Debt & lease maturity ladder ($M) ----------
     Columns: 2026, 2027, 2028, 2029, 2030, thereafter (2031+)
     Source: FY2025 10-K Note 10 / Note 13 — the Q1 2026 press release
     does not restate the ladder by year. Q1 paid down finance obligations
     by $9.8M and long-term debt by $0.3M; ladder will be refreshed once
     the Q1 10-Q discloses the new schedule.
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
     Q1'26 row is computed on a trailing-twelve-month basis
     (TTM rev $739.8M, TTM COGS $929.5M).
  */
  workingCapital: {
    years: ["FY2022", "FY2023", "FY2024", "FY2025", "Q1'26 TTM"],
    dso:   [ 67.4,  99.9,  91.3,  69.3,  52.6],
    dio:   [263.1, 250.8, 198.8, 199.8, 202.7],
    dpo:   [ 78.2,  67.3,  52.7,  64.7,  56.6],
    ccc:   [252.3, 283.4, 237.4, 204.4, 198.7],
  },

  /* ---------- Share count history (millions of common shares issued) ---------- */
  shareHist: [
    { y: 2019, shares:  318.6 },
    { y: 2020, shares:  474.0 },
    { y: 2021, shares:  594.7 },
    { y: 2022, shares:  608.4 },
    { y: 2023, shares:  625.3 },
    { y: 2024, shares:  934.1 },
    { y: 2025, shares: 1394.2 },
    { y: "Q1'26", shares: 1395.6 },
  ],

  /* ---------- Authorization / equity capacity (millions of shares) ---------- */
  // Feb 12, 2026 shareholder vote doubled authorization 1.5B -> 3.0B.
  // Shares issued as of Mar 31, 2026: 1,395,643,390 = 1,395.6M.
  headroom: {
    issued:      1396,        // issued as of Mar 31, 2026 (rounded)
    unissued:    1604,        // authorized but unissued = 3000 - 1396
    warrants775: 185,         // $7.75 warrants, exp 2028 — exercisable since Feb 28, 2026
    atmShares:   583,         // ATM ($944M remaining) at FY25 avg sale price $1.62; no Q1'26 usage
    sepaShares:  617,         // SEPA ($1.0B) at $1.62
  },
};
