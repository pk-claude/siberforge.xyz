// Approximate top holdings per sector ETF.
//
// Why this is hardcoded: Finnhub's free tier doesn't expose ETF holdings, and
// State Street's holdings CSVs aren't on our egress allowlist. The composition
// of these ETFs changes slowly (rebalanced quarterly, weights drift maybe 1-3
// percentage points per quarter), so a hardcoded snapshot updated quarterly is
// good enough for "what's driving today's move" hover content.
//
// Source: State Street SPDR fund pages, snapshot ~April 2026.
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
    asOf: '2026-04',
    holdings: [
      { sym: 'AAPL',  name: 'Apple',          weight: 7.1 },
      { sym: 'MSFT',  name: 'Microsoft',      weight: 6.4 },
      { sym: 'NVDA',  name: 'NVIDIA',         weight: 6.0 },
      { sym: 'AMZN',  name: 'Amazon',         weight: 3.7 },
      { sym: 'META',  name: 'Meta',           weight: 2.6 },
      { sym: 'GOOGL', name: 'Alphabet A',     weight: 2.0 },
      { sym: 'GOOG',  name: 'Alphabet C',     weight: 1.7 },
      { sym: 'BRK-B', name: 'Berkshire',      weight: 1.7 },
      { sym: 'AVGO',  name: 'Broadcom',       weight: 1.5 },
      { sym: 'TSLA',  name: 'Tesla',          weight: 1.5 },
    ],
  },
  XLK: {
    label: 'Technology',
    asOf: '2026-04',
    holdings: [
      { sym: 'NVDA',  name: 'NVIDIA',         weight: 19.5 },
      { sym: 'MSFT',  name: 'Microsoft',      weight: 18.5 },
      { sym: 'AAPL',  name: 'Apple',          weight: 12.5 },
      { sym: 'AVGO',  name: 'Broadcom',       weight: 4.5 },
      { sym: 'CRM',   name: 'Salesforce',     weight: 2.6 },
      { sym: 'ORCL',  name: 'Oracle',         weight: 2.5 },
      { sym: 'CSCO',  name: 'Cisco',          weight: 2.2 },
      { sym: 'AMD',   name: 'AMD',            weight: 2.0 },
      { sym: 'ACN',   name: 'Accenture',      weight: 1.8 },
      { sym: 'INTU',  name: 'Intuit',         weight: 1.7 },
    ],
  },
  XLF: {
    label: 'Financials',
    asOf: '2026-04',
    holdings: [
      { sym: 'JPM',   name: 'JPMorgan',       weight: 10.5 },
      { sym: 'BRK-B', name: 'Berkshire',      weight: 10.0 },
      { sym: 'V',     name: 'Visa',           weight: 6.5 },
      { sym: 'MA',    name: 'Mastercard',     weight: 5.5 },
      { sym: 'BAC',   name: 'Bank of America',weight: 4.5 },
      { sym: 'WFC',   name: 'Wells Fargo',    weight: 3.4 },
      { sym: 'GS',    name: 'Goldman Sachs',  weight: 2.6 },
      { sym: 'MS',    name: 'Morgan Stanley', weight: 2.5 },
      { sym: 'AXP',   name: 'American Express',weight: 2.4 },
      { sym: 'C',     name: 'Citigroup',      weight: 2.0 },
    ],
  },
  XLE: {
    label: 'Energy',
    asOf: '2026-04',
    holdings: [
      { sym: 'XOM',   name: 'Exxon Mobil',    weight: 22.5 },
      { sym: 'CVX',   name: 'Chevron',        weight: 16.0 },
      { sym: 'COP',   name: 'ConocoPhillips', weight: 8.0 },
      { sym: 'WMB',   name: 'Williams Cos.',  weight: 4.5 },
      { sym: 'EOG',   name: 'EOG Resources',  weight: 4.2 },
      { sym: 'SLB',   name: 'Schlumberger',   weight: 4.0 },
      { sym: 'KMI',   name: 'Kinder Morgan',  weight: 3.6 },
      { sym: 'OKE',   name: 'ONEOK',          weight: 3.5 },
      { sym: 'PSX',   name: 'Phillips 66',    weight: 3.4 },
      { sym: 'MPC',   name: 'Marathon Petroleum', weight: 3.3 },
    ],
  },
  XLV: {
    label: 'Health Care',
    asOf: '2026-04',
    holdings: [
      { sym: 'LLY',   name: 'Eli Lilly',      weight: 11.0 },
      { sym: 'UNH',   name: 'UnitedHealth',   weight: 8.5 },
      { sym: 'JNJ',   name: 'Johnson & Johnson', weight: 7.0 },
      { sym: 'ABBV',  name: 'AbbVie',         weight: 5.0 },
      { sym: 'MRK',   name: 'Merck',          weight: 4.6 },
      { sym: 'TMO',   name: 'Thermo Fisher',  weight: 3.8 },
      { sym: 'ABT',   name: 'Abbott Labs',    weight: 3.5 },
      { sym: 'PFE',   name: 'Pfizer',         weight: 3.0 },
      { sym: 'DHR',   name: 'Danaher',        weight: 2.8 },
      { sym: 'ISRG',  name: 'Intuitive Surgical', weight: 2.7 },
    ],
  },
  XLI: {
    label: 'Industrials',
    asOf: '2026-04',
    holdings: [
      { sym: 'GE',    name: 'GE Aerospace',   weight: 5.5 },
      { sym: 'CAT',   name: 'Caterpillar',    weight: 4.6 },
      { sym: 'RTX',   name: 'RTX',            weight: 4.4 },
      { sym: 'HON',   name: 'Honeywell',      weight: 3.9 },
      { sym: 'UNP',   name: 'Union Pacific',  weight: 3.7 },
      { sym: 'BA',    name: 'Boeing',         weight: 3.6 },
      { sym: 'ETN',   name: 'Eaton',          weight: 3.5 },
      { sym: 'DE',    name: 'Deere',          weight: 3.0 },
      { sym: 'LMT',   name: 'Lockheed Martin',weight: 2.7 },
      { sym: 'ADP',   name: 'ADP',            weight: 2.5 },
    ],
  },
  XLY: {
    label: 'Consumer Discretionary',
    asOf: '2026-04',
    holdings: [
      { sym: 'AMZN',  name: 'Amazon',         weight: 23.0 },
      { sym: 'TSLA',  name: 'Tesla',          weight: 14.0 },
      { sym: 'HD',    name: 'Home Depot',     weight: 7.0 },
      { sym: 'MCD',   name: 'McDonald\'s',    weight: 4.4 },
      { sym: 'BKNG',  name: 'Booking',        weight: 3.6 },
      { sym: 'LOW',   name: 'Lowe\'s',        weight: 3.0 },
      { sym: 'TJX',   name: 'TJX Cos.',       weight: 2.8 },
      { sym: 'NKE',   name: 'Nike',           weight: 2.4 },
      { sym: 'SBUX',  name: 'Starbucks',      weight: 2.1 },
      { sym: 'CMG',   name: 'Chipotle',       weight: 1.7 },
    ],
  },
  XLP: {
    label: 'Consumer Staples',
    asOf: '2026-04',
    holdings: [
      { sym: 'COST',  name: 'Costco',         weight: 11.5 },
      { sym: 'WMT',   name: 'Walmart',        weight: 10.5 },
      { sym: 'PG',    name: 'Procter & Gamble', weight: 9.5 },
      { sym: 'KO',    name: 'Coca-Cola',      weight: 8.5 },
      { sym: 'PEP',   name: 'PepsiCo',        weight: 6.0 },
      { sym: 'PM',    name: 'Philip Morris',  weight: 5.5 },
      { sym: 'MO',    name: 'Altria',         weight: 3.5 },
      { sym: 'MDLZ',  name: 'Mondelez',       weight: 3.4 },
      { sym: 'CL',    name: 'Colgate',        weight: 2.8 },
      { sym: 'TGT',   name: 'Target',         weight: 2.6 },
    ],
  },
  XLU: {
    label: 'Utilities',
    asOf: '2026-04',
    holdings: [
      { sym: 'NEE',   name: 'NextEra',        weight: 13.0 },
      { sym: 'SO',    name: 'Southern',       weight: 8.0 },
      { sym: 'DUK',   name: 'Duke Energy',    weight: 7.5 },
      { sym: 'CEG',   name: 'Constellation',  weight: 7.0 },
      { sym: 'AEP',   name: 'American Electric Power', weight: 4.4 },
      { sym: 'D',     name: 'Dominion',       weight: 4.0 },
      { sym: 'SRE',   name: 'Sempra',         weight: 3.7 },
      { sym: 'EXC',   name: 'Exelon',         weight: 3.6 },
      { sym: 'PCG',   name: 'PG&E',           weight: 3.2 },
      { sym: 'XEL',   name: 'Xcel Energy',    weight: 3.1 },
    ],
  },
  XLB: {
    label: 'Materials',
    asOf: '2026-04',
    holdings: [
      { sym: 'LIN',   name: 'Linde',          weight: 16.5 },
      { sym: 'SHW',   name: 'Sherwin-Williams', weight: 8.0 },
      { sym: 'ECL',   name: 'Ecolab',         weight: 6.5 },
      { sym: 'APD',   name: 'Air Products',   weight: 5.5 },
      { sym: 'NEM',   name: 'Newmont',        weight: 5.0 },
      { sym: 'FCX',   name: 'Freeport-McMoRan',weight: 4.5 },
      { sym: 'CTVA',  name: 'Corteva',        weight: 4.0 },
      { sym: 'DD',    name: 'DuPont',         weight: 3.6 },
      { sym: 'NUE',   name: 'Nucor',          weight: 3.3 },
      { sym: 'PPG',   name: 'PPG Industries', weight: 3.0 },
    ],
  },
  XLRE: {
    label: 'Real Estate',
    asOf: '2026-04',
    holdings: [
      { sym: 'PLD',   name: 'Prologis',       weight: 9.5 },
      { sym: 'AMT',   name: 'American Tower', weight: 8.5 },
      { sym: 'EQIX',  name: 'Equinix',        weight: 7.5 },
      { sym: 'WELL',  name: 'Welltower',      weight: 7.0 },
      { sym: 'SPG',   name: 'Simon Property', weight: 5.0 },
      { sym: 'DLR',   name: 'Digital Realty', weight: 4.6 },
      { sym: 'O',     name: 'Realty Income',  weight: 4.4 },
      { sym: 'PSA',   name: 'Public Storage', weight: 4.0 },
      { sym: 'CCI',   name: 'Crown Castle',   weight: 3.8 },
      { sym: 'CBRE',  name: 'CBRE Group',     weight: 3.5 },
    ],
  },
  XLC: {
    label: 'Communications',
    asOf: '2026-04',
    holdings: [
      { sym: 'META',  name: 'Meta',           weight: 22.0 },
      { sym: 'GOOGL', name: 'Alphabet A',     weight: 13.5 },
      { sym: 'GOOG',  name: 'Alphabet C',     weight: 11.5 },
      { sym: 'NFLX',  name: 'Netflix',        weight: 5.5 },
      { sym: 'TMUS',  name: 'T-Mobile',       weight: 4.6 },
      { sym: 'DIS',   name: 'Disney',         weight: 4.5 },
      { sym: 'VZ',    name: 'Verizon',        weight: 4.4 },
      { sym: 'CMCSA', name: 'Comcast',        weight: 4.2 },
      { sym: 'T',     name: 'AT&T',           weight: 4.0 },
      { sym: 'EA',    name: 'Electronic Arts',weight: 1.8 },
    ],
  },
};

// Convenience lookup.
export const HOLDINGS_BY_SYMBOL = ETF_HOLDINGS;
