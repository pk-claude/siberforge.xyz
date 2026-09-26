// Release cadence map for the publications calendar.
// Keyed by indicator id. Entries describe when the metric publishes so the
// calendar engine can compute upcoming dates.
//
// kind values:
//   'monthly_first_friday'      — BLS Employment Situation
//   'monthly_first_business'    — ISM, ACT/FTR
//   'monthly_mid'               — BLS PPI/CPI, Census FT900 (~10-15)
//   'monthly_around_12'         — Cass Freight Index
//   'monthly_around_15'         — Census MTIS, Census construction, port stats
//   'monthly_around_20'         — Federal Reserve G.17
//   'monthly_around_25'         — JOLTS (~5 weeks lag)
//   'weekly_monday_4pm'         — EIA petroleum
//   'weekly_thursday'           — Drewry WCI, Initial Jobless Claims
//   'weekly_wednesday'          — AAR Weekly Rail Traffic
//   'weekly_friday'             — SCFI
//   'quarterly_45d'             — Census e-commerce, USPS RPW
//   'quarterly_75d'             — CRE delinquency
//   'annual_q1'                 — Reshoring Initiative
//   'daily'                     — Yahoo equity prices, FBX, BDI, bunker (skipped from calendar)
//
// hint: human-readable description used as tooltip context.

export const RELEASE_CADENCE = {
  // ============================== DC =================================
  WAREHOUSE_AHE:        { kind: 'monthly_first_friday', hint: 'BLS CES, ~1st Friday' },
  WAREHOUSE_AHE_YOY:    { kind: 'monthly_first_friday', hint: 'derived from CES' },
  WAREHOUSE_EMP:        { kind: 'monthly_first_friday', hint: 'BLS CES, ~1st Friday' },
  JOLTS_TWU_OPENINGS:   { kind: 'monthly_around_25',    hint: 'BLS JOLTS, ~5 weeks after month-end' },
  JOLTS_TWU_QUITS:      { kind: 'monthly_around_25',    hint: 'BLS JOLTS, ~5 weeks after month-end' },
  JOLTS_TWU_LAYOFFS:    { kind: 'monthly_around_25',    hint: 'BLS JOLTS, ~5 weeks after month-end' },
  PPI_CORRUGATED:       { kind: 'monthly_mid',          hint: 'BLS PPI, mid-month' },
  PPI_PALLETS:          { kind: 'monthly_mid',          hint: 'BLS PPI, mid-month' },
  PPI_MAT_HANDLING:     { kind: 'monthly_mid',          hint: 'BLS PPI, mid-month' },
  PPI_WAREHOUSE_SVCS:   { kind: 'monthly_mid',          hint: 'BLS PPI, mid-month' },
  PPI_PULP:             { kind: 'monthly_mid',          hint: 'BLS PPI, mid-month' },
  ELEC_INDUSTRIAL:      { kind: 'monthly_around_25',    hint: 'EIA Electric Power Monthly, ~6 weeks after' },
  INVENTORIES_TO_SALES: { kind: 'monthly_around_15',    hint: 'Census MTIS, ~6 weeks' },
  INV_MFG:              { kind: 'monthly_around_15',    hint: 'Census MTIS' },
  INV_RETAIL:           { kind: 'monthly_around_15',    hint: 'Census MTIS' },
  INV_WHOLESALE:        { kind: 'monthly_around_15',    hint: 'Census MTIS' },
  EMPIRE_DELIVERY:      { kind: 'monthly_mid',          hint: 'NY Fed Empire State Mfg, ~15th' },
  PHILLY_DELIVERY:      { kind: 'monthly_mid',          hint: 'Philly Fed Mfg Survey, 3rd Thu' },
  DALLAS_DELIVERY:      { kind: 'monthly_around_25',    hint: 'Dallas Fed Mfg Survey, last Mon' },

  // ============================ INDUSTRIAL RE ========================
  CONSTR_PRIVATE:       { kind: 'monthly_around_15',    hint: 'Census Construction Spending' },
  CONSTR_MANUF:         { kind: 'monthly_around_15',    hint: 'Census Construction Spending' },
  CRE_DELINQ:           { kind: 'quarterly_75d',        hint: 'Federal Reserve, ~6 weeks after qtr-end' },
  CRE_PRICES:           { kind: 'quarterly_75d',        hint: 'BIS via FRED, quarterly' },
  REIT_INDUSTRIAL_BASKET: { kind: 'daily', hint: 'daily, equity market close' },
  REIT_AVG_DIV_YIELD:   { kind: 'daily',                hint: 'daily' },
  REIT_YIELD_SPREAD_10Y:{ kind: 'daily',                hint: 'derived daily' },
  MFG_CAPACITY_UTIL:    { kind: 'monthly_around_20',    hint: 'Federal Reserve G.17, ~mid-month' },
  // Industrial REIT constituents (individual tickers)
  PLD:                  { kind: 'daily', hint: 'daily' },
  REXR:                 { kind: 'daily', hint: 'daily' },
  FR:                   { kind: 'daily', hint: 'daily' },
  STAG:                 { kind: 'daily', hint: 'daily' },
  EGP:                  { kind: 'daily', hint: 'daily' },
  TRNO:                 { kind: 'daily', hint: 'daily' },
  // Cold storage REITs
  COLD:                 { kind: 'daily', hint: 'daily' },
  LINE:                 { kind: 'daily', hint: 'daily' },
  // Self-storage REITs
  PSA:                  { kind: 'daily', hint: 'daily' },
  EXR:                  { kind: 'daily', hint: 'daily' },
  CUBE:                 { kind: 'daily', hint: 'daily' },

  // ============================== MIDDLE MILE ========================
  DIESEL_RETAIL:        { kind: 'weekly_monday_4pm',    hint: 'EIA Weekly Petroleum, Mondays 4pm ET' },
  GASOLINE_RETAIL:      { kind: 'weekly_monday_4pm',    hint: 'EIA Weekly Petroleum, Mondays 4pm ET' },
  CASS_SHIPMENTS:       { kind: 'monthly_around_12',    hint: 'Cass, ~12th of month' },
  CASS_EXPENDITURES:    { kind: 'monthly_around_12',    hint: 'Cass, ~12th of month' },
  CASS_LINEHAUL:        { kind: 'monthly_around_12',    hint: 'Cass, ~12th of month' },
  ATA_TONNAGE:          { kind: 'monthly_around_25',    hint: 'ATA, ~3 weeks after month-end' },
  DAT_VAN_SPOT:         { kind: 'monthly_around_15',    hint: 'DAT iQ press release' },
  DAT_REEFER_SPOT:      { kind: 'monthly_around_15',    hint: 'DAT iQ' },
  DAT_FLATBED_SPOT:     { kind: 'monthly_around_15',    hint: 'DAT iQ' },
  TRUCKING_EMP:         { kind: 'monthly_first_friday', hint: 'BLS CES, ~1st Friday' },
  AAR_CARLOADS:         { kind: 'monthly_around_15',    hint: 'AAR via FRED, monthly' },
  AAR_INTERMODAL:       { kind: 'monthly_around_15',    hint: 'AAR via FRED, monthly' },
  TSI_FREIGHT:          { kind: 'monthly_around_25',    hint: 'BTS, ~6 weeks after month-end' },
  HEAVY_TRUCK_SAAR:     { kind: 'monthly_around_15',    hint: 'BEA, monthly' },
  CLASS8_ORDERS:        { kind: 'monthly_first_business', hint: 'ACT/FTR, ~5th of month' },
  PPI_LONGHAUL_TL:      { kind: 'monthly_mid',          hint: 'BLS PPI, mid-month' },

  // ============================== LAST MILE ==========================
  COURIER_EMP:          { kind: 'monthly_first_friday', hint: 'BLS CES, ~1st Friday' },
  TRANSPORT_SUPPORT_EMP:{ kind: 'monthly_first_friday', hint: 'BLS CES, ~1st Friday' },
  USPS_FIRST_CLASS:     { kind: 'quarterly_45d',        hint: 'USPS RPW, quarterly' },
  USPS_PACKAGES:        { kind: 'quarterly_45d',        hint: 'USPS RPW, quarterly' },
  ECOM_SHARE:           { kind: 'quarterly_45d',        hint: 'Census, ~7 weeks after quarter' },
  ECOM_SALES:           { kind: 'quarterly_45d',        hint: 'Census, ~7 weeks after quarter' },
  RETAIL_EMP:           { kind: 'monthly_first_friday', hint: 'BLS CES, ~1st Friday' },
  LIGHT_TRUCK_SAAR:     { kind: 'monthly_around_15',    hint: 'BEA, monthly' },
  GASREG:               { kind: 'weekly_monday_4pm',    hint: 'EIA Weekly Petroleum' },
  PPI_COURIERS:         { kind: 'monthly_mid',          hint: 'BLS PPI, mid-month' },
  PPI_LOCAL_TRUCKING:   { kind: 'monthly_mid',          hint: 'BLS PPI, mid-month' },

  // ============================== INTERNATIONAL ======================
  GSCPI:                { kind: 'monthly_first_business', hint: 'NY Fed, ~5th of month' },
  WCI_COMPOSITE:        { kind: 'weekly_thursday',      hint: 'Drewry, every Thursday' },
  WCI_SHA_LA:           { kind: 'weekly_thursday',      hint: 'Drewry' },
  WCI_SHA_RTM:          { kind: 'weekly_thursday',      hint: 'Drewry' },
  SCFI:                 { kind: 'weekly_friday',        hint: 'SSE, every Friday' },
  FBX_GLOBAL:           { kind: 'daily',                hint: 'Freightos, daily' },
  BDI:                  { kind: 'daily',                hint: 'Baltic Exchange, daily' },
  BUNKER_VLSFO_SIN:     { kind: 'daily',                hint: 'Ship & Bunker, daily' },
  BUNKER_VLSFO_RTM:     { kind: 'daily',                hint: 'Ship & Bunker, daily' },
  US_IMPORTS:           { kind: 'monthly_mid',          hint: 'BEA/Census FT900, ~6 weeks' },
  US_EXPORTS:           { kind: 'monthly_mid',          hint: 'BEA/Census FT900, ~6 weeks' },
  TWD_BROAD:            { kind: 'daily',                hint: 'Federal Reserve, daily' },
  PORT_LA_TEU:          { kind: 'monthly_around_15',    hint: 'Port of LA, ~15th' },
  PORT_LB_TEU:          { kind: 'monthly_around_15',    hint: 'Port of LB, ~15th' },
  PORT_NYNJ_TEU:        { kind: 'monthly_around_15',    hint: 'PANYNJ, ~5 weeks after' },
  AIR_TRANSP_EMP:       { kind: 'monthly_first_friday', hint: 'BLS CES, ~1st Friday' },
  BORDER_MX_TRUCKS:     { kind: 'monthly_around_25',    hint: 'BTS Border Crossing, monthly' },
  SUEZ_TRANSITS:        { kind: 'monthly_first_business', hint: 'SCA monthly press release' },
  PANAMA_TRANSITS:      { kind: 'monthly_first_business', hint: 'ACP monthly stats' },
  EU_ETS_CARBON:        { kind: 'daily',                hint: 'ICE/EEX, daily' },
  RESHORING_COUNT:      { kind: 'annual_q1',            hint: 'Reshoring Initiative, annual Q1' },

  // ============================== COMPOSITE ==========================
  SCP_COMPOSITE:        { kind: 'monthly_first_business', hint: 'recomputed at GSCPI release' },
};
