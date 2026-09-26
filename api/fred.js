// Vercel serverless function: proxies FRED API with server-side key.
// Returns { series: [...], errors: [...] } with allSettled partial-failure tolerance.

import { guard } from './_guard.js';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

export const CATALOG = {
  // ====================== MACRO DASHBOARD (/macro/regime/) ======================
  CPIAUCSL:  { label: 'CPI (Headline)',          freq: 'monthly',   unit: 'index',   transform: 'yoy_pct' },
  DFF:       { label: 'Fed Funds Rate',          freq: 'daily',     unit: 'percent', transform: 'level' },
  UNRATE:    { label: 'Unemployment Rate',       freq: 'monthly',   unit: 'percent', transform: 'level' },
  GDPC1:     { label: 'Real GDP',                freq: 'quarterly', unit: 'bn_usd',  transform: 'yoy_pct' },
  DGS10:     { label: '10Y Treasury Yield',      freq: 'daily',     unit: 'percent', transform: 'level' },
  INDPRO:    { label: 'Industrial Production',   freq: 'monthly',   unit: 'index',   transform: 'yoy_pct' },
  ICSA:      { label: 'Initial Jobless Claims',  freq: 'weekly',    unit: 'count',   transform: 'level' },
  UMCSENT:   { label: 'Consumer Sentiment',      freq: 'monthly',   unit: 'index',   transform: 'level' },
  PERMIT:    { label: 'Building Permits',        freq: 'monthly',   unit: 'count',   transform: 'yoy_pct' },
  RSAFS:     { label: 'Retail Sales',            freq: 'monthly',   unit: 'usd',     transform: 'yoy_pct' },
  M2SL:      { label: 'M2 Money Supply',         freq: 'monthly',   unit: 'bn_usd',  transform: 'yoy_pct' },
  WALCL:     { label: 'Fed Balance Sheet',       freq: 'weekly',    unit: 'mm_usd',  transform: 'level' },
  RRPONTSYD: { label: 'Reverse Repo (ON)',       freq: 'daily',     unit: 'bn_usd',  transform: 'level' },
  WTREGEN:   { label: 'Treasury General Account',freq: 'weekly',    unit: 'bn_usd',  transform: 'level' },
  USREC:     { label: 'NBER Recession Indicator',freq: 'monthly',   unit: 'binary',  transform: 'level' },

  // ================= CYCLE DASHBOARD (/macro/cycle/) =================
  NFCI:          { label: 'Chicago Fed NFCI',              freq: 'weekly',  unit: 'index',   transform: 'level', group: 'cycle' },
  ANFCI:         { label: 'Adjusted NFCI',                 freq: 'weekly',  unit: 'index',   transform: 'level', group: 'cycle' },
  BAMLC0A0CM:    { label: 'IG Credit Spread (OAS)',        freq: 'daily',   unit: 'percent', transform: 'level', group: 'cycle' },
  DFII10:        { label: '10Y TIPS Real Yield',           freq: 'daily',   unit: 'percent', transform: 'level', group: 'cycle' },
  RECPROUSM156N: { label: 'Smoothed Recession Probability',freq: 'monthly', unit: 'percent', transform: 'level', group: 'cycle' },

  // ================= INFLATION DASHBOARD (/macro/inflation/) =================
  T5YIE:                   { label: '5Y Breakeven Inflation',          freq: 'daily',   unit: 'percent', transform: 'level',   group: 'inflation' },
  T10YIE:                  { label: '10Y Breakeven Inflation',         freq: 'daily',   unit: 'percent', transform: 'level',   group: 'inflation' },
  COREFLEXCPIM159SFRBATL:  { label: 'Atlanta Flex-Price Core CPI',     freq: 'monthly', unit: 'percent', transform: 'level',   group: 'inflation' },
  CPIHOSSL:                { label: 'CPI Shelter',                     freq: 'monthly', unit: 'index',   transform: 'yoy_pct', group: 'inflation' },
  MICH:                    { label: 'UMich 1Y Inflation Expectations', freq: 'monthly', unit: 'percent', transform: 'level',   group: 'inflation' },

  // ================= REAL ECONOMY (/macro/consumer/) =================
  PCE:           { label: 'Personal Consumption Expenditures',          freq: 'monthly',   unit: 'bn_usd',  transform: 'yoy_pct', group: 'real-economy' },
  DSPI:          { label: 'Disposable Personal Income',                 freq: 'monthly',   unit: 'bn_usd',  transform: 'yoy_pct', group: 'real-economy' },
  PSAVERT:       { label: 'Personal Saving Rate',                       freq: 'monthly',   unit: 'percent', transform: 'level',   group: 'real-economy' },
  TDSP:          { label: 'Household Debt Service Ratio',               freq: 'quarterly', unit: 'percent', transform: 'level',   group: 'real-economy' },
  MSACSR:        { label: 'Monthly Supply of New Houses',               freq: 'monthly',   unit: 'months',  transform: 'level',   group: 'real-economy' },
  HOSSUPUSM673N: { label: 'Months Supply of Existing Homes',            freq: 'monthly',   unit: 'months',  transform: 'level',   group: 'real-economy' },
  WPU081:        { label: 'PPI: Lumber & Wood Products',                freq: 'monthly',   unit: 'index',   transform: 'yoy_pct', group: 'real-economy' },
  DSPIC96:       { label: 'Real Disposable Personal Income',       freq: 'monthly',   unit: 'bn_usd',  transform: 'yoy_pct', group: 'real-economy' },
  REVOLSL:       { label: 'Revolving Consumer Credit Outstanding',   freq: 'monthly',   unit: 'bn_usd',  transform: 'yoy_pct', group: 'real-economy' },
  DRALACBS:      { label: 'Auto Loan Delinquency Rate',             freq: 'quarterly', unit: 'percent', transform: 'level',   group: 'real-economy' },
  OPHNFB:        { label: 'Output Per Hour (Nonfarm Business)', freq: 'quarterly', unit: 'index', transform: 'yoy_pct', group: 'real-economy' },

  // ================= HOUSING DASHBOARD (/macro/housing/) =================
  HOUST1F:       { label: 'Housing Starts: Single-Family',  freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'housing' },
  HOUST5F:       { label: 'Housing Starts: 5+ Units (MF)',  freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'housing' },
  COMPUTSA:      { label: 'Housing Completions',            freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'housing' },
  MSPUS:         { label: 'Median Sales Price of Houses',   freq: 'quarterly', unit: 'usd',     transform: 'level',   group: 'housing' },
  DRSFRMACBS:    { label: 'SF Mortgage Delinquency Rate',   freq: 'quarterly', unit: 'percent', transform: 'level',   group: 'housing' },
  CUUR0000SEHA:  { label: 'CPI: Rent of Primary Residence', freq: 'monthly',   unit: 'index',   transform: 'yoy_pct', group: 'housing' },
  MEHOINUSA672N: { label: 'Real Median Family Income',      freq: 'annual',    unit: 'usd',     transform: 'level',   group: 'housing' },
  MORTGAGE15US:  { label: '15Y Fixed Mortgage Rate',        freq: 'weekly',    unit: 'percent', transform: 'level',   group: 'housing' },
  PRRESCONS:     { label: 'Private Residential Construction Spending', freq: 'monthly', unit: 'mm_usd', transform: 'yoy_pct', group: 'housing' },
  USCONS: { label: 'Construction Employment',        freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'housing' },
  RHVRUSQ156N:   { label: 'Rental Vacancy Rate',            freq: 'quarterly', unit: 'percent', transform: 'level',   group: 'housing' },
  MSPNHSUS:      { label: 'Median Sales Price of New Houses', freq: 'quarterly', unit: 'usd',     transform: 'level',   group: 'housing' },
  ASPNHSUS:      { label: 'Avg Sales Price of New Houses',   freq: 'quarterly', unit: 'usd',     transform: 'level',   group: 'housing' },
  CUSR0000SEHE:  { label: "CPI: Tenants' & Household Insurance", freq: 'monthly', unit: 'index', transform: 'yoy_pct', group: 'housing' },

  // ===================== ECON DASHBOARD (/macro/indicators/) =====================
  T10Y3M:                { label: '10Y-3M Treasury Spread',  freq: 'daily',     unit: 'percent', transform: 'level',   group: 'econ' },
  GACDISA066MSFRBNY:     { label: 'Empire State Mfg Index',  freq: 'monthly',   unit: 'index',   transform: 'level',   group: 'econ' },
  GDPNOW:                { label: 'Atlanta Fed GDPNow',      freq: 'daily',     unit: 'percent', transform: 'level',   group: 'econ' },
  DGS2:                  { label: '2Y Treasury Yield',       freq: 'daily',     unit: 'percent', transform: 'level',   group: 'econ' },
  DGS5:                  { label: '5Y Treasury Yield',       freq: 'daily',     unit: 'percent', transform: 'level',   group: 'econ' },
  T10Y2Y:                { label: '10Y-2Y Spread (2s10s)',   freq: 'daily',     unit: 'percent', transform: 'level',   group: 'econ' },
  PCEPILFE:              { label: 'Core PCE Price Index',    freq: 'monthly',   unit: 'index',   transform: 'yoy_pct', group: 'econ' },
  CPILFESL:              { label: 'Core CPI',                freq: 'monthly',   unit: 'index',   transform: 'yoy_pct', group: 'econ' },
  CORESTICKM159SFRBATL:  { label: 'Sticky-Price Core CPI',   freq: 'monthly',   unit: 'percent', transform: 'level',   group: 'econ' },
  T5YIFR:                { label: '5Y5Y Forward Inflation',  freq: 'daily',     unit: 'percent', transform: 'level',   group: 'econ' },
  PAYEMS:                { label: 'Nonfarm Payrolls',        freq: 'monthly',   unit: 'count',   transform: 'level',   group: 'econ' },
  CES0500000003:         { label: 'Avg Hourly Earnings',     freq: 'monthly',   unit: 'usd',     transform: 'yoy_pct', group: 'econ' },
  RRSFS:                 { label: 'Real Retail Sales',       freq: 'monthly',   unit: 'mm_usd',  transform: 'yoy_pct', group: 'econ' },
  IC4WSA:                { label: 'Jobless Claims (4wk MA)', freq: 'weekly',    unit: 'count',   transform: 'level',   group: 'econ' },
  DRCCLACBS:             { label: 'Credit Card Delinquency', freq: 'quarterly', unit: 'percent', transform: 'level',   group: 'econ' },
  HOUST:                 { label: 'Housing Starts',          freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'econ' },
  EXHOSLUSM495S:         { label: 'Existing Home Sales',     freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'econ' },
  HSN1F:                 { label: 'New Home Sales',          freq: 'monthly',   unit: 'count',   transform: 'yoy_pct', group: 'econ' },
  MORTGAGE30US:          { label: '30Y Fixed Mortgage Rate', freq: 'weekly',    unit: 'percent', transform: 'level',   group: 'econ' },
  CSUSHPISA:             { label: 'Case-Shiller Home Prices',freq: 'monthly',   unit: 'index',   transform: 'yoy_pct', group: 'econ' },

  // ===================== RECESSION DASHBOARD (/macro/recession/) =====
  SAHMCURRENT:           { label: 'Sahm Rule Recession Indicator',  freq: 'monthly', unit: 'percent', transform: 'level', group: 'recession' },
  BAMLH0A0HYM2:          { label: 'High-Yield OAS',                 freq: 'daily',   unit: 'percent', transform: 'level', group: 'recession' },

  // ============== TRANSMISSION NETWORK (/tools/network/) =============
  PPIACO:                { label: 'PPI: All Commodities',           freq: 'monthly', unit: 'index',   transform: 'yoy_pct', group: 'network' },
  CUMFNS:                { label: 'Capacity Utilization (Mfg)',     freq: 'monthly', unit: 'percent', transform: 'level',   group: 'network' },
  JTSJOL:                { label: 'JOLTS Job Openings',             freq: 'monthly', unit: 'count',   transform: 'yoy_pct', group: 'network' },
  CIVPART:               { label: 'Labor Force Participation Rate', freq: 'monthly', unit: 'percent', transform: 'level',   group: 'network' },
  SP500:                 { label: 'S&P 500 Index',                  freq: 'daily',   unit: 'index',   transform: 'yoy_pct', group: 'network' },
  DTWEXBGS:              { label: 'USD Trade-Weighted Broad Index', freq: 'daily',   unit: 'index',   transform: 'yoy_pct', group: 'network' },
  DCOILWTICO:            { label: 'WTI Crude Oil Spot Price',       freq: 'daily',   unit: 'usd',     transform: 'yoy_pct', group: 'network' },
  VIXCLS:                { label: 'CBOE VIX',                       freq: 'daily',   unit: 'index',   transform: 'level',   group: 'network' },

  // ===================== SUPPLY CHAIN DASHBOARD (/supply/) =====================
  // Distribution Center
  CES4300000008:    { label: 'TTU Avg Hourly Earnings',           freq: 'monthly', unit: 'usd',     transform: 'level',   group: 'supply' },
  CES4349300001:    { label: 'Warehousing & Storage Employment',  freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  JTU480099JOL:     { label: 'JOLTS: TWU Job Openings',           freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  JTU480099QUR:     { label: 'JOLTS: TWU Quits Rate',             freq: 'monthly', unit: 'percent', transform: 'level',   group: 'supply' },
  JTU480099LDR:     { label: 'JOLTS: TWU Layoffs Rate',           freq: 'monthly', unit: 'percent', transform: 'level',   group: 'supply' },
  WPU091503:        { label: 'PPI: Corrugated Paperboard',        freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  WPU0841:          { label: 'PPI: Wood Pallets',                 freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  WPU114:           { label: 'PPI: Material Handling Equipment',  freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  PCU493493:        { label: 'PPI: Warehousing & Storage Svcs',   freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  ISRATIO:          { label: 'Inventories-to-Sales Ratio',        freq: 'monthly', unit: 'ratio',   transform: 'level',   group: 'supply' },
  MNFCTRIMSA:       { label: 'Manufacturing Inventories',         freq: 'monthly', unit: 'mm_usd',  transform: 'level',   group: 'supply' },
  RETAILIMSA:       { label: 'Retail Inventories',                freq: 'monthly', unit: 'mm_usd',  transform: 'level',   group: 'supply' },
  WHLSLRIMSA:       { label: 'Wholesale Inventories',             freq: 'monthly', unit: 'mm_usd',  transform: 'level',   group: 'supply' },

  // Industrial Real Estate
  TLPRVCONS:        { label: 'Total Private Construction Spending', freq: 'monthly', unit: 'mm_usd', transform: 'level',  group: 'supply' },
  TLMFGCONS:        { label: 'Manufacturing Construction Spending', freq: 'monthly', unit: 'mm_usd', transform: 'level',  group: 'supply' },
  DRCRELEXFACBS:    { label: 'CRE Loan Delinquency Rate (ex Farmland)', freq: 'quarterly', unit: 'percent', transform: 'level', group: 'supply' },
  COMREPUSQ159N:    { label: 'Commercial Real Estate Prices',     freq: 'quarterly', unit: 'index',   transform: 'level',   group: 'supply' },
  MCUMFN:           { label: 'Capacity Utilization: Mfg (NAICS)', freq: 'monthly', unit: 'percent', transform: 'level',   group: 'supply' },

  // Middle Mile
  TRUCKD11:         { label: 'ATA Truck Tonnage Index',           freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  CES4348400001:    { label: 'Truck Transportation Employment',   freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  TSIFRGHT:         { label: 'Transportation Services: Freight',  freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  HTRUCKSSAAR:      { label: 'Heavy Truck Sales SAAR',            freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  PCU484121484121:  { label: 'PPI: Long-Distance General Freight TL', freq: 'monthly', unit: 'index', transform: 'level', group: 'supply' },
  RAILFRTINTERMODAL:{ label: 'Rail Freight Intermodal Traffic',   freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  RAILFRTCARLOADS:  { label: 'Rail Freight Carloads',             freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },

  // Last Mile
  CES4349200001:    { label: 'Couriers & Messengers Employment',  freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  CES4348800001:    { label: 'Support Activities for Transp Emp', freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  ECOMPCTSA:        { label: 'E-commerce % of Retail Sales',      freq: 'quarterly', unit: 'percent', transform: 'level', group: 'supply' },
  ECOMSA:           { label: 'E-commerce Retail Sales',           freq: 'quarterly', unit: 'mm_usd',  transform: 'level', group: 'supply' },
  CEU4200000001:    { label: 'Retail Trade Employment',           freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  LTRUCKSA:         { label: 'Light Trucks SAAR',                 freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },
  GASREGW:          { label: 'Retail Gasoline Price',             freq: 'weekly',  unit: 'usd',     transform: 'level',   group: 'supply' },
  PCU492492:        { label: 'PPI: Couriers & Messengers',        freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  PCU484110484110:  { label: 'PPI: General Freight Trucking, Local', freq: 'monthly', unit: 'index', transform: 'level',  group: 'supply' },

  // International / Sourcing
  BOPGIMP:          { label: 'US Imports of Goods (BoP)',         freq: 'monthly', unit: 'mm_usd',  transform: 'level',   group: 'supply' },
  BOPGEXP:          { label: 'US Exports of Goods (BoP)',         freq: 'monthly', unit: 'mm_usd',  transform: 'level',   group: 'supply' },
  CES4348100001:    { label: 'Air Transportation Employment',     freq: 'monthly', unit: 'count',   transform: 'level',   group: 'supply' },

  // V2 additions: Mfg PMI delivery times (regional Fed surveys) + pulp PPI
  DTCDISA066MSFRBNY: { label: 'Empire State Mfg Delivery Time',   freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  DTCDFSA066MSFRBPHI:{ label: 'Philly Fed Mfg Delivery Time',     freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },

  // ====================== BONDS DASHBOARD (/markets/bonds/) ====================
  DGS30:         { label: '30Y Treasury Yield',            freq: 'daily',   unit: 'percent', transform: 'level', group: 'bonds' },
  DFII5:         { label: '5Y TIPS Real Yield',            freq: 'daily',   unit: 'percent', transform: 'level', group: 'bonds' },
  DFII30:        { label: '30Y TIPS Real Yield',           freq: 'daily',   unit: 'percent', transform: 'level', group: 'bonds' },
  DTB3:          { label: '3-Month Treasury Bill',         freq: 'daily',   unit: 'percent', transform: 'level', group: 'bonds' },
  DTMSAMFRBDAL:      { label: 'Dallas Fed Mfg Delivery Time',     freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  WPU0911:           { label: 'PPI: Wood Pulp',                   freq: 'monthly', unit: 'index',   transform: 'level',   group: 'supply' },
  // ====== 2026-09 revamp: policy, liquidity/fiscal, global/FX/commodities, analytics ======
  DFEDTARU: { label: 'Fed Funds Target Upper', freq: 'daily', unit: 'percent', transform: 'level', group: 'policy' },
  DFEDTARL: { label: 'Fed Funds Target Lower', freq: 'daily', unit: 'percent', transform: 'level', group: 'policy' },
  SOFR: { label: 'SOFR', freq: 'daily', unit: 'percent', transform: 'level', group: 'policy' },
  DGS1MO: { label: '1M Treasury Yield', freq: 'daily', unit: 'percent', transform: 'level', group: 'policy' },
  DGS3MO: { label: '3M Treasury Yield', freq: 'daily', unit: 'percent', transform: 'level', group: 'policy' },
  DGS6MO: { label: '6M Treasury Yield', freq: 'daily', unit: 'percent', transform: 'level', group: 'policy' },
  DGS1: { label: '1Y Treasury Yield', freq: 'daily', unit: 'percent', transform: 'level', group: 'policy' },
  DGS3: { label: '3Y Treasury Yield', freq: 'daily', unit: 'percent', transform: 'level', group: 'policy' },
  DGS7: { label: '7Y Treasury Yield', freq: 'daily', unit: 'percent', transform: 'level', group: 'policy' },
  DGS20: { label: '20Y Treasury Yield', freq: 'daily', unit: 'percent', transform: 'level', group: 'policy' },
  THREEFYTP10: { label: '10Y Term Premium (Kim-Wright)', freq: 'daily', unit: 'percent', transform: 'level', group: 'policy' },
  FEDTARMD: { label: 'FOMC SEP Median Fed Funds', freq: 'annual', unit: 'percent', transform: 'level', group: 'policy' },
  FEDTARMDLR: { label: 'FOMC SEP Median Longer-Run Fed Funds', freq: 'annual', unit: 'percent', transform: 'level', group: 'policy' },
  PCEPI: { label: 'PCE Price Index', freq: 'monthly', unit: 'index', transform: 'yoy_pct', group: 'policy' },
  WRESBAL: { label: 'Reserve Balances at Fed', freq: 'weekly', unit: 'bn_usd', transform: 'level', group: 'liquidity' },
  MTSDS133FMS: { label: 'Federal Surplus/Deficit (monthly)', freq: 'monthly', unit: 'mm_usd', transform: 'level', group: 'liquidity' },
  FYFSGDA188S: { label: 'Federal Surplus/Deficit % GDP', freq: 'annual', unit: 'percent', transform: 'level', group: 'liquidity' },
  FYOIGDA188S: { label: 'Federal Interest Outlays % GDP', freq: 'annual', unit: 'percent', transform: 'level', group: 'liquidity' },
  A091RC1Q027SBEA: { label: 'Federal Interest Payments (SAAR)', freq: 'quarterly', unit: 'bn_usd', transform: 'level', group: 'liquidity' },
  GFDEGDQ188S: { label: 'Federal Debt % GDP', freq: 'quarterly', unit: 'percent', transform: 'level', group: 'liquidity' },
  GDP: { label: 'Nominal GDP', freq: 'quarterly', unit: 'bn_usd', transform: 'level', group: 'liquidity' },
  FGRECPT: { label: 'Federal Current Receipts (SAAR)', freq: 'quarterly', unit: 'bn_usd', transform: 'level', group: 'liquidity' },
  DEXUSEU: { label: 'USD per EUR', freq: 'daily', unit: 'fx', transform: 'level', group: 'global' },
  DEXJPUS: { label: 'JPY per USD', freq: 'daily', unit: 'fx', transform: 'level', group: 'global' },
  DEXCHUS: { label: 'CNY per USD', freq: 'daily', unit: 'fx', transform: 'level', group: 'global' },
  DEXUSUK: { label: 'USD per GBP', freq: 'daily', unit: 'fx', transform: 'level', group: 'global' },
  DEXMXUS: { label: 'MXN per USD', freq: 'daily', unit: 'fx', transform: 'level', group: 'global' },
  DEXCAUS: { label: 'CAD per USD', freq: 'daily', unit: 'fx', transform: 'level', group: 'global' },
  ECBDFR: { label: 'ECB Deposit Facility Rate', freq: 'daily', unit: 'percent', transform: 'level', group: 'global' },
  IRLTLT01DEM156N: { label: 'Germany 10Y Yield', freq: 'monthly', unit: 'percent', transform: 'level', group: 'global' },
  IRLTLT01JPM156N: { label: 'Japan 10Y Yield', freq: 'monthly', unit: 'percent', transform: 'level', group: 'global' },
  IRLTLT01GBM156N: { label: 'UK 10Y Yield', freq: 'monthly', unit: 'percent', transform: 'level', group: 'global' },
  DCOILBRENTEU: { label: 'Brent Crude Spot', freq: 'daily', unit: 'usd', transform: 'level', group: 'global' },
  DHHNGSP: { label: 'Henry Hub Natural Gas Spot', freq: 'daily', unit: 'usd', transform: 'level', group: 'global' },
  PCOPPUSDM: { label: 'Global Copper Price', freq: 'monthly', unit: 'usd', transform: 'level', group: 'global' },
  SAHMREALTIME: { label: 'Sahm Rule (real-time)', freq: 'monthly', unit: 'percent', transform: 'level', group: 'cycle' },
  BAA10Y: { label: 'Baa Corporate - 10Y Treasury Spread', freq: 'daily', unit: 'percent', transform: 'level', group: 'cycle' },
  AAA10Y: { label: 'Aaa Corporate - 10Y Treasury Spread', freq: 'daily', unit: 'percent', transform: 'level', group: 'cycle' },
  CFNAI: { label: 'Chicago Fed National Activity Index', freq: 'monthly', unit: 'index', transform: 'level', group: 'cycle' },
  CFNAIMA3: { label: 'CFNAI 3-Month Average', freq: 'monthly', unit: 'index', transform: 'level', group: 'cycle' },
  NFCIRISK: { label: 'NFCI Risk Subindex', freq: 'weekly', unit: 'index', transform: 'level', group: 'cycle' },
  NFCICREDIT: { label: 'NFCI Credit Subindex', freq: 'weekly', unit: 'index', transform: 'level', group: 'cycle' },
  NFCILEVERAGE: { label: 'NFCI Leverage Subindex', freq: 'weekly', unit: 'index', transform: 'level', group: 'cycle' },
  POPTHM: { label: 'US Population', freq: 'monthly', unit: 'count', transform: 'level', group: 'geography' },
};

// Sleep helper for retry backoff.
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Fetch one FRED series with retry on transient 5xx upstream errors.
// FRED occasionally returns 500 Internal Server Error for live requests; a
// quick retry usually succeeds. We retry on 5xx + 429 only — never on 4xx
// (bad series id, etc.).
async function fetchSeries(id, key, start, opts = {}) {
  const url = new URL(FRED_BASE);
  url.searchParams.set('series_id', id);
  url.searchParams.set('api_key', key);
  url.searchParams.set('file_type', 'json');
  if (start) url.searchParams.set('observation_start', start);
  if (opts.realtimeStart) url.searchParams.set('realtime_start', opts.realtimeStart);
  if (opts.realtimeEnd)   url.searchParams.set('realtime_end',   opts.realtimeEnd);

  const RETRY_DELAYS = [250, 750, 1500]; // 3 retries before giving up
  let lastErr = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'siberforge.xyz/1.0 (+https://www.siberforge.xyz)', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const json = await res.json();
        const observations = (json.observations || [])
          .filter(o => o.value !== '.' && o.value !== null && o.value !== undefined)
          .map(o => ({ date: o.date, value: Number(o.value) }))
          .filter(o => Number.isFinite(o.value));
        return { id, meta: CATALOG[id] || null, observations };
      }
      // Non-OK response. Read body for debug; decide if we should retry.
      const text = await res.text();
      const transient = res.status >= 500 || res.status === 429;
      lastErr = new Error(`FRED ${id} ${res.status}: ${text.slice(0, 120).replace(/api_key=[^&\s"]+/gi, 'api_key=REDACTED')}`);
      lastErr.status = res.status;
      if (!transient || attempt === RETRY_DELAYS.length) throw lastErr;
      await sleep(RETRY_DELAYS[attempt]);
    } catch (err) {
      // Network/connection error — also transient; retry until we exhaust.
      // A 4xx thrown above (block, bad id) is final: rethrow immediately.
      if (err && err.status && err.status < 500 && err.status !== 429) throw err;
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === RETRY_DELAYS.length) throw lastErr;
      await sleep(RETRY_DELAYS[attempt]);
    }
  }
  // Should be unreachable but guard anyway.
  throw lastErr || new Error(`FRED ${id} unknown failure`);
}

function validDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }

// State-level + MSA-level allowlist patterns. Allowing these by regex avoids
// dumping ~250 explicit catalog entries per state * ~6 metrics each.
const STATE_RE = /^([A-Z]{2})(UR|STHPI|POP|NA|NQGSP|UPOP|CONS|MFG|RETL|TRAD|GOVT)$/;
const MSA_RE   = /^(ATNHPIUS\d{5}Q|LAUMT\d+|LAUMT.*A|MSACSR.*)$/;
const CPI_RE   = /^CUU[RS]A?\d{3,4}SA[A-Z0-9]+$/;

export default async function handler(req, res) {
  // Same-origin policy + best-effort rate limit. See api/_guard.js.
  if (guard(req, res, { limit: 90 })) return;

  const key = process.env.FRED_API_KEY;
  if (!key) return res.status(500).json({ error: 'FRED_API_KEY not configured on server' });

  if (req.query.catalog) return res.status(200).json({ catalog: CATALOG });

  const seriesParam = (req.query.series || '').trim();
  if (!seriesParam) return res.status(400).json({ error: 'missing ?series=ID1,ID2,...' });

  const ids = seriesParam.split(',').map(s => s.trim()).filter(Boolean);
  const unknown = ids.filter(id => !CATALOG[id] && !STATE_RE.test(id) && !MSA_RE.test(id) && !CPI_RE.test(id));
  if (unknown.length) return res.status(400).json({ error: `unknown series: ${unknown.join(',')}` });

  if (ids.length > 40) return res.status(400).json({ error: 'at most 40 series per request' });

  const start = req.query.start || '2010-01-01';
  if (!validDate(start)) return res.status(400).json({ error: 'start must be YYYY-MM-DD' });
  const opts = {};
  if (req.query.realtime_start) {
    if (!validDate(req.query.realtime_start)) return res.status(400).json({ error: 'realtime_start must be YYYY-MM-DD' });
    opts.realtimeStart = req.query.realtime_start;
  }
  if (req.query.realtime_end) {
    if (!validDate(req.query.realtime_end)) return res.status(400).json({ error: 'realtime_end must be YYYY-MM-DD' });
    opts.realtimeEnd = req.query.realtime_end;
  }

  try {
    // At most 4 upstream calls in flight, and stop calling FRED at all once it
    // answers 403: that is an IP-level block, and hammering it prolongs it.
    let blocked = false;
    const settled = new Array(ids.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(4, ids.length) }, async () => {
      while (next < ids.length) {
        const i = next++;
        if (blocked) { settled[i] = { status: 'rejected', reason: new Error(`FRED ${ids[i]} skipped: upstream blocked (403)`) }; continue; }
        try { settled[i] = { status: 'fulfilled', value: await fetchSeries(ids[i], key, start, opts) }; }
        catch (e) { if (e && e.status === 403) blocked = true; settled[i] = { status: 'rejected', reason: e }; }
      }
    }));
    const series = [];
    const errors = [];
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') series.push(r.value);
      else errors.push({ id: ids[i], error: String(r.reason?.message || r.reason) });
    });
    if (series.length === 0 && errors.length > 0) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ error: 'all series failed', errors });
    }
    // Only a complete answer earns the long edge cache; a partial one would
    // pin the missing series as missing for hours.
    res.setHeader('Cache-Control', errors.length
      ? 'public, s-maxage=60, stale-while-revalidate=300'
      : 'public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ series, errors });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
