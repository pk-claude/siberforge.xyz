# Supply Chain Dashboard — Design Spec

**Date:** 2026-04-25
**Author:** Pavel (with Claude)
**Target:** siberforge.xyz/core/supply/
**Status:** Approved — ready for implementation plan

---

## 1. Goal

Add a Supply Chain Dashboard to siberforge.xyz that tracks publicly-available indicators across distribution-center operations, middle-mile freight, last-mile delivery, and international logistics. The dashboard must:

- Refresh automatically once per week with no manual intervention
- Group metrics into four categories with deep-dive views per category and per metric
- Treat Industrial Real Estate as a dedicated sub-deep-dive within the Distribution Center category
- Surface rich hover-over context per metric (latest, deltas vs last month / last year / 10y norm, why it matters, how to interpret)
- Label key points on every chart (latest, local extrema, regime turns)
- Expose the full historical dataset for download (per-metric CSV plus a single bundle.zip) at a dedicated location on the site
- Match the existing siberforge visual language and registry-driven architecture used by `/core/econ/` and `/core/macro/`

The deliverable is a working slice on `siberforge.xyz/core/supply/` plus a weekly GitHub Actions refresh job that commits fresh snapshot data back to the repo.

## 2. Context

The siberforge.xyz repo (`github.com/pk-claude/siberforge.xyz`) already contains:

- A Vercel-hosted static site with serverless function proxies under `api/` (`fred.js`, `stocks.js`)
- A registry-driven indicator pattern in `/core/econ/indicators.js` with fields for FRED ID, transform, category, label, methodology, direction, target, hasVintages
- Reusable `sparklines.js` (SVG sparkline + percentile-strip renderer)
- A reusable per-metric drill-down page at `/core/econ/indicator.html` driven entirely by the registry
- A tooltip / hover-context system (commits 065dc4f and 3567280) wired across all six existing deep-dive pages
- A landing-page hub at `/index.html` that links to every project under `/core/`
- A `/core/data/` section that is the natural home for cross-project bulk-data hand-off
- API keys (`FRED_API_KEY`, `FINNHUB_API_KEY`) configured in Vercel and ready to extend

The Supply Chain Dashboard is additive. It does not modify any existing project — it adds a new project at `/core/supply/`, extends the `/api/fred` CATALOG whitelist with supply-chain FRED IDs, and adds two small new API proxies (`/api/eia` and `/api/bls`) so the registry can declaratively pull from those sources too.

## 3. Decisions made during brainstorming

The four open decisions resolved as:

| Decision | Choice |
|----------|--------|
| Refresh model | **Weekly snapshot via GitHub Actions.** Mondays 06:00 UTC. Commits JSON + CSV files to repo; Vercel auto-deploys on push. Page loads serve static JSON (no per-view API calls). |
| Source breadth | **Free APIs + scrapers.** No paid feeds. Scrapers built defensively with last-known-good fallback. |
| Industrial RE depth | **National series + REIT proxies.** Its own deep-dive page; no broker-PDF metro-level scraping in v1. |
| Build sequencing | **One-shot full build.** All four categories shipped together. Phase-2 follow-ups identified but not in scope. |

Domain assumed to be **siberforge.xyz** (matches repo name) unless contradicted.

## 4. Architecture

### 4.1 File layout

```
siberforge/
├── api/
│   ├── fred.js                     # extend CATALOG with new FRED IDs
│   ├── stocks.js                   # already wired (industrial REIT prices)
│   ├── eia.js                      # NEW — EIA proxy (diesel, electricity)
│   └── bls.js                      # NEW — BLS API proxy (OEW wages, JOLTS detail)
├── core/supply/
│   ├── index.html                  # 4-quadrant overview + composite tile
│   ├── dashboard.js                # overview controller (reads snapshot.json)
│   ├── indicators.js               # supply-chain registry (~50 entries)
│   ├── styles.css                  # local overrides; inherits global theme
│   ├── data/
│   │   ├── snapshot.json           # latest values + recent history per series
│   │   ├── manifest.json           # per-source last-success timestamp + freshness
│   │   ├── history/<id>.csv        # one CSV per metric, full history
│   │   ├── raw/                    # archived raw HTML/PDF per scrape (audit)
│   │   └── bundle.zip              # zipped concatenation of every CSV
│   ├── data.html                   # download-zone UI (table of all series + bundle link)
│   ├── dc/
│   │   ├── index.html              # Distribution Center deep-dive grid
│   │   └── industrial-re.html      # Industrial Real Estate sub-deep-dive
│   ├── middle-mile/index.html
│   ├── last-mile/index.html
│   └── international/index.html
├── scripts/
│   ├── refresh-supply.mjs          # main orchestrator
│   ├── lib/
│   │   ├── csv.mjs                 # CSV write helpers
│   │   ├── manifest.mjs            # manifest read/write/freshness
│   │   ├── http.mjs                # retry/timeout/UA helpers for scrapers
│   │   └── snapshot.mjs            # snapshot.json builder
│   └── sources/
│       ├── fred.mjs                # batch FRED fetcher
│       ├── eia.mjs                 # EIA fetcher
│       ├── bls.mjs                 # BLS fetcher
│       ├── census.mjs              # FT900 / trade-balance fetcher
│       ├── nyfed-gscpi.mjs         # static CSV
│       ├── aar-rail.mjs            # AAR weekly traffic CSV
│       ├── yahoo-reits.mjs         # REIT basket via existing pattern
│       ├── cass.mjs                # Cass monthly PDF scraper
│       ├── dat.mjs                 # DAT monthly press-release scraper
│       ├── act-ftr.mjs             # Class 8 orders scraper
│       ├── drewry.mjs              # WCI weekly HTML scraper
│       ├── scfi.mjs                # SCFI weekly scraper
│       ├── freightos.mjs           # FBX (API tier or scraper)
│       ├── bdi.mjs                 # Baltic Dry Index
│       ├── ship-and-bunker.mjs     # VLSFO daily scraper
│       ├── usps.mjs                # RPW quarterly scraper
│       └── ports.mjs               # LA / LB / NYNJ TEU monthly
└── .github/workflows/
    └── refresh-supply.yml          # cron: 0 6 * * 1 + workflow_dispatch
```

### 4.2 Data flow

**Refresh path (weekly):**
GitHub Actions runner → `scripts/refresh-supply.mjs` → for each registry entry, dispatch to the right `sources/*.mjs` fetcher → write `data/history/<id>.csv` → rebuild `data/snapshot.json` → rebuild `data/bundle.zip` → update `data/manifest.json` → commit + push if anything changed → Vercel auto-deploys.

**Read path (page load):**
Browser → static asset fetch of `/core/supply/data/snapshot.json` (CDN-cached) → `dashboard.js` renders tiles, sparklines, tooltips entirely client-side from snapshot.

There are no per-pageview server calls. The serverless `/api/*` proxies remain available for any future interactive controls but are not on the hot path for the supply dashboard. This is the key behavioral change vs `/core/macro/`: that dashboard fetches live; this one reads a snapshot.

### 4.3 Indicator registry shape

Extends the existing pattern from `/core/econ/indicators.js`. Each entry:

```js
{
  id: 'DIESEL_RETAIL',                  // stable internal key + URL slug
  source: 'eia',                        // 'fred' | 'eia' | 'bls' | 'census' | 'scrape:cass' | ...
  sourceId: 'EMD_EPD2D_PTE_NUS_DPG',    // upstream series id where applicable
  category: 'middle-mile',              // 'dc' | 'middle-mile' | 'last-mile' | 'international' | 'industrial-re'
  label: 'Diesel Retail Price (US Avg)',
  shortLabel: 'Diesel',
  unit: '$/gal',
  decimals: 2,
  freq: 'weekly',
  transform: 'level',                   // 'level' | 'yoy' | 'mom_diff' | 'index100' | 'zscore'
  release: 'EIA Weekly Petroleum Status, every Monday',
  direction: 'lower_better',            // for shippers
  whyMatters: '...',                    // 60-120 words for tooltip
  howToRead: '...',                     // 60-120 words for tooltip
  methodology: '...',                   // long-form, drill-down page
  longTermNormYears: 10,                // window for "vs long-term norm"
  hasVintages: false,
}
```

Two new fields beyond the econ pattern: `whyMatters` and `howToRead`. These power the hover content described in §6.

### 4.4 Snapshot file shape

`data/snapshot.json`:

```json
{
  "generatedAt": "2026-04-25T06:00:14Z",
  "schemaVersion": 1,
  "series": {
    "DIESEL_RETAIL": {
      "lastValue": 4.234,
      "lastDate": "2026-04-21",
      "deltas": {
        "vsLastMonth":  0.018,
        "vsLastYear":  -0.032,
        "vsTenYearMean": 0.41,
        "tenYearPercentile": 0.68
      },
      "history": [
        ["2016-04-25", 2.21], ["2016-05-02", 2.24], ...
      ],
      "source": "eia",
      "lastFetchOk": true,
      "lastFetchAt": "2026-04-25T06:00:11Z"
    },
    ...
  }
}
```

History stored at native frequency. Page-side sparklines decimate as needed.

`data/manifest.json`:

```json
{
  "generatedAt": "2026-04-25T06:00:14Z",
  "sources": {
    "fred":    { "lastSuccess": "2026-04-25T06:00:08Z", "seriesCount": 27, "errorCount": 0 },
    "eia":     { "lastSuccess": "2026-04-25T06:00:09Z", "seriesCount":  3, "errorCount": 0 },
    "scrape:cass": { "lastSuccess": "2026-04-21T06:00:00Z", "seriesCount": 3, "errorCount": 0, "staleDays": 4 },
    ...
  }
}
```

Tiles compute "stale" badges from `lastSuccess` per source.

## 5. Metric inventory (full)

### 5.1 Distribution Center (~14 metrics)

| ID | Source | Series | Unit | Freq |
|---|---|---|---|---|
| WAREHOUSE_AHE | FRED | CES4349300008 (avg hourly earnings, warehousing & storage) | $/hr | monthly |
| WAREHOUSE_AHE_YOY | derived | YoY of WAREHOUSE_AHE | % | monthly |
| WAREHOUSE_EMP | FRED | CEU4349300001 (employees, warehousing & storage) | thousands | monthly |
| JOLTS_TWU_OPENINGS | FRED | JTS4400JOL (job openings, transp/warehousing/utilities) | thousands | monthly |
| JOLTS_TWU_QUITS | FRED | JTS4400QUR (quits rate) | % | monthly |
| JOLTS_TWU_LAYOFFS | FRED | JTS4400LDR (layoffs rate) | % | monthly |
| PPI_CORRUGATED | FRED | WPU091503 (corrugated paperboard) | index | monthly |
| PPI_PALLETS | FRED | WPU08321401 (wood pallets) | index | monthly |
| PPI_MAT_HANDLING | FRED | WPU114 (material handling equipment) | index | monthly |
| PPI_WAREHOUSE_SVCS | FRED | PCU493493 (warehousing & storage services) | index | monthly |
| ELEC_INDUSTRIAL | EIA | industrial sector electricity rate (US) | ¢/kWh | monthly |
| INVENTORIES_TO_SALES | FRED | ISRATIO | ratio | monthly |
| INV_MFG | FRED | MNFCTRIMSA | $M | monthly |
| INV_RETAIL_EX_AUTO | FRED | RETAILIRSA | $M | monthly |

### 5.2 Industrial Real Estate (~9 metrics — DC sub-deep-dive)

| ID | Source | Series | Unit | Freq |
|---|---|---|---|---|
| CONSTR_PRIVATE_IND | FRED | TLPRVCONS-derived industrial slice (or use TLPRVCONS + manuf) | $M SAAR | monthly |
| CONSTR_MANUF | FRED | TLMFGCONS | $M SAAR | monthly |
| CRE_PRICE_INDEX | FRED | industrial CRE price proxy — exact FRED ID confirmed at impl. time (candidate: Federal Reserve Z.1 industrial CRE value series, or NAREIT industrial total return as price-level proxy) | index | quarterly |
| CRE_DELINQ | FRED | DRBLACBS (CRE delinquency, all comm banks) | % | quarterly |
| REIT_INDUSTRIAL_BASKET | yahoo | equal-weighted price index of PLD, REXR, FR, STAG, EGP, TRNO | index100 | daily |
| REIT_AVG_DIV_YIELD | yahoo | mean trailing dividend yield of basket | % | daily |
| REIT_YIELD_SPREAD_10Y | derived | REIT_AVG_DIV_YIELD − DGS10 | bps | daily |
| MFG_CAPACITY_UTIL | FRED | MCUMFN | % | monthly |
| DGS10 | FRED | already in CATALOG | % | daily |

### 5.3 Middle Mile (~13 metrics)

| ID | Source | Series | Unit | Freq |
|---|---|---|---|---|
| DIESEL_RETAIL | EIA | EMD_EPD2D_PTE_NUS_DPG | $/gal | weekly |
| GASOLINE_RETAIL | EIA | EMM_EPMR_PTE_NUS_DPG | $/gal | weekly |
| CASS_SHIPMENTS | scrape:cass | Cass Shipments Index | index | monthly |
| CASS_EXPENDITURES | scrape:cass | Cass Expenditures Index | index | monthly |
| CASS_LINEHAUL | scrape:cass | Cass Truckload Linehaul Index | index | monthly |
| ATA_TONNAGE | FRED | TRUCKD11 | index | monthly |
| DAT_VAN_SPOT | scrape:dat | DAT van national avg | $/mi | monthly |
| DAT_REEFER_SPOT | scrape:dat | DAT reefer national avg | $/mi | monthly |
| DAT_FLATBED_SPOT | scrape:dat | DAT flatbed national avg | $/mi | monthly |
| TRUCKING_EMP | FRED | CES4348100001 | thousands | monthly |
| AAR_CARLOADS | scrape:aar | Total carloads, weekly | k units | weekly |
| AAR_INTERMODAL | scrape:aar | Intermodal units, weekly | k units | weekly |
| TSI_FREIGHT | FRED | TSIFRGHT | index | monthly |
| HEAVY_TRUCK_SAAR | FRED | HTRUCKSSAAR | k units SAAR | monthly |
| CLASS8_ORDERS | scrape:act-ftr | Class 8 net orders | k units | monthly |
| PPI_LONGHAUL_TL | FRED | PCU484121484121 | index | monthly |

### 5.4 Last Mile (~10 metrics)

| ID | Source | Series | Unit | Freq |
|---|---|---|---|---|
| COURIER_EMP | FRED | CES4349200001 (couriers & messengers) | thousands | monthly |
| LOCAL_TRUCK_EMP | FRED | CES4848400001 (local trucking) | thousands | monthly |
| USPS_FIRST_CLASS | scrape:usps | First-class mail volume | M pieces | quarterly |
| USPS_MARKETING | scrape:usps | Marketing mail volume | M pieces | quarterly |
| USPS_PACKAGES | scrape:usps | Package services volume | M pieces | quarterly |
| ECOM_SHARE | FRED | ECOMPCTSA (verify current series ID at impl. — Census periodically renames) | % | quarterly |
| ECOM_SALES | FRED | ECOMSA (verify current series ID at impl.) | $M | quarterly |
| RETAIL_EMP | FRED | CEU4200000001 | thousands | monthly |
| LIGHT_TRUCK_SAAR | FRED | LTRUCKSA | k units SAAR | monthly |
| GASOLINE_RETAIL_LM | (alias) | shared with §5.3 GASOLINE_RETAIL | $/gal | weekly |
| PPI_COURIERS | FRED | PCU492492 | index | monthly |
| PPI_LOCAL_TRUCKING | FRED | PCU484110484110 | index | monthly |

### 5.5 International / Sourcing (~14 metrics)

| ID | Source | Series | Unit | Freq |
|---|---|---|---|---|
| GSCPI | scrape:nyfed | NY Fed Global Supply Chain Pressure Index | std-dev | monthly |
| WCI_COMPOSITE | scrape:drewry | Drewry WCI composite | $/40ft | weekly |
| WCI_SHA_LA | scrape:drewry | Shanghai → LA lane | $/40ft | weekly |
| WCI_SHA_RTM | scrape:drewry | Shanghai → Rotterdam lane | $/40ft | weekly |
| (6 more WCI lanes) | scrape:drewry | remaining WCI lanes | $/40ft | weekly |
| SCFI | scrape:scfi | SCFI composite | index | weekly |
| FBX_GLOBAL | scrape:freightos | Freightos Baltic Index global | $/40ft | daily |
| BDI | scrape:bdi | Baltic Dry Index | index | daily |
| BUNKER_VLSFO_SIN | scrape:shipbunker | VLSFO Singapore | $/mt | daily |
| BUNKER_VLSFO_RTM | scrape:shipbunker | VLSFO Rotterdam | $/mt | daily |
| BUNKER_VLSFO_HOU | scrape:shipbunker | VLSFO Houston | $/mt | daily |
| US_IMPORTS | census | FT900 imports total goods | $M | monthly |
| US_EXPORTS | census | FT900 exports total goods | $M | monthly |
| TWD_BROAD | FRED | DTWEXBGS | index | daily |
| PORT_LA_TEU | scrape:ports | Port of LA monthly throughput | TEU | monthly |
| PORT_LB_TEU | scrape:ports | Port of Long Beach monthly | TEU | monthly |
| PORT_NYNJ_TEU | scrape:ports | Port of NY/NJ monthly | TEU | monthly |

### 5.6 Composite — "Supply Chain Pressure"

Z-score blend rendered as a single tile at the top of `/core/supply/index.html`.

```
SCP = mean(
  z(GSCPI, 10y window),                       // direct
  -z(CASS_SHIPMENTS, 10y window),             // inverted: lower shipments = looser system
  z(DIESEL_RETAIL_dev_from_norm, 10y window),
  z(WCI_COMPOSITE, 5y window),
  z(BUNKER_VLSFO_SIN, 5y window)
)
```

Methodology displayed in tooltip and on a methodology link from the tile. Regime label based on SCP value: <-1 "Loose", -1 to +1 "Normal", +1 to +2 "Tight", >+2 "Severe".

## 6. Hover-over and chart-label spec

### 6.1 Tooltip content per metric

Each tile and each chart point has a hover tooltip with:

```
┌──────────────────────────────────────────────────────┐
│ <Label>                                              │
│ Latest: <value> <unit>  ·  <date>                    │
│                                                      │
│ Δ vs last month       <signed %>                     │
│ Δ vs last year        <signed %>                     │
│ vs 10y norm           <±N.Nσ above/below mean>       │
│ Percentile (10y)      <Nth>                          │
│                                                      │
│ Why it matters                                       │
│ <whyMatters from registry, 60-120 words>             │
│                                                      │
│ How to read the trend                                │
│ <howToRead from registry, 60-120 words>              │
│                                                      │
│ Source: <source>  ·  refreshed <date>  [Open chart →]│
└──────────────────────────────────────────────────────┘
```

Computed at render time from snapshot.json. The four numeric deltas are not stored (avoids drift) — they're recomputed in JS each load. This way a fresh snapshot automatically refreshes deltas.

### 6.2 Chart point labels

Every chart auto-labels:
- Latest point: value + date, always shown
- Most-recent local maximum in visible window
- Most-recent local minimum in visible window
- Major regime turn (where applicable, e.g. a 10y SCP composite chart)

Labels are positioned by the existing `sparklines.js` with a new `labelExtrema` pass added. Collisions resolved by shifting along the axis.

## 7. Layout

### 7.1 `/core/supply/index.html` (overview)

```
┌─────────────────────────────────────────────────────┐
│  Supply Chain Pressure Composite (full-width tile)  │
│  current value · sparkline · regime label · why     │
└─────────────────────────────────────────────────────┘
┌──────────────────────────┬──────────────────────────┐
│ Distribution Center      │ Middle Mile              │
│ 4-6 KPI tiles            │ 4-6 KPI tiles            │
│ Open deep dive →         │ Open deep dive →         │
├──────────────────────────┼──────────────────────────┤
│ Last Mile                │ International / Sourcing │
│ 4-6 KPI tiles            │ 4-6 KPI tiles            │
│ Open deep dive →         │ Open deep dive →         │
└──────────────────────────┴──────────────────────────┘
```

Equal-width columns, equal panel heights. Symmetry-first.

### 7.2 Category deep-dives

Dense tile grid (Bloomberg-terminal density, matching existing `/core/econ/`). Every metric in the category as a tile. Each tile clickable to per-metric drill page.

**DC category page specifically excludes Industrial Real Estate metrics** — those live on the IR sub-page (§7.3). The DC page renders a prominent "Industrial Real Estate →" callout card linking to `/core/supply/dc/industrial-re.html` so the relationship is visible without crowding the operational-economics grid.

### 7.3 Industrial RE (`/core/supply/dc/industrial-re.html`)

Distinct narrative-led layout. Sections:
1. Construction pipeline (CONSTR_PRIVATE_IND, CONSTR_MANUF charts)
2. Pricing & cap-rate (CRE_PRICE_INDEX, REIT_AVG_DIV_YIELD, REIT_YIELD_SPREAD_10Y)
3. REIT basket performance (basket index, individual constituents, drawdowns)
4. Operator economics (MFG_CAPACITY_UTIL, DGS10 spread context)

### 7.4 Per-metric drill-down

Reuses `/core/econ/indicator.html` template. Receives `?id=<id>` and `?registry=supply` query params. Renders full-window chart with labeled extrema, methodology, last-N revisions where `hasVintages`.

### 7.5 Download zone (`/core/supply/data.html`)

Table: ID · Label · Category · Source · Last Refresh · Frequency · CSV link.
Top of page: "Download all (.zip)" button → `/core/supply/data/bundle.zip`.
Linked from `/core/data/` hub.

## 8. Refresh pipeline

### 8.1 GitHub Actions workflow

`.github/workflows/refresh-supply.yml`:

```yaml
name: refresh-supply
on:
  schedule:
    - cron: '0 6 * * 1'      # Mondays 06:00 UTC
  workflow_dispatch: {}
jobs:
  refresh:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Refresh supply-chain data
        run: node scripts/refresh-supply.mjs
        env:
          FRED_API_KEY:   ${{ secrets.FRED_API_KEY }}
          EIA_API_KEY:    ${{ secrets.EIA_API_KEY }}
          BLS_API_KEY:    ${{ secrets.BLS_API_KEY }}
          CENSUS_API_KEY: ${{ secrets.CENSUS_API_KEY }}
      - name: Commit if changed
        run: |
          git config user.name  "siberforge-bot"
          git config user.email "bot@siberforge.xyz"
          git add core/supply/data
          git diff --staged --quiet || git commit -m "data: weekly supply-chain refresh $(date -u +%F)"
          git push
```

### 8.2 Orchestrator (`scripts/refresh-supply.mjs`) responsibilities

1. Load registry from `core/supply/indicators.js`
2. Group entries by source; call each source module in parallel where safe
3. Per series: write `core/supply/data/history/<id>.csv` (full history, append-then-rewrite for idempotency)
4. Compute `snapshot.json` from histories (latest values + recent N points + source health)
5. Rebuild `bundle.zip`
6. Update `manifest.json` (per-source last-success, error count, stale flag if > 14d)
7. Exit 0 even if individual sources fail; exit non-zero only if all sources fail or critical writes fail
8. Log per-source success/failure to GH Actions log for visibility

### 8.3 Source-module contract

Every `scripts/sources/*.mjs` exports:

```js
export const id = 'cass';
export async function fetch({ entries, env, http, cache }) {
  // returns { [registryId]: { history: [[date, value], ...], lastFetchAt, ok: bool, err?: string } }
}
```

Scrapers persist last-known-good to `core/supply/data/raw/<source>/<date>.{html,pdf}` and to a per-source last-good cache so a transient failure doesn't blank the series.

### 8.4 First-run bootstrap

First execution pulls full available history per series (FRED 10y minimum, EIA 10y, scrapers from earliest available archive page). Estimated runtime 8-12 min on a fresh runner. Subsequent weekly runs are deltas only — under 2 min.

### 8.5 Required GitHub secrets

`FRED_API_KEY`, `EIA_API_KEY`, `BLS_API_KEY`, `CENSUS_API_KEY`. The user will run a single PowerShell command using `gh secret set` to add all four. Snippet provided at hand-off.

## 9. Failure modes and mitigations

| Failure | Detection | Mitigation |
|---|---|---|
| Single API source down at refresh time | `manifest.json` records error; tile shows "stale Nd" badge | Last-known-good values persist; next weekly run retries; data unaffected on dashboard except for badge |
| Scraper layout change | Same — stale-data badge surfaces it | Raw archive under `data/raw/` lets us diff old vs new layout to fix the parser quickly |
| All sources fail (network outage on runner) | Action exits non-zero; GitHub emails Pavel | Manual `workflow_dispatch` retry once network recovers |
| Snapshot.json corruption | Page-side guard: if `schemaVersion !== 1` or `series` missing, render "data unavailable" panel with link to last-good | Git history is the rollback — easy revert |
| Vercel deploy fails | Vercel dashboard email | Last working snapshot still served from previous deploy |
| Domain mismatch (xyz vs com) | At deploy verification time | Spec assumes .xyz; correct in implementation if .com is live |
| Cap on GitHub Actions | N/A — public repo has unlimited Actions minutes | — |

## 10. Testing

The site is mostly declarative (registry-driven, snapshot-rendered) so testing focuses on the refresh pipeline and the rendering primitives.

- `scripts/refresh-supply.mjs` runs locally with `--dry-run` (writes to `data/_preview/` instead of `data/`) so changes can be inspected before commit
- Each source module exposes `mock()` returning canned data; an integration test runs the orchestrator with all sources mocked and asserts snapshot/manifest shape
- A schema test on `snapshot.json` runs in CI on every PR
- A visual regression check: a Puppeteer script loads every page in light + dark theme, screenshots, diffs against committed baselines (matches the existing approach if any; otherwise added as new infra)
- Manual QA before merging:
  - Open `/core/supply/` — composite tile renders, all four panels render, no console errors
  - Hover every tile — tooltip renders all five sections
  - Click every "Open deep dive →" — page renders
  - Click any metric tile — drill-down renders with chart and methodology
  - `/core/supply/data.html` — every CSV link returns a CSV; `bundle.zip` downloads and unzips correctly
  - Verify `manifest.json` timestamps look plausible

## 11. Out of scope (v2 follow-ups)

- Metro-level industrial vacancy/rent (CBRE/JLL/Cushman/Colliers/Newmark broker-PDF scraping)
- Lead/lag analysis tab
- Authenticated views or paid feeds
- Mobile-first responsive overhaul (will be functional on mobile, not optimized)
- Any non-supply-chain category additions
- Alerts / email digests when SCP composite crosses thresholds
- BigQuery / Slack / Asana integrations even though those plugins exist on this workspace

## 12. Hand-off plan

1. Spec self-review (next step in this conversation)
2. Pavel reviews this spec
3. Invoke `writing-plans` skill to produce ordered implementation plan
4. Execute implementation plan in this session
5. Provide Pavel a single PowerShell snippet to set GitHub secrets via `gh secret set`
6. Trigger first refresh manually via `workflow_dispatch`
7. Verify `/core/supply/` lives at siberforge.xyz/core/supply/ and download bundle works
8. Document the new project in the root `index.html` hub

---

## Appendix A — Hover content authoring guide

Every registry entry must define `whyMatters` (60-120 words) and `howToRead` (60-120 words). Tone: financial-operator brief, no marketing language. Examples:

**DIESEL_RETAIL · whyMatters**
"Diesel is roughly 25-30% of total operating cost for a long-haul carrier and the largest single variable input. Spot-rate carriers absorb diesel moves directly because their rates are settled per-load; contract-rate carriers have a fuel surcharge that lags the DOE national average by 60-90 days, so a sharp move in diesel pressures contract carrier margins for a quarter before being passed through. Retail diesel also flows through to last-mile delivery costs, particularly for regional parcel and LTL operators."

**DIESEL_RETAIL · howToRead**
"Above 10y norm and rising → carrier margin pressure; expect contract-rate increases in the 60-90 day window and tighter capacity as smaller fleets pull trucks. Above norm and falling → margins recovering, capacity stable. Below norm and falling → shipper-favorable; spot rates soften, RFP season becomes buyer-friendly. Below norm and rising → watch for the inflection — historically the 10y mean is the threshold where shipper sentiment flips."

Author all 50 entries in the same register before commit.
