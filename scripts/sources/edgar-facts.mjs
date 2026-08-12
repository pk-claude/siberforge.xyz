// scripts/sources/edgar-facts.mjs
// SEC EDGAR companyfacts -> clean annual + standalone-quarterly series.
//
// Annual:    10-K facts, duration ~1y, deduped by period end, latest filing wins
//            (so restated figures reflect the most recent vintage).
// Quarterly: rebuilt from YTD chains the way an analyst would by hand:
//            facts sharing a fiscal-year start form a YTD sequence
//            (Q1, H1, 9M, FY); standalone quarter = YTD_n - YTD_(n-1).
//            Direct ~90-day facts are preferred where the filer tags them.
// Instant:   (cash etc.) latest filing per period end.

import { fetchWithRetry, sleep } from '../lib/http.mjs';

const BASE = 'https://data.sec.gov/api/xbrl/companyfacts';
const UA = 'Siberforge dashboard contact@siberforge.xyz';

let _tickerMapPromise = null;

export async function cikForTicker(ticker) {
  if (!_tickerMapPromise) {
    _tickerMapPromise = fetchWithRetry('https://www.sec.gov/files/company_tickers.json', {
      expectJson: true, headers: { 'User-Agent': UA },
    });
  }
  const map = await _tickerMapPromise;
  const want = ticker.toUpperCase().replace(/-/g, '.');
  for (const k of Object.keys(map)) {
    if ((map[k].ticker || '').toUpperCase() === want) {
      return String(map[k].cik_str).padStart(10, '0');
    }
  }
  return null;
}

export async function fetchCompanyFacts(cik) {
  const json = await fetchWithRetry(`${BASE}/CIK${cik}.json`, {
    expectJson: true, tries: 4, timeout: 60000,
    headers: { 'User-Agent': UA },
  });
  return json;
}

// Concept fallback chains (us-gaap unless noted).
export const CONCEPTS = {
  revenue:     ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues',
                'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueNet'],
  grossProfit: ['GrossProfit'],
  costOfRev:   ['CostOfRevenue', 'CostOfGoodsAndServicesSold', 'CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization'],
  opIncome:    ['OperatingIncomeLoss'],
  netIncome:   ['NetIncomeLoss'],
  cfo:         ['NetCashProvidedByUsedInOperatingActivities',
                'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex:       ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  rnd:         ['ResearchAndDevelopmentExpense'],
  epsD:        ['EarningsPerShareDiluted'],
  sharesD:     ['WeightedAverageNumberOfDilutedSharesOutstanding'],
};
export const INSTANT_CONCEPTS = {
  cash: ['CashAndCashEquivalentsAtCarryingValue'],
};

const DAY = 86400000;
const dur = (f) => (new Date(f.end) - new Date(f.start)) / DAY;

// Pull raw facts for the first concept in the chain that exists.
function rawFacts(facts, chain) {
  for (const c of chain) {
    const node = facts?.[c];
    if (!node) continue;
    const units = node.units || {};
    const key = units.USD ? 'USD'
      : units['USD/shares'] ? 'USD/shares'
      : units.shares ? 'shares'
      : Object.keys(units)[0];
    if (!key) continue;
    const rows = (units[key] || []).filter(f =>
      f.val != null && f.end && (f.form === '10-K' || f.form === '10-Q' || f.form === '10-K/A' || f.form === '10-Q/A'));
    if (rows.length) return { concept: c, unit: key, rows };
  }
  return null;
}

// Dedupe by key, keeping the latest-filed fact (restatements win).
function latestByKey(rows, keyFn) {
  const m = new Map();
  for (const f of rows) {
    const k = keyFn(f);
    const prev = m.get(k);
    if (!prev || (f.filed || '') > (prev.filed || '')) m.set(k, f);
  }
  return [...m.values()];
}

// Annual series: duration facts ~1 year from 10-Ks.
export function annualSeries(facts, chain) {
  const rf = rawFacts(facts, chain);
  if (!rf) return [];
  const ann = rf.rows.filter(f => f.start && dur(f) > 330 && dur(f) < 385
    && (f.form.startsWith('10-K')));
  return latestByKey(ann, f => f.end)
    .map(f => ({ end: f.end, val: f.val }))
    .sort((a, b) => a.end.localeCompare(b.end));
}

// Quarterly series via YTD differencing.
export function quarterlySeries(facts, chain) {
  const rf = rawFacts(facts, chain);
  if (!rf) return [];
  const rows = latestByKey(
    rf.rows.filter(f => f.start),
    f => f.start + '|' + f.end
  );

  const out = new Map(); // end -> { end, val, direct }

  // 1) direct standalone quarters
  for (const f of rows) {
    const d = dur(f);
    if (d > 75 && d < 100) out.set(f.end, { end: f.end, val: f.val, direct: true });
  }

  // 2) YTD chains grouped by fiscal-year start
  const byStart = new Map();
  for (const f of rows) {
    if (!byStart.has(f.start)) byStart.set(f.start, []);
    byStart.get(f.start).push(f);
  }
  for (const chainRows of byStart.values()) {
    chainRows.sort((a, b) => a.end.localeCompare(b.end));
    for (let i = 1; i < chainRows.length; i++) {
      const cur = chainRows[i], prev = chainRows[i - 1];
      const gap = (new Date(cur.end) - new Date(prev.end)) / DAY;
      if (gap > 75 && gap < 100 && !out.get(cur.end)?.direct) {
        out.set(cur.end, { end: cur.end, val: cur.val - prev.val, direct: false });
      }
    }
  }

  return [...out.values()]
    .map(({ end, val }) => ({ end, val }))
    .sort((a, b) => a.end.localeCompare(b.end));
}

// Instant series (balance-sheet points).
export function instantSeries(facts, chain) {
  for (const c of chain) {
    const node = facts?.[c];
    if (!node) continue;
    const rows = (node.units?.USD || []).filter(f => f.val != null && f.end && !f.start);
    if (!rows.length) continue;
    return latestByKey(rows, f => f.end)
      .map(f => ({ end: f.end, val: f.val }))
      .sort((a, b) => a.end.localeCompare(b.end));
  }
  return [];
}

export { sleep };
