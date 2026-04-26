// Curated educational + contextual content for the metric tiles on the
// deep-dive pages. Each tile in cycle/inflation/housing/consumer/credit/labor
// can be tagged with `data-tile-metric="<id>"` and the tile-tooltip module
// will read this catalog and surface what/why/recent-events/source links.
//
// Add new metrics by appending an entry. Keep `links` honest — only include
// authoritative sources (FRED, BLS, NBER, NY Fed, FT, Bloomberg, Reuters).
// "context" should be 1-3 sentences with concrete dates so the reader sees
// the metric tied to actual market history.
//
// CATALOG_AS_OF: when the context blurbs were last reviewed. Bump this when
// you do a content refresh so the footer line in the tooltip reflects it.

export const CATALOG_AS_OF = '2025-Q2';

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
  HOSSUPUSM673N: {
    label: 'Months Supply of Existing Homes',
    unit: 'months · monthly · NAR',
    what: 'Months it would take to sell current existing-home inventory at the current sales pace. NAR (resale) market — the dominant ~85% of US housing transactions.',
    why:  'Cleanest single measure of resale-market balance. Existing-home turnover is what most households actually transact in; new-home supply (MSACSR) is the smaller builder-side complement. Below 4 months = sellers\' market, above 6 = balanced-to-soft, above 7 = buyers\' market.',
    context: 'Compressed to ~2 months during the 2021 demand surge (extreme sellers\' market). Drifted to 4–5 months by 2024 as rate-locked owners stayed put and inventory crept back.',
    thresholds: '< 4 months sellers\' · 4–6 months balanced · 6–7 months soft · > 7 months buyers\' · > 9 months distressed',
    links: [
      { label: 'FRED · HOSSUPUSM673N',                                url: 'https://fred.stlouisfed.org/series/HOSSUPUSM673N' },
      { label: 'NAR · Existing Home Sales release',                   url: 'https://www.nar.realtor/research-and-statistics/housing-statistics/existing-home-sales' },
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
  HOUST5F: {
    label: 'Multi-Family Housing Starts (5+ units)',
    unit: 'thousands SAAR · monthly · Census',
    what: 'Annualized housing starts of buildings with 5 or more units (apartments and condos).',
    why:  'MF cycle is driven by rents and cap rates rather than mortgage rates. Tracks distinctly from single-family — frequently moves opposite direction.',
    context: 'Spiked to 600K+ in 2022 driven by post-Covid rent surge and institutional buying. Collapsed to ~330K by 2024 as rents rolled and cap rates compressed margins.',
    thresholds: '< 350K weak · 350-500K normal · > 550K hot',
    links: [
      { label: 'FRED · HOUST5F',                                  url: 'https://fred.stlouisfed.org/series/HOUST5F' },
    ],
  },
  COMPUTSA: {
    label: 'Housing Completions',
    unit: 'thousands SAAR · monthly · Census',
    what: 'Annualized housing completions — units brought to market, ready for sale or occupancy.',
    why:  'Lags starts by ~9 months. When completions rise while starts fall, the pipeline is unwinding — supply continues hitting the market even as new activity contracts. Pressures prices.',
    context: '2024 ran above 1.5M annualized — the highest pace since the 1970s, due to multi-family deliveries from 2022 starts.',
    thresholds: 'follows starts with 9-12mo lag',
    links: [
      { label: 'FRED · COMPUTSA',                                 url: 'https://fred.stlouisfed.org/series/COMPUTSA' },
    ],
  },
  HSN1F: {
    label: 'New Single-Family Home Sales',
    unit: 'thousands SAAR · monthly · Census',
    what: 'Sales of newly constructed single-family homes. Census reports both contracts and closings.',
    why:  'Pure builder-demand signal — about 10% of total housing volume but the cleanest measure of marginal buyer appetite at current rates.',
    context: '2022 peak ~1.0M, trough ~530K early 2023, recovering to ~700K range through 2024 as builders cut prices and bought down rates.',
    thresholds: '< 550K weak · 550-750K normal · > 850K strong',
    links: [
      { label: 'FRED · HSN1F',                                    url: 'https://fred.stlouisfed.org/series/HSN1F' },
      { label: 'Census · New Residential Sales release',          url: 'https://www.census.gov/construction/nrs/' },
    ],
  },
  EXHOSLUSM495S: {
    label: 'Existing Home Sales',
    unit: 'millions SAAR · monthly · NAR',
    what: 'Sales of previously occupied single-family homes, condos and co-ops. ~90% of total US housing volume.',
    why:  'The dominant volume metric. "Rate-lock" effect — owners with sub-3% mortgages won\'t sell — has compressed inventory and held volumes near 30-year lows.',
    context: 'Bottomed at 3.85M in October 2023 — the lowest pace since 1995. Drifted around 4.0-4.1M through 2024 — recession-territory levels even with a strong economy.',
    thresholds: '< 4.5M stress · 4.5-5.5M normal · > 5.5M hot',
    links: [
      { label: 'FRED · EXHOSLUSM495S',                              url: 'https://fred.stlouisfed.org/series/EXHOSLUSM495S' },
      { label: 'NAR · Existing Home Sales release',                 url: 'https://www.nar.realtor/research-and-statistics/housing-statistics/existing-home-sales' },
    ],
  },
  MSPUS: {
    label: 'Median Sales Price of Houses Sold',
    unit: 'USD · quarterly · Census',
    what: 'Median sales price of houses sold in the US (new home sales).',
    why:  'Compositional measure — affected by mix of homes sold (more luxury vs starter). Use alongside Case-Shiller (repeat-sales) for cleaner reading.',
    context: 'Peaked near $480K in Q4 2022; drifted to ~$420K range through 2024 as mix shifted to lower-priced inventory.',
    thresholds: 'directional only (composition matters)',
    links: [
      { label: 'FRED · MSPUS',                                      url: 'https://fred.stlouisfed.org/series/MSPUS' },
    ],
  },
  MORTGAGE15US: {
    label: '15-Year Fixed Mortgage Rate',
    unit: 'percent · weekly · Freddie Mac',
    what: '15-year fixed-rate mortgage average. Refi target rate — typically ~75bp below the 30Y.',
    why:  'When the 15Y drops materially below the prevailing 30Y at origination, refi waves activate. The 15Y-30Y spread proxies the steepness of the mortgage curve.',
    context: 'Range 5.5-6.5% through 2024. Refi activity essentially dormant since 2022 because few existing mortgages are above 6%.',
    thresholds: '< 4% expansionary · 4-5% normal · 5-6% restrictive · > 6% high',
    links: [
      { label: 'FRED · MORTGAGE15US',                                url: 'https://fred.stlouisfed.org/series/MORTGAGE15US' },
    ],
  },
  CES2000000001: {
    label: 'Construction Employment',
    unit: 'thousands · monthly · BLS',
    what: 'Total employees in the construction sector (residential + non-residential + heavy/civil).',
    why:  'Late-stage labor signal — construction layoffs follow housing starts by ~6 months. When YoY growth turns negative, recession is typically already underway.',
    context: 'Resilient through the rate-hike cycle — held above 8M jobs through 2024 despite collapsed starts. Suggests labor hoarding from the 2021-2022 shortage.',
    thresholds: 'YoY > 2% expansion · 0-2% slowing · negative recessionary',
    links: [
      { label: 'FRED · CES2000000001',                               url: 'https://fred.stlouisfed.org/series/CES2000000001' },
    ],
  },
  WPU081: {
    label: 'PPI: Lumber & Wood Products',
    unit: 'index · monthly · BLS',
    what: 'Producer Price Index for the lumber and wood products subsector.',
    why:  'Direct read on lumber input costs to homebuilding. Lumber-price spikes compress builder margins; collapses widen them. Watched closely by Home Depot, Lowes, and pure-play lumber distributors.',
    context: 'Spiked in 2021 (post-Covid renovation boom + supply constraints), collapsed through 2022, range-bound 2023-2024. Less volatility than the daily lumber futures contract.',
    thresholds: 'directional indicator',
    links: [
      { label: 'FRED · WPU081',                                       url: 'https://fred.stlouisfed.org/series/WPU081' },
      { label: 'CME · Lumber futures',                                 url: 'https://www.cmegroup.com/markets/agriculture/lumber-and-pulp/random-length-lumber.html' },
    ],
  },

  // =========================== CONSUMER / REAL-ECONOMY ===========================
  PSAVERT: {
    label: 'Personal Saving Rate',
    unit: 'percent · monthly · BEA',
    what: 'Personal saving as a percentage of disposable personal income. The buffer between income and spending.',
    why:  'Below ~4% indicates households are running down savings to maintain spending — historically precedes consumer-spending slowdowns by 6-12 months.',
    context: 'Spiked to 32% in April 2020 (Covid stimulus). Collapsed through 2022 as stimulus exhausted. Drifted around 4-5% through 2024 — historically low and declining.',
    thresholds: '< 4% stretched · 4-7% normal · > 8% precautionary',
    links: [
      { label: 'FRED · PSAVERT',                                     url: 'https://fred.stlouisfed.org/series/PSAVERT' },
      { label: 'BEA · Personal Income & Outlays release',             url: 'https://www.bea.gov/data/income-saving/personal-income' },
    ],
  },
  TDSP: {
    label: 'Household Debt Service Ratio',
    unit: 'percent · quarterly · FRB',
    what: 'Household required debt-service payments (mortgage + consumer debt) as a percentage of disposable personal income.',
    why:  'Cleanest measure of household leverage burden. Low and declining is constructive; rising is consumer-stress in slow motion.',
    context: 'Hit ~13.2% in 2007 pre-crisis; cycle low ~9.0% in 2021. Drifted up to ~9.8% by 2024 due to high mortgage rates on new originations + credit card debt.',
    thresholds: '< 9% benign · 9-11% normal · > 12% stress · > 13% pre-crisis',
    links: [
      { label: 'FRED · TDSP',                                        url: 'https://fred.stlouisfed.org/series/TDSP' },
      { label: 'FRB · Financial Obligations Ratio',                   url: 'https://www.federalreserve.gov/releases/housedebt/' },
    ],
  },
  DSPI: {
    label: 'Disposable Personal Income',
    unit: 'percent YoY · monthly · BEA',
    what: 'Personal income minus personal current taxes — the income available for spending or saving.',
    why:  'The denominator behind every consumer-spending decision. YoY growth must outpace inflation for real spending power to rise.',
    context: 'Real DSPI lagged inflation through 2022 (-0.5% real growth), turned positive in 2023 as inflation rolled, ran near +3% real in 2024.',
    thresholds: 'real growth > 0 needed for real spending power',
    links: [
      { label: 'FRED · DSPI',                                        url: 'https://fred.stlouisfed.org/series/DSPI' },
    ],
  },
  PCE: {
    label: 'Personal Consumption Expenditures',
    unit: 'percent YoY · monthly · BEA',
    what: 'Total household spending on goods and services. ~70% of US GDP.',
    why:  'The single largest component of GDP. When PCE growth slows materially, recession follows. Goods PCE leads services PCE in turning.',
    context: 'Real PCE growth held above 2% through 2023-2024 — the consumer kept spending despite rate hikes, supported by full employment.',
    thresholds: 'real growth > 1% expansion · 0-1% slowing · negative recession',
    links: [
      { label: 'FRED · PCE',                                         url: 'https://fred.stlouisfed.org/series/PCE' },
    ],
  },
  DRCCLACBS: {
    label: 'Credit Card Delinquency Rate',
    unit: 'percent · quarterly · FRB',
    what: 'Percentage of credit card loans 30+ days past due, all commercial banks.',
    why:  'Leading indicator of consumer-balance-sheet stress. Credit cards are the first debt to fall delinquent when household budgets tighten.',
    context: 'Bottomed at 1.5% in 2021 as stimulus paid down balances. Rose steadily through 2023-2024 to 3.2% — the highest since 2011. Strong post-Covid signal of consumer-budget stress.',
    thresholds: '< 2% benign · 2-3% normal · > 3.5% stress · > 4.5% crisis',
    links: [
      { label: 'FRED · DRCCLACBS',                                   url: 'https://fred.stlouisfed.org/series/DRCCLACBS' },
      { label: 'NY Fed · Quarterly Household Debt Report',            url: 'https://www.newyorkfed.org/microeconomics/hhdc' },
    ],
  },
  UMCSENT: {
    label: 'UMich Consumer Sentiment',
    unit: 'index · monthly · U. Michigan',
    what: 'Composite of consumer assessments of current conditions and future expectations from the U. Michigan Survey of Consumers.',
    why:  'Volatile and politically biased post-2016 — consumers report sentiment based on which party holds the White House. But changes still correlate with discretionary spending.',
    context: 'Hit a 70-year low of 50 in mid-2022 (worst recorded reading despite no recession). Recovered to 70-80 range through 2024. Often diverges from "hard data" labor market.',
    thresholds: '< 60 stress · 60-80 normal · > 90 strong',
    links: [
      { label: 'FRED · UMCSENT',                                     url: 'https://fred.stlouisfed.org/series/UMCSENT' },
      { label: 'U. Michigan · Survey of Consumers',                  url: 'http://www.sca.isr.umich.edu/' },
    ],
  },

  // =========================== COMPOSITE-LEVEL (home page tiles) ===========================
  // The 6 composite scores on /core/macro/. Each surfaces what the composite
  // is, what regime it drives, and links to its deep-dive page.
  CYCLE_COMPOSITE: {
    label: 'Cycle Risk Composite',
    unit: 'score 0-100 · monthly · Siberforge',
    what: 'Weighted composite of 5 leading recession signals: NY Fed recession probability (25%), Sahm Rule (25%), 10Y-3M curve (15%), NFCI financial conditions (15%), HY OAS credit stress (20%). Higher = closer to or inside recession.',
    why:  'Single-number answer to "how late are we in the cycle?" — the question every multi-asset positioning decision hinges on. Phase boundaries map to defined positioning tilts (early-cycle pro-risk → contraction defensive).',
    context: 'A score crossing 45 historically precedes equity drawdowns by 6-9 months. Crossings into 65+ have aligned with recession start within 1-3 quarters in the past 50 years.',
    thresholds: '0-25 Early/Mid Expansion · 25-45 Late Expansion · 45-65 Slowdown · 65-80 Contraction Risk · 80+ Contraction Underway',
    links: [
      { label: 'Cycle deep-dive',                          url: '/core/macro/cycle/' },
      { label: 'NY Fed · Recession Probabilities',          url: 'https://www.newyorkfed.org/research/capital_markets/ycfaq.html' },
      { label: 'NBER Recession Dating',                     url: 'https://www.nber.org/research/business-cycle-dating' },
    ],
  },
  INFLATION_COMPOSITE: {
    label: 'Inflation Persistence Composite',
    unit: 'score 0-100 · monthly · Siberforge',
    what: 'Weighted composite of inflation pressure: Sticky-Price Core CPI (30%), 5y5y forward breakeven (20%), Core CPI 6m annualized (20%), wage growth AHE YoY (15%), shelter CPI (15%). Higher = more persistent / structural inflation.',
    why:  'Distinguishes "transitory" inflation (flexible-price, energy-driven) from "sticky" structural inflation that requires sustained restrictive policy. Maps directly to Fed reaction-function expectations.',
    context: 'Peaked near 90 in mid-2022 — the highest in series history. Drifted to 35-45 range through 2024 as goods disinflation rolled through, but services inflation kept the score above the 25 "anchored" level.',
    thresholds: '0-25 Disinflationary · 25-45 Normalizing · 45-65 Sticky · 65-80 Persistent · 80+ Accelerating',
    links: [
      { label: 'Inflation deep-dive',                      url: '/core/macro/inflation/' },
      { label: 'Atlanta Fed · Sticky-Price CPI',            url: 'https://www.atlantafed.org/research/inflationproject/stickyprice' },
      { label: 'Cleveland Fed · New Tenant Rent Index',     url: 'https://www.clevelandfed.org/indicators-and-data/new-tenant-repeat-rent-index' },
    ],
  },
  HOUSING_COMPOSITE: {
    label: 'Housing Cycle Composite',
    unit: 'score 0-100 · monthly · Siberforge',
    what: 'Weighted composite of housing pipeline + price + affordability + stress signals: months supply (30%), permits YoY, 30Y mortgage rate, SF starts YoY, HPI YoY, mortgage delinquency, construction employment.',
    why:  'Housing is the largest household balance-sheet exposure and one of the most rate-sensitive sectors. Cycle position drives builder profitability, building-materials demand, and household consumption.',
    context: '2024 score in the 60-65 range — late-cycle: high months supply, broken affordability, slowing prices, but no stress yet. The "soft landing" reading.',
    thresholds: '0-25 Early-Cycle Recovery · 25-45 Mid-Cycle Expansion · 45-65 Late-Cycle · 65-80 Cooling · 80+ Contraction',
    links: [
      { label: 'Housing deep-dive',                                  url: '/core/macro/housing/' },
      { label: 'NAHB · Housing Market Index',                         url: 'https://www.nahb.org/news-and-economics/housing-economics/indices/housing-market-index' },
      { label: 'NY Fed · Quarterly Household Debt Report',            url: 'https://www.newyorkfed.org/microeconomics/hhdc' },
    ],
  },
  CONSUMER_COMPOSITE: {
    label: 'Consumer Stress Composite',
    unit: 'score 0-100 · monthly · Siberforge',
    what: 'Weighted composite of consumer balance-sheet stress: real wages (25%), saving rate (20%), credit card delinquency (20%), jobless claims (15%), UMich sentiment (10%), debt-service ratio (10%).',
    why:  'The household ability and willingness to keep spending. When this composite turns up, discretionary categories (durables, restaurants, big-box retail) show stress within 2 quarters.',
    context: 'Drifted from ~25 in 2021 to 40-45 by 2024 — saving rate falling, credit card delinquencies rising sharply. Real wages turning positive in 2023 prevented a cliff.',
    thresholds: '0-25 Robust · 25-45 Healthy · 45-65 Mixed · 65-80 Stressed · 80+ Distressed',
    links: [
      { label: 'Consumer deep-dive',                                  url: '/core/macro/real-economy/' },
      { label: 'NY Fed · Quarterly Household Debt Report',            url: 'https://www.newyorkfed.org/microeconomics/hhdc' },
      { label: 'BEA · Personal Income & Outlays',                      url: 'https://www.bea.gov/data/income-saving/personal-income' },
    ],
  },
  CREDIT_COMPOSITE: {
    label: 'Credit & Liquidity Composite',
    unit: 'score 0-100 · monthly · Siberforge',
    what: 'Weighted composite of financial conditions: NFCI (25%), ANFCI (15%), HY OAS (20%), IG OAS (15%), 10Y-3M curve (15%), 10Y real yield (10%). Higher = tighter conditions / more credit stress.',
    why:  'The bridge between Fed policy and the real economy. When this score jumps materially, the cycle ends — regardless of what other indicators say. Credit comes before equities in every cycle.',
    context: 'Spiked above 65 during March 2023 SVB. Compressed to 25-35 range through late 2024 — credit complacency despite still-restrictive Fed policy.',
    thresholds: '0-25 Very Accommodative · 25-45 Accommodative · 45-65 Neutral · 65-80 Tight · 80+ Stressed',
    links: [
      { label: 'Credit & Liquidity deep-dive',                       url: '/core/macro/credit/' },
      { label: 'Chicago Fed · NFCI methodology',                      url: 'https://www.chicagofed.org/publications/nfci/index' },
      { label: 'NY Fed · Recession Probabilities',                    url: 'https://www.newyorkfed.org/research/capital_markets/ycfaq.html' },
    ],
  },
  LABOR_COMPOSITE: {
    label: 'Labor Market Composite',
    unit: 'score 0-100 · monthly · Siberforge',
    what: 'Weighted composite of labor-market signals: unemployment rate (20%), Sahm Rule (20%), claims 4w MA (20%), payrolls 6m annualized (20%), wage growth AHE YoY (20%). Higher = labor weakening.',
    why:  'Labor is the engine of consumption and the most reliable cycle-confirmation signal. The Sahm Rule embedded in this composite has flagged every post-1970 US recession in real time.',
    context: 'Drifted from ~15 in 2022 (very tight) to ~40 by 2024 as unemployment normalized, Sahm Rule briefly triggered, and wage growth decelerated. "Cooling" range — pre-recessionary not recessionary.',
    thresholds: '0-25 Very Tight · 25-45 Tight · 45-65 Cooling · 65-80 Weakening · 80+ Recessionary',
    links: [
      { label: 'Labor Market deep-dive',                              url: '/core/macro/labor/' },
      { label: 'Sahm 2019 · methodology',                             url: 'https://www.hamiltonproject.org/papers/direct_stimulus_payments_to_individuals' },
      { label: 'BLS · Employment Situation release',                  url: 'https://www.bls.gov/news.release/empsit.toc.htm' },
    ],
  },
};

// Helper used by tooltip — get an entry, fall back to null gracefully.
export function getMetricContext(id) {
  return METRIC_CONTEXT[id] || null;
}
