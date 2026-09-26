// Metric catalog for the Geography dashboard.
//
// Each entry is a state/MSA-level economic metric with structured metadata:
//   what    — one-line definition
//   why     — why a finance/strategy reader cares
//   drivers — what makes it move
//   soWhat  — translation to housing/consumer/operational decisions
//   source  — primary data source + cadence (live FRED vs snapshot)
//   sample  — illustrative latest value (varies by state — formatted as "range" string)
//
// "live" entries are pulled from FRED on demand using the existing /api/fred
// proxy. "snapshot" entries reflect a hardcoded latest value and refresh
// quarterly/annually depending on the source release schedule.

export const METRIC_CATALOG = [
  // ============================== LABOR & INCOME ==============================
  {
    id: 'lfpr', category: 'Labor & Income',
    label: 'Labor Force Participation Rate',
    source: 'BLS via FRED · monthly · live',
    sample: 'Range: ~55% (WV) to ~70% (UT)',
    what: 'Share of the working-age (16+) population either employed or actively looking for work.',
    why:  'Unemployment alone is misleading — it can fall while LFPR collapses (people give up). True labor health requires both.',
    drivers: 'Aging populations (lower LFPR), education levels, retirement timing, disability rates, immigration, child-care availability, prime-age (25-54) demographics.',
    soWhat: 'Higher LFPR = larger pool of consumers + household-formers. Sun Belt states with younger populations have structurally higher LFPR — supports housing demand.',
  },
  {
    id: 'pcpi', category: 'Labor & Income',
    label: 'Per-Capita Personal Income',
    source: 'BEA via FRED · annual · live',
    sample: 'Range: ~$50K (MS) to ~$95K (CT, MA, DC)',
    what: 'Total state personal income divided by state population.',
    why:  'The denominator behind every affordability and ticket-size decision. Per-capita income normalizes for state size.',
    drivers: 'Industry mix (finance/tech/professional pay more), education levels, age structure, cost-of-living adjusted via local pay, federal transfers.',
    soWhat: 'Sets aggregate ticket-size capacity. High-income states tolerate higher P&I burdens; low-income states see affordability stress at lower price points.',
  },
  {
    id: 'gdp', category: 'Labor & Income',
    label: 'Real GDP by State',
    source: 'BEA via FRED · quarterly · live',
    sample: 'Range varies; YoY typically +1% to +5% across states',
    what: 'Inflation-adjusted state economic output. YoY growth is the cleanest single measure of state economic momentum.',
    why:  'Aggregates everything — production, services, government — into one number. Tracks state-level cyclicality.',
    drivers: 'Industry mix, energy production (TX, ND), tech (CA, WA), federal spending (DC, VA), tourism (NV, FL), manufacturing (MI, IN).',
    soWhat: 'Above-trend GDP growth = consumer + business spending tailwind = hardware/HI demand support. Below-trend states have proportional headwind.',
  },
  {
    id: 'jolts', category: 'Labor & Income',
    label: 'Job Openings Rate (JOLTS State)',
    source: 'BLS state-level JOLTS · monthly · snapshot',
    sample: 'Range: ~3% to ~7% across states',
    what: 'Job openings as a percentage of total employment + openings. Real-time labor demand.',
    why:  'Leads payroll growth by 3-6 months. Falling openings rate = labor demand cooling before it shows in unemployment.',
    drivers: 'Industry mix, labor mobility, state population trends, business formation, seasonal patterns.',
    soWhat: 'High openings + low unemployment = wage pressure + consumer spending tailwind. Falling openings is the first labor-cycle warning.',
  },
  {
    id: 'wages', category: 'Labor & Income',
    label: 'Average Hourly Earnings (State)',
    source: 'BLS QCEW · quarterly · snapshot',
    sample: 'Range: ~$25/hr (MS) to ~$45/hr (DC, MA, CA)',
    what: 'Average hourly earnings of private-sector employees by state.',
    why:  'Direct read on wage pressure by region. Pair with state CPI for real wage growth.',
    drivers: 'Industry mix, minimum wage laws, unionization, labor market tightness, cost-of-living adjustments.',
    soWhat: 'Faster wage growth than US national average = real consumer purchasing power gain in that state. Net positive for ticket sizes.',
  },

  // ============================== INDUSTRY MIX ==============================
  {
    id: 'mfg-share', category: 'Industry Mix',
    label: 'Manufacturing Employment Share',
    source: 'BLS QCEW via FRED · monthly · live',
    sample: 'Range: ~3% (NV) to ~18% (IN, WI, MI)',
    what: 'Manufacturing employment as a percentage of total state nonfarm employment.',
    why:  'Identifies states whose business cycle tracks the goods-producing economy. Manufacturing-heavy states experience deeper recessions and stronger expansions.',
    drivers: 'Historical industrial concentration, port/transport access, energy costs, right-to-work laws, labor costs, automation.',
    soWhat: 'High-mfg states (Midwest) more pro-cyclical and more sensitive to ISM/PMI. Their housing markets follow goods-economy cycles more than coastal services-tech states.',
  },
  {
    id: 'gov-share', category: 'Industry Mix',
    label: 'Government Employment Share',
    source: 'BLS QCEW via FRED · monthly · live',
    sample: 'Range: ~12% (NV, WY) to ~25% (DC, HI, AK)',
    what: 'Federal + state + local government employment as % of state nonfarm.',
    why:  'High government share = more cycle stability (gov payrolls less cyclical). Also affects fiscal-policy sensitivity.',
    drivers: 'State capital effects, federal facilities, military bases, presence of state university systems.',
    soWhat: 'Government-heavy states have lower volatility but lower upside. Steady housing demand; less cyclical risk; muted Pro-channel growth.',
  },
  {
    id: 'health-share', category: 'Industry Mix',
    label: 'Healthcare Employment Share',
    source: 'BLS QCEW · monthly · snapshot',
    sample: 'Range: ~10% (UT) to ~18% (MA, MD)',
    what: 'Healthcare and social-assistance employment as % of state nonfarm.',
    why:  'Secular growth sector — has expanded in every state for decades. Defensive characteristics; weakly cyclical.',
    drivers: 'Population age, rural vs urban hospital networks, Medicaid expansion, university medical centers.',
    soWhat: 'Higher healthcare share = more recession-resistant economy. Older, healthcare-heavy states (FL retiree zones) buffer downturns.',
  },
  {
    id: 'ttu-share', category: 'Industry Mix',
    label: 'Trade/Transport/Utilities Share',
    source: 'BLS QCEW via FRED · monthly · live',
    sample: 'Range: ~14% (DC) to ~22% (NV, GA, TN)',
    what: 'Trade, transportation, and utilities sector as % of state nonfarm.',
    why:  'Distribution-economy proxy. States with major ports/logistics hubs have outsized TTU shares; consumer-cycle sensitive.',
    drivers: 'Port/airport infrastructure, e-commerce fulfillment networks (Amazon), logistics corridors, retail concentration.',
    soWhat: 'High TTU share = leveraged exposure to consumer spending swings. Useful for consumer-discretionary read by region.',
  },

  // ============================== REAL ESTATE OPERATIONAL ==============================
  {
    id: 'active-inventory', category: 'Real Estate Operational',
    label: 'Active Listings Inventory',
    source: 'Realtor.com Data · monthly · snapshot',
    sample: 'Range varies; tracking vs prior year is the signal',
    what: 'Total number of active for-sale listings in the state/metro at month end.',
    why:  'The inventory side of the supply/demand equation. Falling inventory = pent-up demand; rising = overhang.',
    drivers: 'New listings vs sales pace, mortgage-rate-locked sellers, builder activity, investor activity, mortality + downsizing flow.',
    soWhat: 'Tight inventory supports prices and pro-channel demand (renovate-and-stay). Loose inventory = pricing pressure + builder share competition.',
  },
  {
    id: 'days-on-market', category: 'Real Estate Operational',
    label: 'Median Days on Market',
    source: 'Realtor.com Data · monthly · snapshot',
    sample: 'Range: ~20 days (tight) to ~80 days (soft)',
    what: 'Median number of days a listing stays on the market before going under contract.',
    why:  'Real-time speed-of-market indicator. Falling DOM = sellers gaining leverage; rising DOM = buyers gaining leverage.',
    drivers: 'Mortgage rates, inventory levels, seasonality, price-discovery efficiency, local economic conditions.',
    soWhat: '<25 days = sellers market with minimal price negotiation; >60 days = buyers market with deeper price cuts and concessions.',
  },
  {
    id: 'sale-list-ratio', category: 'Real Estate Operational',
    label: 'Sale-to-List Price Ratio',
    source: 'Redfin Data Center · monthly · snapshot',
    sample: 'Range: 95% (soft) to 105% (hot)',
    what: 'Final sale price divided by original list price. Above 100% = buyers paying above asking.',
    why:  'The cleanest single read on bidding-war intensity. Tells you whether sellers are realizing list price or cutting.',
    drivers: 'Inventory tightness, demand strength, list-price calibration by sellers/agents, mortgage rate environment.',
    soWhat: '>102% = bidding wars (hot market, builder pricing power); <97% = price cuts dominate (soft market, builder margin pressure).',
  },
  {
    id: 'rent-zori', category: 'Real Estate Operational',
    label: 'Median Rent (Zillow ZORI)',
    source: 'Zillow Observed Rent Index · monthly · snapshot',
    sample: 'Range: ~$1,100 (rural Midwest) to ~$3,500 (SF, NYC)',
    what: 'Repeat-rent index of asking rents for newly-listed units. Excludes existing-tenant rents.',
    why:  'Leading indicator of CPI rent (which lags by 6-12mo). The actually-current rent dynamics, not the BLS-method-lagged version.',
    drivers: 'Rental supply, in/out-migration, wage growth, household formation, eviction-moratorium effects, build-to-rent supply.',
    soWhat: 'Rent growth predicts housing-formation dynamics. Falling rents = household-formation slowdown = HI demand softness.',
  },
  {
    id: 'sfr-index', category: 'Real Estate Operational',
    label: 'Single-Family Rent Index',
    source: 'Zillow / John Burns · monthly · snapshot',
    sample: 'YoY typically -2% to +8% across metros',
    what: 'Rent index specifically for single-family rentals, distinct from apartments.',
    why:  'SFR is a fast-growing institutional asset class. Cap rates here drive build-to-rent activity which competes with traditional buyers.',
    drivers: 'Institutional demand (Invitation Homes, AMH), households unable to qualify for mortgages, family size shifts, suburb preference.',
    soWhat: 'Strong SFR rent growth = build-to-rent expansion = competitive pressure on first-time-buyer market and corresponding shifts in HI demand mix.',
  },

  // ============================== DEMOGRAPHICS DEEP-CUTS ==============================
  {
    id: 'biz-formation', category: 'Demographics & Society',
    label: 'New Business Formation',
    source: 'Census BFS · weekly · snapshot',
    sample: 'Range: ~5K/wk (small states) to ~80K/wk (CA, FL, TX)',
    what: 'New business applications filed (high-propensity formations leading to actual business starts).',
    why:  'Leading indicator for state economic dynamism. Rising formations = entrepreneurial activity = future job creation.',
    drivers: 'Tax/regulatory environment, in-migration, business-friendly state laws, wealth effects, post-COVID work-from-anywhere.',
    soWhat: 'High-formation states (FL, TX, GA) have stronger forward economic dynamism + corresponding housing/HI demand tailwinds.',
  },
  {
    id: 'foreign-born', category: 'Demographics & Society',
    label: '% Foreign Born',
    source: 'Census ACS · annual · snapshot',
    sample: 'Range: ~2% (WV, MS) to ~27% (CA, NJ)',
    what: 'Share of state residents born outside the United States.',
    why:  'Immigration-heavy states have different consumption patterns, household-formation dynamics, and labor-supply characteristics.',
    drivers: 'Historical immigration patterns, sanctuary policies, gateway-city status, agricultural/service-economy labor demand.',
    soWhat: 'High foreign-born % correlates with higher household-formation rate (younger immigrants form households faster) and different home-improvement/repair preferences.',
  },
  {
    id: 'birth-rate', category: 'Demographics & Society',
    label: 'Birth Rate / Fertility',
    source: 'CDC NCHS · annual · snapshot',
    sample: 'Range: ~50 births/1000 women (VT) to ~70 (UT, SD)',
    what: 'Births per 1,000 women aged 15-44 per year.',
    why:  'Long-cycle household-demand signal. Birth-rate cohorts feed household formation 25-30 years later.',
    drivers: 'Cultural factors, religious composition, educational attainment, cost-of-living, housing affordability, child-care availability.',
    soWhat: 'High-fertility states (Utah, South Dakota) have built-in 25-year demographic tailwinds. Low-fertility coastal states have headwinds.',
  },

  // ============================== FISCAL / TAX ==============================
  {
    id: 'tax-burden', category: 'Fiscal / Tax',
    label: 'State + Local Tax Burden',
    source: 'Tax Foundation · annual · snapshot',
    sample: 'Range: ~6% (AK, WY, TN) to ~15% (NY, HI, CT)',
    what: 'Total state + local taxes paid by residents as % of personal income.',
    why:  'Direct measure of consumer disposable income drag. Drives migration patterns and after-tax purchasing power.',
    drivers: 'Income tax rates, sales tax rates, property tax rates, severance taxes (energy states), no-income-tax-state policies.',
    soWhat: 'Lower-tax states retain net-domestic-migration tailwind. After-tax HI ticket-size capacity meaningfully different across states.',
  },
  {
    id: 'property-tax', category: 'Fiscal / Tax',
    label: 'Effective Property Tax Rate',
    source: 'Tax Foundation / ATTOM · annual · snapshot',
    sample: 'Range: ~0.3% (HI) to ~2.2% (NJ, IL)',
    what: 'Property taxes paid as % of property value (effective rate).',
    why:  'Direct ownership cost, in addition to mortgage P&I. NJ and IL effectively double the housing cost via property taxes.',
    drivers: 'School funding model (local vs state-level), municipal services, state homestead exemptions, assessment frequency.',
    soWhat: 'Effective monthly housing cost = mortgage P&I + property taxes + insurance. High-property-tax states see sharper turnover slowdown when rates rise.',
  },
  {
    id: 'fiscal-health', category: 'Fiscal / Tax',
    label: 'State Fiscal Health (Days Reserve)',
    source: 'Pew / state CAFRs · annual · snapshot',
    sample: 'Range: 0 days (IL) to ~200+ days (TX, AK rainy-day funds)',
    what: 'State general fund reserves expressed as days of operating expenses covered.',
    why:  'Fiscally healthy states have flexibility to support residents/businesses through downturns. Fiscally stressed states cut services.',
    drivers: 'Pension funding levels, debt levels, tax-revenue diversification, prior fiscal management.',
    soWhat: 'Strong reserve states (TX, FL, WY) ride out recessions without service cuts; weak ones (IL, NJ) face austerity that compounds local economic slowdown.',
  },

  // ============================== ENERGY / COST OF LIVING ==============================
  {
    id: 'electricity', category: 'Energy / Cost of Living',
    label: 'Residential Electricity Price',
    source: 'EIA · monthly · snapshot',
    sample: 'Range: ~10c/kWh (WA, ID) to ~40c/kWh (HI, CA)',
    what: 'Average residential retail electricity price in cents per kWh.',
    why:  'Direct utility-bill burden on households + driver of HVAC system upgrade demand.',
    drivers: 'Generation mix (hydro = cheap, oil = expensive), grid investments, regulatory environment, climate policies.',
    soWhat: 'High-power-cost states drive HVAC efficiency upgrades and solar adoption — tailwind for related HI categories.',
  },
  {
    id: 'gas-price', category: 'Energy / Cost of Living',
    label: 'Gasoline Retail Price (regional)',
    source: 'EIA · weekly · snapshot',
    sample: 'Range: ~$2.80/gal (Gulf) to ~$4.50/gal (West Coast)',
    what: 'Average retail gasoline price by PADD region (5 regions).',
    why:  'Discretionary-spending headwind when high. Drives commute behavior + vehicle preferences.',
    drivers: 'Crude oil prices, refinery capacity, transportation logistics, state taxes, ethanol blending requirements.',
    soWhat: 'High gas prices compress consumer discretionary across the board; West Coast typically pays $1+/gal premium driven by CARB regulations.',
  },
  {
    id: 'rpp', category: 'Energy / Cost of Living',
    label: 'Regional Price Parity',
    source: 'BEA · annual · snapshot',
    sample: 'Range: ~85 (low-cost MS, AL) to ~120 (HI, NY, CA)',
    what: 'Cost-of-living index, with US = 100. Below 100 = cheaper than national average.',
    why:  'Adjusts nominal income/wages for purchasing power. $80K in Mississippi buys what $120K does in California.',
    drivers: 'Housing costs (largest component), state-level service prices, rent levels, urbanization.',
    soWhat: 'Real income comparisons between states require RPP adjustment. Affects HI-spending capacity in real (purchasing-power) terms.',
  },

  // ============================== HUMAN CAPITAL & HEALTH ==============================
  {
    id: 'bachelors', category: 'Human Capital & Health',
    label: "% with Bachelor's Degree+",
    source: 'Census ACS · annual · snapshot',
    sample: 'Range: ~22% (WV, MS) to ~45% (DC, MA, CO)',
    what: 'Share of adults aged 25+ with at least a bachelor\'s degree.',
    why:  'Long-run economic dynamism predictor. High-education states attract employers and capital, higher wages, lower unemployment volatility.',
    drivers: 'Historical investment in higher ed, employer presence (tech, finance, biotech), in-migration of college-educated, university-system strength.',
    soWhat: 'High-education states have structurally higher median income and home values, and lower job-volatility recessions. Tracks closely with HI premium-product adoption.',
  },
  {
    id: 'life-expectancy', category: 'Human Capital & Health',
    label: 'Life Expectancy',
    source: 'CDC NCHS · annual · snapshot',
    sample: 'Range: ~72 yrs (MS, WV) to ~81 yrs (HI, CA, MA)',
    what: 'Average life expectancy at birth.',
    why:  'Composite indicator of state health, healthcare access, lifestyle, environmental quality, public-health infrastructure.',
    drivers: 'Income, education, healthcare access, smoking/obesity rates, infant mortality, opioid mortality, drug-overdose rates.',
    soWhat: 'Higher life-expectancy states have older populations, longer downsizing turnover cycles, and higher accessibility-remodel demand.',
  },
];

// Convenience lookup
export const METRIC_BY_ID = Object.fromEntries(METRIC_CATALOG.map(m => [m.id, m]));

// Categories in display order
export const CATEGORIES = [
  'Labor & Income',
  'Industry Mix',
  'Real Estate Operational',
  'Demographics & Society',
  'Fiscal / Tax',
  'Energy / Cost of Living',
  'Human Capital & Health',
];
