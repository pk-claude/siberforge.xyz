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
| Research | `/research/` | Dated notes: 37 single-name deep dives (`/research/<ticker>/`), Plug Power (`/research/plug/`), AI beneficiaries (`/research/ai/`) |
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

- Missing months: BLS published no October 2025 CPI or household-survey data. `lib/fred-snapshot.js`
  fills a lone missing month by interpolation and flags it (`interpolated: true`), so positional
  math ("12 observations ago") stays a true year. `scripts/test/gap-fill-and-regime.mjs` guards it.
- Regime months are classified only when every growth input has reported; real wages use headline
  CPI; the Sahm rule, policy stance and composite synthesis each have one shared implementation
  (`lib/composite-scores.js`, `lib/sf-kit.js`).

## Front door, history and share card

- `macro/state-core.js` is the State of the Cycle computation with no DOM. The page
  (`macro/state.js`), `scripts/build-state.mjs` and the share card all call it, so they cannot disagree.
- `scripts/build-state.mjs` runs in the `snapshot-fred` workflow after each snapshot and writes
  `data/macro/state.json` (today), `data/macro/state-history.json` (the same dials at every
  month-end since 1990, as they would have read then) and `share/macro.png`.
- `share/macro.png` is the Open Graph image for the landing page and every Macro page: regime,
  four key numbers and the regime map (`lib/quadrant.js`, the same SVG the page shows). It is
  rendered with `@resvg/resvg-js` and the Inter files in `scripts/assets/fonts` (SIL OFL), names
  the month rather than the day, and is rewritten only when something on it changes.
- "When did it last look like this?" (`macro/analog.js`) ranks past months by the gap between
  their dials and today's. Matches must be at least two years old and have 60% of each score's
  inputs; the text says resemblance, never forecast.
- The second-tier nav is a single row that scrolls sideways when it does not fit (`lib/layout.css`,
  `wireNavRow` in `lib/layout.js`).
- Score pages (Labor, Consumer, Housing, Inflation, Credit, Cycle) share the header template in
  `lib/page.css`: eyebrow, title, one computed line (`headerHtml`), data dates, methodology block.

## Local preview

```
node scripts/dev-server.mjs 8790     # static files + /api/* forwarded to the live site
```

Head metadata (title, description, canonical, Open Graph) for the Macro pages is written by
`node scripts/set-head-meta.mjs`; add a row there when a page is added.

## Local check before pushing

```
npm ci
npm run check        # nav audit, link check, test suite
```

## Secrets

Vercel env and GitHub Actions secrets: `FRED_API_KEY`, `FINNHUB_API_KEY`, `EIA_API_KEY`,
`BLS_API_KEY`, `CENSUS_API_KEY`. Never print request URLs with keys; `scripts/lib/http.mjs`
redacts them.
