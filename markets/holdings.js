// Approximate top holdings per sector ETF.
//
// Why this is hardcoded: Finnhub's free tier doesn't expose ETF holdings, and
// State Street's holdings CSVs aren't on our egress allowlist. The composition
// of these ETFs changes slowly (rebalanced quarterly, weights drift maybe 1-3
// percentage points per quarter), so a hardcoded snapshot updated quarterly is
// good enough for "what's driving today's move" hover content.
//
// Source: State Street SPDR fund pages, snapshot ~July 2026 via Yahoo topHoldings.
//   - SPY:  https://www.ssga.com/us/en/intermediary/etfs/spy
//   - XLK:  https://www.ssga.com/us/en/intermediary/etfs/xlk
//   - etc.
//
// To refresh: pull the "Top Ten Holdings" section from each fund's fact sheet
// and update the weights below. The drilldown still works with stale weights —
// it just attributes contribution incorrectly until you refresh.

export const ETF_HOLDINGS = {
  SPY: {
    label: 'S&P 500',
    asOf: '2026-07',
    holdings: [
      { sym: 'NVDA',    name: 'NVIDIA',           weight: 7.5 },
      { sym: 'AAPL',    name: 'Apple',            weight: 6.6 },
      { sym: 'MSFT',    name: 'Microsoft',        weight: 4.3 },
      { sym: 'AMZN',    name: 'Amazon',           weight: 3.6 },
      { sym: 'GOOGL',   name: 'Alphabet A',       weight: 3.2 },
      { sym: 'AVGO',    name: 'Broadcom',         weight: 2.8 },
      { sym: 'GOOG',    name: 'Alphabet C',       weight: 2.6 },
      { sym: 'MU',      name: 'Micron',           weight: 2.0 },
      { sym: 'META',    name: 'Meta',             weight: 1.9 },
      { sym: 'TSLA',    name: 'Tesla',            weight: 1.8 },
    ],
  },
  XLK: {
    label: 'Technology',
    asOf: '2026-07',
    holdings: [
      { sym: 'NVDA',    name: 'NVIDIA',           weight: 12.6 },
      { sym: 'AAPL',    name: 'Apple',            weight: 11.1 },
      { sym: 'MSFT',    name: 'Microsoft',        weight: 7.2 },
      { sym: 'AMD',     name: 'AMD',              weight: 4.7 },
      { sym: 'MU',      name: 'Micron',           weight: 4.7 },
      { sym: 'AVGO',    name: 'Broadcom',         weight: 4.7 },
      { sym: 'INTC',    name: 'Intel',            weight: 4.2 },
      { sym: 'AMAT',    name: 'Applied Mat',      weight: 3.7 },
      { sym: 'LRCX',    name: 'Lam Research',     weight: 3.5 },
      { sym: 'CSCO',    name: 'Cisco',            weight: 3.0 },
    ],
  },
  XLF: {
    label: 'Financials',
    asOf: '2026-07',
    holdings: [
      { sym: 'BRK-B',   name: 'Berkshire',        weight: 12.1 },
      { sym: 'JPM',     name: 'JPMorgan',         weight: 11.5 },
      { sym: 'V',       name: 'Visa',             weight: 7.5 },
      { sym: 'MA',      name: 'Mastercard',       weight: 5.5 },
      { sym: 'BAC',     name: 'BofA',             weight: 4.9 },
      { sym: 'GS',      name: 'Goldman Sachs',    weight: 3.9 },
      { sym: 'WFC',     name: 'Wells Fargo',      weight: 3.3 },
      { sym: 'MS',      name: 'Morgan Stanley',   weight: 3.3 },
      { sym: 'C',       name: 'Citigroup',        weight: 3.1 },
      { sym: 'AXP',     name: 'Amex',             weight: 2.4 },
    ],
  },
  XLE: {
    label: 'Energy',
    asOf: '2026-07',
    holdings: [
      { sym: 'XOM',     name: 'Exxon',            weight: 20.3 },
      { sym: 'CVX',     name: 'Chevron',          weight: 14.4 },
      { sym: 'COP',     name: 'ConocoPhillips',   weight: 5.9 },
      { sym: 'SLB',     name: 'SLB',              weight: 4.5 },
      { sym: 'WMB',     name: 'Williams',         weight: 4.5 },
      { sym: 'MPC',     name: 'Marathon Pet',     weight: 4.5 },
      { sym: 'EOG',     name: 'EOG',              weight: 4.4 },
      { sym: 'VLO',     name: 'Valero',           weight: 4.4 },
      { sym: 'PSX',     name: 'Phillips 66',      weight: 4.4 },
      { sym: 'KMI',     name: 'Kinder Morgan',    weight: 4.3 },
    ],
  },
  XLV: {
    label: 'Health Care',
    asOf: '2026-07',
    holdings: [
      { sym: 'LLY',     name: 'Eli Lilly',        weight: 16.5 },
      { sym: 'JNJ',     name: 'J&J',              weight: 10.6 },
      { sym: 'ABBV',    name: 'AbbVie',           weight: 7.7 },
      { sym: 'UNH',     name: 'UnitedHealth',     weight: 6.6 },
      { sym: 'MRK',     name: 'Merck',            weight: 5.5 },
      { sym: 'AMGN',    name: 'Amgen',            weight: 3.4 },
      { sym: 'TMO',     name: 'Thermo Fisher',    weight: 3.2 },
      { sym: 'ABT',     name: 'Abbott',           weight: 2.7 },
      { sym: 'GILD',    name: 'Gilead',           weight: 2.7 },
      { sym: 'ISRG',    name: 'Intuitive',        weight: 2.4 },
    ],
  },
  XLI: {
    label: 'Industrials',
    asOf: '2026-07',
    holdings: [
      { sym: 'CAT',     name: 'Caterpillar',      weight: 8.5 },
      { sym: 'GE',      name: 'GE Aerospace',     weight: 6.8 },
      { sym: 'GEV',     name: 'GE Vernova',       weight: 5.5 },
      { sym: 'RTX',     name: 'RTX',              weight: 4.4 },
      { sym: 'BA',      name: 'Boeing',           weight: 3.0 },
      { sym: 'ETN',     name: 'Eaton',            weight: 2.9 },
      { sym: 'UNP',     name: 'Union Pacific',    weight: 2.8 },
      { sym: 'DE',      name: 'Deere',            weight: 2.8 },
      { sym: 'UBER',    name: 'Uber',             weight: 2.5 },
      { sym: 'VRT',     name: 'Vertiv',           weight: 2.2 },
    ],
  },
  XLY: {
    label: 'Consumer Discretionary',
    asOf: '2026-07',
    holdings: [
      { sym: 'AMZN',    name: 'Amazon',           weight: 22.2 },
      { sym: 'TSLA',    name: 'Tesla',            weight: 19.6 },
      { sym: 'HD',      name: 'Home Depot',       weight: 5.8 },
      { sym: 'MCD',     name: 'McDonald\'s',      weight: 4.2 },
      { sym: 'TJX',     name: 'TJX',              weight: 3.9 },
      { sym: 'BKNG',    name: 'Booking',          weight: 3.4 },
      { sym: 'LOW',     name: 'Lowe\'s',          weight: 3.1 },
      { sym: 'SBUX',    name: 'Starbucks',        weight: 2.9 },
      { sym: 'MAR',     name: 'Marriott',         weight: 2.0 },
      { sym: 'RCL',     name: 'Royal Carib',      weight: 2.0 },
    ],
  },
  XLP: {
    label: 'Consumer Staples',
    asOf: '2026-07',
    holdings: [
      { sym: 'WMT',     name: 'Walmart',          weight: 10.8 },
      { sym: 'COST',    name: 'Costco',           weight: 9.0 },
      { sym: 'PG',      name: 'P&G',              weight: 7.4 },
      { sym: 'KO',      name: 'Coca-Cola',        weight: 6.8 },
      { sym: 'PM',      name: 'Philip Morris',    weight: 6.1 },
      { sym: 'CL',      name: 'Colgate',          weight: 4.7 },
      { sym: 'MO',      name: 'Altria',           weight: 4.5 },
      { sym: 'MNST',    name: 'Monster',          weight: 4.4 },
      { sym: 'PEP',     name: 'PepsiCo',          weight: 4.3 },
      { sym: 'MDLZ',    name: 'Mondelez',         weight: 4.1 },
    ],
  },
  XLU: {
    label: 'Utilities',
    asOf: '2026-07',
    holdings: [
      { sym: 'NEE',     name: 'NextEra',          weight: 12.9 },
      { sym: 'SO',      name: 'Southern',         weight: 7.6 },
      { sym: 'DUK',     name: 'Duke',             weight: 6.9 },
      { sym: 'CEG',     name: 'Constellation',    weight: 5.6 },
      { sym: 'AEP',     name: 'AEP',              weight: 5.2 },
      { sym: 'SRE',     name: 'Sempra',           weight: 4.3 },
      { sym: 'D',       name: 'Dominion',         weight: 4.2 },
      { sym: 'ETR',     name: 'Entergy',          weight: 3.7 },
      { sym: 'VST',     name: 'Vistra',           weight: 3.5 },
      { sym: 'XEL',     name: 'Xcel',             weight: 3.5 },
    ],
  },
  XLB: {
    label: 'Materials',
    asOf: '2026-07',
    holdings: [
      { sym: 'LIN',     name: 'Linde',            weight: 14.0 },
      { sym: 'NEM',     name: 'Newmont',          weight: 5.8 },
      { sym: 'FCX',     name: 'Freeport',         weight: 5.3 },
      { sym: 'CTVA',    name: 'Corteva',          weight: 5.0 },
      { sym: 'SHW',     name: 'Sherwin-Wms',      weight: 4.9 },
      { sym: 'ECL',     name: 'Ecolab',           weight: 4.7 },
      { sym: 'VMC',     name: 'Vulcan',           weight: 4.7 },
      { sym: 'CRH',     name: 'CRH',              weight: 4.7 },
      { sym: 'APD',     name: 'Air Products',     weight: 4.6 },
      { sym: 'MLM',     name: 'Martin Marietta',  weight: 4.5 },
    ],
  },
  XLRE: {
    label: 'Real Estate',
    asOf: '2026-07',
    holdings: [
      { sym: 'WELL',    name: 'Welltower',        weight: 11.0 },
      { sym: 'PLD',     name: 'Prologis',         weight: 8.7 },
      { sym: 'EQIX',    name: 'Equinix',          weight: 7.1 },
      { sym: 'AMT',     name: 'Amer Tower',       weight: 5.2 },
      { sym: 'SPG',     name: 'Simon Prop',       weight: 5.0 },
      { sym: 'O',       name: 'Realty Income',    weight: 4.5 },
      { sym: 'DLR',     name: 'Digital Realty',   weight: 4.5 },
      { sym: 'PSA',     name: 'Public Storage',   weight: 4.5 },
      { sym: 'VTR',     name: 'Ventas',           weight: 4.5 },
      { sym: 'CBRE',    name: 'CBRE',             weight: 4.1 },
    ],
  },
  XLC: {
    label: 'Communications',
    asOf: '2026-07',
    holdings: [
      { sym: 'META',    name: 'Meta',             weight: 19.9 },
      { sym: 'GOOGL',   name: 'Alphabet A',       weight: 13.1 },
      { sym: 'GOOG',    name: 'Alphabet C',       weight: 10.4 },
      { sym: 'TTWO',    name: 'Take-Two',         weight: 5.2 },
      { sym: 'NFLX',    name: 'Netflix',          weight: 4.8 },
      { sym: 'CMCSA',   name: 'Comcast',          weight: 4.7 },
      { sym: 'WBD',     name: 'Warner Bros D',    weight: 4.7 },
      { sym: 'EA',      name: 'Electronic Arts',  weight: 4.6 },
      { sym: 'DIS',     name: 'Disney',           weight: 4.5 },
      { sym: 'TMUS',    name: 'T-Mobile',         weight: 4.1 },
    ],
  },
};

// Convenience lookup.
export const HOLDINGS_BY_SYMBOL = ETF_HOLDINGS;
