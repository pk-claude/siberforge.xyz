// nav-config.js — single source of truth for site navigation.
//
// Add/rename a section: edit this file. Every page's nav re-renders from here.
//
// Shape:
//   SECTIONS: top-level tabs (one row across the top of every page)
//   PAGES:    keyed by section.id, defines second-tier links shown when that
//             section is active. Each entry has:
//               - label:  the .sf-nav-label text (left-aligned grey caption)
//               - groups: array of link groups; each group is one of:
//                   { master: true, links: [...] }   -- highlighted master/sub group
//                   { label: 'X',   links: [...] }   -- group with section-label
//                   { links: [...] }                 -- plain group (with divider before)
//
// Each link: { id, label, href, sub: true (optional, renders as small sub-link) }
//
// The page declares its identity via <body data-section="..." data-page="..."
// data-sub-section="...">. layout.js reads that and applies .active classes.

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
          { id: 'markets', label: 'Markets', href: '/core/macro/markets.html' },
          { id: 'bonds',   label: 'Bonds',   href: '/core/macro/bonds.html' },
          { id: 'ticker',  label: 'Ticker',  href: '/core/macro/ticker.html' },
        ]},
        { label: 'Single-name', links: [
          { id: 'single-name-hub', label: 'Research hub', href: '/core/single-name/' },
          { id: 'equity-hub',      label: 'Equity hub',   href: '/core/equity/' },
          { id: 'plug-overview',   label: 'Plug Power',   href: '/core/plug/' },
        ]},
      ],
    },

    // Sub-section nav for Plug Power deep-dive pages.
    // Pages set data-section="equity" data-sub-section="plug" so the equity
    // tab stays active up top, but the page row shows Plug-specific links.
    'equity:plug': {
      label: 'Plug Power - PLUG',
      groups: [
        { links: [
          { id: 'plug-overview',  label: 'Overview',     href: '/core/plug/' },
          { id: 'plug-cashflow',  label: 'Cash flow',    href: '/core/plug/cashflow.html' },
          { id: 'plug-revenue',   label: 'Revenue',      href: '/core/plug/revenue.html' },
          { id: 'plug-balance',   label: 'Balance sheet',href: '/core/plug/balance.html' },
          { id: 'plug-liquidity', label: 'Liquidity',    href: '/core/plug/liquidity.html' },
          { id: 'plug-map',       label: 'US footprint', href: '/core/plug/map.html' },
        ]},
      ],
    },

    macro: {
      label: 'Macro views',
      groups: [
        { master: true, links: [
          { id: 'regime',    label: 'Regime',    href: '/core/macro/' },
          { id: 'cycle',     label: 'Cycle',     href: '/core/macro/cycle/',     sub: true },
          { id: 'inflation', label: 'Inflation', href: '/core/macro/inflation/', sub: true },
          { id: 'housing',   label: 'Housing',   href: '/core/macro/housing/',   sub: true },
          { id: 'consumer',  label: 'Consumer',  href: '/core/macro/real-economy/', sub: true },
          { id: 'credit',    label: 'Credit',    href: '/core/macro/credit/',    sub: true },
          { id: 'labor',     label: 'Labor',     href: '/core/macro/labor/',     sub: true },
        ]},
        { links: [
          { id: 'regional',   label: 'Regional',   href: '/core/macro/regional/' },
          { id: 'geography',  label: 'Geography',  href: '/core/macro/geography/' },
        ]},
        { links: [
          { id: 'indicators', label: 'Indicators', href: '/core/econ/' },
          { id: 'recession',  label: 'Recession',  href: '/core/econ/recession.html' },
        ]},
      ],
    },

    'macro:regional': {
      label: 'Regional macro',
      groups: [
        { links: [
          { id: 'regional-hub',    label: 'Overview',     href: '/core/macro/regional/' },
          { id: 'regional-cpi',    label: 'CPI',          href: '/core/macro/regional/regional-cpi/' },
          { id: 'affordability',   label: 'Affordability',href: '/core/macro/regional/affordability/' },
          { id: 'build-buy',       label: 'Build vs Buy', href: '/core/macro/regional/build-buy/' },
          { id: 'channel-mix',     label: 'Channel Mix',  href: '/core/macro/regional/channel-mix/' },
          { id: 'climate-risk',    label: 'Climate',      href: '/core/macro/regional/climate-risk/' },
          { id: 'demographics',    label: 'Demographics', href: '/core/macro/regional/demographics/' },
          { id: 'migration',       label: 'Migration',    href: '/core/macro/regional/migration/' },
        ]},
      ],
    },

    ai: {
      label: 'AI Beneficiaries',
      groups: [
        { label: 'Top-down thematic', links: [
          { id: 'ai-hub',          label: 'Hub',           href: '/core/ai/' },
          { id: 'ai-compute',      label: 'Compute',       href: '/core/ai/compute/' },
          { id: 'ai-hyperscalers', label: 'Hyperscalers',  href: '/core/ai/hyperscalers/' },
          { id: 'ai-power',        label: 'Power',         href: '/core/ai/power/' },
          { id: 'ai-adopters',     label: 'Adopters',      href: '/core/ai/adopters/' },
        ]},
        { label: 'Bottom-up', links: [
          { id: 'ai-screen',       label: 'Industry Scenarios', href: '/core/ai/screen/' },
          { id: 'ai-top-5',        label: 'Top 5 Winners',      href: '/core/ai/top-5/' },
        ]},
      ],
    },

    supply: {
      label: 'Supply Chain',
      groups: [
        { links: [
          { id: 'supply-overview',     label: 'Overview',             href: '/core/supply/' },
          { id: 'supply-insights',     label: 'Insights',             href: '/core/supply/insights/' },
          { id: 'supply-dc',           label: 'Distribution Center',  href: '/core/supply/dc/' },
          { id: 'supply-industrial',   label: 'Industrial RE',        href: '/core/supply/dc/industrial-re.html' },
          { id: 'supply-middle',       label: 'Middle Mile',          href: '/core/supply/middle-mile/' },
          { id: 'supply-last',         label: 'Last Mile',            href: '/core/supply/last-mile/' },
          { id: 'supply-international',label: 'International',        href: '/core/supply/international/' },
        ]},
        { links: [
          { id: 'supply-downloads',    label: 'Downloads',            href: '/core/supply/data.html', sub: true },
        ]},
      ],
    },

    tools: {
      label: 'Tools',
      groups: [
        { links: [
          { id: 'pair-explorer',  label: 'Pair Explorer',        href: '/core/macro/research.html' },
          { id: 'network',        label: 'Transmission Network', href: '/core/macro/network.html' },
          { id: 'backtest',       label: 'Regime Backtest',      href: '/core/macro/backtest/' },
          { id: 'compare',        label: 'Compare Indicators',   href: '/core/econ/compare.html' },
        ]},
      ],
    },

    reference: {
      label: 'Reference',
      groups: [
        { links: [
          { id: 'data-catalog',      label: 'Data Catalog',     href: '/core/data/' },
          { id: 'supply-downloads',  label: 'Supply Downloads', href: '/core/supply/data.html' },
        ]},
      ],
    },
  };

  window.SIBERFORGE_NAV = { SECTIONS: SECTIONS, PAGES: PAGES };
})();
