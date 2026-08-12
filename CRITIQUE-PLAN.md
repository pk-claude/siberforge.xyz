# Siberforge critique + improvement plan

Date: 2026-08-03. Four independent read-only audits produced 10 findings each
(40 total) across: navigation/IA, analytical credibility, design/accessibility,
and code health. This file is the consolidated, prioritized plan.

Ranking principle: credibility damage first (a finance site that displays a
stale number under a "LIVE" badge is worse than one that looks plain), then
things that block a visitor from reaching content at all, then correctness of
the analytics, then hygiene.

---

## Tier 1 -- The site tells the reader things that are not true

| # | Finding | Evidence | Action |
|---|---------|----------|--------|
| 1 | Equity P/E page hardcodes a `LIVE` pill regardless of data age | `core/equity/pe/pe.js:127` literal, `last-refresh.json` = 2026-07-12 (22d) | Compute badge from `refreshed_at`; FRESH / AGING / STALE with day count |
| 2 | Snapshot count claims a daily series that has 1 file since May | `pe.js:136`, `snapshots/` = 1 file | Report real count + real date range |
| 3 | Supply pipeline stalled 56d; per-source staleness measured against the stale manifest itself, so everything self-reports fresh | `core/supply/data/manifest.json` generatedAt 2026-06-08; `dashboard.js:216` compares to manifest, not wall clock | Add wall-clock pipeline-age banner above the per-source pills |
| 4 | 13 dashboards print `Updated ${new Date()}` -- the browser clock, not the data | `core/macro/dashboard.js:1441` + 12 others | Relabel to "Fetched" (truthful) rather than "Updated" (a claim about the data) |
| 5 | Top-5 stock page carries April-2026 trade calls in present tense ("April 27 print is imminent") with position sizing | `core/ai/top-5/index.html:317,624,636,649` | Archived banner at top of page, dated, stating calls are not maintained |
| 6 | "This Week" influencer briefing frozen at 2026-04-24 | `core/influencers/data/this-week.json` | Archived banner + noindex; page is already delisted from nav |
| 7 | Metric-context prose anchored to "late 2024" while the numbers beside it are live | `core/lib/metric-context.js:14` CATALOG_AS_OF='2025-Q2' | Auto-warn in the tooltip when the catalog is more than 2 quarters behind |

## Tier 2 -- Analytical defensibility

| # | Finding | Action |
|---|---------|--------|
| 8 | Composite 0-100 scores use hand-picked linear anchors (e.g. HY OAS `(bps-200)/1000`) that appear nowhere on the site | Export the anchors as data, render a "How this score is built" disclosure. Full z-score refactor deferred: it moves every historical score level and needs threshold recalibration |
| 9 | Two unreconciled recession frameworks (5 binary triggers on the homepage vs a weighted 0-100 composite on macro) | Cross-reference note on both, explaining why they can disagree |
| 10 | Backtest prints "Edge confirmed" on gross returns while separately displaying turnover | Deduct 5bp per one-way trade; report gross AND net CAGR/Sharpe; verdict reads off net |
| 11 | Dual-axis credit charts auto-scale each axis independently with no zero baseline; a code comment promises recession shading that was never built | Add an explicit "independent axes" caveat; correct the misleading comment |
| 12 | Sector median P/E silently drops all loss-making names; normalized P/E is survivorship-biased to current index members | Disclose both in the on-page methodology text, with the excluded-name count |

## Tier 3 -- Reachability and orientation

| # | Finding | Action |
|---|---------|--------|
| 13 | Landing page hides all six section links below 880px with no hamburger; hero is 100vh | Mobile menu toggle + hero height cap on small screens |
| 14 | Global search cannot find "unemployment", "mortgage", "gdp" -- 10 of 14 plausible metric searches return zero | Add a `keywords` field per nav entry and fold it into the search score |
| 15 | 48 of 54 leaf pages have no link to a related page in another section | Add a curated `related` field to nav-config and render a "See also" block on leaf pages |
| 16 | 404 page loads no nav and no search -- one exit link | Load nav-config + layout so a lost visitor gets the full site |
| 17 | Plug pages show two adjacent breadcrumbs pointing at the same URL | Suppress the final crumb when it equals the sub-section landing |
| 18 | Markets is the only top tab that does not land on a hub | Add `data-page-hub` to markets.html |
| 19 | The one styled CTA on the homepage promotes a subscribe form that is explicitly not wired | Promote "Explore the dashboards"; demote Subscribe to a plain link |
| 20 | `supply-downloads` appears twice in nav, once next to a similarly-named Data Catalog | Rename the Tools copy to disambiguate |
| 21 | Interior two-tier nav wraps to permanent multi-row chrome on phones (worst: Regional, 9 ungrouped links) | Collapse `.sf-nav-pages` behind a toggle below 800px |

## Tier 4 -- Accessibility and design system

| # | Finding | Action |
|---|---------|--------|
| 22 | Search dialog: `outline:none` with no replacement, no focus trap, focus never returned on close | Focus-visible ring, Tab trap, return focus to opener |
| 23 | Plug pages: `--accent` on `--accent-bg` = 1.85:1 in the default dark theme (needs 4.5:1) | Define `--accent-bg` per theme in tokens.css |
| 24 | Light theme `--accent` = 4.06:1 on bg, and `.sf-nav-link--master.active` hardcodes `#13171c` as text on accent = 4.20:1 in light | Darken light accent; add an `--on-accent` token |
| 25 | 42 of 61 pages have no `<main>`; `role="main"` appears zero times; no skip link | Inject skip link + resolve a main landmark at runtime in layout.js (zero HTML churn, works everywhere) |
| 26 | 240 `<th>` elements, zero `scope` attributes | Script-add `scope="col"` to header cells |
| 27 | 62 `<canvas>` charts, zero with any accessible name | Auto-label each canvas from its nearest heading at runtime |
| 28 | 22 of 25 Chart.js files hardcode dark-theme hex; light mode leaves axes near-invisible | Fix the shared `gridColor()`/`tickColor()` helpers to read CSS variables (covers most charts with few edits) |
| 29 | Theme toggle and search button compute to ~22px tall, below the 24px WCAG 2.5.8 minimum | Bump padding |
| 30 | 6 pages skip heading levels; `core/equity/index.html` has no h1 | Fix the sequence |

## Tier 5 -- Operational hygiene

| # | Finding | Action |
|---|---------|--------|
| 31 | `api/edgar.js` sets `Access-Control-Allow-Origin: *` -- an open SEC proxy anyone can hotlink | Restrict to the site's own origins |
| 32 | All six API proxies have zero rate limiting | Best-effort per-instance token bucket; documented as non-distributed |
| 33 | Three scheduled workflows have no failure notification -- a dead pipeline is silent | Add an `if: failure()` step that files/updates a GitHub issue |
| 34 | No lockfile; workflows run `npm install` with caret ranges against a cheerio-based Wikipedia scraper | Commit `package-lock.json`, switch to `npm ci` |
| 35 | No CI of any kind: a syntax error ships straight to production | Add a workflow running `node --check`, the nav audit, and a link check |
| 36 | `archiver` and `pdfjs-dist` are dependencies with zero imports | Remove from package.json |
| 37 | No CSP; three different Chart.js versions; 256KB of render-blocking CDN JS in `<head>` on ~25 pages | Add CSP, standardize the version, add `defer` |
| 38 | `core/influencers/index.html` ships zero script tags -- permanently stuck on "Loading rationale..." | Archived banner (page is delisted); its 13KB of JS stays unreferenced |
| 39 | Duplicated `fetchJSON`/`el`/`fmt`/`setStatus` across ~20 files, already drifting | DEFERRED -- mechanical churn across 20 files with no user-visible gain; recorded here so it is a decision, not an oversight |
| 40 | Cruft: `index.html.bak`, `deploys/archive/*`, 1021 hardcoded hex literals, 35 distinct font sizes, 13 breakpoints | DEFERRED / needs owner sign-off. No files deleted without explicit permission |

---

## Explicitly deferred, with reasons

- **Z-score refactor of composite scores.** Correct direction, but it changes
  every historical score level and the phase-label thresholds keyed off them.
  That is a calibration exercise, not an edit. Disclosure first.
- **Survivorship bias in normalized P/E.** Fixing it requires historical index
  membership, which is paid data. Disclosed instead.
- **Design-token consolidation** (1021 hex literals, 35 font sizes, two
  conflicting radius scales). Large mechanical diff, high review cost, zero
  functional change. The contrast failures that actually harm readers are
  fixed; the cleanup is a separate pass.
- **Shared-helper refactor** across ~20 files. Same reasoning.
- **File deletion** (`index.html.bak`, `deploys/archive/`). Requires explicit
  permission.
- **Re-dating stale content** (metric-context prose, Top-5 calls, influencer
  week). That is research work, not code. The site now says so out loud
  instead of pretending otherwise.

---

## What was actually implemented, and how it was verified

38 of the 40 findings are implemented. Two (#39 shared-helper extraction,
#40 design-token consolidation) are deferred by decision, above.

One finding did not survive contact with the code: the code-health audit
called `archiver` an unused dependency. It is used, via a dynamic
`await import('archiver')` in `scripts/refresh-supply.mjs:249`, which its
grep did not reach. Only `pdfjs-dist` was genuinely unreferenced and only
that one was removed.

### New files

| File | Purpose |
|------|---------|
| `core/lib/freshness.js` | One staleness answer for the whole site. Age is measured against the wall clock, never against another field in the same file |
| `core/lib/chart-theme.js` | Chart.js plugin mapping hardcoded dark literals to live CSS variables, and re-theming on toggle |
| `api/_guard.js` | Shared origin policy + best-effort per-instance rate limiting |
| `scripts/check-links.mjs` | Every internal href must resolve on disk. Runs in under a second |
| `scripts/test/*.mjs` | 6 files, 60+ assertions. `npm test` |
| `.github/workflows/ci.yml` | Syntax, config, nav audit, link check, tests on every push |

### Verification run

```
130 JS/MJS files          node --check          0 failures
vercel/package/lock       JSON.parse            valid
4 workflow files          yaml.safe_load        valid
audit-nav.mjs             57 pages / 51 views   0 errors, 0 warnings
check-links.mjs           654 internal links    0 dead
headings                  61 HTML files         0 skips, 0 missing h1
contrast.mjs              24 token pairs        all >= 4.5:1
nav-integrity.mjs         51 views              15/15 searches resolve
layout-and-freshness.mjs  21 assertions         pass
chart-theme.mjs           10 assertions         pass
landing-nav.mjs            7 assertions         pass
api-guard.mjs              7 assertions         pass
backtest-costs.mjs         5 assertions         pass
```

### Known, pre-existing, not introduced here

- `core/influencers/index.html` has unbalanced tags (an unclosed `div`
  inside `footer`). Verified identical at HEAD before these changes.
- Four AI pages still load Chart.js 4.5.0 against 4.4.1 elsewhere. Bumping
  4.4.0 to 4.4.1 was a safe patch; forcing 4.5.0 down a minor version was
  not, without knowing what those pages use.

### Not done, needs your decision

- `index.html.bak` (25KB) and `deploys/archive/*` (11 scripts, 48KB) are
  cruft. `.bak` is already gitignored so it is untracked; `deploys/archive`
  IS tracked. Neither was deleted -- deletion needs your explicit go-ahead.
- `_contrast.tmp.py` in the repo root is a scratch file from this session
  that the sandbox could not remove. Safe to delete.
- The stale content itself (Top-5 April calls, the influencer week, the
  metric-context prose) is now labelled honestly but not refreshed. That
  is research, not code.
- The two stalled pipelines (equity-pe since 2026-07-12, supply since
  2026-06-08) still need diagnosing. The site will now say they are stale;
  it will not fix them.
