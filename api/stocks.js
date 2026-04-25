// Vercel serverless function: proxies real-time quotes + historical candles.
//   /api/stocks?mode=quote    -> live prices for SPY + sector ETFs (Finnhub, 60s cache)
//   /api/stocks?mode=history  -> daily closes for last N years (Yahoo Finance, 24h cache)
//   /api/stocks?mode=catalog  -> ticker catalog
//
// Why two sources: Finnhub free tier provides /quote but NOT historical candles
// (those require a paid plan). Yahoo Finance's v8 chart endpoint is keyless and
// publicly accessible; many free tools rely on it. It's unofficial, so if Yahoo
// ever changes it we'd need to swap to Stooq or Alpha Vantage.

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

// ---- Yahoo Finance (historical closes, keyless) ----
//
// We prefer adjusted close (`adjclose`) over raw close (`close`) so that all
// downstream return calculations include dividends and split adjustments.
// For sector ETFs over multi-year horizons, the dividend share of total return
// is material (1–4%/yr); using raw close would understate cumulative returns
// and bias every regime-conditional return downward by that amount.
//
// Fallback: if Yahoo doesn't return an adjclose array (rare — happens for
// some non-equity symbols), drop back to raw close so we don't return empty.
async function yahooHistory(symbol, years) {
  const now = Math.floor(Date.now() / 1000);
  const from = now - years * 365 * 86400;
  const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?period1=${from}&period2=${now}&interval=1d`;
  // Yahoo's endpoint 403s without a UA header when called from server code.
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
    if (c == null) continue; // Yahoo returns null for non-trading days occasionally
    out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), value: c });
  }
  return { symbol, closes: out };
}

export default async function handler(req, res) {
  const mode = req.query.mode || 'quote';

  const requested = (req.query.symbols || '').trim();
  const symbols = requested
    ? requested.split(',').map(s => s.trim().toUpperCase()).filter(s => TICKERS.some(t => t.symbol === s))
    : TICKERS.map(t => t.symbol);

  try {
    if (mode === 'catalog') {
      return res.status(200).json({ tickers: TICKERS });
    }

    if (mode === 'quote') {
      const key = process.env.FINNHUB_API_KEY;
      if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured on server' });
      const quotes = await Promise.all(symbols.map(s => finnhubQuote(s, key)));
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      return res.status(200).json({ quotes, ts: Date.now() });
    }

    if (mode === 'history') {
      // Bumped 20 -> 30 so the regime-returns analysis can reach back to the
      // sector-ETF inception window (XLK/XLF/etc. launched Dec 1998).
      const years = Math.max(1, Math.min(30, Number(req.query.years) || 10));
      // Yahoo handles parallel fine; run all symbols concurrently.
      const series = await Promise.all(symbols.map(s => yahooHistory(s, years)));
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
      return res.status(200).json({ series, ts: Date.now(), source: 'yahoo' });
    }

    return res.status(400).json({ error: `unknown mode: ${mode}` });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
