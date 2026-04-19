// Indicator registry for the Economic Dashboard.
//
// Each entry describes one indicator: where to pull it, how to transform it,
// and how to frame it for a reader. The dashboard reads this registry,
// fetches each series, and renders cards driven entirely by these definitions.
//
// Fields:
//   id          : stable internal key (used in URLs for drill-downs)
//   source      : 'fred' | 'derived'
//                   fred    — pulled from /api/fred
//                   derived — computed client-side from other indicators
//   fredId      : FRED series ID (for source='fred')
//   dependsOn   : array of indicator IDs this derived series needs
//   deriveFn    : (depsMap) => [{date, value}, ...] (for source='derived')
//   category    : 'growth' | 'inflation' | 'consumer' | 'housing'
//   label       : full display name
//   shortLabel  : compact label for dense grids
//   unit        : display unit suffix ('%', ' bps', 'K', '')
//   decimals    : display precision
//   freq        : 'daily' | 'weekly' | 'monthly' | 'quarterly'
//   transform   : 'level' | 'level_k' | 'level_m' | 'level_bps' | 'yoy' | 'mom_diff' | 'mom_diff_k'
//                   (applied server-response → card-ready values)
//   release     : human-readable cadence note
//   context     : one-line plain-English description of what this measures / why it matters
//   direction   : 'higher_better' | 'lower_better' | 'target_band' | 'neutral'
//   target      : optional numeric target (for direction='target_band')
//   placeholder : if true, render as disabled "coming soon" card
//   cardType    : 'standard' (default) | 'compact' — compact skips sparkline & percentile
//   methodology : prose description of the series (2-4 sentences) — shown on drill-down
//   hasVintages : if true, drill-down fetches historical vintages for revision ribbons
//
// Keep context strings tight (< 90 chars). Methodology can be longer, shown
// on the drill-down page.

export const CATEGORIES = {
  growth:    { label: 'Growth',           accent: '#3b82f6' },
  inflation: { label: 'Inflation',        accent: '#ef4444' },
  consumer:  { label: 'Consumer & Labor', accent: '#10b981' },
  housing:   { label: 'Housing',          accent: '#a855f7' },
};

export const INDICATORS = [
  // ------------------------------------------------------------------ GROWTH
  {
    id: 'GDPC1',
    source: 'fred',
    fredId: 'GDPC1',
    category: 'growth',
    label: 'Real GDP (YoY)',
    shortLabel: 'Real GDP',
    unit: '%',
    decimals: 1,
    freq: 'quarterly',
    transform: 'yoy',
    release: 'Advance ~30 days after quarter end; revised twice',
    context: 'Headline output of the US economy. Sub-2% YoY historically signals below-trend growth.',
    direction: 'higher_better',
    hasVintages: true,
    methodology: 'Bureau of Economic Analysis quarterly measure of inflation-adjusted gross domestic product (chained 2017 dollars). Three vintages per quarter: advance estimate ~30 days after quarter end, second estimate ~60 days, third estimate ~90 days. Annual revisions each July can shift the series back ~3 years. First-print accuracy: initial estimates typically move ±0.5–1.0 percentage points on the second revision as missing data fills in — markets still trade the advance print because it lands first.',
  },
  {
    id: 'GDPNOW',
    source: 'fred',
    fredId: 'GDPNOW',
    category: 'growth',
    label: 'Atlanta Fed GDPNow',
    shortLabel: 'GDPNow',
    unit: '%',
    decimals: 1,
    freq: 'daily',
    transform: 'level',
    release: 'Updated several times per week through the quarter',
    context: 'Real-time nowcast of current-quarter Real GDP (QoQ SAAR). Model-based, not a forecast.',
    direction: 'higher_better',
    methodology: 'Atlanta Fed bridge model that ingests monthly hard data (retail, housing, trade, etc.) as it releases and mechanically rolls into a quarter-on-quarter SAAR estimate for current-quarter GDP. Updated 4–7 times per quarter. Not a forecast — it is a running sum of what the existing data implies under the model. By the end of a quarter it typically falls within 0.5ppt of the advance BEA print; early in a quarter it is noisier.',
  },
  {
    id: 'T10Y3M',
    source: 'fred',
    fredId: 'T10Y3M',
    category: 'growth',
    label: '10Y–3M Treasury Spread',
    shortLabel: '10Y–3M Spread',
    unit: ' bps',
    decimals: 0,
    freq: 'daily',
    transform: 'level_bps', // FRED returns %; multiply by 100
    release: 'Daily',
    context: 'Yield-curve recession signal. Sustained inversion (<0) has preceded every US recession since 1960.',
    direction: 'higher_better',
    methodology: 'Spread between the 10-year constant-maturity Treasury yield and the 3-month Treasury bill rate. The NY Fed\'s preferred recession-probability input (per Estrella-Mishkin). Inversion has preceded every US recession since 1960 with 6–18 month leads. More reliable than 2s10s for recession signaling per most academic studies, though 2s10s draws more financial-press attention.',
  },
  {
    id: 'INDPRO',
    source: 'fred',
    fredId: 'INDPRO',
    category: 'growth',
    label: 'Industrial Production (YoY)',
    shortLabel: 'Ind. Production',
    unit: '%',
    decimals: 1,
    freq: 'monthly',
    transform: 'yoy',
    release: 'Mid-month, prior month',
    context: 'Output of factories, mines, utilities. Cyclical proxy for the goods economy (since ISM left FRED in 2021).',
    direction: 'higher_better',
    methodology: 'Federal Reserve Board G.17 release. Broad measure of physical output in manufacturing (~75% of index weight), mining, and electric/gas utilities. Chain-weighted, base period 2017=100. Less relevant than it once was since services now dominate GDP, but remains the best monthly read on goods-sector capacity utilization.',
  },
  {
    id: 'EMPIRE',
    source: 'fred',
    fredId: 'GACDISA066MSFRBNY',
    category: 'growth',
    label: 'Empire State Manufacturing Index',
    shortLabel: 'Empire State',
    unit: '',
    decimals: 1,
    freq: 'monthly',
    transform: 'level',
    release: 'Mid-month, current month (earliest US manufacturing reading)',
    context: 'NY Fed diffusion index. >0 expansion, <0 contraction. First US manufacturing datapoint each month.',
    direction: 'higher_better',
    methodology: 'Monthly survey of ~200 manufacturing executives in the NY Fed\'s district. Reported as a diffusion index: percentage reporting improvement minus percentage reporting deterioration. Released ~15th of the current month, making it the first manufacturing data each month — often watched as a preview of the national ISM.',
  },
  // Yield-curve additions (Phase 2)
  {
    id: 'DGS2',
    source: 'fred',
    fredId: 'DGS2',
    category: 'growth',
    label: '2Y Treasury Yield',
    shortLabel: '2Y Yield',
    unit: '%',
    decimals: 2,
    freq: 'daily',
    transform: 'level',
    release: 'Daily',
    context: 'Front-end rate. Most sensitive to near-term Fed policy expectations.',
    direction: 'neutral',
    methodology: 'Constant-maturity 2-year Treasury yield, daily closing rate published by the Fed Board (H.15 release). Effectively reflects the market\'s expected average fed funds rate over the next 24 months plus a small term premium. The front end of the curve most traders watch for near-term policy signaling.',
  },
  {
    id: 'DGS5',
    source: 'fred',
    fredId: 'DGS5',
    category: 'growth',
    label: '5Y Treasury Yield',
    shortLabel: '5Y Yield',
    unit: '%',
    decimals: 2,
    freq: 'daily',
    transform: 'level',
    release: 'Daily',
    context: 'Belly of the curve. Reflects medium-term growth + inflation expectations.',
    direction: 'neutral',
    methodology: 'Constant-maturity 5-year Treasury yield. Sits at the belly of the curve — blends near-term policy expectations (like the 2Y) with inflation and term premium components (like the 10Y). Often the most-traded duration bucket for leveraged fixed-income strategies.',
  },
  {
    id: 'T10Y2Y',
    source: 'fred',
    fredId: 'T10Y2Y',
    category: 'growth',
    label: '10Y–2Y Spread (2s10s)',
    shortLabel: '10Y–2Y Spread',
    unit: ' bps',
    decimals: 0,
    freq: 'daily',
    transform: 'level_bps',
    release: 'Daily',
    context: 'Classic recession indicator. Inversion historically leads recessions by 12–18 months.',
    direction: 'higher_better',
    methodology: 'Spread between 10Y and 2Y constant-maturity Treasury yields. The classic "2s10s" curve that financial press covers. Inversion has preceded every US recession since 1976, but with long and variable leads (12–24 months). Less statistically robust than T10Y3M per NY Fed research, but more closely watched.',
  },

  // --------------------------------------------------------------- INFLATION
  {
    id: 'PCEPILFE',
    source: 'fred',
    fredId: 'PCEPILFE',
    category: 'inflation',
    label: 'Core PCE (YoY)',
    shortLabel: 'Core PCE',
    unit: '%',
    decimals: 2,
    freq: 'monthly',
    transform: 'yoy',
    release: 'End of month, prior month',
    context: "Fed's preferred inflation gauge. Target 2.0%. Excludes food & energy.",
    direction: 'target_band',
    target: 2.0,
    methodology: 'Core Personal Consumption Expenditures price index from the Bureau of Economic Analysis, excluding food and energy. The Fed\'s preferred inflation gauge because the basket flexibly reweights month-to-month based on actual household spending (captures substitution behavior). Typically runs 0.3–0.5 percentage points below Core CPI. The 2% target is exact, measured as a long-run average.',
  },
  {
    id: 'CPILFESL',
    source: 'fred',
    fredId: 'CPILFESL',
    category: 'inflation',
    label: 'Core CPI (YoY)',
    shortLabel: 'Core CPI',
    unit: '%',
    decimals: 2,
    freq: 'monthly',
    transform: 'yoy',
    release: 'Mid-month, prior month',
    context: 'Consumer price inflation ex food & energy. Typically runs ~0.4ppt above Core PCE.',
    direction: 'target_band',
    target: 2.0,
    methodology: 'Core CPI from the Bureau of Labor Statistics, excluding food and energy. Released ~2 weeks before Core PCE, making it the market\'s first inflation read each month. Uses a fixed basket (no substitution adjustment) — that structural difference is why it systematically runs above Core PCE.',
  },
  {
    id: 'STICKY',
    source: 'fred',
    fredId: 'CORESTICKM159SFRBATL',
    category: 'inflation',
    label: 'Atlanta Sticky-Price CPI (YoY)',
    shortLabel: 'Sticky CPI',
    unit: '%',
    decimals: 2,
    freq: 'monthly',
    transform: 'level', // this series is already published as 12-mo pct change
    release: 'Mid-month, with CPI',
    context: 'Subset of CPI basket with slow-moving prices. A cleaner read on inflation persistence than headline.',
    direction: 'target_band',
    target: 2.0,
    methodology: 'Atlanta Fed measure that isolates CPI basket components with prices that change infrequently — rent, medical services, education, etc. Excludes the volatile half of the basket (food, energy, used cars, airfare) that introduces month-to-month noise. A cleaner read on underlying inflation persistence than headline or even core CPI.',
  },
  {
    id: 'T5YIFR',
    source: 'fred',
    fredId: 'T5YIFR',
    category: 'inflation',
    label: '5Y5Y Forward Inflation',
    shortLabel: '5Y5Y Breakeven',
    unit: '%',
    decimals: 2,
    freq: 'daily',
    transform: 'level',
    release: 'Daily',
    context: "Market's pricing of average inflation 5–10y ahead. The Fed watches this for anchored expectations.",
    direction: 'target_band',
    target: 2.0,
    methodology: 'Five-year average inflation rate expected to prevail between 5 and 10 years from now, derived from TIPS breakevens. The Fed\'s most-watched market-based measure of long-term inflation expectations. Anchored around 2% signals that policy credibility is intact. Moves less than near-term breakevens since it strips out current inflation dynamics.',
  },

  // ------------------------------------------------------- CONSUMER & LABOR
  {
    id: 'UNRATE',
    source: 'fred',
    fredId: 'UNRATE',
    category: 'consumer',
    label: 'Unemployment Rate',
    shortLabel: 'Unemployment',
    unit: '%',
    decimals: 1,
    freq: 'monthly',
    transform: 'level',
    release: 'First Friday of month, prior month',
    context: 'Sahm Rule: 0.5ppt rise over 3mo-avg trough historically = recession underway.',
    direction: 'lower_better',
    methodology: 'U-3 unemployment rate from the BLS household survey (separate from the payrolls establishment survey). Measures unemployed / labor force. Known for the Sahm Rule: when the 3-month moving average rises 0.5 percentage points above its trailing-12-month low, the US has historically been in recession. Since 1970 the Sahm Rule has triggered during every recession, with no false positives prior to 2024.',
  },
  {
    id: 'PAYEMS',
    source: 'fred',
    fredId: 'PAYEMS',
    category: 'consumer',
    label: 'Nonfarm Payrolls (MoM change)',
    shortLabel: 'Payrolls (MoM)',
    unit: 'K',
    decimals: 0,
    freq: 'monthly',
    transform: 'mom_diff_k', // diff in thousands (FRED publishes in thousands of persons)
    release: 'First Friday of month, prior month',
    context: 'Jobs added last month. Breakeven for stable U-rate is ~100–150K given labor-force growth.',
    direction: 'higher_better',
    hasVintages: true,
    methodology: 'Total nonfarm payroll employment from the BLS Current Employment Statistics (establishment survey). Subject to substantial revisions: the initial print often moves ±50–100K on the first revision (next month) and again on the second (two months later). Annual benchmark revisions to business establishment counts can shift the entire level curve back 5+ years each January. The vintage ribbon tracks how each print evolved post-release.',
  },
  {
    id: 'AHE',
    source: 'fred',
    fredId: 'CES0500000003',
    category: 'consumer',
    label: 'Avg Hourly Earnings (YoY)',
    shortLabel: 'Wage Growth',
    unit: '%',
    decimals: 1,
    freq: 'monthly',
    transform: 'yoy',
    release: 'First Friday of month, with payrolls',
    context: 'Nominal wage growth. Pairs with real wage card below to show purchasing-power change.',
    direction: 'higher_better',
    methodology: 'Average hourly earnings of all private-sector employees from the BLS CES establishment survey. Released with payrolls. Prone to composition effects — shifts in low-wage vs high-wage employment can move the aggregate without underlying wage pressure. The Atlanta Fed Wage Growth Tracker is a cleaner same-worker measure, though not available in this dashboard yet.',
  },
  {
    // Real wage growth: nominal AHE YoY minus Core CPI YoY, aligned by date.
    // Core CPI (not headline) as deflator — smoother, more signal, fewer
    // energy-driven oscillations. Common practice for labor economists.
    id: 'REAL_WAGES',
    source: 'derived',
    dependsOn: ['AHE', 'CPILFESL'],
    deriveFn: (deps) => {
      const ahe = deps.AHE;        // transformed YoY % values
      const cpi = deps.CPILFESL;    // transformed YoY % values
      if (!ahe || !cpi) return [];
      const cpiByDate = new Map(cpi.map(o => [o.date, o.value]));
      const out = [];
      for (const a of ahe) {
        const c = cpiByDate.get(a.date);
        if (c != null) out.push({ date: a.date, value: a.value - c });
      }
      return out;
    },
    category: 'consumer',
    label: 'Real Wages (AHE − Core CPI, YoY)',
    shortLabel: 'Real Wages',
    unit: '%',
    decimals: 2,
    freq: 'monthly',
    transform: 'level', // inputs are already YoY; we subtract directly
    release: 'Monthly, with payrolls + CPI',
    context: 'Nominal wage growth minus Core CPI. >0 = workers gaining purchasing power, <0 = losing it.',
    direction: 'higher_better',
    methodology: 'Derived indicator: nominal average hourly earnings YoY minus Core CPI YoY, aligned by date. Using Core (vs. headline) CPI as the deflator removes food/energy noise — the standard labor economics convention for tracking real wage dynamics. Positive values indicate workers are gaining purchasing power; negative values mean wages aren\'t keeping up with core inflation.',
  },
  {
    id: 'RRSFS',
    source: 'fred',
    fredId: 'RRSFS',
    category: 'consumer',
    label: 'Real Retail Sales (YoY)',
    shortLabel: 'Real Retail',
    unit: '%',
    decimals: 1,
    freq: 'monthly',
    transform: 'yoy',
    release: 'Mid-month, prior month',
    context: 'Inflation-adjusted consumer spending on goods. ~70% of US GDP is consumption.',
    direction: 'higher_better',
    hasVintages: true,
    methodology: 'Real retail and food services sales — nominal Census Bureau retail sales deflated by a CPI-based goods price index. Covers goods spending specifically; services are in separate releases. Initial print often moves ±0.3–0.5 percentage points on the second estimate as late respondents report. The vintage ribbon captures those revisions.',
  },
  {
    id: 'IC4WSA',
    source: 'fred',
    fredId: 'IC4WSA',
    category: 'consumer',
    label: 'Initial Jobless Claims (4wk MA)',
    shortLabel: 'Jobless Claims',
    unit: 'K',
    decimals: 0,
    freq: 'weekly',
    transform: 'level_k', // FRED publishes in persons; render as thousands
    release: 'Every Thursday',
    context: 'Real-time labor-market signal. Sustained move above ~300K has historically marked turning points.',
    direction: 'lower_better',
    methodology: '4-week moving average of initial claims for unemployment insurance. Weekly release from the Department of Labor aggregating state-level filings. The 4-week MA is smoother than the noisy weekly print. Historical thresholds: sustained readings above ~300K have marked labor-market inflection points; below ~220K generally indicates a tight labor market.',
  },
  {
    id: 'DRCCLACBS',
    source: 'fred',
    fredId: 'DRCCLACBS',
    category: 'consumer',
    label: 'Credit Card Delinquency Rate',
    shortLabel: 'CC Delinquency',
    unit: '%',
    decimals: 2,
    freq: 'quarterly',
    transform: 'level',
    release: 'Quarterly, ~2 months after quarter end',
    context: 'Consumer balance-sheet stress. Rising delinquencies lead consumer-spending weakness by 1–2 quarters.',
    direction: 'lower_better',
    methodology: 'Share of credit card loan balances 30+ days past due at domestically-chartered commercial banks, from the Fed\'s FFIEC call report data. Published quarterly with ~2-month lag. A deep balance-sheet stress signal — rising delinquencies typically lead consumer-spending weakness by 1–2 quarters. Also a useful leading indicator for bank credit provisions.',
  },

  // ---------------------------------------------------------------- HOUSING
  {
    id: 'PERMIT',
    source: 'fred',
    fredId: 'PERMIT',
    category: 'housing',
    label: 'Building Permits (YoY)',
    shortLabel: 'Permits',
    unit: '%',
    decimals: 1,
    freq: 'monthly',
    transform: 'yoy',
    release: 'Mid-month, prior month',
    context: 'Leading housing indicator: permits precede starts by 1–2 months.',
    direction: 'higher_better',
    methodology: 'Building permits issued for new privately-owned residential construction, from the Census Bureau. Leads housing starts by 1–2 months (permit → physical start) and is the best leading indicator in the housing bloc. Part of the Conference Board\'s LEI composite. Regional breakdowns can reveal geographic cycle turns before the national number.',
  },
  {
    id: 'HOUST',
    source: 'fred',
    fredId: 'HOUST',
    category: 'housing',
    label: 'Housing Starts (YoY)',
    shortLabel: 'Starts',
    unit: '%',
    decimals: 1,
    freq: 'monthly',
    transform: 'yoy',
    release: 'Mid-month, prior month',
    context: 'New residential construction begun. A direct GDP contributor via residential investment.',
    direction: 'higher_better',
    methodology: 'New privately-owned residential construction started, Census Bureau. Volatile month-to-month — 3-month average smooths the signal. Single-family starts are the trend component; multi-family is noisy and weather-sensitive. A direct GDP contributor through residential investment.',
  },
  {
    // NOTE: FRED's EXHOSLUSM495S series only began ~Feb 2025 (NAR data
    // licensing reset). Too short for YoY — showing SAAR level in millions
    // instead. Revisit transform to 'yoy' once the series has 2+ years of
    // history (~early 2027).
    id: 'EXHOSLUS',
    source: 'fred',
    fredId: 'EXHOSLUSM495S',
    category: 'housing',
    label: 'Existing Home Sales (SAAR)',
    shortLabel: 'Existing Sales',
    unit: 'M',
    decimals: 2,
    freq: 'monthly',
    transform: 'level_m',
    release: 'Third week of month, prior month',
    context: '~90% of total home sales. Reported as seasonally-adjusted annualized rate in millions of units.',
    direction: 'higher_better',
    methodology: 'Existing home sales from the National Association of Realtors, published on FRED as a seasonally-adjusted annualized rate in millions of units. The historical series was discontinued in a 2024 licensing reset; the current FRED series began February 2025, which is why this card shows SAAR level rather than YoY. Will switch to YoY once the series accumulates two years of history (~early 2027).',
  },
  {
    id: 'HSN1F',
    source: 'fred',
    fredId: 'HSN1F',
    category: 'housing',
    label: 'New Home Sales (YoY)',
    shortLabel: 'New Home Sales',
    unit: '%',
    decimals: 1,
    freq: 'monthly',
    transform: 'yoy',
    release: 'End of month, prior month',
    context: 'Sales of newly-built single-family homes. Volatile but a direct read on builder demand.',
    direction: 'higher_better',
    methodology: 'New single-family homes sold (SAAR) from the Census Bureau. Much smaller segment than existing home sales (~10% of total market) but a direct read on builder demand and marginal construction activity. Volatile — three-month averages are more reliable than any single print. Often moves in tandem with homebuilder stock prices.',
  },
  {
    id: 'MORTGAGE30US',
    source: 'fred',
    fredId: 'MORTGAGE30US',
    category: 'housing',
    label: '30Y Fixed Mortgage Rate',
    shortLabel: '30Y Mortgage',
    unit: '%',
    decimals: 2,
    freq: 'weekly',
    transform: 'level',
    release: 'Every Thursday (Freddie Mac PMMS)',
    context: 'Marginal cost of a new mortgage. Each 100bp move changes monthly payment on a $400K loan by ~$260.',
    direction: 'lower_better',
    methodology: 'Freddie Mac Primary Mortgage Market Survey 30-year fixed rate, Thursday publication. Lags 10Y Treasury moves by 1–5 business days as lenders update rate sheets. The mortgage-to-10Y spread has widened structurally since 2022 — historically ~175bp, now ~250bp — driven by higher prepayment risk premia and reduced mortgage-market liquidity.',
  },
  {
    id: 'CSUSHPISA',
    source: 'fred',
    fredId: 'CSUSHPISA',
    category: 'housing',
    label: 'Case-Shiller Home Price Index (YoY)',
    shortLabel: 'Case-Shiller HPI',
    unit: '%',
    decimals: 1,
    freq: 'monthly',
    transform: 'yoy',
    release: 'Last Tuesday of month, 2-month lag',
    context: 'Repeat-sales national home price index. Lags sales volume turns by ~6 months.',
    direction: 'neutral',
    methodology: 'S&P Cotality (formerly CoreLogic) Case-Shiller US National Home Price Index. Uses a repeat-sales methodology — tracks price changes on the same individual properties over time, which controls for quality and mix. Published with a 2-month lag and uses closing data, so lags the housing-volume turn by ~6 months. The 20-city and 10-city variants are also widely followed.',
  },
];

// Convenience lookups
export const INDICATORS_BY_ID = Object.fromEntries(INDICATORS.map(i => [i.id, i]));
export const INDICATORS_BY_CATEGORY = INDICATORS.reduce((acc, ind) => {
  (acc[ind.category] ||= []).push(ind);
  return acc;
}, {});
