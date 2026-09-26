// nav-config.js -- single source of truth for site navigation AND landing page.
//
// SECTIONS:    top-level tabs (one row across the top of every dashboard page).
//              Also renders the landing top bar and the landing "Themes" grid,
//              so those three surfaces can never drift apart again.
// PAGES:       keyed by section.id (or "section:sub"), defines the second-tier
//              links shown when that section is active.
// LANDING_HUB: ordered list of cards rendered on the home page hub, each
//              referencing a PAGES key + presentation overrides.
//
// NOTE ON IDS: section ids are internal and deliberately stable ('equity',
// 'tools') even where the visible label changed ('Markets', 'Tools & Data').
// Renaming an id means touching data-section on every page in that section, so
// ids are frozen and only labels move.
//
// Per-link extras:
//   meta: short description shown on the landing hub leaf and in search.
//   sub:  render as small sub-link under a master.
//
// Per-PAGES extras:
//   label:       grey caption shown left-aligned at start of the nav row, and
//                used as the middle crumb in the breadcrumb trail.
//   groups[].label:  treated as a "section label" pill in nav AND a branch
//                    label on the landing.

(function () {
  'use strict';

  const SECTIONS = [
    { id: 'macro',    label: 'Macro',        href: '/macro/',
      blurb: 'State of the US cycle: one-screen verdict, regime and base rates, growth, labor, inflation, policy, liquidity, credit and recession risk.' },
    { id: 'markets',  label: 'Markets',      href: '/markets/',
      blurb: 'Cross-asset: US sectors, rates and credit spreads, global equities, FX and commodities, index valuation.' },
    { id: 'regional', label: 'Regional',     href: '/regional/',
      blurb: 'The dispersion the national aggregate hides: CPI by region, affordability, build vs buy, channel mix, migration, climate risk.' },
    { id: 'supply',   label: 'Supply Chain', href: '/supply/',
      blurb: 'SC Pressure composite plus ~50 freight, warehouse, last-mile and international metrics, refreshed weekly.' },
    { id: 'research', label: 'Research',     href: '/research/',
      blurb: 'Dated company and thematic notes: 38 single-name deep dives, a Plug Power deep dive, and the AI beneficiaries framework.' },
    { id: 'tools',    label: 'Tools & Data', href: '/tools/',
      blurb: 'Pair explorer, transmission network, regime backtest, indicator comparison, ticker lookup, data catalog and downloads.' },
  ];

  const PAGES = {
    macro: {
      label: 'Macro',
      groups: [
        { label: 'Summary', links: [
          { id: 'state',      label: 'State of the Cycle', href: '/macro/',            meta: 'One-screen verdict: regime, eight dials, what changed, what would flip the call' },
          { id: 'this-week',  label: 'This Week',          href: '/macro/this-week/',  meta: 'What moved most vs its own history, releases due, market moves' },
          { id: 'regime',     label: 'Regime & base rates', href: '/macro/regime/',    meta: 'Growth x inflation quadrant, composite scores, forward sector base rates' },
        ]},
        { label: 'Economy', links: [
          { id: 'labor',      label: 'Labor',              href: '/macro/labor/',      meta: 'Payrolls, unemployment, claims, wages, participation' },
          { id: 'consumer',   label: 'Consumer',           href: '/macro/consumer/',   meta: 'Spending, real income, saving, household credit health' },
          { id: 'housing',    label: 'Housing',            href: '/macro/housing/',    meta: 'Starts, sales, prices, mortgage rates, affordability' },
          { id: 'inflation',  label: 'Inflation',          href: '/macro/inflation/',  meta: 'Core, sticky vs flexible, shelter, wages, expectations' },
          { id: 'indicators', label: 'All indicators',     href: '/macro/indicators/', meta: 'Card grid - latest print, change, percentile, next release' },
        ]},
        { label: 'Policy & risk', links: [
          { id: 'policy',     label: 'Policy & Rates',     href: '/macro/policy/',     meta: 'Fed funds vs 2Y, curve today vs 3/12m ago, real policy rate, term premium' },
          { id: 'liquidity',  label: 'Liquidity & Fiscal', href: '/macro/liquidity/',  meta: 'Net Fed liquidity, reserves, deficit, interest burden, debt' },
          { id: 'credit',     label: 'Credit',             href: '/macro/credit/',     meta: 'Spreads, lending standards, delinquencies, financial conditions' },
          { id: 'cycle',      label: 'Cycle & Recession',  href: '/macro/cycle/',      meta: 'Cycle composite, term-spread probit, NFCI, spreads' },
          { id: 'recession',  label: 'Recession signals',  href: '/macro/recession/',  meta: 'Four trigger signals with calibration vs NBER dates' },
        ]},
      ],
    },

    markets: {
      label: 'Markets',
      groups: [
        { links: [
          { id: 'markets',     label: 'US equities & sectors', href: '/markets/',           meta: 'SPY and the 11 sector SPDRs: performance, contribution, drawdown' },
          { id: 'bonds',       label: 'Rates & credit',        href: '/markets/bonds/',     meta: 'Stock-bond correlation, curve, real yields, spreads, rate vol' },
          { id: 'global',      label: 'Global, FX & commodities', href: '/markets/global/', meta: 'Dollar, EUR/JPY/CNY, ex-US equities, oil, copper, gold' },
          { id: 'pe-overview', label: 'Valuation (P/E)',       href: '/markets/valuation/', meta: 'S&P 500 + Nasdaq-100 trailing & forward P/E, daily forward-P/E history' },
        ]},
      ],
    },

    regional: {
      label: 'Regional',
      groups: [
        { links: [
          { id: 'regional-hub',  label: 'Overview',        href: '/regional/',               meta: 'Hub - all regional dispersion views' },
          { id: 'geography',     label: 'Geography',       href: '/regional/geography/',     meta: 'State + metro rankings: unemployment, home prices, population' },
          { id: 'regional-cpi',  label: 'CPI dispersion',  href: '/regional/regional-cpi/',  meta: 'Region and metro CPI dispersion' },
          { id: 'affordability', label: 'Affordability',   href: '/regional/affordability/', meta: 'Metro price-to-income and payment burden' },
          { id: 'build-buy',     label: 'Build vs Buy',    href: '/regional/build-buy/',     meta: 'New vs existing home price gap' },
          { id: 'channel-mix',   label: 'Channel mix',     href: '/regional/channel-mix/',   meta: 'Pro vs DIY skew by state' },
          { id: 'climate-risk',  label: 'Climate risk',    href: '/regional/climate-risk/',  meta: 'Physical-risk exposure and insurance pricing' },
          { id: 'demographics',  label: 'Demographics',    href: '/regional/demographics/',  meta: 'Population, age, household formation' },
          { id: 'migration',     label: 'Migration',       href: '/regional/migration/',     meta: 'Net domestic migration flows' },
        ]},
      ],
    },

    supply: {
      label: 'Supply Chain',
      groups: [
        { links: [
          { id: 'supply-overview',     label: 'Overview',                 href: '/supply/',                      meta: 'SC Pressure composite - 4-quadrant z-score blend' },
          { id: 'supply-insights',     label: 'Insights',                 href: '/supply/insights/',             meta: 'Weekly read on what moved, outliers, calendar' },
          { id: 'supply-dc',           label: 'Distribution Center',      href: '/supply/dc/',                   meta: 'Wages, packaging, equipment, inventories' },
          { id: 'supply-industrial',   label: 'Industrial Real Estate',   href: '/supply/dc/industrial-re.html', meta: 'Construction, REIT basket, cap-rate spread' },
          { id: 'supply-middle',       label: 'Middle Mile',              href: '/supply/middle-mile/',          meta: 'Diesel, Cass, ATA tonnage, intermodal, DAT spot' },
          { id: 'supply-last',         label: 'Last Mile',                href: '/supply/last-mile/',            meta: 'Couriers, USPS volume, e-commerce share' },
          { id: 'supply-international',label: 'International',            href: '/supply/international/',        meta: 'GSCPI, container rates, BDI, ports, bunker' },
          { id: 'supply-downloads',    label: 'Downloads',                href: '/supply/data.html',             meta: 'All supply-chain series, full history, CSV + zip' },
        ]},
      ],
    },

    research: {
      label: 'Research',
      groups: [
        { links: [
          { id: 'research-hub',  label: 'Companies',          href: '/research/',       meta: '38 dated single-name deep dives: valuation lab, EDGAR fundamentals, peer comps' },
          { id: 'plug-overview', label: 'Plug Power deep dive', href: '/research/plug/', meta: '7 views - P&L, cash flow, revenue, balance sheet, liquidity, footprint' },
          { id: 'ai-hub',        label: 'AI beneficiaries',   href: '/research/ai/',    meta: 'Capex flow from hyperscalers to compute, power and adopters' },
        ]},
      ],
    },

    'research:single': {
      label: 'Companies',
      collapse: true,
      groups: [
        { links: [
      { id: 'sn-nvda',  label: 'NVIDIA (NVDA)',    href: '/research/nvda/',  meta: 'AI compute monopoly, reverse DCF' },
      { id: 'sn-tsm',   label: 'TSMC (TSM)',       href: '/research/tsm/',   meta: 'N2 monopoly, foundry comps' },
      { id: 'sn-mu',    label: 'Micron (MU)',      href: '/research/mu/',    meta: 'Peak-cycle memory at 6x forward' },
      { id: 'sn-avgo',  label: 'Broadcom (AVGO)',  href: '/research/avgo/',  meta: 'Custom-ASIC arms dealer' },
      { id: 'sn-googl', label: 'Alphabet (GOOGL)', href: '/research/googl/', meta: 'Search through the AI transition' },
      { id: 'sn-pltr',  label: 'Palantir (PLTR)',  href: '/research/pltr/',  meta: 'Best metrics, richest multiple' },
      { id: 'sn-crwv',  label: 'CoreWeave (CRWV)', href: '/research/crwv/',  meta: 'Leveraged AI capex, $104B backlog' },
      { id: 'sn-cbrs',  label: 'Cerebras (CBRS)',  href: '/research/cbrs/',  meta: 'Wafer-scale inference, post-IPO' },
      { id: 'sn-meta',  label: 'Meta (META)',      href: '/research/meta/',  meta: 'Ad machine vs superintelligence capex' },
      { id: 'sn-msft',  label: 'Microsoft (MSFT)', href: '/research/msft/',  meta: 'Azure $100B, $678B RPO, Copilot' },
      { id: 'sn-aapl',  label: 'Apple (AAPL)',     href: '/research/aapl/',  meta: 'Supply-capped iPhone supercycle' },
      { id: 'sn-amzn',  label: 'Amazon (AMZN)',    href: '/research/amzn/',  meta: 'AWS reacceleration, $220B capex' },
      { id: 'sn-amd',   label: 'AMD (AMD)',        href: '/research/amd/',   meta: 'The chosen second source' },
      { id: 'sn-intc',  label: 'Intel (INTC)',     href: '/research/intc/',  meta: 'Backstopped turnaround, 18A' },
      { id: 'sn-mrvl',  label: 'Marvell (MRVL)',   href: '/research/mrvl/',  meta: 'No. 2 custom silicon + optics' },
      { id: 'sn-amat',  label: 'Applied Mat. (AMAT)', href: '/research/amat/', meta: 'WFE cycle, cyclical-to-secular' },
      { id: 'sn-smci',  label: 'Super Micro (SMCI)', href: '/research/smci/', meta: 'AI servers, margin trust debate' },
      { id: 'sn-sndk',  label: 'Sandisk (SNDK)',   href: '/research/sndk/',  meta: 'NAND supercycle at 3x forward' },
      { id: 'sn-tsla',  label: 'Tesla (TSLA)',     href: '/research/tsla/',  meta: 'AI narrative vs 1.4% op margin' },
      { id: 'sn-orcl',  label: 'Oracle (ORCL)',    href: '/research/orcl/',  meta: '$638B RPO, debt-funded OCI' },
      { id: 'sn-ibm',   label: 'IBM (IBM)',        href: '/research/ibm/',   meta: 'Post-crash value or trap' },
      { id: 'sn-cat',   label: 'Caterpillar (CAT)', href: '/research/cat/',  meta: '$72B backlog, data-center power' },
      { id: 'sn-cvx',   label: 'Chevron (CVX)',    href: '/research/cvx/',   meta: 'Record production, Hess synergies' },
      { id: 'sn-vst',   label: 'Vistra (VST)',     href: '/research/vst/',   meta: 'Data-center power PPAs' },
      { id: 'sn-be',    label: 'Bloom Energy (BE)', href: '/research/be/',   meta: 'Fuel cells for AI datacenters' },
      { id: 'sn-sofi',  label: 'SoFi (SOFI)',      href: '/research/sofi/',  meta: '43% growth bank at 30x forward' },
      { id: 'sn-rivn',  label: 'Rivian (RIVN)',    href: '/research/rivn/',  meta: 'R2 ramp, VW bridge' },
      { id: 'sn-nbis',  label: 'Nebius (NBIS)',    href: '/research/nbis/',  meta: 'The profitable neocloud' },
      { id: 'sn-spcx',  label: 'SpaceX (SPCX)',    href: '/research/spcx/',  meta: 'Largest IPO in history' },
      { id: 'sn-ionq',  label: 'IonQ (IONQ)',      href: '/research/ionq/',  meta: 'Trapped-ion quantum, $2B cash' },
      { id: 'sn-qbts',  label: 'D-Wave (QBTS)',    href: '/research/qbts/',  meta: 'Annealing bookings vs revenue' },
      { id: 'sn-rgti',  label: 'Rigetti (RGTI)',   href: '/research/rgti/',  meta: 'Superconducting, Cepheus roadmap' },
      { id: 'sn-qs',    label: 'QuantumScape (QS)', href: '/research/qs/',   meta: 'Solid-state licensing model' },
      { id: 'sn-hovr',  label: 'Horizon Aircraft (HOVR)', href: '/research/hovr/', meta: 'Fan-in-wing eVTOL micro-cap' },
      { id: 'sn-mrln',  label: 'Merlin (MRLN)',    href: '/research/mrln/',  meta: 'Autonomous flight, USSOCOM prime' },
      { id: 'sn-xlk',   label: 'Tech SPDR (XLK)',  href: '/research/xlk/',   meta: 'ETF - capped tech sector fund' },
      { id: 'sn-ewy',   label: 'South Korea (EWY)', href: '/research/ewy/',  meta: 'ETF - memory supercycle country fund' },
        ]},
      ],
    },

    'research:plug': {
      label: 'Plug Power - PLUG',
      groups: [
        { links: [
          { id: 'plug-overview',  label: 'Overview',                 href: '/research/plug/',              meta: 'PLUG landing' },
          { id: 'plug-pnl',       label: 'P&L / path to EBITDAS',    href: '/research/plug/pnl.html',      meta: 'Quarterly margins, opex, breakeven trend' },
          { id: 'plug-cashflow',  label: 'Quarterly cash flow',      href: '/research/plug/cashflow.html', meta: 'CFO/CFI/CFF and cash drivers, 2015-2026 EDGAR XBRL' },
          { id: 'plug-revenue',   label: 'Revenue & segment',        href: '/research/plug/revenue.html',  meta: 'Top-line decomposition by product line' },
          { id: 'plug-balance',   label: 'Balance-sheet health',     href: '/research/plug/balance.html',  meta: 'Assets, liabilities, working capital, maturities' },
          { id: 'plug-liquidity', label: 'Liquidity options',        href: '/research/plug/liquidity.html',meta: 'Cash runway, monetization levers, dilution paths' },
          { id: 'plug-map',       label: 'US production footprint',  href: '/research/plug/map.html',      meta: 'Site-by-site facility map' },
        ]},
      ],
    },

    'research:ai': {
      label: 'AI beneficiaries',
      groups: [
        { links: [
          { id: 'ai-hub',          label: 'Overview',             href: '/research/ai/',              meta: 'Capex Sankey and four pillars' },
          { id: 'ai-compute',      label: 'Compute & semis',      href: '/research/ai/compute/',      meta: 'NVDA, AVGO, AMD, custom silicon' },
          { id: 'ai-hyperscalers', label: 'Hyperscaler capex',    href: '/research/ai/hyperscalers/', meta: 'MSFT, GOOGL, META, AMZN spend' },
          { id: 'ai-power',        label: 'Power & grid',         href: '/research/ai/power/',        meta: 'Datacenter load, utilities, IPPs' },
          { id: 'ai-adopters',     label: 'Adopters',             href: '/research/ai/adopters/',     meta: 'Software, services, productivity beneficiaries' },
          { id: 'ai-screen',       label: 'Industry screen (Apr 2026)', href: '/research/ai/screen/', meta: 'Archived April 2026 - 160 companies, 8 industries, 4 scenarios' },
          { id: 'ai-top-5',        label: 'Top-5 (archived)',     href: '/research/ai/top-5/',        meta: 'Archived April 2026 picks - not maintained' },
        ]},
      ],
    },

    tools: {
      label: 'Tools & Data',
      groups: [
        { label: 'Analytics', links: [
          { id: 'tools-hub',      label: 'Overview',             href: '/tools/',          meta: 'All cross-cutting analytical tools' },
          { id: 'pair-explorer',  label: 'Pair Explorer',        href: '/tools/pairs/',    meta: 'Correlation + regression of any two series' },
          { id: 'compare',        label: 'Compare Indicators',   href: '/tools/compare/',  meta: 'Two indicators side by side, with vintages' },
          { id: 'network',        label: 'Correlation Network',  href: '/tools/network/',  meta: 'All-pairs correlation map, 60m window (association, not causation)' },
          { id: 'backtest',       label: 'Regime Backtest',      href: '/tools/backtest/', meta: 'Walk-forward regime rotation vs SPY, equal-weight sectors and 60/40' },
          { id: 'ticker',         label: 'Ticker Lookup',        href: '/tools/ticker/',   meta: 'Price history and total return for any symbol' },
        ]},
        { label: 'Data', links: [
          { id: 'data-catalog',   label: 'Data Catalog',         href: '/tools/data/',     meta: 'Every series with source IDs, transforms, last observation, downloads' },
          { id: 'site-index',     label: 'A-Z index',            href: '/tools/a-z/',      meta: 'Every view on the site, alphabetical' },
        ]},
      ],
    },
  };

  // ----------------------------------------------------------------------
  // LANDING_HUB -- ordered cards rendered on the home page hub.
  // ----------------------------------------------------------------------
  const LANDING_HUB = [
    { id: 'macro',    title: 'Macro',        pill: 'Daily',  pages: 'macro',    open: true  },
    { id: 'markets',  title: 'Markets',      pill: 'Daily',  pages: 'markets',  open: true  },
    { id: 'regional', title: 'Regional',                     pages: 'regional', open: false },
    { id: 'supply',   title: 'Supply Chain', pill: 'Weekly', pages: 'supply',   open: false },
    { id: 'research', title: 'Research',     pill: 'Dated',  pages: 'research', open: false,
      include: ['research:ai', 'research:plug'] },
    { id: 'tools',    title: 'Tools & Data',                 pages: 'tools',    open: false },
  ];

  // ----------------------------------------------------------------------
  // KEYWORDS -- what a reader actually types.
  //
  // Search used to match only link labels and the short `meta` blurb, so
  // "unemployment", "mortgage", "gdp", "case-shiller" and "p/e ratio" all
  // returned nothing: the site knew the page as "Labor" or "Housing". These
  // are the metric names, tickers and series IDs behind each view. Kept in
  // one map rather than sprinkled through PAGES so adding a synonym is a
  // one-line change and never touches the nav structure.
  // ----------------------------------------------------------------------
  const KEYWORDS = {
    markets:        ['s&p 500', 'spx', 'nasdaq', 'sector rotation', 'sector returns', 'equity', 'stocks', 'breadth', 'vix', 'volatility'],
    bonds:          ['yield curve', 'treasury', '10 year', '2s10s', '10y3m', 'term premium', 'duration', 'ig', 'high yield', 'hy oas', 'credit spread', 'move index', 'interest rates', 'rates', 'fed funds', 'bond yields'],
    ticker:         ['symbol lookup', 'series lookup', 'quote', 'search series'],
    'research-hub': ['company', 'single stock', 'deep dive', 'fundamentals'],
    'plug-overview':['plug power', 'plug', 'hydrogen', 'fuel cell', 'green hydrogen'],
    'sn-nvda':  ['nvidia', 'nvda', 'gpu', 'ai chips', 'blackwell', 'rubin', 'cuda'],
    'sn-tsm':   ['tsmc', 'tsm', 'taiwan semiconductor', 'foundry', 'n2', '2nm'],
    'sn-mu':    ['micron', 'mu', 'memory', 'dram', 'hbm', 'nand'],
    'sn-avgo':  ['broadcom', 'avgo', 'asic', 'custom silicon', 'vmware', 'tomahawk'],
    'sn-googl': ['alphabet', 'google', 'googl', 'search', 'gemini', 'youtube', 'gcp'],
    'sn-pltr':  ['palantir', 'pltr', 'aip', 'foundry software', 'defense software'],
    'sn-crwv':  ['coreweave', 'crwv', 'neocloud', 'gpu cloud', 'ai infrastructure'],
    'sn-cbrs':  ['cerebras', 'cbrs', 'wafer scale', 'inference', 'wse'],
    'sn-meta':  ['meta', 'facebook', 'instagram', 'whatsapp', 'ads', 'reality labs'],
    'sn-msft':  ['microsoft', 'msft', 'azure', 'copilot', 'windows', 'openai'],
    'sn-aapl':  ['apple', 'aapl', 'iphone', 'siri', 'services', 'mac'],
    'sn-amzn':  ['amazon', 'amzn', 'aws', 'trainium', 'prime', 'kuiper', 'leo'],
    'sn-amd':   ['amd', 'instinct', 'epyc', 'helios', 'mi450', 'ryzen'],
    'sn-intc':  ['intel', 'intc', '18a', 'foundry', 'xeon', 'panther lake'],
    'sn-mrvl':  ['marvell', 'mrvl', 'custom silicon', 'optics', 'trainium', 'interconnect'],
    'sn-amat':  ['applied materials', 'amat', 'wfe', 'equipment', 'deposition', 'etch'],
    'sn-smci':  ['supermicro', 'super micro', 'smci', 'ai servers', 'liquid cooling', 'rack scale'],
    'sn-sndk':  ['sandisk', 'sndk', 'nand', 'flash', 'ssd', 'memory'],
    'sn-tsla':  ['tesla', 'tsla', 'robotaxi', 'fsd', 'optimus', 'ev', 'musk'],
    'sn-orcl':  ['oracle', 'orcl', 'oci', 'stargate', 'database', 'rpo'],
    'sn-ibm':   ['ibm', 'red hat', 'watsonx', 'mainframe', 'quantum', 'starling'],
    'sn-cat':   ['caterpillar', 'cat', 'construction', 'gensets', 'machinery'],
    'sn-cvx':   ['chevron', 'cvx', 'oil', 'permian', 'guyana', 'hess', 'energy'],
    'sn-vst':   ['vistra', 'vst', 'power', 'nuclear', 'utility', 'comanche peak', 'ppa'],
    'sn-be':    ['bloom energy', 'be', 'fuel cell', 'sofc', 'aep', 'microgrids'],
    'sn-sofi':  ['sofi', 'fintech', 'bank', 'galileo', 'student loans', 'lending'],
    'sn-rivn':  ['rivian', 'rivn', 'r2', 'ev', 'volkswagen', 'trucks'],
    'sn-nbis':  ['nebius', 'nbis', 'neocloud', 'gpu cloud', 'yandex'],
    'sn-spcx':  ['spacex', 'spcx', 'starlink', 'starship', 'falcon', 'space'],
    'sn-ionq':  ['ionq', 'quantum', 'trapped ion', 'tempo', 'oxford ionics'],
    'sn-qbts':  ['d-wave', 'dwave', 'qbts', 'quantum annealing', 'advantage2'],
    'sn-rgti':  ['rigetti', 'rgti', 'quantum', 'superconducting', 'cepheus', 'ankaa'],
    'sn-qs':    ['quantumscape', 'qs', 'solid state battery', 'powerco', 'volkswagen', 'qse-5'],
    'sn-hovr':  ['horizon aircraft', 'hovr', 'evtol', 'cavorite', 'hybrid aircraft'],
    'sn-mrln':  ['merlin', 'mrln', 'autonomous flight', 'ussocom', 'kc-135', 'pilot'],
    'sn-xlk':   ['xlk', 'technology etf', 'tech sector', 'spdr', 'sector fund'],
    'sn-ewy':   ['ewy', 'south korea', 'korea etf', 'samsung', 'sk hynix', 'kospi'],
    'plug-pnl':     ['margin', 'gross margin', 'ebitdas', 'breakeven', 'opex', 'income statement', 'profitability'],
    'plug-cashflow':['cash flow', 'cfo', 'capex', 'free cash flow', 'burn rate'],
    'plug-revenue': ['revenue', 'segment', 'top line', 'sales'],
    'plug-balance': ['balance sheet', 'assets', 'liabilities', 'working capital', 'debt'],
    'plug-liquidity':['liquidity', 'cash runway', 'dilution', 'credit line', 'going concern'],
    'plug-map':     ['facilities', 'plants', 'footprint', 'production sites'],
    'pe-overview':  ['p/e', 'p/e ratio', 'pe ratio', 'price to earnings', 'valuation', 'multiple', 'forward pe', 'trailing pe', 'earnings yield', 'cape', 'shiller'],

    state:          ['state of the cycle', 'summary', 'executive summary', 'verdict', 'dashboard', 'macro outlook', 'where are we'],
    'this-week':    ['this week', 'what changed', 'weekly', 'digest', 'movers', 'calendar', 'releases', 'surprises'],
    policy:         ['fed', 'fomc', 'fed funds', 'policy rate', 'rate cuts', 'rate hikes', 'sofr', 'yield curve', 'real rate', 'term premium', 'r-star', 'dot plot'],
    liquidity:      ['liquidity', 'net liquidity', 'balance sheet', 'qt', 'reserves', 'reverse repo', 'tga', 'deficit', 'fiscal', 'debt', 'interest expense', 'treasury issuance'],
    global:         ['global', 'fx', 'currency', 'dollar', 'dxy', 'euro', 'yen', 'yuan', 'china', 'europe', 'japan', 'emerging markets', 'commodities', 'oil', 'crude', 'brent', 'copper', 'gold', 'natural gas'],
    regime:         ['regime', 'macro regime', 'business cycle', 'composite score', 'risk on', 'risk off'],
    cycle:          ['recession', 'recession risk', 'sahm rule', 'yield curve inversion', 'nfci', 'financial conditions', 'slowdown', 'downturn'],
    inflation:      ['cpi', 'inflation', 'pce', 'core cpi', 'sticky cpi', 'shelter', 'breakeven', '5y5y', 'prices', 'deflation', 'disinflation'],
    housing:        ['housing', 'mortgage', 'mortgage rate', 'home prices', 'case-shiller', 'housing starts', 'permits', 'existing home sales', 'nahb', 'affordability', 'rent'],
    consumer:       ['consumer', 'retail sales', 'consumer spending', 'pce', 'savings rate', 'sentiment', 'credit card', 'delinquency', 'real income'],
    credit:         ['credit', 'spreads', 'hy oas', 'ig oas', 'default rate', 'loan growth', 'bank lending', 'sloos'],
    labor:          ['unemployment', 'jobs', 'jobs report', 'payrolls', 'nonfarm payrolls', 'nfp', 'wages', 'average hourly earnings', 'participation', 'jolts', 'claims', 'quits'],
    indicators:     ['indicators', 'gdp', 'ism', 'pmi', 'industrial production', 'all series', 'dashboard', 'economic data'],
    recession:      ['recession', 'recession probability', 'sahm', 'inversion', 'nber', 'hard landing', 'soft landing'],

    'regional-hub': ['regional', 'states', 'metro', 'msa', 'dispersion', 'geography'],
    geography:      ['state', 'msa', 'metro area', 'map', 'by state', 'regional ranking'],
    'regional-cpi': ['regional cpi', 'cpi by region', 'local inflation', 'metro inflation'],
    affordability:  ['affordability', 'cost of living', 'income vs cost', 'housing affordability'],
    'build-buy':    ['rent vs buy', 'build vs buy', 'breakeven', 'own vs rent'],
    'channel-mix':  ['ecommerce', 'e-commerce', 'online retail', 'in-store', 'channel shift'],
    'climate-risk': ['climate', 'physical risk', 'hurricane', 'wildfire', 'flood', 'insurance'],
    demographics:   ['population', 'demographics', 'age', 'household formation', 'births'],
    migration:      ['migration', 'moving', 'domestic migration', 'net inflow', 'population flows'],

    'ai-hub':          ['ai', 'artificial intelligence', 'ai beneficiaries', 'scenarios'],
    'ai-compute':      ['nvda', 'nvidia', 'amd', 'avgo', 'broadcom', 'semis', 'semiconductors', 'gpu', 'accelerators', 'custom silicon'],
    'ai-hyperscalers': ['msft', 'microsoft', 'googl', 'google', 'meta', 'amzn', 'amazon', 'capex', 'cloud', 'hyperscaler'],
    'ai-power':        ['power', 'electricity', 'utilities', 'grid', 'datacenter power', 'ipp', 'nuclear', 'load growth'],
    'ai-adopters':     ['software', 'saas', 'adopters', 'productivity', 'second derivative'],
    'ai-screen':       ['screen', 'stock screen', 'industry screen', '160 companies', 'scenarios'],
    'ai-top-5':        ['top 5', 'picks', 'meta', 'cdns', 'cadence', 'avgo', 'snps', 'synopsys', 'msft'],

    'supply-overview':     ['supply chain', 'sc pressure', 'logistics', 'freight'],
    'supply-insights':     ['insights', 'weekly read', 'what moved', 'commentary'],
    'supply-dc':           ['distribution center', 'warehouse', 'inventories', 'packaging', 'warehouse wages'],
    'supply-industrial':   ['industrial real estate', 'warehouse construction', 'reit', 'cap rate', 'industrial re'],
    'supply-middle':       ['trucking', 'diesel', 'cass', 'freight index', 'ata tonnage', 'intermodal', 'rail', 'dat', 'spot rates'],
    'supply-last':         ['last mile', 'ups', 'fedex', 'usps', 'parcel', 'delivery', 'couriers'],
    'supply-international':['gscpi', 'wci', 'scfi', 'fbx', 'bdi', 'container rates', 'ports', 'ocean freight', 'bunker', 'shipping'],
    'supply-downloads':    ['csv', 'download', 'export', 'raw data', 'supply data'],

    'tools-hub':     ['tools', 'analytics', 'utilities'],
    'pair-explorer': ['correlation', 'regression', 'scatter', 'two series', 'relationship'],
    network:         ['network', 'correlation map', 'lead lag', 'transmission'],
    backtest:        ['backtest', 'rotation', 'strategy', 'walk forward', 'sector rotation', 'spy', '60/40'],
    compare:         ['compare', 'side by side', 'two indicators', 'overlay'],
    'data-catalog':  ['data catalog', 'fred', 'series id', 'sources', 'methodology', 'transforms', 'dictionary'],
    'site-index':    ['index', 'a-z', 'sitemap', 'all pages', 'everything'],
  };

  // ----------------------------------------------------------------------
  // RELATED -- curated cross-section jumps, keyed by link id.
  //
  // The nav can only move a reader inside the section they are already in.
  // These are the edges the nav structurally cannot express. Kept short and
  // hand-picked on purpose: an auto-generated "related" block is link spam.
  // ----------------------------------------------------------------------
  const RELATED = {
    state:          ['this-week', 'regime', 'cycle'],
    'this-week':    ['state', 'indicators', 'markets'],
    policy:         ['bonds', 'inflation', 'liquidity'],
    liquidity:      ['policy', 'credit', 'markets'],
    global:         ['markets', 'policy', 'supply-international'],
    inflation:      ['regional-cpi', 'labor', 'indicators'],
    'regional-cpi': ['inflation', 'affordability', 'geography'],
    housing:        ['build-buy', 'affordability', 'supply-industrial'],
    'build-buy':    ['housing', 'affordability', 'migration'],
    affordability:  ['housing', 'regional-cpi', 'demographics'],
    labor:          ['cycle', 'consumer', 'recession'],
    consumer:       ['channel-mix', 'labor', 'supply-last'],
    'channel-mix':  ['consumer', 'supply-last', 'supply-dc'],
    credit:         ['bonds', 'cycle', 'recession'],
    bonds:          ['credit', 'cycle', 'markets'],
    cycle:          ['recession', 'credit', 'labor'],
    recession:      ['cycle', 'regime', 'backtest'],
    regime:         ['backtest', 'state', 'markets'],
    markets:        ['bonds', 'pe-overview', 'regime'],
    'pe-overview':  ['markets', 'ai-screen', 'data-catalog'],
    migration:      ['demographics', 'affordability', 'build-buy'],
    demographics:   ['migration', 'housing', 'labor'],
    geography:      ['regional-cpi', 'affordability', 'climate-risk'],
    'climate-risk': ['geography', 'affordability', 'supply-industrial'],
    'supply-dc':    ['supply-industrial', 'channel-mix', 'housing'],
    'supply-industrial': ['supply-dc', 'housing', 'markets'],
    'supply-middle':['supply-international', 'supply-last', 'consumer'],
    'supply-last':  ['channel-mix', 'supply-middle', 'consumer'],
    'supply-international': ['supply-middle', 'markets', 'inflation'],
    'ai-compute':   ['ai-power', 'ai-hyperscalers', 'pe-overview'],
    'ai-power':     ['ai-compute', 'supply-industrial', 'ai-hyperscalers'],
    'ai-hyperscalers': ['ai-compute', 'ai-adopters', 'pe-overview'],
    'ai-adopters':  ['ai-hyperscalers', 'ai-screen', 'pe-overview'],
    backtest:       ['regime', 'recession', 'compare'],
    'pair-explorer':['network', 'compare', 'data-catalog'],
    network:        ['pair-explorer', 'regime', 'compare'],
    compare:        ['indicators', 'pair-explorer', 'data-catalog'],
    indicators:     ['compare', 'data-catalog', 'regime'],
  };

  // ----------------------------------------------------------------------
  // Flat index of every unique view. Used by global search, the A-Z index
  // page, and the sitemap generator. Deduped by href; first occurrence wins,
  // and the section it first appears in is treated as its canonical home.
  // ----------------------------------------------------------------------
  function buildIndex() {
    const seen = Object.create(null);
    const out = [];
    SECTIONS.forEach(function (s) {
      const keys = [s.id].concat(Object.keys(PAGES).filter(function (k) {
        return k.indexOf(s.id + ':') === 0;
      }));
      keys.forEach(function (key) {
        const entry = PAGES[key];
        if (!entry) return;
        entry.groups.forEach(function (g) {
          g.links.forEach(function (l) {
            if (seen[l.href]) return;
            seen[l.href] = true;
            out.push({
              id: l.id,
              label: l.label,
              href: l.href,
              meta: l.meta || '',
              keywords: KEYWORDS[l.id] || [],
              related: RELATED[l.id] || [],
              group: g.label || entry.label || '',
              section: s.label,
              sectionId: s.id,
              pagesKey: key,
            });
          });
        });
      });
    });
    return out;
  }

  window.SIBERFORGE_NAV = {
    SECTIONS: SECTIONS,
    PAGES: PAGES,
    LANDING_HUB: LANDING_HUB,
    KEYWORDS: KEYWORDS,
    RELATED: RELATED,
    index: buildIndex,
  };
})();
