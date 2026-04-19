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
//
// Keep context strings tight (< 90 chars). Any detail should live on the
// drill-down page, not the card.

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
  },
];

// Convenience lookups
export const INDICATORS_BY_ID = Object.fromEntries(INDICATORS.map(i => [i.id, i]));
export const INDICATORS_BY_CATEGORY = INDICATORS.reduce((acc, ind) => {
  (acc[ind.category] ||= []).push(ind);
  return acc;
}, {});
