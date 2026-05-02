// nav-config.js -- single source of truth for site navigation AND landing hub.
//
// SECTIONS:    top-level tabs (one row across the top of every dashboard page)
// PAGES:       keyed by section.id (or "section:sub"), defines the second-tier
//              links shown when that section is active.
// LANDING_HUB: ordered list of cards rendered on the home page hub, each
//              referencing a PAGES key + presentation overrides.
//
// Per-link extras:
//   meta: short description shown on the landing hub leaf (and tooltips later).
//   sub:  render as small sub-link under a master.
//
// Per-PAGES extras:
//   label:       grey caption shown left-aligned at start of the nav row.
//   groups[].label:  treated as a "section label" pill in nav AND a branch
//                    label on the landing.

(function () {
  'use strict';

  const SECTIONS = [
    { id: 'equity',    label: 'Equity / Markets', href: '/core/single-name/' },
    { id: 'macro',     label: 'Macro',            href: '/core/macro/' },
    { id: 'ai',        label: 'AI',               href: '/core/ai/' },
    { id: 'supply',    label: 'Supply Chain',     href: '/core/supply/' },
    { id: 'tools',     label: 'Tools',            href: '/core/tools/' },
    { id: 'reference', label: 'Reference',        href: '/core/data/' },
  ];

  const PAGES = {
    equity: {
      label: 'Equity / Markets',
      groups: [
        { label: 'Markets', links: [
          { id: 'markets', label: 'Markets overview', href: '/core/macro/markets.html', meta: 'Equity dashboards, sector flows' },
          { id: 'bonds',   label: 'Bonds',            href: '/core/macro/bonds.html',   meta: 'Yield curve, term structure, credit spreads' },
          { id: 'ticker',  label: 'Ticker',           href: '/core/macro/ticker.html',  meta: 'Quick lookup across the macro series universe' },
        ]},
        { label: 'Single-name', links: [
          { id: 'single-name-hub', label: 'Single-name research', href: '/core/single-name/', meta: 'All single-name deep dives' },
          { id: 'equity-hub',      label: 'Equity hub',           href: '/core/equity/',      meta: 'Top-5 AI winners deep dive' },
          { id: 'plug-overview',   label: 'Plug Power (PLUG)',    href: '/core/plug/',        meta: '6 views - cash flow, revenue, balance, liquidity, footprint' },
        ]},
      ],
    },

    'equity:plug': {
      label: 'Plug Power - PLUG',
      groups: [
        { links: [
          { id: 'plug-overview',  label: 'Section overview',         href: '/core/plug/',             meta: 'PLUG landing' },
          { id: 'plug-cashflow',  label: 'Quarterly cash flow',      href: '/core/plug/cashflow.html', meta: 'CFO/CFI/CFF/Cash drivers, 2015-2025 EDGAR XBRL' },
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
          { id: 'regime',    label: 'Regime',    href: '/core/macro/',                 meta: 'Composite + sector regime, regime returns, headline read' },
          { id: 'cycle',     label: 'Cycle',     href: '/core/macro/cycle/',     sub: true, meta: 'Recession risk, NFCI, yield spreads' },
          { id: 'inflation', label: 'Inflation', href: '/core/macro/inflation/', sub: true, meta: 'CPI breakdown, services vs goods, sticky vs flexible' },
          { id: 'housing',   label: 'Housing',   href: '/core/macro/housing/',   sub: true, meta: '20 housing metrics' },
          { id: 'consumer',  label: 'Consumer',  href: '/core/macro/real-economy/', sub: true, meta: 'Spending, savings, credit health' },
          { id: 'credit',    label: 'Credit',    href: '/core/macro/credit/',    sub: true, meta: 'Spreads, default rates, loan growth' },
          { id: 'labor',     label: 'Labor',     href: '/core/macro/labor/',     sub: true, meta: 'Payrolls, wages, participation' },
        ]},
        { links: [
          { id: 'regional',   label: 'Regional',   href: '/core/macro/regional/',  meta: 'All regional dispersion views' },
          { id: 'geography',  label: 'Geography',  href: '/core/macro/geography/', meta: 'State + MSA selectors, ranked bars' },
        ]},
        { links: [
          { id: 'indicators', label: 'All 22 indicators', href: '/core/econ/',          meta: 'Card grid - latest, YoY, percentile, sparkline, live' },
          { id: 'recession',  label: 'Recession composite', href: '/core/econ/recession.html', meta: '5-signal model: Sahm, 10Y-3M, HY OAS, UNRATE, NFP' },
        ]},
      ],
    },

    'macro:regional': {
      label: 'Regional macro',
      groups: [
        { links: [
          { id: 'regional-hub',    label: 'Regional overview',  href: '/core/macro/regional/',                meta: 'Hub - all regional dispersion views' },
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
        { links: [
          { id: 'supply-overview',     label: 'Overview & SC Pressure', href: '/core/supply/',                 meta: '4-quadrant headline - z-score blend' },
          { id: 'supply-insights',     label: 'Insights',               href: '/core/supply/insights/',        meta: 'Curated weekly read on what moved' },
          { id: 'supply-dc',           label: 'Distribution Center',    href: '/core/supply/dc/',              meta: 'Wages, packaging, equipment, inventories' },
          { id: 'supply-industrial',   label: 'Industrial Real Estate', href: '/core/supply/dc/industrial-re.html', meta: 'Construction, REIT basket, cap-rate spread' },
          { id: 'supply-middle',       label: 'Middle Mile',            href: '/core/supply/middle-mile/',     meta: 'Diesel, Cass, ATA tonnage, intermodal, DAT spot' },
          { id: 'supply-last',         label: 'Last Mile',              href: '/core/supply/last-mile/',       meta: 'Couriers, USPS volume, e-commerce share' },
          { id: 'supply-international',label: 'International / Sourcing', href: '/core/supply/international/', meta: 'GSCPI, WCI, SCFI, FBX, BDI, ports, bunker' },
        ]},
        { links: [
          { id: 'supply-downloads',    label: 'Downloads (CSV + zip)',  href: '/core/supply/data.html',        meta: 'All series, full history', sub: true },
        ]},
      ],
    },

    tools: {
      label: 'Tools',
      groups: [
        { links: [
          { id: 'pair-explorer',  label: 'Pair Explorer',        href: '/core/macro/research.html',  meta: 'Correlation + regression any two series' },
          { id: 'network',        label: 'Transmission Network', href: '/core/macro/network.html',   meta: 'All-pairs correlation map - 60m window - lead-lag arrows' },
          { id: 'backtest',       label: 'Regime Backtest',      href: '/core/macro/backtest/',      meta: 'Walk-forward regime rotation vs SPY + 60/40' },
          { id: 'compare',        label: 'Compare Indicators',   href: '/core/econ/compare.html',    meta: 'Compare any two indicators side-by-side' },
        ]},
      ],
    },

    reference: {
      label: 'Reference',
      groups: [
        { links: [
          { id: 'data-catalog',      label: 'Data Catalog',     href: '/core/data/',             meta: 'All series with FRED IDs, transforms, refresh cadence' },
          { id: 'supply-downloads',  label: 'Supply Downloads', href: '/core/supply/data.html',  meta: 'Supply-chain CSV bundle' },
        ]},
      ],
    },
  };

  // ----------------------------------------------------------------------
  // LANDING_HUB -- ordered cards rendered on the home page hub
  // pages   = which PAGES key to pull links from
  // pill    = optional badge text (Live / New / Weekly etc.)
  // open    = whether the card is initially expanded
  // include = additional sections to splice in as additional groups
  // exclude = group indexes to drop from the source PAGES entry
  // ----------------------------------------------------------------------
  const LANDING_HUB = [
    {
      id: 'equity',
      title: 'Equity / Markets',
      pill: 'Live',
      pages: 'equity',
      include: ['equity:plug'],   // shows Plug pages as a sub-group
      open: true,
    },
    {
      id: 'macro-national',
      title: 'Macro (National)',
      pill: 'Live',
      pages: 'macro',
      exclude: [1],               // skip macro group #1 (regional + geography)
      open: true,
    },
    {
      id: 'macro-regional',
      title: 'Macro (Regional)',
      pill: 'Live',
      pages: 'macro:regional',
      open: false,
    },
    {
      id: 'ai',
      title: 'AI Focus',
      pill: 'New',
      pages: 'ai',
      open: false,
    },
    {
      id: 'supply',
      title: 'Supply Chain',
      pill: 'Weekly',
      pages: 'supply',
      open: false,
    },
    {
      id: 'tools',
      title: 'Tools',
      pages: 'tools',
      open: false,
    },
  ];

  window.SIBERFORGE_NAV = { SECTIONS: SECTIONS, PAGES: PAGES, LANDING_HUB: LANDING_HUB };
})();
