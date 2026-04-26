// Vercel serverless function: proxies real-time quotes + historical candles + news.
//   /api/stocks?mode=quote      -> live prices for given symbols (Finnhub, 60s cache)
//   /api/stocks?mode=history    -> daily closes for last N years (Yahoo, 24h cache)
//   /api/stocks?mode=catalog    -> ticker catalog (the curated SPY+sector list)
//   /api/stocks?mode=news       -> recent company news (Finnhub free tier)
//
// Why two sources: Finnhub free tier provides /quote and /company-news but NOT
// historical candles (those require paid). Yahoo Finance's v8 chart endpoint is
// keyless and publicly accessible; many free tools rely on it. It's unofficial,
// so if Yahoo ever changes it we'd need to swap to Stooq or Alpha Vantage.
//
// Quote/news allowlist: by default we restrict to the curated TICKERS list to
// prevent abuse of the proxy. The drilldown page and the holdings hover popup
// need quotes + news for individual stocks (AAPL, MSFT, etc.), so we accept any
// symbol that matches a basic alphanumeric/dot/dash pattern. No PII or
// expensive endpoints are exposed by either Finnhub call so this is safe.

const FINN_BASE  = 'https://finnhub.io/api/v1';
const YAHOO_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

const TICKERS = [
  { symbol: 'SPY',  label: 'S&P 500 (SPY)',      group: 'index'  },
  { symbol: 'XLK',  label: 'Technology',         group: 'sector' },
  { symbol: 'XLF',  label: 'Financials',         group: 'sector' },
  { symbol: 'XLE',  label: 'Energy',             group: 'sector' },
  { symbol: 'XLV',  label: 'Health Care',        group: 'sector' },
  { symbol: 'XLI',  label: 'Industrials',        group: 'sector' },
  { symbol: 'XLY',  label: 'Consumer Disc.',     group: 'sector' },
  { symbol: 'XLP',  label: 'Consumer Staples',   group: 'sector' },
  { symbol: 'XLU',  label: 'Utilities',          group: 'sector' },
  { symbol: 'XLB',  label: 'Materials',          group: 'sector' },
  { symbol: 'XLRE', label: 'Real Estate',        group: 'sector' },
  { symbol: 'XLC',  label: 'Communications',     group: 'sector' },
];

// Match a reasonable equity ticker: 1-6 alphanumerics with optional . or -
// (BRK.B, BRK-B, GOOG, etc.). Rejects garbage so our proxy isn't a generic
// open relay.
const SYMBOL_RE = /^[A-Z][A-Z0-9.\-]{0,7}$/;

function sanitizeSymbols(raw, allowAny) {
  return raw.split(',').map(s => s.trim().toUpperCase()).filter(s => {
    if (!s) return false;
    if (!SYMBOL_RE.test(s)) return false;
    if (allowAny) return true;
    return TICKERS.some(t => t.symbol === s);
  });
}

// ---- Finnhub (live quotes) ----
async function finnhubQuote(symbol, key) {
  const url = `${FINN_BASE}/quote?symbol=${symbol}&token=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub quote ${symbol} ${res.status}`);
  const q = await res.json();
  return {
    symbol,
    price: q.c,
    change: q.d,
    changePct: q.dp,
    open: q.o,
    high: q.h,
    low: q.l,
    prevClose: q.pc,
    t: q.t,
  };
}

// ---- Finnhub (company news) ----
async function finnhubNews(symbol, key, days = 14) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const fmt = d => d.toISOString().slice(0, 10);
  const url = `${FINN_BASE}/company-news?symbol=${symbol}&from=${fmt(from)}&to=${fmt(to)}&token=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub news ${symbol} ${res.status}`);
  const items = await res.json();
  return items.slice(0, 20).map(it => ({
    headline: it.headline,
    summary: it.summary,
    source: it.source,
    url: it.url,
    datetime: it.datetime, // unix seconds
    image: it.image,
    category: it.category,
  }));
}

// ---- Yahoo Finance (historical closes, keyless, adjclose for total return) ----
async function yahooHistory(symbol, years) {
  const now = Math.floor(Date.now() / 1000);
  const from = now - years * 365 * 86400;
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?period1=${from}&period2=${now}&interval=1d`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (siberforge-dashboard)' } });
  if (!res.ok) throw new Error(`Yahoo ${symbol} ${res.status}`);
  const j = await res.json();
  const r = j?.chart?.result?.[0];
  if (!r || !r.timestamp) return { symbol, closes: [] };
  const ts = r.timestamp;
  const adj = r.indicators?.adjclose?.[0]?.adjclose;
  const raw = r.indicators?.quote?.[0]?.close;
  const series = (adj && adj.length === ts.length) ? adj : raw;
  if (!series) return { symbol, closes: [] };
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const c = series[i];
    if (c == null) continue;
    out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), value: c });
  }
  return { symbol, closes: out };
}


// ---- Finnhub (quarterly financials) ----
async function finnhubFinancials(symbol, key) {
  const url = `${FINN_BASE}/financials-reported?symbol=${symbol}&token=${key}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub financials ${symbol} ${res.status}`);
  const data = await res.json();
  // data.data is array of reports: { quarter, year, value, currency, symbol }
  // Quarterly items have 'quarter' field; annual have null quarter
  const quarterly = (data.data || []).filter(r => r.quarter && r.currency === 'USD');
  return {
    symbol,
    reports: quarterly.map(r => ({
      quarter: r.quarter,
      year: r.year,
      revenue: r.revenue,
      netIncome: r.netIncome,
      operatingCashFlow: r.operatingCashFlow,
      capex: r.capex,
      // Note: Finnhub free tier may not expose all fields
    }))
  };
}


export default async function handler(req, res) {
  const mode = req.query.mode || 'quote';

  // catalog returns the curated TICKERS list (used to populate the quote strip).
  if (mode === 'catalog') {
    return res.status(200).json({ tickers: TICKERS });
  }

  // For the open modes (quote/history/news), allow any well-formed symbol.
  const allowAny = mode === 'quote' || mode === 'history' || mode === 'news' || mode === 'financials';
  const requested = (req.query.symbols || '').trim();
  const symbols = requested
    ? sanitizeSymbols(requested, allowAny)
    : TICKERS.map(t => t.symbol);

  if (!symbols.length) {
    return res.status(400).json({ error: 'no valid symbols supplied' });
  }

  try {
    if (mode === 'quote') {
      const key = process.env.FINNHUB_API_KEY;
      if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured on server' });
      const quotes = await Promise.all(symbols.map(s => finnhubQuote(s, key)));
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      return res.status(200).json({ quotes, ts: Date.now() });
    }

    if (mode === 'history') {
      const years = Math.max(1, Math.min(30, Number(req.query.years) || 10));
      const series = await Promise.all(symbols.map(s => yahooHistory(s, years)));
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
      return res.status(200).json({ series, ts: Date.now(), source: 'yahoo' });
    }

    if (mode === 'financials') {
      const key = process.env.FINNHUB_API_KEY;
      if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured on server' });
      const financials = await Promise.all(symbols.map(s => finnhubFinancials(s, key)));
      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({ financials, ts: Date.now() });
    }

    if (mode === 'news') {
      const key = process.env.FINNHUB_API_KEY;
      if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured on server' });
      const days = Math.max(1, Math.min(60, Number(req.query.days) || 14));
      // News is per-symbol (one Finnhub call each). Run in parallel.
      const news = await Promise.all(symbols.map(async s => ({ symbol: s, items: await finnhubNews(s, key, days) })));
      // Cache news for 30 minutes — frequent enough to feel current, infrequent
      // enough to not burn through Finnhub's free-tier 60/min limit on heavy traffic.
      res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
      return res.status(200).json({ news, ts: Date.now() });
    }

    return res.status(400).json({ error: `unknown mode: ${mode}` });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
