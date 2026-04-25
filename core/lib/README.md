# /core/lib — shared dashboard utilities

Modules consumed by every macro/deep-dive page. Keep these dependency-free
(no framework, no build step, plain ES modules + a few non-module scripts).

| File                    | Type         | Purpose |
|-------------------------|--------------|---------|
| `analytics.js`          | ES module    | Numerics: rolling correlation, regression, z-scores, log returns |
| `chart-range.js`        | classic JS   | Auto-attaches 1Y/3Y/5Y/10Y/Max range buttons over Chart.js time-axis canvases |
| `charts.js`             | ES module    | Chart.js helpers and shared options |
| `composite-scores.js`   | ES module    | The 6 composite-score functions: cycle, inflation, housing, consumer, credit, labor |
| `csv-export.js`         | ES module    | `downloadCSV`, `downloadJSON`, `seriesToCSV`, `tableToCSV` |
| `download-button.js`    | classic JS   | Universal click handler for every page's "Download data" button |
| `fred-client.js`        | ES module    | FRED API client with the catalog passthrough |
| `metric-context.js`     | ES module    | Curated educational content + citations for each metric (the tooltip catalog) |
| `plotly-theme.js`       | ES module    | Plotly theme defaults |
| `theme-toggle.js`       | classic JS   | Light/dark theme switcher with localStorage persistence |
| `tile-tooltip.js`       | ES module    | Auto-attaching hover/click popup that reads metric-context |
| `transforms.js`         | ES module    | yoy_pct, mom_pct, level — series transforms |
| `ui.js`                 | ES module    | Shared UI helpers |

## Tile tooltips — adding a new metric

1. **Pick an ID.** Use the FRED series id when there's a 1:1 mapping (e.g.
   `MORTGAGE30US`), or a descriptive UPPER_SNAKE_CASE id for derived measures
   (e.g. `REAL_WAGES`, `HY_IG_RATIO`). Composite-level entries use a
   `_COMPOSITE` suffix.

2. **Append an entry to `metric-context.js`:**

   ```js
   YOUR_ID: {
     label: 'Display Name',
     unit:  'unit · cadence · source',
     what:  'One-sentence definition.',
     why:   'Why a finance/strategy reader cares — the implication.',
     context: '1-3 sentences with concrete dates and historical references so the tile reads as time-aware, not generic.',
     thresholds: 'short bucket descriptions separated by · for quick reading',
     links: [
       { label: 'FRED · YOUR_ID',                url: 'https://fred.stlouisfed.org/series/YOUR_ID' },
       { label: 'BLS / NY Fed / authoritative',  url: 'https://...' },
     ],
   },
   ```

3. **Tag the tile.** In the page's render code, add a `metric: 'YOUR_ID'`
   field to the tile object that gets passed to `renderTiles`, OR add
   `data-tile-metric="YOUR_ID"` directly to the tile's HTML element.

4. **Verify.** Hover the tile in the live page; the popup should appear with
   the new content. ESC dismisses; click pins.

## Catalog refresh discipline

Bump `CATALOG_AS_OF` in `metric-context.js` whenever you do a content review.
The footer of every tooltip surfaces this date so the reader knows how fresh
the "recent context" blurb is. Recommend a quarterly review cadence, more
often during regime shifts.

## Conventions

- All times in user's local timezone (no UTC conversion in display).
- All FRED series fetches go through `/api/fred?series=…` — never call
  fred.stlouisfed.org directly from the browser (CORS blocks it; the proxy
  also has retry/backoff for upstream 5xx errors).
- All Yahoo stock data goes through `/api/stocks?…`.
- Numbers in tile content use `font-variant-numeric: tabular-nums` so digits
  align across rows.
- Threshold strings use `·` (middle dot, U+00B7) as a separator, not `|`
  or `,`.
