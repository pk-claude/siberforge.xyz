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
    { id: 'equity',   label: 'Markets',      href: '/core/macro/markets.html',
      blurb: 'Equity markets and the bond complex. Sector flows, yield curve, credit spreads, single-name work, P/E multiples.' },
    { id: 'macro',    label: 'Macro',        href: '/core/macro/',
      blurb: 'Regime, cycle, inflation, housing, consumer, credit, labor. The full national macro stack plus 22 indicators.' },
    { id: 'regional', label: 'Regional',     href: '/core/macro/regional/',
      blurb: 'CPI dispersion, build vs buy, channel mix, migration, demographics, affordability, climate risk, geography.' },
    { id: 'ai',       label: 'AI',           href: '/core/ai/',
      blurb: '160 companies x 8 industries x 4 scenarios. Compute, hyperscalers, power, adopters, and a Top-5 deep dive.' },
    { id: 'supply',   label: 'Supply Chain', href: '/core/supply/',
      blurb: 'SC Pressure composite plus ~50 metrics across distribution centers, middle mile, last mile, international.' },
    { id: 'tools',    label: 'Tools & Data', href: '/core/tools/',
      blurb: 'Pair explorer, transmission network, regime backtest, indicator comparison, full data catalog and downloads.' },
  ];

  const PAGES = {
    equity: {
      label: 'Markets',
      groups: [
        { label: 'Markets', links: [
          { id: 'markets', label: 'Markets overview', href: '/core/macro/markets.html', meta: 'Equity dashboards, sector flows' },
          { id: 'bonds',   label: 'Bonds',            href: '/core/macro/bonds.html',   meta: 'Yield curve, term structure, credit spreads' },
          { id: 'ticker',  label: 'Ticker',           href: '/core/macro/ticker.html',  meta: 'Quick lookup across the macro series universe' },
        ]},
        { label: 'Single-name', links: [
          { id: 'single-name-hub', label: 'Single-name research', href: '/core/single-name/', meta: '19 deep dives live: valuation lab, EDGAR fundamentals, peer comps' },
          { id: 'plug-overview',   label: 'Plug Power (PLUG)',    href: '/core/plug/',        meta: '7 views - P&L, cash flow, revenue, balance, liquidity, footprint' },
        ]},
        { label: 'Valuation', links: [
          { id: 'pe-overview',     label: 'P/E Multiples',        href: '/core/equity/pe/',   meta: 'S&P 500 + Nasdaq-100 trailing & forward P/E, sortable, with daily forward-P/E history' },
        ]},
      ],
    },

    'equity:single': {
      label: 'Single-Name Research',
      groups: [
        { links: [
          { id: 'single-name-hub', label: 'All names',        href: '/core/single-name/',       meta: 'Hub - 19 live, 19 pipeline' },
          { id: 'sn-nvda',  label: 'NVIDIA (NVDA)',    href: '/core/single-name/nvda/',  meta: 'AI compute monopoly, reverse DCF' },
          { id: 'sn-tsm',   label: 'TSMC (TSM)',       href: '/core/single-name/tsm/',   meta: 'N2 monopoly, foundry comps' },
          { id: 'sn-mu',    label: 'Micron (MU)',      href: '/core/single-name/mu/',    meta: 'Peak-cycle memory at 6x forward' },
          { id: 'sn-avgo',  label: 'Broadcom (AVGO)',  href: '/core/single-name/avgo/',  meta: 'Custom-ASIC arms dealer' },
          { id: 'sn-googl', label: 'Alphabet (GOOGL)', href: '/core/single-name/googl/', meta: 'Search through the AI transition' },
          { id: 'sn-pltr',  label: 'Palantir (PLTR)',  href: '/core/single-name/pltr/',  meta: 'Best metrics, richest multiple' },
          { id: 'sn-crwv',  label: 'CoreWeave (CRWV)', href: '/core/single-name/crwv/',  meta: 'Leveraged AI capex, $104B backlog' },
          { id: 'sn-cbrs',  label: 'Cerebras (CBRS)',  href: '/core/single-name/cbrs/',  meta: 'Wafer-scale inference, post-IPO' },
          { id: 'sn-meta',  label: 'Meta (META)',      href: '/core/single-name/meta/',  meta: 'Ad machine vs superintelligence capex' },
          { id: 'sn-msft',  label: 'Microsoft (MSFT)', href: '/core/single-name/msft/',  meta: 'Azure $100B, $678B RPO, Copilot' },
          { id: 'sn-aapl',  label: 'Apple (AAPL)',     href: '/core/single-name/aapl/',  meta: 'Supply-capped iPhone supercycle' },
          { id: 'sn-amzn',  label: 'Amazon (AMZN)',    href: '/core/single-name/amzn/',  meta: 'AWS reacceleration, $220B capex' },
          { id: 'sn-amd',   label: 'AMD (AMD)',        href: '/core/single-name/amd/',   meta: 'The chosen second source' },
          { id: 'sn-intc',  label: 'Intel (INTC)',     href: '/core/single-name/intc/',  meta: 'Backstopped turnaround, 18A' },
          { id: 'sn-mrvl',  label: 'Marvell (MRVL)',   href: '/core/single-name/mrvl/',  meta: 'No. 2 custom silicon + optics' },
          { id: 'sn-amat',  label: 'Applied Mat. (AMAT)', href: '/core/single-name/amat/', meta: 'WFE cycle, cyclical-to-secular' },
          { id: 'sn-smci',  label: 'Super Micro (SMCI)', href: '/core/single-name/smci/', meta: 'AI servers, margin trust debate' },
          { id: 'sn-sndk',  label: 'Sandisk (SNDK)',   href: '/core/single-name/sndk/',  meta: 'NAND supercycle at 3x forward' },
        ]},
      ],
    },

    'equity:plug': {
      label: 'Plug Power - PLUG',
      groups: [
        { links: [
          { id: 'plug-overview',  label: 'Section overview',         href: '/core/plug/',              meta: 'PLUG landing' },
          { id: 'plug-pnl',       label: 'P&L / path to EBITDAS',    href: '/core/plug/pnl.html',      meta: 'Quarterly margins, opex, breakeven trend' },
          { id: 'plug-cashflow',  label: 'Quarterly cash flow',      href: '/core/plug/cashflow.html', meta: 'CFO/CFI/CFF/Cash drivers, 2015-2026 EDGAR XBRL' },
          { id: 'plug-revenue',   label: 'Revenue & segment',        href: '/core/plug/revenue.html',  meta: 'Top-line decomposition by segment' },
          { id: 'plug-balance',   label: 'Balance-sheet health',     href: '/core/plug/balance.html',  meta: 'Assets, liabilities, working capital trend' },
          { id: 'plug-liquidity', label: 'Liquidity options',        href: '/core/plug/liquidity.html',meta: 'Cash runway, credit lines, dilution paths' },
          { id: 'plug-map',       label: 'US production footprint',  href: '/core/plug/map.html',      meta: 'Site-by-site facility map' },
        ]},
      ],
    },

    macro: {
      label: 'Macro views',
      groups: [
        { master: true, links: [
          { id: 'regime',    label: 'Regime',    href: '/core/macro/',                        meta: 'Composite + sector regime, regime returns, headline read' },
          { id: 'cycle',     label: 'Cycle',     href: '/core/macro/cycle/',        sub: true, meta: 'Recession risk, NFCI, yield spreads' },
          { id: 'inflation', label: 'Inflation', href: '/core/macro/inflation/',    sub: true, meta: 'CPI breakdown, services vs goods, sticky vs flexible' },
          { id: 'housing',   label: 'Housing',   href: '/core/macro/housing/',      sub: true, meta: '20 housing metrics' },
          { id: 'consumer',  label: 'Consumer',  href: '/core/macro/real-economy/', sub: true, meta: 'Spending, savings, credit health' },
          { id: 'credit',    label: 'Credit',    href: '/core/macro/credit/',       sub: true, meta: 'Spreads, default rates, loan growth' },
          { id: 'labor',     label: 'Labor',     href: '/core/macro/labor/',        sub: true, meta: 'Payrolls, wages, participation' },
        ]},
        { label: 'Indicators & risk', links: [
          { id: 'indicators', label: 'All 22 indicators',   href: '/core/econ/',               meta: 'Card grid - latest, YoY, percentile, sparkline, live' },
          { id: 'recession',  label: 'Recession composite', href: '/core/econ/recession.html', meta: '5-signal model: Sahm, 10Y-3M, HY OAS, UNRATE, NFP' },
        ]},
      ],
    },

    regional: {
      label: 'Regional macro',
      groups: [
        { links: [
          { id: 'regional-hub',    label: 'Section overview',   href: '/core/macro/regional/',                meta: 'Hub - all regional dispersion views' },
          { id: 'geography',       label: 'Geography',          href: '/core/macro/geography/',               meta: 'State + MSA selectors, ranked bars' },
          { id: 'regional-cpi',    label: 'CPI dispersion',     href: '/core/macro/regional/regional-cpi/',   meta: 'Region-level CPI dispersion' },
          { id: 'affordability',   label: 'Affordability',      href: '/core/macro/regional/affordability/',  meta: 'Income vs cost-of-living gap' },
          { id: 'build-buy',       label: 'Build vs Buy',       href: '/core/macro/regional/build-buy/',      meta: 'Rent vs own break-even by region' },
          { id: 'channel-mix',     label: 'Channel mix',        href: '/core/macro/regional/channel-mix/',    meta: 'In-store vs online retail mix' },
          { id: 'climate-risk',    label: 'Climate risk',       href: '/core/macro/regional/climate-risk/',   meta: 'Region-level physical-risk exposure' },
          { id: 'demographics',    label: 'Demographics',       href: '/core/macro/regional/demographics/',   meta: 'Population, age, household formation' },
          { id: 'migration',       label: 'Migration',          href: '/core/macro/regional/migration/',      meta: 'Net domestic migration flows' },
        ]},
      ],
    },

    ai: {
      label: 'AI Beneficiaries',
      groups: [
        { label: 'Top-down thematic', links: [
          { id: 'ai-hub',          label: 'Section overview',       href: '/core/ai/',              meta: 'Cross-page scenario picker + 4 sub-sectors' },
          { id: 'ai-compute',      label: 'Compute & semis',        href: '/core/ai/compute/',      meta: 'NVDA, AVGO, AMD, custom silicon' },
          { id: 'ai-hyperscalers', label: 'Hyperscaler capex',      href: '/core/ai/hyperscalers/', meta: 'MSFT, GOOGL, META, AMZN spend' },
          { id: 'ai-power',        label: 'Power & grid',           href: '/core/ai/power/',        meta: 'Datacenter load, utilities, IPPs' },
          { id: 'ai-adopters',     label: 'Adopters & 2nd-deriv',   href: '/core/ai/adopters/',     meta: 'Software, services, productivity beneficiaries' },
        ]},
        { label: 'Bottom-up', links: [
          { id: 'ai-screen',       label: 'Industry Screen',        href: '/core/ai/screen/',       meta: '160 companies - 8 industries - 4 scenarios' },
          { id: 'ai-top-5',        label: 'Top-5 Deep Dive',        href: '/core/ai/top-5/',        meta: 'Modest-scenario picks: META, CDNS, AVGO, SNPS, MSFT' },
        ]},
      ],
    },

    supply: {
      label: 'Supply Chain',
      groups: [
        { label: 'Dashboards', links: [
          { id: 'supply-overview',     label: 'Section overview',         href: '/core/supply/',                      meta: '4-quadrant headline - z-score blend' },
          { id: 'supply-insights',     label: 'Insights',                 href: '/core/supply/insights/',             meta: 'Curated weekly read on what moved' },
          { id: 'supply-dc',           label: 'Distribution Center',      href: '/core/supply/dc/',                   meta: 'Wages, packaging, equipment, inventories' },
          { id: 'supply-industrial',   label: 'Industrial Real Estate',   href: '/core/supply/dc/industrial-re.html', meta: 'Construction, REIT basket, cap-rate spread' },
          { id: 'supply-middle',       label: 'Middle Mile',              href: '/core/supply/middle-mile/',          meta: 'Diesel, Cass, ATA tonnage, intermodal, DAT spot' },
          { id: 'supply-last',         label: 'Last Mile',                href: '/core/supply/last-mile/',            meta: 'Couriers, USPS volume, e-commerce share' },
          { id: 'supply-international',label: 'International / Sourcing', href: '/core/supply/international/',        meta: 'GSCPI, WCI, SCFI, FBX, BDI, ports, bunker' },
        ]},
        { label: 'Data', links: [
          { id: 'supply-downloads',    label: 'Supply data downloads',    href: '/core/supply/data.html',             meta: 'All supply-chain series, full history, CSV + zip', sub: true },
        ]},
      ],
    },

    tools: {
      label: 'Tools & Data',
      groups: [
        { label: 'Analytics', links: [
          { id: 'tools-hub',      label: 'Section overview',     href: '/core/tools/',              meta: 'All cross-cutting analytical tools' },
          { id: 'pair-explorer',  label: 'Pair Explorer',        href: '/core/macro/research.html', meta: 'Correlation + regression any two series' },
          { id: 'network',        label: 'Transmission Network', href: '/core/macro/network.html',  meta: 'All-pairs correlation map - 60m window - lead-lag arrows' },
          { id: 'backtest',       label: 'Regime Backtest',      href: '/core/macro/backtest/',     meta: 'Walk-forward regime rotation vs SPY + 60/40' },
          { id: 'compare',        label: 'Compare Indicators',   href: '/core/econ/compare.html',   meta: 'Compare any two indicators side-by-side' },
        ]},
        { label: 'Data', links: [
          { id: 'data-catalog',     label: 'Data Catalog',          href: '/core/data/',            meta: 'All series with FRED IDs, transforms, refresh cadence' },
          { id: 'supply-downloads', label: 'Supply Chain CSV export', href: '/core/supply/data.html', meta: 'Bulk CSV + zip of the ~50 supply-chain series only (the catalog above covers every series on the site)' },
          { id: 'site-index',       label: 'A-Z index',             href: '/core/',                 meta: 'Every view on the site, alphabetical' },
        ]},
      ],
    },
  };

  // ----------------------------------------------------------------------
  // LANDING_HUB -- ordered cards rendered on the home page hub.
  // One card per SECTION, same order, same label. pill = optional badge.
  // ----------------------------------------------------------------------
  const LANDING_HUB = [
    { id: 'equity',   title: 'Markets',      pill: 'Live',   pages: 'equity',   open: true,
      include: ['equity:plug'] },
    { id: 'macro',    title: 'Macro',        pill: 'Live',   pages: 'macro',    open: true  },
    { id: 'regional', title: 'Regional',     pill: 'Live',   pages: 'regional', open: false },
    { id: 'ai',       title: 'AI',           pill: 'New',    pages: 'ai',       open: false },
    { id: 'supply',   title: 'Supply Chain', pill: 'Weekly', pages: 'supply',   open: false },
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
    'single-name-hub': ['company', 'single stock', 'deep dive', 'fundamentals'],
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
    'plug-pnl':     ['margin', 'gross margin', 'ebitdas', 'breakeven', 'opex', 'income statement', 'profitability'],
    'plug-cashflow':['cash flow', 'cfo', 'capex', 'free cash flow', 'burn rate'],
    'plug-revenue': ['revenue', 'segment', 'top line', 'sales'],
    'plug-balance': ['balance sheet', 'assets', 'liabilities', 'working capital', 'debt'],
    'plug-liquidity':['liquidity', 'cash runway', 'dilution', 'credit line', 'going concern'],
    'plug-map':     ['facilities', 'plants', 'footprint', 'production sites'],
    'pe-overview':  ['p/e', 'p/e ratio', 'pe ratio', 'price to earnings', 'valuation', 'multiple', 'forward pe', 'trailing pe', 'earnings yield', 'cape', 'shiller'],

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
    regime:         ['backtest', 'cycle', 'markets'],
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
