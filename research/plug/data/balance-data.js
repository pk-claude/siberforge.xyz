/* balance-data.js — Plug Power balance-sheet health data.
   All figures in US$ millions unless noted.
   Sources:
     - FY2025 10-K (filed 2026-03-02), EDGAR XBRL companyfacts
     - Q2 2026 10-Q (filed 2026-08-10) — Jun 30, 2026 balance sheet, actual
       restricted-cash buckets (Note 17), convertible/warrant fair values.
     - Q2 2026 press release (filed 2026-08-10).

   This file holds the numeric data. Chart configuration (colors,
   traces, layout) stays in balance.js.
*/

window.PLUG_BALANCE_DATA = {
  /* ---------- Cash composition at period-end (Jun 30, 2026) ---------- */
  // Q2 10-Q Note 17 discloses ACTUAL restricted-cash buckets (no longer
  // estimated): sale/leaseback collateral $279.2M, LC/bank guarantees $150.4M
  // (of which $117.2M S/LB letters of credit + $33.2M customs), Texas-plant
  // power escrow $62.0M, Georgia-plant power escrow $18.0M. Total $509.6M
  // ($155.5M current + $354.1M long-term).
  cashSlices: [
    { label: "Unrestricted cash & equivalents",        val: 161.9 },
    { label: "Restricted — sale/leaseback collateral", val: 279.2 },
    { label: "Restricted — LC / bank guarantees",      val: 150.4 },
    { label: "Restricted — TX plant power escrow",     val:  62.0 },
    { label: "Restricted — GA plant power escrow",     val:  18.0 },
  ],
  // Annotation shown inside donut center
  cashTotalLabel: "$671.5M",

  /* ---------- Total-cash history (year-end annual; final rows are 2026 quarterly snapshots) ---------- */
  cashHist: [
    { y: 2021, unrestricted: 2481.3, restricted: 650.9 },
    { y: 2022, unrestricted:  690.6, restricted: 858.7 },
    { y: 2023, unrestricted:  135.0, restricted:1034.1 },
    { y: 2024, unrestricted:  205.7, restricted: 835.0 },
    { y: 2025, unrestricted:  368.5, restricted: 625.4 },
    { y: "Q1'26", unrestricted: 223.2, restricted: 578.8 },
    { y: "Q2'26", unrestricted: 161.9, restricted: 509.6 },
  ],

  /* ---------- Debt & lease maturity ladder ($M) ----------
     Columns: 2026, 2027, 2028, 2029, 2030, thereafter (2031+)
     Source: FY2025 10-K Note 10 / Note 13 schedules, adjusted for H1 2026
     repayments. The 2026 10-Qs no longer disclose by-year maturity tables,
     so: (a) 7.00% 2026 notes repaid in cash H1'26 — 2026 column zeroed;
     (b) finance obligations reset to the Jun 30, 2026 current portion
     ($57.7M) with the $156.2M long-term balance spread evenly 2027-2029
     (same convention as the FY25 ladder); (c) operating/finance-lease
     schedules remain FY25 10-K undiscounted disclosures (H1'26 payments
     mean the 2026 column overstates remaining-year payments somewhat);
     (d) long-term debt current portion $0.3M at Jun 30.
  */
  maturity: {
    years:     ["2026", "2027", "2028", "2029", "2030", "2031+"],
    opLease:   [94.4, 79.1, 56.1, 32.3, 14.3, 128.9],
    finLease:  [12.6,  9.1,  2.8,  1.3,  1.3,   7.4],
    finObl:    [57.7, 52.1, 52.1, 52.1,  0.0,   0.0],
    ltDebt:    [ 0.3,  1.2,  0.0,  0.0,  0.0,   0.0],
    // 7.00% Conv. Notes (2026) repaid H1 2026; 6.75% Conv. Notes (2033)
    // $431.3M principal in 2031+ (carried at fair value $578.0M at Jun 30).
    convNotes: [ 0.0,  0.0,  0.0,  0.0,  0.0, 431.3],
  },

  /* ---------- Working capital turns (days) ----------
     DSO = AR / Revenue * 365
     DIO = Inventory / COGS * 365
     DPO = AP / COGS * 365
     CCC = DSO + DIO - DPO
     Quarterly rows are computed on a trailing-twelve-month basis
     (Q1'26 TTM: rev $739.8M, COGS $929.5M;
      Q2'26 TTM: rev $744.1M, COGS $882.1M).
  */
  workingCapital: {
    years: ["FY2022", "FY2023", "FY2024", "FY2025", "Q1'26 TTM", "Q2'26 TTM"],
    dso:   [ 67.4,  99.9,  91.3,  69.3,  52.6,  61.7],
    dio:   [263.1, 250.8, 198.8, 199.8, 202.7, 204.2],
    dpo:   [ 78.2,  67.3,  52.7,  64.7,  56.6,  59.7],
    ccc:   [252.3, 283.4, 237.4, 204.4, 198.7, 206.2],
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
    { y: "Q2'26", shares: 1397.9 },
  ],

  /* ---------- Authorization / equity capacity (millions of shares) ---------- */
  // Feb 12, 2026 shareholder vote doubled authorization 1.5B -> 3.0B.
  // Shares issued as of Jun 30, 2026: 1,397,924,047 = 1,397.9M.
  // ATM/SEPA share-equivalents priced at $2.71 (Jun 30, 2026 close per the
  // Q2 10-Q warrant-valuation inputs); zero ATM/SEPA usage in H1 2026.
  headroom: {
    issued:      1398,        // issued as of Jun 30, 2026 (rounded)
    unissued:    1602,        // authorized but unissued = 3000 - 1398
    warrants775: 185,         // $7.75 warrants, exp 2028 — no exercises through Q2 2026
    atmShares:   348,         // ATM ($944.1M remaining) at $2.71
    sepaShares:  369,         // SEPA ($1.0B) at $2.71
  },
};
