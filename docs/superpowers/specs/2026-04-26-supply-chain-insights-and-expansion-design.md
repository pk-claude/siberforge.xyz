# Supply Chain Dashboard v2 — Insights, Expansion, and Calendar

**Date:** 2026-04-26
**Author:** Pavel (with Claude)
**Status:** Approved — building

---

## 1. Goal

Build three additive layers on top of the v1 supply-chain dashboard:

1. **Metric expansion** — close 11 high-value gaps in the registry, plus break the industrial REIT basket out into individual tickers with per-company descriptions.
2. **Deterministic insight engine** — score every metric for risk/opportunity intensity, surface top movers in a "Watch Band" at the top of every category page, render a single Environment Summary on the overview, expose a dedicated `/insights/` page for the morning read.
3. **14-day publications calendar** — strip at the top of every page showing what data is about to release, with hover context for each upcoming print.

Constraint: free public data only, no paid feeds, deterministic logic only (no LLM).

## 2. Audit — metrics being added

| Indicator | Source | Cadence | Why |
|---|---|---|---|
| Empire State Mfg — Delivery Time | FRED | monthly | Direct supply-chain pressure subindex; closest free substitute for ISM Suppliers' Deliveries (which left FRED 2021) |
| Philly Fed Mfg — Delivery Time | FRED | monthly | Cross-validates Empire State; broader region |
| Dallas Fed Mfg — Delivery Time | FRED | monthly | South region; nearshoring narrative |
| US-Mexico Border Crossings (truck) | BTS scraper | monthly | Direct nearshoring signal |
| Suez Canal Monthly Transits | SCA press release scraper | monthly | Houthi/Red Sea diversions; chokepoint risk |
| Panama Canal Transits | ACP scraper | monthly | Drought constraint cycle |
| Cold Storage REIT basket (COLD, LINE) | Yahoo | daily | Cold chain cycle distinct from dry industrial |
| Self-Storage REIT basket (PSA, EXR, CUBE) | Yahoo | daily | Adjacent industrial RE; consumer warehousing |
| Pulp PPI | FRED (WPU0911) | monthly | Leading indicator for corrugated by 1-2 quarters |
| EU ETS Carbon Price (EUA) | scraper | daily | Shipping fully phased into ETS by 2026; +$50-150/TEU on Asia-Europe |
| Reshoring Initiative annual count | scraper | annual | Long-cycle structural signal |

Plus REIT constituent breakout: PLD, REXR, FR, STAG, EGP, TRNO (existing) + COLD, LINE, PSA, EXR, CUBE (new) — each rendered as its own tile on the Industrial RE page with hover description (company, market cap, footprint, role in supply chain).

## 3. Insight engine

### 3.1 Inputs
- `core/supply/data/snapshot.json` (latest values + per-metric history)
- `core/supply/data/manifest.json` (per-source freshness)
- `core/supply/indicators.js` (registry — direction, longTermNormYears, whyMatters, howToRead)

### 3.2 Per-metric calculations

For each indicator with a non-empty history:

- **z**: `(latest − mean(window)) / sd(window)` over `longTermNormYears`
- **MoM**: `(latest − prior) / |prior|` (or matching native frequency)
- **YoY**: closest observation ~365 days back
- **persistence**: count of consecutive periods where the move had the same sign (positive or negative)
- **acceleration**: difference between MoM and median MoM over trailing 6 periods
- **percentile**: rank of latest value within `longTermNormYears` window

### 3.3 Score formula (0-100)

```
intensity = clip(
  30 * min(|z|, 3.0)             // magnitude (0-90)
  + 5 * min(persistence, 4)      // persistence bonus (0-20)
  + 10 * acceleration_signal     // acceleration bonus (0-10)
  , 0, 100)
```

`acceleration_signal` is 1 if the absolute acceleration > 0.5σ in the same direction as z; 0 otherwise.

### 3.4 Classification

For each metric, combine `direction` field with the sign of `z`:

| direction | z sign | move | classification |
|---|---|---|---|
| lower_better | + | rising | risk |
| lower_better | − | falling | opportunity |
| higher_better | + | rising | opportunity |
| higher_better | − | falling | risk |
| neutral | any | any | watch |

Plus rule overrides:

| Rule | Condition | Class | Headline template |
|---|---|---|---|
| RISK_TIGHTENING | z > +1.5 AND persistence ≥ 2 AND direction=lower_better | risk | "{label} pressure intensifying" |
| RISK_SOFTENING | z < −1.5 AND persistence ≥ 2 AND direction=higher_better | risk | "{label} demand softening" |
| OPPTY_RELIEF | z falling >1.0σ in 3mo AND direction=lower_better | opportunity | "{label} cost relief opening" |
| OPPTY_RECOVERY | z rising >1.0σ in 3mo AND direction=higher_better | opportunity | "{label} demand recovering" |
| WATCH_INFLECTION | \|z\| < 1.0 AND \|acceleration\| > 0.5 | watch | "{label} direction may be turning" |
| WATCH_EXTREME_HIGH | percentile > 95 | watch | "{label} at multi-year high" |
| WATCH_EXTREME_LOW | percentile < 5 | watch | "{label} at multi-year low" |
| QUIET | otherwise | quiet | (not surfaced) |

The first matching rule wins. Quiet metrics are scored but excluded from the Watch Band.

### 3.5 Output: `core/supply/data/insights.json`

```json
{
  "generatedAt": "...",
  "summary": {
    "compositeScpValue": 1.23,
    "compositeScpRegime": "Tight",
    "risks": 7, "opportunities": 3, "watches": 5,
    "topAction": { "id": "...", "headline": "...", "score": 82 }
  },
  "byCategory": {
    "dc": [ { "id":"...", "score":78, "class":"risk", "rule":"RISK_TIGHTENING",
              "headline":"...", "current":..., "norm":..., "z":..., "vsLastMonth":...,
              "vsLastYear":..., "rightNow":"..." }, ... ],
    "industrial-re": [...], "middle-mile": [...], "last-mile": [...], "international": [...]
  },
  "all": [/* every flagged metric, sorted by score desc */]
}
```

`rightNow` is a one-line synthesis used to populate the new "Right now" line in tooltips on every metric tile.

## 4. Calendar engine

### 4.1 Inputs

- `core/supply/indicators.js` (every entry gets a new `releaseCadence` field)
- FRED Release API (`/fred/release/dates`) for FRED-mirrored series — gives actual scheduled dates

### 4.2 Cadence rules (registry field)

```js
releaseCadence: {
  kind: 'fred_release' | 'first_friday' | 'first_business_day' |
        'mid_month' | 'around_12th' | 'weekly_monday_4pm' |
        'wednesday' | 'thursday' | 'quarterly_45d' | 'annual_q1' | 'daily',
  releaseId: '...',  // for kind='fred_release', the FRED release_id
  hint: 'BLS CES, ~1st Friday',  // existing 'release' field for display
}
```

### 4.3 Output: `core/supply/data/calendar.json`

```json
{
  "generatedAt": "...",
  "windows": {
    "next14": [
      { "date":"2026-04-27", "id":"DIESEL_RETAIL", "label":"Diesel Retail Price",
        "shortLabel":"Diesel", "category":"middle-mile", "lastValue":4.234,
        "lastDate":"2026-04-21", "context":"Last +1.8% MoM, +0.4σ above 10y norm" },
      ...
    ],
    "byCategory": { "dc":[...], "middle-mile":[...], ... }
  }
}
```

### 4.4 Calendar engine logic

`scripts/calendar.mjs` — runs after `insights.mjs` in `refresh-supply.mjs`.

For each indicator:
1. If `kind=fred_release` → call FRED API once per unique releaseId (cached in-memory), filter dates to next 14 days
2. Else → evaluate cadence rule against today's date to compute next 1-3 occurrences within 14 days
3. For each upcoming release: pull current value + delta + light context from snapshot.json

Rule evaluator handles:
- `first_friday`: first Friday of next month (or this month if not yet passed)
- `first_business_day`: first non-weekend non-federal-holiday day of next month
- `mid_month`: 14-16th of current/next month
- `around_12th`: 11-13th of current/next month
- `weekly_monday_4pm`: each Monday in the next 14 days
- `wednesday`/`thursday`: every occurrence in the window
- `quarterly_45d`: 45 days after each quarter-end
- `annual_q1`: Jan-Mar of current year
- `daily`: skipped (too noisy for the calendar)

US federal holidays handled by a small embedded list (no library dependency).

## 5. UI surfaces

### 5.1 Top of every category page (and overview)

Three stacked bands:

```
┌────────────────────────────────────────────────────────┐
│ NEXT 14 DAYS · 9 RELEASES                              │  ← Calendar
│ [date·label] [date·label] [date·label] ...             │
├────────────────────────────────────────────────────────┤
│ ⚠ TOP MOVES THIS WEEK                                   │  ← Watch Band
│ [score·icon·label·z·headline] ×3-5                     │
├────────────────────────────────────────────────────────┤
│ (existing content for the page below)                  │
└────────────────────────────────────────────────────────┘
```

### 5.2 Overview page additionally has Environment Summary

Replaces the existing dim "awaiting data" composite tile with a richer card:

```
ENVIRONMENT · refresh 2026-04-26
Composite SC Pressure   +1.23σ TIGHT  ▲
7 risks · 3 opportunities · 5 watch
⚠ TOP ACTION  [headline + 2-line context + drill →]
```

### 5.3 Enhanced metric tooltip (every cell)

```
{label}
{latest value} · {date}
Δ MoM / Δ YoY / vs 10y / pct
▶ RIGHT NOW: {synthesized one-liner from rule + numbers}
Why it matters: {whyMatters}
How to read: {howToRead}
Source: {source} · refreshed {date}
```

### 5.4 Industrial RE constituent tiles

REIT basket (PLD, REXR, FR, STAG, EGP, TRNO + new COLD, LINE, PSA, EXR, CUBE) is rendered as 11 individual tiles. Each tile:
- Latest price, YTD return, dividend yield
- Hover: company description, market cap, footprint, supply-chain role

Existing aggregate basket tile remains as the headline.

### 5.5 Dedicated `/core/supply/insights/` page

Single-page morning read:
- Environment Summary (same as overview)
- Top Risks (5+ cards)
- Top Opportunities (3+ cards)
- Watch List — early inflection points
- Sortable table of every flagged outlier

## 6. Architecture changes

```
scripts/
  insights.mjs                  # NEW
  calendar.mjs                  # NEW
  refresh-supply.mjs            # MODIFIED — calls insights, then calendar
  sources/
    bts-borders.mjs             # NEW
    suez-canal.mjs              # NEW
    panama-canal.mjs            # NEW
    eu-ets.mjs                  # NEW
    reshoring.mjs               # NEW (low priority)

core/supply/
  insights.js                   # NEW — Watch Band + Calendar Strip + Insights page renderer
  insights/
    index.html                  # NEW
  data/
    insights.json               # NEW (output)
    calendar.json               # NEW (output)
  indicators.js                 # MODIFIED — 11 new entries + REIT constituents +
                                # `releaseCadence` field on every entry +
                                # `tickerInfo` field on each REIT/equity entry
  dashboard.js                  # MODIFIED — calendar+watch render, enhanced tooltip, ticker tiles
  index.html                    # MODIFIED — calendar+watch slots + Environment card slot
  dc/index.html                 # MODIFIED — calendar+watch slots
  dc/industrial-re.html         # MODIFIED — calendar+watch slots + constituent grid
  middle-mile/index.html        # MODIFIED — calendar+watch slots
  last-mile/index.html          # MODIFIED — calendar+watch slots
  international/index.html      # MODIFIED — calendar+watch slots

api/
  fred.js                       # MODIFIED — whitelist new FRED IDs
                                # (Empire State / Philly / Dallas mfg delivery time, pulp PPI)
  releases.js                   # MODIFIED — extend if needed for release-dates lookup
```

## 7. Risks / tradeoffs

- **Rule thresholds need tuning.** First-week scoring may be over- or under-aggressive. We'll see signal-to-noise after one weekly cycle.
- **Templated narrative** is mechanical. Upgrade path to LLM is small if needed later.
- **REIT page becomes denser** (~20 tiles vs ~9). Gains constituent visibility at cost of density.
- **5 new scrapers** to maintain (BTS, Suez, Panama, EU ETS, Reshoring). All defensive (last-known-good fallback, stale-N badge), but the usual scraper-rot risk applies.
- **Calendar is computed**, not authoritative. FRED dates come from FRED; non-FRED cadence is rule-based and may be ~1 day off when an agency reschedules. Each calendar entry tagged with confidence (FRED-actual = high, rule-derived = nominal).

## 8. Out of scope for v2

- LLM-narrative upgrade (deferred — cheap to add later)
- Working capital (DSO/DPO/DIO from XBRL) — leverages /core/single-name/ infra, separate effort (v3)
- Metro-level industrial vacancy (still requires broker PDF scraping)
- Email/alert delivery on rule firings
- Cross-metric relational rules ("diesel rising AND wages flat → carrier margin pressure")

## 9. Hand-off plan

1. Spec self-review (next step)
2. Implementation in order: registry expansion → insights engine → calendar engine → UI bands → /insights page → tooltip enhancement → run locally → commit → push → trigger workflow_dispatch
3. PowerShell snippet to user for the final push if needed
