# Siberforge

Landing page + project hub. The root `index.html` is a directory of Siberforge projects; each project lives under `core/` and is linked from the hub.

Currently shipped:

- **Economic Indicators** (`/core/econ/`) — 22-indicator overview of US growth, inflation, consumer/labor, and housing. Latest print, YoY/MoM change, 5yr sparkline, and historical-percentile context strip per card. Pulls from FRED.
- **Macro & Markets Dashboard** (`/core/macro/`) — economic indicators tracker with S&P 500 / sector ETF correlation. Static front-end + Vercel serverless functions that proxy FRED and Finnhub with server-side keys.

## Architecture

```
siberforge/
├── index.html              # landing-page hub (links to projects under /core/)
├── README.md
├── package.json
├── vercel.json
├── .gitignore
├── api/                    # serverless functions (required at root by Vercel)
│   ├── fred.js             # /api/fred    -- FRED proxy (6h edge cache)
│   └── stocks.js           # /api/stocks  -- Finnhub proxy (60s quote, 24h history)
└── core/
    ├── econ/               # Economic Indicators overview (22 FRED series)
    │   ├── index.html      # overview UI (served at /core/econ/)
    │   ├── dashboard.js    # controller: batch-fetch, transform, render
    │   ├── indicators.js   # indicator registry (FRED IDs, transforms, categories, context)
    │   ├── sparklines.js   # reusable SVG sparkline + percentile-strip renderers
    │   └── styles.css      # local styles (category accents, dense card grid)
    ├── macro/              # Macro & Markets Dashboard
    │   ├── index.html      # dashboard UI (served at /core/macro/)
    │   ├── dashboard.js    # client controller (ES module)
    │   └── styles.css      # dark theme
    └── lib/
        └── analytics.js    # correlation, regression, z-score, alignment
```

**Why `api/` sits at the repo root.** Vercel's serverless-function file-based routing only discovers functions under `api/` at the project root — the `functions` key in `vercel.json` configures already-discovered functions but can't relocate them. So `api/` is a platform-imposed exception to the "everything under `core/`" rule. Everything else that isn't a Vercel-handled root file lives under `core/`.

**Why a proxy layer?** So API keys stay server-side and cache headers throttle upstream requests. Clients hit `/api/*`; Vercel's CDN caches responses; Finnhub/FRED see one request per TTL, not one per viewer.

## Adding a new project

1. Create a new subfolder under `core/` (e.g. `core/fx/`).
2. Add an `index.html` (+ any project-specific `.js` / `.css`) inside it. It will be served at `/core/fx/`.
3. Shared libraries go in `core/lib/`; new serverless endpoints go in `api/` at the repo root (Vercel requires functions there — see routing note above).
4. Add a `<a class="card" href="/core/fx/">` to the root `index.html` so it shows up on the hub.

## Data sources

**FRED (St. Louis Fed)** — free, unlimited with a key. Indicators wired in (series ID → label):

| Group        | ID         | Indicator                    | Freq      | Transform |
|--------------|------------|------------------------------|-----------|-----------|
| Core macro   | CPIAUCSL   | CPI (headline)               | monthly   | YoY %     |
| Core macro   | DFF        | Fed Funds Rate               | daily     | level     |
| Core macro   | UNRATE     | Unemployment Rate            | monthly   | level     |
| Core macro   | GDPC1      | Real GDP                     | quarterly | YoY %     |
| Core macro   | DGS10      | 10Y Treasury Yield           | daily     | level     |
| Leading      | INDPRO     | Industrial Production        | monthly   | YoY %     |
| Leading      | ICSA       | Initial Jobless Claims       | weekly    | level     |
| Leading      | UMCSENT    | Consumer Sentiment (UMich)   | monthly   | level     |
| Leading      | PERMIT     | Building Permits             | monthly   | YoY %     |
| Leading      | RSAFS      | Retail Sales                 | monthly   | YoY %     |
| Liquidity    | M2SL       | M2 Money Supply              | monthly   | YoY %     |
| Liquidity    | WALCL      | Fed Balance Sheet            | weekly    | level     |
| Liquidity    | RRPONTSYD  | Reverse Repo (overnight)     | daily     | level     |
| Liquidity    | WTREGEN    | Treasury General Account     | weekly    | level     |

Caveats: ISM/PMI is **not** on FRED (license pulled 2021) — `INDPRO` is substituted as a cyclical proxy. Swap in a PMI feed later if you pay for one.

**Finnhub** — free tier = 60 req/min. Used for **live quotes only** (`/quote`). SPY proxies the S&P 500 because `^GSPC` isn't on the free tier. Sector universe: XLK, XLF, XLE, XLV, XLI, XLY, XLP, XLU, XLB, XLRE, XLC.

**Yahoo Finance v8 chart endpoint** — used for **historical daily closes**. Keyless, unofficial, but stable for years. Reason: Finnhub moved `/stock/candle` behind a ~$49/mo paywall in 2024, so the free tier has no history. If Yahoo ever breaks, swap to Stooq (also keyless) or Alpha Vantage (25 req/day free, which is enough given 24h edge caching).

## Local setup

1. `npm install -g vercel` (if you don't have it)
2. `cd siberforge && vercel login`
3. Create a `.env.local` with:
   ```
   FRED_API_KEY=your_fred_key
   FINNHUB_API_KEY=your_finnhub_key
   ```
4. `vercel dev` — runs at http://localhost:3000

## Deployment

### One-time setup

1. **Get API keys**
   - FRED: https://fredaccount.stlouisfed.org/apikeys (instant)
   - Finnhub: https://finnhub.io/register (free tier, instant)

2. **Commit and push this folder to the siberforge GitHub repo.**
   ```bash
   cd siberforge
   git init                   # if not already a repo
   git add .
   git commit -m "Initial macro/markets dashboard"
   git remote add origin git@github.com:<your-user>/siberforge.git
   git push -u origin main
   ```

3. **Connect repo to Vercel** (Vercel dashboard → Add New Project → Import from GitHub → siberforge). Framework preset: **Other** (it's a static site). Root directory: the `siberforge/` folder if that's not the repo root, otherwise leave blank.

4. **Add env vars in Vercel** (Project → Settings → Environment Variables). Scope each to **Production, Preview, Development**:
   - `FRED_API_KEY` = your FRED key
   - `FINNHUB_API_KEY` = your Finnhub key

5. **Bind the siberforge.com domain** (Project → Settings → Domains → Add). Vercel will give you DNS records to set at Porkbun:
   - For apex (`siberforge.com`): an A record pointing to `76.76.21.21`
   - For `www`: a CNAME pointing to `cname.vercel-dns.com`
   (Exact values are shown in the Vercel UI — always trust those over what's documented.)

### Ongoing

`git push` → Vercel auto-deploys. Preview deploys per branch, production on `main`.

## Refresh behavior

- **Quotes (SPY + sector ETFs):** client polls `/api/stocks?mode=quote` every 60s. Vercel caches for 60s so real upstream calls are ~1/min regardless of traffic.
- **Daily history:** fetched once per session; CDN caches for 24h.
- **FRED series:** fetched on selection change; CDN caches for 6h. FRED releases are monthly/quarterly anyway — more frequent polling buys nothing.

## What the tabs do

1. **Rolling correlation** — Pearson r between the (transformed) indicator and SPY daily log returns, computed over a sliding window. Shows regime shifts. A window crossing zero means the macro-market relationship flipped sign.
2. **Scatter + regression** — Indicator values on x, daily return (%) on y, with OLS fit line. Reports β, α, R², n. R² will be low — that's expected for daily-frequency macro factor models.
3. **Time-series overlay** — Both series standardized (z-score) and plotted together. Divergences = macro and price telling different stories.

Below the tabs: an **indicator × sector** correlation heatmap (14 × 12) computed over 10 years of daily data. Green = positive, red = negative. Clamped at ±0.5 for color scaling.

## Not wired (could add later)

- VIX overlay (would need a data source — Finnhub free doesn't include it)
- Lead/lag analysis (shift indicators forward N days to find predictive windows)
- Regime-dependent correlation (split history by Fed hiking/cutting/holding)
- CSV export per chart
- Authentication (the dashboard is public by default; add Vercel password protection if you don't want it indexed)

## Rate limit math

- **Finnhub (quotes):** free = 60/min. Per user visit: 12 quote requests on load, then 12/min after. Vercel edge caching collapses that to **12 upstream requests per 60s total across all users**. At the 60/min limit that's 5× headroom.
- **Yahoo (history):** no documented rate limit for this endpoint. 24h edge cache means ~12 upstream calls per day regardless of traffic.
- **FRED:** no hard limit documented. 6h edge cache.
                                                                                                                  