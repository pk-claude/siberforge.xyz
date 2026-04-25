// Sector ETF descriptions and regime-specific narratives.
//
// Used by the regime-returns table to populate hover tooltips. Three layers
// of information surface to the user:
//   1. SECTOR_PROFILES[sym].description — what the sector IS (sub-industries +
//      a one-line cyclical/duration/inflation profile).
//   2. SECTOR_PROFILES[sym].byRegime[regime] — why it tends to perform the way
//      it does in that specific regime (the macro mechanism).
//   3. REGIME_NARRATIVES[regime] — the regime's macro setup, used on row-label
//      tooltips so the user can read each regime's general thesis.
//
// Editorial voice: terse, mechanism-focused, written for a finance audience.
// No "this might..." hedging — these are textbook regime mechanics. The
// numbers in the cell already carry the empirical record.

export const SECTOR_PROFILES = {
  SPY: {
    label: 'S&P 500',
    description: 'Broad large-cap US equity benchmark. Use as the comparison baseline — sectors are interesting when they materially diverge from this row.',
    byRegime: {
      goldilocks:   'The textbook risk-on regime: real growth expanding, Fed not forced to tighten, multiples expand. SPY tends to lead among broad-asset choices.',
      reflation:    'Mixed: cyclicals lift the index but long-duration growth (tech, communications) drags. Returns are positive on average but with wider dispersion vs Goldilocks.',
      stagflation:  'The hostile regime for risk assets. Real returns near zero, P/E compression dominates earnings growth. High variance, fat negative tail.',
      disinflation: 'Bimodal — late-cycle slowdowns end in recessions (deeply negative SPY); soft landings end in Fed-cut rallies (positive). Average masks the bimodality.',
    },
  },
  XLK: {
    label: 'Technology',
    description: 'Software, semiconductors, hardware (AAPL, MSFT, NVDA dominate). The longest-duration equity sector — cash flows weighted to far future, so multiples are highly rate-sensitive.',
    byRegime: {
      goldilocks:   'Best-case for tech: stable rates + earnings growth = multiple expansion on top of EPS growth. Long-duration discount-rate tailwind. Typically the leading sector in this regime.',
      reflation:    'Headwind from rising real yields compressing multiples; partially offset by AI/secular cap-ex demand. Often a mid-pack performer in reflation despite strong nominal earnings.',
      stagflation:  'Worst-case: falling growth hits earnings AND rising rates compress multiples. The 2022 episode is the textbook example.',
      disinflation: 'Strong if the Fed is actively cutting — long-duration bid returns. Weak in early-disinflation (recession middle) when earnings are still falling.',
    },
  },
  XLF: {
    label: 'Financials',
    description: 'Banks (JPM, BAC), insurers (BRK.B), capital markets (GS, MS). Earnings tied to net interest margin (curve shape) and credit losses (cycle position).',
    byRegime: {
      goldilocks:   'Solid: loan demand healthy, credit losses contained, but flat curve caps NIM upside. Performs in line with SPY rather than leading.',
      reflation:    'Sweet spot: rising long rates + healthy demand = NIM expansion. Bank earnings are a function of curve steepness; reflation steepens it.',
      stagflation:  'Mixed: rising rates help NIM, but slowing growth and rising defaults hit credit costs. Net often negative as credit dominates.',
      disinflation: 'Weak — Fed cutting flattens the curve and squeezes NIM, while recession risk drives loan-loss provisions higher.',
    },
  },
  XLE: {
    label: 'Energy',
    description: 'Oil & gas E&P (XOM, CVX), refiners, services. Revenue tracks crude/gas prices directly. The closest thing to an inflation hedge in equities — positive real-asset beta.',
    byRegime: {
      goldilocks:   'Lacks a thesis: stable demand without inflation tailwind. Earnings fine but multiples don\'t expand. Often a market lagger in this regime.',
      reflation:    'Strong: rising oil prices feed both top-line revenue and earnings leverage. Reflationary cycles often have an oil-supply driver.',
      stagflation:  'The classic hedge: stagflation episodes (1970s, 2022) are usually CAUSED BY oil supply shocks. Energy is the one sector that can be positive when SPY is deeply negative.',
      disinflation: 'Weak: falling demand crushes commodity prices, sector earnings fall with them. Energy underperforms as the cycle turns down.',
    },
  },
  XLV: {
    label: 'Health Care',
    description: 'Pharma (LLY, JNJ, PFE), managed care (UNH), devices, biotech. Demand inelastic to the cycle — people get sick regardless. Quasi-defensive with quality earnings.',
    byRegime: {
      goldilocks:   'Stable performer but lags cyclicals. Earnings predictable, multiples not stretched. The "sleep at night" sector — fine but not leading.',
      reflation:    'Modest underperformance — defensives don\'t get the cyclical bid, but pricing power on drugs partially insulates margins.',
      stagflation:  'Outperforms: defensive earnings hold up, pricing power preserves margins, demand inelastic. One of the few non-energy hiding places.',
      disinflation: 'Strong defensive bid, especially as Fed cuts boost the bond-proxy component. Historically a top sector in late-cycle slowdowns.',
    },
  },
  XLI: {
    label: 'Industrials',
    description: 'Capital goods (CAT, DE), aerospace/defense (BA, RTX), transports, machinery. Earnings track cap-ex cycle and global trade. Pure economic-cycle exposure.',
    byRegime: {
      goldilocks:   'Strong: cap-ex pickup + healthy global trade. Reads off the manufacturing cycle, which is improving. Solid mid-pack to leader.',
      reflation:    'Strong: cyclical earnings expanding + nominal pricing power on capital goods. Often a top performer in this regime.',
      stagflation:  'Weak: cap-ex falters as rates rise and growth slows. Order books shrink. Negative operating leverage hits hard.',
      disinflation: 'Weak: late-cycle cap-ex contraction, demand slowing. Industrials lead the cycle down — they don\'t bottom until the rate-cut cycle is well underway.',
    },
  },
  XLY: {
    label: 'Consumer Discretionary',
    description: 'Autos (TSLA, F), homebuilders (DHI, LEN), retail (AMZN, HD), restaurants, leisure, apparel. The pure cyclical — first thing households cut when budgets tighten.',
    byRegime: {
      goldilocks:   'Often the leading sector: real wages outpacing inflation = healthy household spending power. Wallet-share goes to discretionary categories.',
      reflation:    'Mixed: strong nominal demand, but inflation eats into real wages and margins compress on input costs. Auto / homebuilder rate sensitivity adds noise.',
      stagflation:  'Worst regime: real wages negative, savings rate rising, big-ticket purchases deferred. Often the worst-performing sector after long-duration growth.',
      disinflation: 'Mixed: rate cuts help affordability (autos, housing) but employment weakening hurts demand. Net depends on whether soft or hard landing.',
    },
  },
  XLP: {
    label: 'Consumer Staples',
    description: 'Food/beverage (KO, PEP, PG), household goods, tobacco. Demand inelastic — people don\'t stop buying toothpaste in recessions. Defensive bond-proxy with steady dividends.',
    byRegime: {
      goldilocks:   'Lags: no cyclical bid, no rate-cut tailwind. Defensive sectors underperform when risk-on dominates. Worst regime for staples on a relative basis.',
      reflation:    'Mixed: pricing power passes through input costs, but multiple compression as rates rise. Net flat to slightly negative.',
      stagflation:  'Outperforms: pricing power preserves real margins, demand inelastic, defensive bid kicks in. One of the few historically positive sectors in stagflation.',
      disinflation: 'Strong: defensive bid + falling rates lift bond-proxy valuations. Often a top performer when the cycle turns down.',
    },
  },
  XLU: {
    label: 'Utilities',
    description: 'Regulated electric (NEE, SO), gas, water utilities. The most bond-like equity sector — high dividend yield, regulated returns, long-duration cash flows. Trades more on long rates than equity beta.',
    byRegime: {
      goldilocks:   'Lags badly: defensive bond-proxy with no cyclical thesis and no rate tailwind. The sector you underweight when growth is fine.',
      reflation:    'Worst regime: rising rates hammer the bond-proxy, no operating leverage to inflation. Often the bottom-ranking sector.',
      stagflation:  'Mixed: defensive demand offset by rate sensitivity. Net depends on which dominates — usually rates win and utilities lag.',
      disinflation: 'Best regime: falling rates lift bond-proxy valuations, defensive bid, dividend yield looks better as risk-free falls. Often the leading sector.',
    },
  },
  XLB: {
    label: 'Materials',
    description: 'Chemicals (LIN, APD, SHW), metals & mining (FCX, NEM), paper/packaging. Cyclical-commodity hybrid — earnings track industrial demand and commodity prices simultaneously.',
    byRegime: {
      goldilocks:   'Decent: cyclical demand picks up but commodity prices stable. Mid-pack performer — neither inflation hedge nor pure cyclical.',
      reflation:    'Strong: rising commodity prices + cyclical demand both lift earnings. Direct beneficiary of the regime\'s mechanics.',
      stagflation:  'Mixed: commodity tailwind on prices, but volume contraction hurts. Often less negative than pure cyclicals but still weak.',
      disinflation: 'Weak: falling commodity prices, demand contracting. Materials don\'t bottom until the cycle does.',
    },
  },
  XLRE: {
    label: 'Real Estate (REITs)',
    description: 'Equity REITs across residential (AVB, EQR), industrial (PLD), data centers (EQIX), retail, healthcare. Income-producing real assets — long-duration via cap rates, rent growth tracks nominal GDP. INCEPTION OCT 2015 — limited regime history.',
    byRegime: {
      goldilocks:   'Decent: stable rates + nominal growth = decent rent growth + cap-rate stability. Mid-pack performer with stable income contribution.',
      reflation:    'Mixed: rent growth strong, but cap rates expand with rising long rates. Net depends on whether rent growth outpaces cap-rate expansion (usually it doesn\'t in fast-rate-rise regimes).',
      stagflation:  'Weak: rate sensitivity dominates rent growth. Multifamily/industrial more resilient than office. Limited 2022 sample shows the pattern clearly.',
      disinflation: 'Strong: falling cap rates support valuations even as rent growth slows. Falling rates the dominant factor. Typically a top performer.',
    },
  },
  XLC: {
    label: 'Communications',
    description: 'Media + telecom + interactive — META, GOOGL, NFLX dominate. Originally a defensive sector (telecom), restructured 2018 to add digital media. Heavy ad-revenue exposure makes it cyclical now. INCEPTION JUNE 2018 — very limited regime history.',
    byRegime: {
      goldilocks:   'Strong: ad spend tracks GDP + consumer health, internet platforms scale earnings well in expansion. Limited sample but pattern consistent.',
      reflation:    'Mixed: ad cyclicality helps, but rising rates compress multiples on Meta/Alphabet (long-duration platforms). Net often modest.',
      stagflation:  'Weak: ad market contracts with growth slowdown + multiple compression on platforms. 2022 sample shows the pattern.',
      disinflation: 'Mixed: rate cuts help long-duration platforms, but slowing ad market hurts. Net depends on which dominates.',
    },
  },
};

// Regime-level macro narratives — used on the row-label tooltip in the table.
// Each is 2-3 sentences: the macro setup, the dominant cross-asset implication,
// and the signature "tell" for the regime.
export const REGIME_NARRATIVES = {
  goldilocks: {
    title: 'Goldilocks: growth expanding, inflation cooling',
    body: 'Real economy in mid-cycle expansion, Fed not forced to tighten further, multiples can expand alongside earnings growth. Risk-on regime: cyclicals + long-duration growth lead, defensives lag. The typical 2013–2019 backdrop.',
  },
  reflation: {
    title: 'Reflation: growth and inflation both rising',
    body: 'Late-expansion or early-recovery with both growth and prices accelerating. Real assets (energy, materials), curve-steepening beneficiaries (financials), and pricing-power businesses lead. Long-duration growth (tech, REITs) lags as discount rates rise. 2003–2007, parts of 2021 fit here.',
  },
  stagflation: {
    title: 'Stagflation: growth slowing, inflation hot',
    body: 'The hostile regime: Fed forced to tighten into weakness. Real returns near zero, valuation compression dominates earnings. Energy, staples, healthcare hold up; everything else underperforms. 1970s, 2022 are the canonical episodes.',
  },
  disinflation: {
    title: 'Disinflation / Recession risk: growth and inflation both falling',
    body: 'Late cycle slowdown turning into either soft landing or recession. Bimodal regime: average forward returns mask deep recessions (negative tail) and soft-landing rallies (positive tail). Defensives (utilities, staples, healthcare) and rate-cut beneficiaries (long-duration tech, REITs) tend to lead. 2001, 2008, late-2019, parts of 2024.',
  },
};
