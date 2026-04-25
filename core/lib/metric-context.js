// Curated educational + contextual content for the metric tiles on the
// deep-dive pages. Each tile in cycle/inflation/housing/consumer/credit/labor
// can be tagged with `data-tile-metric="<id>"` and the tile-tooltip module
// will read this catalog and surface what/why/recent-events/source links.
//
// Add new metrics by appending an entry. Keep `links` honest — only include
// authoritative sources (FRED, BLS, NBER, NY Fed, FT, Bloomberg, Reuters).
// "context" should be 1-3 sentences with concrete dates so the reader sees
// the metric tied to actual market history.

export const METRIC_CONTEXT = {

  // =========================== LABOR ===========================
  UNRATE: {
    label: 'U.S. Unemployment Rate',
    unit: 'percent · monthly · BLS',
    what: 'Share of the civilian labor force that is unemployed and actively seeking work (U-3 measure).',
    why:  'Most-watched single labor stat. Lagging by construction — by the time UNRATE rises materially, the cycle has already turned. The trajectory matters more than the level.',
    context: 'Hit a 50-year low of 3.4% in Jan 2023. Drifted to 4.3% by Aug 2024, briefly triggering the Sahm Rule before stabilizing. Historically, every 0.5pp rise from cycle low has preceded recession.',
    thresholds: '< 4.0% tight · 4.0–5.0% normal · > 5.0% weakening · > 6.0% recessionary',
    links: [
      { label: 'FRED · UNRATE',                            url: 'https://fred.stlouisfed.org/series/UNRATE' },
      { label: 'BLS · The Employment Situation (release)', url: 'https://www.bls.gov/news.release/empsit.toc.htm' },
      { label: 'NBER Recession Dating Procedure',          url: 'https://www.nber.org/research/business-cycle-dating' },
    ],
  },
  SAHM: {
    label: 'Sahm Rule',
    unit: 'percentage points · monthly · derived',
    what: 'Triggers when the 3-month moving average of UNRATE rises 0.50pp above its trailing 12-month low. Real-time recession indicator developed by Claudia Sahm.',
    why:  'Has flagged every post-1970 US recession in real time with no false positives prior to 2024 — making it the most reliable real-time recession trigger in macro.',
    context: 'Briefly triggered Aug 2024 (0.53pp) when UNRATE rose to 4.3%, then reversed by Q4 2024. Sahm herself argued in a Bloomberg op-ed that post-Covid labor-supply dynamics may have caused a false positive — first such outcome in 50+ years.',
    thresholds: '0.0pp baseline · 0.4pp watch · 0.50pp trigger',
    links: [
      { label: 'FRED · SAHMCURRENT',                                         url: 'https://fred.stlouisfed.org/series/SAHMCURRENT' },
      { label: 'Sahm 2019 — original methodology (Hamilton Project, NBER)',  url: 'https://www.hamiltonproject.org/papers/direct_stimulus_payments_to_individuals' },
      { label: 'Bloomberg · Why everyone is talking about the Sahm Rule',    url: 'https://www.bloomberg.com/news/articles/2024-08-02/what-is-the-sahm-rule-and-why-everyone-on-wall-street-is-talking-about-it' },
      { label: 'Claudia Sahm Substack · the 2024 trigger explained',         url: 'https://stayathomemacro.substack.com/' },
    ],
  },
  IC4WSA: {
    label: 'Initial Claims, 4-week MA',
    unit: 'thousands · weekly · DOL',
    what: 'Smoothed 4-week moving average of new applications for unemployment insurance. Highest-frequency labor signal published in macro.',
    why:  'Leads UNRATE by 4-8 weeks. A sustained climb of 30K+ over six weeks has historically marked regime shifts; the 350K threshold has separated expansions from contractions.',
    context: 'Range during 2023-2024 expansion: ~210-260K. Recession troughs typically run 200-230K; recession peaks reach 600K+ (2008 hit 660K, 2020 spiked to 6.6M briefly).',
    thresholds: '< 230K full employment · 230-300K normal expansion · > 350K stress · > 450K contraction',
    links: [
      { label: 'FRED · IC4WSA',                                       url: 'https://fred.stlouisfed.org/series/IC4WSA' },
      { label: 'DOL · UI weekly claims release',                      url: 'https://www.dol.gov/ui/data.pdf' },
      { label: 'St. Louis Fed · Reading Initial Claims',              url: 'https://www.stlouisfed.org/on-the-economy/2023/dec/initial-claims-recession-signals' },
    ],
  },
  PAYEMS_6M: {
    label: 'Nonfarm Payrolls, 6-month annualized',
    unit: 'percent · monthly · BLS',
    what: '6-month percent change in PAYEMS, annualized. Captures the momentum of hiring better than YoY (which lags 6+ months).',
    why:  'Sub-1% annualized 6m growth is the recession-warning threshold. The level matters less than the trajectory — sustained deceleration from 2%+ to under 1% over two quarters is the cleanest signal.',
    context: 'Slowed from ~3% in early 2022 to 1.5% by mid-2024 — typical of late-cycle expansion. NBER recessions of the past 50 years all featured 6m annualized growth turning negative within 1-2 months of recession start.',
    thresholds: '> 2% strong · 1.5–2% healthy · 0.5–1.5% slowing · < 0.5% recession risk · negative confirmed',
    links: [
      { label: 'FRED · PAYEMS',                            url: 'https://fred.stlouisfed.org/series/PAYEMS' },
      { label: 'BLS · The Employment Situation (release)', url: 'https://www.bls.gov/news.release/empsit.toc.htm' },
    ],
  },
  AHE_YOY: {
    label: 'Average Hourly Earnings, YoY',
    unit: 'percent · monthly · BLS',
    what: 'Year-over-year change in average hourly earnings of private sector employees. Direct read on wage pressure.',
    why:  'Wages drive 50-60% of services CPI. The Fed targets wage growth around 3.0-3.5% as consistent with 2% inflation + ~1% productivity. Above 4.5% suggests structurally too-tight labor; below 2.5% suggests slack.',
    context: 'Peaked at 5.9% in March 2022 during the post-Covid wage spike. Decelerated to ~4.0% by mid-2024 — still above the Fed-comfortable level. ECI (Employment Cost Index) is the cleaner Fed-watched alternative since AHE is composition-sensitive.',
    thresholds: '< 2.5% slack · 2.5–3.5% near-target · 3.5–4.5% elevated · > 4.5% structurally tight',
    links: [
      { label: 'FRED · CES0500000003 (private AHE)',                                url: 'https://fred.stlouisfed.org/series/CES0500000003' },
      { label: 'BLS · Employment Cost Index (preferred Fed measure)',                url: 'https://www.bls.gov/eci/' },
      { label: 'Atlanta Fed · Wage Growth Tracker',                                  url: 'https://www.atlantafed.org/chcs/wage-growth-tracker' },
    ],
  },
  REAL_WAGES: {
    label: 'Real Wage Growth',
    unit: 'percentage points · monthly · derived',
    what: 'AHE YoY minus Core CPI YoY. The actual purchasing-power change for the average worker.',
    why:  'Negative real wages compress consumer demand and historically end inflation cycles by breaking demand. When real wages turn negative, discretionary spending typically softens within 1-2 quarters.',
    context: 'Negative through most of 2021-2022 (peak inflation), turned positive mid-2023 as inflation rolled. Consumer durables purchasing dropped 8% YoY during the negative-real-wages period.',
    thresholds: '> +1pp consumer tailwind · 0 to +1pp neutral · negative consumer headwind',
    links: [
      { label: 'FRED · CES0500000003 (AHE)',     url: 'https://fred.stlouisfed.org/series/CES0500000003' },
      { label: 'FRED · CPILFESL (Core CPI)',     url: 'https://fred.stlouisfed.org/series/CPILFESL' },
    ],
  },

  // =========================== CREDIT ===========================
  NFCI: {
    label: 'Chicago Fed National Financial Conditions Index',
    unit: 'index · weekly · Chicago Fed',
    what: 'Composite z-score of 105 measures of money-market stress, credit-market spreads, and leverage. By construction, > 0 = tighter than historical average; < 0 = looser.',
    why:  'NFCI > +0.5 has historically preceded recessions by 6-9 months. Captures funding stress not visible in spreads alone (e.g., commercial paper, repo).',
    context: 'Spiked to +1.6 during March 2023 SVB collapse before normalizing. Drifted to ~-0.5 (loose) by Q4 2024 as credit risk normalized despite curve still inverted.',
    thresholds: '< -0.5 very loose · -0.5 to 0 loose · 0 to +0.5 watch · > +0.5 stress · > +1.0 crisis',
    links: [
      { label: 'FRED · NFCI',                                     url: 'https://fred.stlouisfed.org/series/NFCI' },
      { label: 'Chicago Fed · NFCI methodology',                  url: 'https://www.chicagofed.org/publications/nfci/index' },
    ],
  },
  ANFCI: {
    label: 'Adjusted NFCI (cycle-controlled)',
    unit: 'index · weekly · Chicago Fed',
    what: 'NFCI residual after removing variation explained by current macro conditions. Isolates "tightness vs what the cycle would imply."',
    why:  'When ANFCI tightens while NFCI is flat, conditions are tightening for non-cyclical reasons — that\'s often the early-warning signal.',
    context: 'Diverged from NFCI in late 2007 and again in early 2020 — predicting both recessions before broader stress emerged.',
    thresholds: 'Same scale as NFCI; diverge from NFCI = signal',
    links: [
      { label: 'FRED · ANFCI',                                    url: 'https://fred.stlouisfed.org/series/ANFCI' },
      { label: 'Chicago Fed · NFCI methodology',                  url: 'https://www.chicagofed.org/publications/nfci/index' },
    ],
  },
  HY_OAS: {
    label: 'High-Yield OAS (BAML)',
    unit: 'basis points · daily · ICE BofA',
    what: 'Option-adjusted spread of US dollar high-yield corporate bonds vs Treasuries. Pure default-risk premium.',
    why:  'Single best market-priced cycle indicator. HY widens before equity drawdowns and contracts before equity recoveries. The HY-IG ratio reveals whether stress is concentrated (idiosyncratic) or systemic.',
    context: 'Spiked to 1080bp at the March 2020 Covid trough; 870bp during the 2022 rate-hike sell-off; 460bp during March 2023 SVB. Compressed to ~280bp by late 2024 — historically tight, indicating credit complacency.',
    thresholds: '< 300bp complacent · 300–500bp normal · 500–800bp elevated · > 800bp stress · > 1000bp crisis',
    links: [
      { label: 'FRED · BAMLH0A0HYM2',                              url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2' },
      { label: 'ICE BofA US High Yield Index methodology',         url: 'https://indices.theice.com/' },
    ],
  },
  IG_OAS: {
    label: 'Investment-Grade OAS',
    unit: 'basis points · daily · ICE BofA',
    what: 'Option-adjusted spread of US dollar IG corporate bonds vs Treasuries.',
    why:  'IG spreads widen first in slowdowns; HY widens second. When IG widens while HY stays calm, market is repricing duration not default — usually a rates story not a cycle story.',
    context: 'Range during 2024 expansion: 80–110bp. Crisis levels reach 350bp+ (2008 peaked at 555bp).',
    thresholds: '< 100bp loose · 100–150bp normal · 150–250bp elevated · > 250bp stress',
    links: [
      { label: 'FRED · BAMLC0A0CM',                                url: 'https://fred.stlouisfed.org/series/BAMLC0A0CM' },
    ],
  },
  HY_IG_RATIO: {
    label: 'HY / IG OAS Ratio',
    unit: 'multiple · daily · derived',
    what: 'High-yield OAS divided by IG OAS. Ratio captures the shape of the credit-risk curve.',
    why:  'When HY widens faster than IG (rising ratio), market is pricing distress at the bottom of the credit stack — early-cycle warning. Ratio below historical 4x mean = HY complacency relative to IG.',
    context: 'Historical mean ~4x; spiked above 6x in late 2022 (HY widened more than IG). At ~3.5x in 2024 — HY priced relatively too tight.',
    thresholds: '< 3.5x HY tight · 3.5–4.5x normal · > 5.0x stress concentrated in HY',
    links: [
      { label: 'St. Louis Fed Research · credit spread research', url: 'https://research.stlouisfed.org/' },
    ],
  },
  T10Y3M: {
    label: '10Y - 3M Treasury Curve',
    unit: 'basis points · daily · UST',
    what: 'Spread between the 10-year Treasury yield and the 3-month Treasury bill yield.',
    why:  'NY Fed\'s preferred recession-model input. Inversion (negative spread) precedes every post-1970 US recession with a 12-18 month lag. The dangerous signal is the bull-steepening *after* inversion — that\'s when recessions actually start.',
    context: 'Inverted continuously from October 2022 through August 2024 — longest inversion since 1980. Steepened sharply in late 2024 as Fed began cutting; this re-steepening from inversion historically marks the start of recessions.',
    thresholds: '> +150bp healthy · 0 to +150bp flat · 0 to -100bp inverted · < -100bp deeply inverted',
    links: [
      { label: 'FRED · T10Y3M',                                                  url: 'https://fred.stlouisfed.org/series/T10Y3M' },
      { label: 'NY Fed · Recession Probabilities Model',                          url: 'https://www.newyorkfed.org/research/capital_markets/ycfaq.html' },
      { label: 'Estrella & Mishkin 1996 · The Yield Curve as a Predictor',        url: 'https://www.newyorkfed.org/medialibrary/media/research/current_issues/ci2-7.pdf' },
    ],
  },
  T10Y2Y: {
    label: '10Y - 2Y Treasury Curve',
    unit: 'basis points · daily · UST',
    what: 'Spread between the 10-year Treasury yield and the 2-year Treasury yield. The financial-press favorite.',
    why:  'Less reliable than 10Y-3M (NY Fed prefers 10Y-3M for its model) but watched because it inverts earlier and is more sensitive to Fed policy expectations.',
    context: 'Inverted July 2022, deepened to -108bp in mid-2023, steepened back to +30bp by late 2024. The 2022-2024 inversion was the deepest since 1981.',
    thresholds: '> +100bp healthy · 0 to +100bp flat · negative inverted',
    links: [
      { label: 'FRED · T10Y2Y',                            url: 'https://fred.stlouisfed.org/series/T10Y2Y' },
    ],
  },
  DFII10: {
    label: '10-Year Real Yield (TIPS)',
    unit: 'percent · daily · UST',
    what: 'Yield on 10-year Treasury Inflation-Protected Securities. Compensation for lending real (inflation-adjusted) for 10 years.',
    why:  'The cleanest gauge of monetary policy restrictiveness. Independent of inflation expectations — directly measures how restrictive real interest rates are vs the natural rate (estimated ~0.5-1.0%).',
    context: 'Negative through 2020-2021 (very accommodative), spiked above 2.4% in October 2023 — most restrictive since 2007. Drifted to ~1.8% in late 2024 as Fed pivoted.',
    thresholds: '< 0% accommodative · 0–1% neutral · 1–2% restrictive · > 2% deeply restrictive',
    links: [
      { label: 'FRED · DFII10',                                                  url: 'https://fred.stlouisfed.org/series/DFII10' },
      { label: 'NY Fed · The Natural Rate of Interest (R-star)',                 url: 'https://www.newyorkfed.org/research/policy/rstar' },
    ],
  },

  // =========================== CYCLE ===========================
  RECPROB: {
    label: 'NY Fed Recession Probability (12m forward)',
    unit: 'percent · monthly · NY Fed',
    what: 'Probability of recession within 12 months estimated from a probit model of the 10Y-3M Treasury spread.',
    why:  'Pure statistical rendering of the curve\'s recession signal. Above 30% historically precedes recessions by 12-18 months; above 50% has been close to deterministic.',
    context: 'Climbed above 50% in late 2022 and stayed elevated through 2023. Even with the curve un-inverting in 2024, prob remained > 30% — historically that\'s where recessions begin.',
    thresholds: '< 10% benign · 10–30% watch · 30–50% elevated · > 50% near-deterministic',
    links: [
      { label: 'FRED · RECPROUSM156N',                                        url: 'https://fred.stlouisfed.org/series/RECPROUSM156N' },
      { label: 'NY Fed · Probability of Recession Model (FAQ)',               url: 'https://www.newyorkfed.org/research/capital_markets/ycfaq.html' },
    ],
  },

  // =========================== INFLATION ===========================
  CORE_CPI_YOY: {
    label: 'Core CPI, YoY',
    unit: 'percent · monthly · BLS',
    what: 'CPI excluding food and energy, year-over-year. The Fed\'s pre-2012 inflation target measure (now superseded by Core PCE but still the most-watched).',
    why:  'Strips volatile components to expose persistent inflation. Lags Core PCE by ~30bp structurally because of how shelter is measured.',
    context: 'Peaked at 6.6% in September 2022 — the highest since 1982. Drifted to 3.3% by late 2024 — sticky around 3.0-3.3% range due to shelter and services.',
    thresholds: '< 2% below target · 2–2.5% target · 2.5–3.5% sticky · > 3.5% problematic',
    links: [
      { label: 'FRED · CPILFESL',                          url: 'https://fred.stlouisfed.org/series/CPILFESL' },
      { label: 'BLS · CPI release',                        url: 'https://www.bls.gov/cpi/' },
    ],
  },
  STICKY_CPI: {
    label: 'Atlanta Fed Sticky-Price CPI',
    unit: 'percent · monthly · Atlanta Fed',
    what: 'Atlanta Fed split of core CPI by frequency of price change. "Sticky" components (rent, medical, education, insurance) reprice annually or less.',
    why:  'Sticky-price inflation is the Fed\'s real target — it\'s what monetary policy can actually affect. You can\'t talk down sticky inflation with dovish guidance.',
    context: 'Peaked at 6.6% in mid-2022. Decelerated slowly — at 4.2% in early 2024 — explaining why the Fed held rates high for so long despite headline inflation falling.',
    thresholds: '< 2.5% target · 2.5–3.5% sticky · > 3.5% Fed-uncomfortable · > 4.5% persistent',
    links: [
      { label: 'FRED · CORESTICKM159SFRBATL',                                  url: 'https://fred.stlouisfed.org/series/CORESTICKM159SFRBATL' },
      { label: 'Atlanta Fed · Sticky-Price CPI methodology',                   url: 'https://www.atlantafed.org/research/inflationproject/stickyprice' },
    ],
  },
  T5YIE: {
    label: '5-Year Breakeven Inflation',
    unit: 'percent · daily · UST',
    what: 'Difference between 5-year nominal Treasury yield and 5-year TIPS yield. Market-implied average inflation expectation over the next 5 years.',
    why:  'Real-time market pricing of inflation expectations. Includes a small risk premium so structurally runs ~25bp above realized inflation expectations.',
    context: 'Spiked to 3.6% in March 2022 then declined steadily. Trading near 2.3% in late 2024 — close to Fed target.',
    thresholds: '< 2% below-target · 2–2.5% near-target · > 2.5% market sees overshoot',
    links: [
      { label: 'FRED · T5YIE',                             url: 'https://fred.stlouisfed.org/series/T5YIE' },
    ],
  },
  T5YIFR: {
    label: '5Y5Y Forward Inflation',
    unit: 'percent · daily · UST',
    what: 'Market-implied average inflation rate for years 5 through 10. Strips out near-term inflation dynamics.',
    why:  'Cleanest gauge of long-run anchored expectations. Once this drifts above 2.7%, inflation expectations are "unanchored" and Fed credibility is at risk.',
    context: 'Stayed remarkably anchored 2.0-2.4% even during the 2021-2022 inflation spike — a key reason the Fed avoided a 1970s-style wage-price spiral.',
    thresholds: '< 2.0% deflation risk · 2.0–2.4% anchored · 2.4–2.7% drifting · > 2.7% unanchored',
    links: [
      { label: 'FRED · T5YIFR',                            url: 'https://fred.stlouisfed.org/series/T5YIFR' },
    ],
  },
  MICH: {
    label: 'UMich 1Y Inflation Expectations',
    unit: 'percent · monthly · U. Michigan',
    what: 'Median 1-year-ahead inflation expectation from the University of Michigan Survey of Consumers.',
    why:  'Consumer expectations matter because they affect wage demands and spending. Tend to be volatile and reflect grocery/gas prices more than policy credibility.',
    context: 'Peaked above 5.4% in mid-2022 alongside the gas-price spike. Drifted back below 3% by 2024.',
    thresholds: '< 3% anchored · 3–4% elevated · > 4% drifting',
    links: [
      { label: 'FRED · MICH',                                                 url: 'https://fred.stlouisfed.org/series/MICH' },
      { label: 'U. Michigan · Survey of Consumers',                            url: 'http://www.sca.isr.umich.edu/' },
    ],
  },
  SHELTER_CPI: {
    label: 'CPI Shelter, YoY',
    unit: 'percent · monthly · BLS',
    what: 'CPI shelter component (rent + owners\' equivalent rent), year-over-year. ~35% of Core CPI.',
    why:  'Shelter is the largest, most-lagged Core CPI component. BLS methodology lags actual rent by 6-12 months — when shelter is rolling over in the data, it\'s likely to keep rolling.',
    context: 'Peaked at 8.2% in early 2023 — highest since 1982. Decelerated steadily to ~5% by late 2024 but remains the biggest contributor keeping Core CPI above target.',
    thresholds: '< 3% benign · 3–4% normal · > 5% structural pressure',
    links: [
      { label: 'FRED · CPIHOSSL',                                               url: 'https://fred.stlouisfed.org/series/CPIHOSSL' },
      { label: 'Cleveland Fed · New Tenant Rent Index (leading indicator)',     url: 'https://www.clevelandfed.org/indicators-and-data/new-tenant-repeat-rent-index' },
    ],
  },

  // =========================== HOUSING ===========================
  MSACSR: {
    label: 'Months Supply of New Houses',
    unit: 'months · monthly · Census',
    what: 'Months it would take to sell current new-home inventory at the current sales pace.',
    why:  'Cleanest single measure of housing-market balance. Above 7 months = buyers\' market, below 4 months = sellers\' market. The threshold for builder margin compression.',
    context: 'Spiked to 10.9 in July 2022 as mortgage rates surged. Drifted to ~8 in 2024 — buyers\' market, builders cutting prices and offering rate buy-downs.',
    thresholds: '< 4 months sellers\' · 4–6 months balanced · 6–7 months soft · > 7 months buyers\' · > 9 months distressed',
    links: [
      { label: 'FRED · MSACSR',                                       url: 'https://fred.stlouisfed.org/series/MSACSR' },
      { label: 'Census · New Residential Sales release',              url: 'https://www.census.gov/construction/nrs/' },
    ],
  },
  MORTGAGE30US: {
    label: '30Y Fixed Mortgage Rate',
    unit: 'percent · weekly · Freddie Mac',
    what: '30-year fixed-rate mortgage average as published by Freddie Mac\'s Primary Mortgage Market Survey.',
    why:  'The single most consequential interest rate for the US consumer. Shapes housing demand, refi activity, and home-improvement timing.',
    context: 'Hit 7.79% in October 2023 — highest since 2000. Settled in 6.5-7.5% range through 2024 — affordability decisively broken vs the 3% rates of 2020-2021.',
    thresholds: '< 4% expansionary · 4–5.5% normal · 5.5–7% restrictive · > 7% affordability stress',
    links: [
      { label: 'FRED · MORTGAGE30US',                                  url: 'https://fred.stlouisfed.org/series/MORTGAGE30US' },
      { label: 'Freddie Mac · Primary Mortgage Market Survey',         url: 'https://www.freddiemac.com/pmms' },
    ],
  },
  HOUST1F: {
    label: 'Single-Family Housing Starts',
    unit: 'thousands SAAR · monthly · Census',
    what: 'Annualized single-family housing starts (excluding multi-family/apartment construction).',
    why:  'Direct read on builder confidence. Single-family is more rate-sensitive than multi-family and tracks consumer mortgage demand.',
    context: 'Peaked at 1.28M annualized in late 2021 (post-Covid housing boom). Bottomed near 700K in mid-2022 as rates spiked. Recovering in 800-900K range through 2024.',
    thresholds: '< 700K weak · 700-1000K normal · > 1100K hot',
    links: [
      { label: 'FRED · HOUST1F',                                      url: 'https://fred.stlouisfed.org/series/HOUST1F' },
      { label: 'NAHB · Housing Market Index',                          url: 'https://www.nahb.org/news-and-economics/housing-economics/indices/housing-market-index' },
    ],
  },
  PERMIT: {
    label: 'Building Permits',
    unit: 'thousands SAAR · monthly · Census',
    what: 'Building permits issued for new privately-owned housing units.',
    why:  'Leads housing starts by 1-2 months and is the leading indicator in the Conference Board LEI. Builders pull permits when they intend to build — direct read on forward construction activity.',
    context: '2024 range ~1.4-1.5M units annualized — well below the 2021 peak of 1.9M but above the 2008-2011 trough of 500K.',
    thresholds: '< 1.0M weak · 1.0–1.6M normal · > 1.8M hot',
    links: [
      { label: 'FRED · PERMIT',                                       url: 'https://fred.stlouisfed.org/series/PERMIT' },
      { label: 'Conference Board · LEI components',                    url: 'https://www.conference-board.org/topics/us-leading-indicators' },
    ],
  },
  CSUSHPISA: {
    label: 'Case-Shiller National Home Price Index',
    unit: 'percent YoY · monthly · S&P/CoreLogic',
    what: 'Repeat-sales national home price index, seasonally adjusted. Tracks price changes for the same homes over time.',
    why:  'Cleanest measure of home-price appreciation — repeat-sales methodology controls for compositional shifts. Lags by 2 months.',
    context: 'Peaked at 20.8% YoY in March 2022 — highest in series history. Decelerated to small negative in 2023, recovered to ~6% YoY by late 2024.',
    thresholds: '< 0% deflating · 0–4% normal · 4–8% strong · > 10% bubble territory',
    links: [
      { label: 'FRED · CSUSHPISA',                            url: 'https://fred.stlouisfed.org/series/CSUSHPISA' },
      { label: 'S&P · Case-Shiller methodology',              url: 'https://www.spglobal.com/spdji/en/indices/indicators/sp-corelogic-case-shiller-us-national-home-price-nsa-index/' },
    ],
  },
  DRSFRMACBS: {
    label: 'Single-Family Mortgage Delinquency Rate',
    unit: 'percent · quarterly · FRB',
    what: 'Percentage of single-family residential mortgages 30+ days past due, all commercial banks.',
    why:  'Lagging consumer-stress signal but the cleanest read on actual housing-market pain. Delinquencies above 4% historically signal household-balance-sheet stress.',
    context: 'Hit 11.5% in 2010 (subprime crisis legacy). Steady decline through 2010s to ~1.7% in 2022. Drifted up modestly through 2024 to ~2.0% — still very low historically.',
    thresholds: '< 2% benign · 2–4% normal · > 4% stress · > 6% crisis',
    links: [
      { label: 'FRED · DRSFRMACBS',                                  url: 'https://fred.stlouisfed.org/series/DRSFRMACBS' },
      { label: 'FRB Senior Loan Officer Opinion Survey (SLOOS)',      url: 'https://www.federalreserve.gov/data/sloos.htm' },
    ],
  },
};

// Helper used by tooltip — get an entry, fall back to null gracefully.
export function getMetricContext(id) {
  return METRIC_CONTEXT[id] || null;
}
