# Siberforge

Independent US macro, markets and supply-chain dashboards at https://www.siberforge.xyz.
Static HTML/JS (no build step) on Vercel, a few serverless proxies in `api/`, and
scheduled GitHub Actions that snapshot data into the repo.

## Site map (six sections)

| Section | URL | What it answers |
|---|---|---|
| Macro | `/macro/` | State of the Cycle (front door), This Week, Regime & base rates, Labor, Consumer, Housing, Inflation, All indicators, Policy & Rates, Liquidity & Fiscal, Credit, Cycle & Recession, Recession signals |
| Markets | `/markets/` | US equities & sectors (breadth, vol), Rates & credit, Global FX & commodities, Valuation (P/E) |
| Regional | `/regional/` | Geography, CPI dispersion, affordability, build vs buy, channel mix, climate, demographics, migration |
| Supply Chain | `/supply/` | SC Pressure composite, insights, DC, industrial RE, middle/last mile, international, downloads |
| Research | `/research/` | Dated notes: 38 company deep dives (`/research/<ticker>/`), Plug Power (`/research/plug/`), AI beneficiaries (`/research/ai/`) |
| Tools & Data | `/tools/` | Pair explorer, compare, correlation network, regime backtest, ticker lookup, data catalog, A-Z |

`lib/nav-config.js` is the single source of truth for navigation, search, the landing
section grid, the A-Z index and `sitemap.xml`. Old `/core/...` URLs 301 to the new ones
(`vercel.json`).

## Layout

```
index.html, home.css      landing page
lib/                      shared: layout (chrome), nav-config, tokens, page.css (page template),
                          sf-kit.js (data + chart helpers), fred-snapshot.js (data shim),
                          composite-scores.js (all composite scores), freshness, chart theme
macro/ markets/ regional/ supply/ research/ tools/    one folder per section
data/fred/                FRED snapshot (generated; do not hand-edit)
api/                      Vercel functions: fred, stocks, releases, bls, eia, edgar (+ _guard)
scripts/                  refresh/snapshot pipelines, audits, tests
```

## Data backbone

- **FRED**: `scripts/snapshot-fred.mjs` pulls every series in the `api/fred.js` CATALOG
  plus `scripts/fred-universe.json` (state, metro and regional-CPI families) into
  `data/fred/<ID>.json` (daily series split into `.hist.json` + current year) and
  `data/fred/manifest.json`. Runs twice each weekday and Sunday (`snapshot-fred.yml`).
  `lib/fred-snapshot.js` is the first script on every page: it serves `/api/fred?...`
  requests from the snapshot and only calls the live proxy for series the snapshot lacks.
  Reason: FRED's CDN blocks Vercel's shared IPs at times (seen 2026-09-26).
- **Market prices**: `/api/stocks?mode=history` (Yahoo daily closes, 24h edge cache).
- **Supply chain, P/E, single names**: their own weekly/daily workflows commit JSON under
  `supply/data`, `markets/valuation/data`, `research/data`.
- All data workflows share the concurrency group `data-commits` and `git pull --rebase`
  before pushing. Failures open a GitHub issue.

## Analytics conventions

- Composite scores (`lib/composite-scores.js`): each signal = percentile of its own trailing
  20 years, sign-aligned so 100 = most risk; weighted mean; point-in-time (an observation
  counts only after its typical release lag). One implementation used by every page.
- Regime: robust z (median/MAD, 120 months) of 6m-annualized growth and core inflation;
  regimes are paired with returns one month later (publication lag).
- Sector tilts are shown only when the 6m excess return vs SPY clears |t| >= 2 (Newey-West).
- Recession page reports each signal's hit rate and false alarms, computed on load.

## Local check before pushing

```
npm ci
npm run check        # nav audit, link check, test suite
```

## Secrets

Vercel env and GitHub Actions secrets: `FRED_API_KEY`, `FINNHUB_API_KEY`, `EIA_API_KEY`,
`BLS_API_KEY`, `CENSUS_API_KEY`. Never print request URLs with keys; `scripts/lib/http.mjs`
redacts them.
