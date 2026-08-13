#!/usr/bin/env node
// scripts/refresh-single-name.mjs
// Refresh data for the single-name research pages.
//
// Per tier-1 ticker, writes core/single-name/data/<TICKER>.json with:
//   snapshot   - Yahoo quoteSummary (price, multiples, margins, growth)
//   annual     - deep history: EDGAR 10-K facts (US filers), Yahoo fills gaps
//   quarterly  - EDGAR YTD-differenced standalone quarters + Yahoo recents
//   balance    - cash / total debt points
//   prices/eps - 6y monthly closes + diluted EPS history (P/E band chart)
//   ttm        - trailing-4Q aggregates for the valuation lab
//   peers      - comp-table rows (USD-normalized caps)
//
// Run: node scripts/refresh-single-name.mjs [--tickers=NVDA,TSM] [--dry-run]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchFundamentals, fetchMonthlyHistory, fetchEpsHistory } from './sources/yahoo-equity-pe.mjs';
import { fetchStatements, fetchFxPerUsd, fetchEtfProfile } from './sources/yahoo-single-name.mjs';
import { cikForTicker, fetchCompanyFacts, annualSeries, quarterlySeries, instantSeries, CONCEPTS, INSTANT_CONCEPTS, sleep } from './sources/edgar-facts.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT  = path.join(ROOT, 'core', 'single-name', 'data');
const DRY  = process.argv.includes('--dry-run');

const TIER1 = [
  { t: 'NVDA',  edgar: true,  peers: ['AMD', 'AVGO', 'INTC', 'MRVL', 'CBRS'] },
  { t: 'TSM',   edgar: false, peers: ['INTC', 'GFS', 'UMC', '005930.KS'] },
  { t: 'MU',    edgar: true,  peers: ['000660.KS', 'SNDK', 'WDC', 'STX'] },
  { t: 'AVGO',  edgar: true,  peers: ['NVDA', 'MRVL', 'QCOM', 'AMD'] },
  { t: 'GOOGL', edgar: true,  peers: ['MSFT', 'META', 'AMZN', 'AAPL'] },
  { t: 'PLTR',  edgar: true,  peers: ['SNOW', 'NOW', 'DDOG', 'CRM'] },
  { t: 'CRWV',  edgar: true,  peers: ['NBIS', 'ORCL', 'MSFT', 'IREN'] },
  { t: 'CBRS',  edgar: true,  peers: ['NVDA', 'AMD', 'MRVL', 'INTC'] },
  { t: 'META',  edgar: true,  peers: ['GOOGL', 'MSFT', 'AMZN', 'AAPL'] },
  { t: 'MSFT',  edgar: true,  peers: ['GOOGL', 'AMZN', 'META', 'ORCL'] },
  { t: 'AAPL',  edgar: true,  peers: ['MSFT', 'GOOGL', 'AMZN', 'META'] },
  { t: 'AMZN',  edgar: true,  peers: ['MSFT', 'GOOGL', 'META', 'WMT'] },
  { t: 'AMD',   edgar: true,  peers: ['NVDA', 'INTC', 'AVGO', 'MRVL'] },
  { t: 'INTC',  edgar: true,  peers: ['AMD', 'NVDA', 'TSM', 'MU'] },
  { t: 'MRVL',  edgar: true,  peers: ['AVGO', 'NVDA', 'AMD', 'INTC'] },
  { t: 'AMAT',  edgar: true,  peers: ['LRCX', 'KLAC', 'ASML'] },
  { t: 'SMCI',  edgar: true,  peers: ['DELL', 'HPE', 'NVDA'] },
  { t: 'SNDK',  edgar: true,  peers: ['MU', 'WDC', 'STX', '000660.KS'] },
  { t: 'IONQ',  edgar: true,  peers: ['QBTS', 'RGTI', 'IBM'] },
  { t: 'QBTS',  edgar: true,  peers: ['IONQ', 'RGTI', 'IBM'] },
  { t: 'RGTI',  edgar: true,  peers: ['IONQ', 'QBTS', 'IBM'] },
  { t: 'QS',    edgar: true,  peers: ['ENVX', 'SLDP', 'TSLA'] },
  { t: 'HOVR',  edgar: true,  peers: ['JOBY', 'ACHR', 'EH'] },
  { t: 'MRLN',  edgar: true,  peers: ['KTOS', 'AVAV', 'JOBY'] },
  { t: 'NBIS',  edgar: false, peers: ['CRWV', 'ORCL', 'MSFT', 'IREN'] },
  { t: 'SPCX',  edgar: true,  peers: ['RKLB', 'ASTS', 'LMT'] },
  { t: 'BE',    edgar: true,  peers: ['PLUG', 'FCEL', 'GEV'] },
  { t: 'RIVN',  edgar: true,  peers: ['TSLA', 'GM', 'F', 'LCID'] },
  { t: 'SOFI',  edgar: true,  peers: ['HOOD', 'LC', 'NU', 'ALLY'] },
  { t: 'TSLA',  edgar: true,  peers: ['RIVN', 'GM', 'F', 'BYDDY'] },
  { t: 'VST',   edgar: true,  peers: ['CEG', 'NRG', 'TLN'] },
  { t: 'CAT',   edgar: true,  peers: ['DE', 'CMI', 'HON'] },
  { t: 'CVX',   edgar: true,  peers: ['XOM', 'COP', 'SHEL'] },
  { t: 'IBM',   edgar: true,  peers: ['MSFT', 'ORCL', 'ACN', 'HPE'] },
  { t: 'ORCL',  edgar: true,  peers: ['MSFT', 'AMZN', 'GOOGL', 'SAP'] },
];

const ETFS = ['XLK', 'EWY'];

const argT = process.argv.find(a => a.startsWith('--tickers='));
const ONLY = argT ? argT.split('=')[1].split(',').map(s => s.trim().toUpperCase()) : null;

const ym = (d) => d ? d.slice(0, 7) : null;
const r2 = (v) => (v == null || !Number.isFinite(v)) ? null : Math.round(v);
const last = (arr) => arr && arr.length ? arr[arr.length - 1] : null;

// ---- FX (units per USD) ---------------------------------------------------
const FX_CODES = { TWD: 'TWD', KRW: 'KRW', EUR: 'EUR', JPY: 'JPY' };
const fxCache = {};
async function fx(code) {
  if (code === 'USD') return 1;
  if (fxCache[code]) return fxCache[code];
  const v = await fetchFxPerUsd(FX_CODES[code] || code);
  fxCache[code] = v || 1;
  return fxCache[code];
}

// ---- EDGAR pull -----------------------------------------------------------
async function edgarSeries(ticker) {
  const cik = await cikForTicker(ticker);
  if (!cik) { console.warn(`  [${ticker}] no CIK found, skipping EDGAR`); return null; }
  const cf = await fetchCompanyFacts(cik);
  const facts = cf?.facts?.['us-gaap'];
  if (!facts) { console.warn(`  [${ticker}] no us-gaap facts`); return null; }
  const out = { annual: {}, quarterly: {}, instant: {} };
  for (const [k, chain] of Object.entries(CONCEPTS)) {
    out.annual[k] = annualSeries(facts, chain);
    out.quarterly[k] = quarterlySeries(facts, chain);
  }
  for (const [k, chain] of Object.entries(INSTANT_CONCEPTS)) {
    out.instant[k] = instantSeries(facts, chain);
  }
  return out;
}

// ---- merge EDGAR + Yahoo into row arrays keyed by year-month --------------
const Y_KEYS = {
  revenue: 'TotalRevenue', grossProfit: 'GrossProfit', opIncome: 'OperatingIncome',
  netIncome: 'NetIncome', cfo: 'OperatingCashFlow', capex: 'CapitalExpenditure',
  rnd: 'ResearchAndDevelopment', epsD: 'DilutedEPS', sharesD: 'DilutedAverageShares',
  fcf: 'FreeCashFlow',
};

function buildRows(edgar, yahoo, freq, fxRate) {
  const rows = new Map(); // ym -> row
  const put = (end, key, val, overwrite) => {
    const k = ym(end);
    if (!k || val == null) return;
    if (!rows.has(k)) rows.set(k, { end: k });
    const row = rows.get(k);
    if (overwrite || row[key] == null) row[key] = val;
  };

  // EDGAR first (authoritative, deep history, USD already)
  if (edgar) {
    const src = freq === 'annual' ? edgar.annual : edgar.quarterly;
    for (const [key, series] of Object.entries(src)) {
      for (const { end, val } of series) put(end, key, val, true);
    }
  }
  // Yahoo fills gaps (and is the only source for non-US filers). Convert FX.
  const ysrc = yahoo ? (freq === 'annual' ? yahoo.annual : yahoo.quarterly) : {};
  for (const [key, yk] of Object.entries(Y_KEYS)) {
    for (const [end, val] of ysrc[yk] || []) {
      const isPerShare = key === 'epsD';
      const isCount = key === 'sharesD';
      const v = isCount ? val : val / fxRate;
      // Yahoo capex is negative (outflow); EDGAR payments are positive.
      put(end, key, key === 'capex' ? Math.abs(v) : (isPerShare ? v : v));
    }
  }

  const out = [...rows.values()].sort((a, b) => a.end.localeCompare(b.end));
  // derive fcf + margins
  for (const r of out) {
    if (r.fcf == null && r.cfo != null && r.capex != null) r.fcf = r.cfo - r.capex;
    if (r.grossProfit == null && r.revenue != null && r.costOfRev != null) r.grossProfit = r.revenue - r.costOfRev;
  }
  return out;
}

function ttmFrom(quarterly) {
  const rows = quarterly.slice(-4);
  if (rows.length < 4) return null;
  const sum = (k) => rows.every(r => r[k] != null) ? rows.reduce((a, r) => a + r[k], 0) : null;
  return {
    through: last(rows).end,
    revenue: r2(sum('revenue')), netIncome: r2(sum('netIncome')),
    cfo: r2(sum('cfo')), capex: r2(sum('capex')), fcf: r2(sum('fcf')),
  };
}

// ---- peer comp row --------------------------------------------------------
async function peerRow(t) {
  const f = await fetchFundamentals(t);
  if (f.err) return { t, err: f.err };
  // quoteSummary reports mc/ev/rev in the listing currency; normalize caps to USD
  const cur = /\.KS$/.test(t) ? 'KRW' : /\.TW$/.test(t) ? 'TWD' : 'USD';
  const rate = await fx(cur);
  return {
    t, n: f.n, sec: f.sec, ind: f.ind,
    mc: (f.mc > 0) ? r2(f.mc / rate) : null, ev: r2(f.ev / rate),
    tpe: f.tpe, fpe: f.fpe,
    evs: (f.ev && f.rev) ? Math.round(f.ev / f.rev * 100) / 100 : null,
    evEbitda: (f.ev && f.ebitda && f.ebitda > 0) ? Math.round(f.ev / f.ebitda * 10) / 10 : null,
    gm: f.gm, om: f.om, pm: f.pm, rg: f.rg, eg: f.eg,
    pb: f.pb, peg: f.peg, beta: f.beta, div: f.div,
  };
}

// ---- main -----------------------------------------------------------------
async function main() {
  await fs.mkdir(OUT, { recursive: true });
  const list = TIER1.filter(c => !ONLY || ONLY.includes(c.t));
  const peerCache = new Map();

  for (const cfg of list) {
    const T = cfg.t;
    console.log(`[${T}] fetching...`);
    const [snap, stmts, prices, eps] = await Promise.all([
      fetchFundamentals(T),
      fetchStatements(T),
      fetchMonthlyHistory(T, 6),
      fetchEpsHistory(T),
    ]);
    if (snap.err) { console.error(`  [${T}] quoteSummary failed: ${snap.err}`); continue; }

    const stmtCur = stmts.currency || 'USD';
    const fxRate = await fx(stmtCur);

    let edgar = null;
    if (cfg.edgar) {
      try { edgar = await edgarSeries(T); await sleep(150); }
      catch (e) { console.warn(`  [${T}] EDGAR failed: ${e.message}`); }
    }

    const annual = buildRows(edgar, stmts, 'annual', fxRate);
    const quarterly = buildRows(edgar, stmts, 'quarterly', fxRate).slice(-16);

    // Yahoo occasionally returns a null market cap (seen on MU):
    // fall back to price x latest diluted share count.
    if (!(snap.mc > 0)) {
      const lastQ = [...quarterly].reverse().find(r => r.sharesD != null);
      if (lastQ && snap.px) snap.mc = r2(snap.px * lastQ.sharesD);
    }

    // balance points: EDGAR instant cash + Yahoo debt/cash (fx-converted)
    const balance = new Map();
    for (const { end, val } of edgar?.instant?.cash || []) {
      balance.set(ym(end), { end: ym(end), cash: val });
    }
    for (const [end, val] of stmts.quarterly.CashCashEquivalentsAndShortTermInvestments
        || stmts.quarterly.CashAndCashEquivalents || []) {
      const k = ym(end);
      if (!balance.has(k)) balance.set(k, { end: k });
      balance.get(k).cash = val / fxRate;   // prefer incl. short-term investments
    }
    for (const [end, val] of stmts.quarterly.TotalDebt || []) {
      const k = ym(end);
      if (!balance.has(k)) balance.set(k, { end: k });
      balance.get(k).debt = val / fxRate;
    }
    const balRows = [...balance.values()].sort((a, b) => a.end.localeCompare(b.end));

    // peers
    const peers = [];
    for (const p of [T, ...cfg.peers]) {
      if (!peerCache.has(p)) {
        try { peerCache.set(p, await peerRow(p)); }
        catch (e) { peerCache.set(p, { t: p, err: String(e.message).slice(0, 80) }); }
      }
      peers.push(peerCache.get(p));
    }

    // Non-USD filers: Yahoo mixes currencies (USD ADR market cap, TWD
    // enterprise value / revenue / ebitda). Convert statement-currency money
    // fields and rebuild EV from USD balance data so EV-based ratios work.
    if (stmtCur !== 'USD') {
      for (const k of ['rev', 'ni', 'ebitda']) {
        if (snap[k] != null) snap[k] = r2(snap[k] / fxRate);
      }
      const lastBal = [...balRows].reverse().find(b => b.cash != null || b.debt != null) || {};
      snap.ev = r2(snap.mc + (lastBal.debt || 0) - (lastBal.cash || 0));
    }

    if (peers[0] && peers[0].t === T && peers[0].mc == null && snap.mc > 0) {
      peers[0].mc = r2(snap.mc);
    }

    const doc = {
      ticker: T, name: snap.n, sector: snap.sec, industry: snap.ind,
      statementCurrency: stmtCur,
      fxNote: stmtCur === 'USD' ? null : `Statements converted at spot ${fxCache[stmtCur]?.toFixed(2)} ${stmtCur}/USD`,
      asOf: new Date().toISOString().slice(0, 10),
      snapshot: snap,
      annual, quarterly, balance: balRows,
      ttm: ttmFrom(quarterly),
      prices, eps,
      peers,
      sources: ['SEC EDGAR XBRL companyfacts', 'Yahoo Finance quoteSummary / fundamentals-timeseries / chart'],
    };

    if (DRY) {
      console.log(`  [${T}] annual=${annual.length}y quarterly=${quarterly.length}q peers=${peers.length} ttm=${JSON.stringify(doc.ttm)}`);
    } else {
      const file = path.join(OUT, `${T}.json`);
      await fs.writeFile(file, JSON.stringify(doc));
      console.log(`  [${T}] wrote ${file} (annual=${annual.length}y quarterly=${quarterly.length}q)`);
    }
  }

  // ---- ETFs: holdings/profile/performance variant ----
  for (const T of ETFS) {
    if (ONLY && !ONLY.includes(T)) continue;
    console.log(`[${T}] fetching (ETF)...`);
    try {
      const [prof, prices] = await Promise.all([
        fetchEtfProfile(T),
        fetchMonthlyHistory(T, 6),
      ]);
      const doc = {
        ticker: T, etf: true, name: prof.name, asOf: new Date().toISOString().slice(0, 10),
        snapshot: prof, prices,
        sources: ['Yahoo Finance quoteSummary (topHoldings/fundProfile) / chart'],
      };
      if (!DRY) {
        await fs.writeFile(path.join(OUT, `${T}.json`), JSON.stringify(doc));
        console.log(`  [${T}] wrote ETF doc (holdings=${(prof.holdings || []).length})`);
      }
    } catch (e) { console.error(`  [${T}] ETF fetch failed: ${e.message}`); }
  }

  if (!DRY) {
    await fs.writeFile(path.join(OUT, 'last-refresh.json'),
      JSON.stringify({ at: new Date().toISOString(), tickers: list.map(c => c.t) }));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
