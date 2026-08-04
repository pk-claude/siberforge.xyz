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
          { id: 'single-name-hub', label: 'Single-name research', href: '/core/single-name/', meta: 'All single-name deep dives' },
          { id: 'plug-overview',   label: 'Plug Power (PLUG)',    href: '/core/plug/',        meta: '6 views - cash flow, revenue, balance, liquidity, footprint' },
        ]},
        { label: 'Valuation', links: [
          { id: 'pe-overview',     label: 'P/E Multiples',        href: '/core/equity/pe/',   meta: 'S&P 500 + Nasdaq-100 trailing & forward P/E, sortable, with daily forward-P/E history' },
        ]},
      ],
    },

    'equity:plug': {
      label: 'Plug Power - PLUG',
      groups: [
        { links: [
          { id: 'plug-overview',  label: 'Section overview',         href: '/core/plug/',              meta: 'PLUG landing' },
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
          { id: 'supply-downloads', label: 'Supply data downloads', href: '/core/supply/data.html', meta: 'All supply-chain series, full history, CSV + zip' },
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
    index: buildIndex,
  };
})();
