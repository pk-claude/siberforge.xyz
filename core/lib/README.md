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
| `landing-hub.js`        | classic JS   | Renders the landing top bar, Themes grid and "Every view." tree from `nav-config.js` |
| `layout.css`            | CSS          | Header, two-tier nav, tab menus, breadcrumbs, search overlay, hub child lists |
| `layout.js`             | classic JS   | Injects the shared chrome on every dashboard page: header, nav, breadcrumbs, global search |
| `nav-config.js`         | classic JS   | **Single source of truth for navigation.** Sections, pages, landing hub, flat search index |
| `metric-context.js`     | ES module    | Curated educational content + citations for each metric (the tooltip catalog) |
| `plotly-theme.js`       | ES module    | Plotly theme defaults |
| `theme-toggle.js`       | classic JS   | Light/dark theme switcher with localStorage persistence |
| `tokens.css`            | CSS          | Design tokens (colors, type, spacing, radii, z-layers), light + dark |
| `tile-tooltip.js`       | ES module    | Auto-attaching hover/click popup that reads metric-context |
| `transforms.js`         | ES module    | yoy_pct, mom_pct, level — series transforms |
| `ui.js`                 | ES module    | Shared UI helpers |

## Navigation — one config, six sections

`nav-config.js` is the only place the site's structure is written down. It feeds
the interior tab row, the tab dropdown menus, the breadcrumbs, the global search,
the landing page top bar, the landing Themes grid, the landing hub tree, the A-Z
index at `/core/`, and `sitemap.xml`. Nothing else defines structure. If a page is
not in `nav-config.js`, it does not exist as far as the site is concerned.

The six sections are fixed: **Markets, Macro, Regional, AI, Supply Chain,
Tools & Data**. Section *ids* are frozen (`equity`, `tools`) even where the label
has moved on, because renaming an id means touching `data-section` on every page
in that section.

### Adding a page

1. Add a link to the right `PAGES` group in `nav-config.js` with a unique `id`,
   an `href`, and a one-line `meta` (the `meta` is what people read in search
   results, hub cards and dropdowns — write it for a stranger).
2. Set the page's body attributes so it can locate itself:

   ```html
   <body data-section="macro" data-page="cycle" data-page-sub="Cycle Position">
   ```

3. `node scripts/gen-sitemap.mjs` — regenerates `sitemap.xml` from the config.
4. `node scripts/audit-nav.mjs` — must print 0 errors before you deploy.

### Body attribute contract

| Attribute               | Required | Meaning |
|-------------------------|----------|---------|
| `data-section`          | yes      | Top-level tab id, must exist in `SECTIONS` |
| `data-page`             | yes*     | Link id inside that section's `PAGES` entry — this is what highlights |
| `data-sub-section`      | no       | Selects `PAGES["section:sub"]` for deep sub-trees (PLUG) |
| `data-page-parent`      | yes*     | For drill-downs that are not nav entries (`indicator.html`, `metric.html`): the link id to highlight and breadcrumb back to |
| `data-page-sub`         | no       | Subtitle in the header, and the final breadcrumb on drill-downs |
| `data-page-hub`         | no       | `"true"` appends an auto-generated list of every view in the section |
| `data-page-status[-text]` | no     | Status dot and label |
| `data-page-download`    | no       | `"true"` renders the Download data button |
| `data-view`             | no       | Supply-chain render mode only (`overview`/`category`/…). **Not** a nav attribute |

\* one of `data-page` or `data-page-parent`.

**Never put two `data-page` attributes on one body tag.** HTML keeps the first
and silently drops the rest; that is exactly how the entire Supply Chain section
lost its active-state highlight. `audit-nav.mjs` fails the build on duplicates.

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
