# Research note spec (v3)

How a company note in `research/data/<T>.research.json` is written. `research/sn.js` renders it; NVDA
(2026-10-24) is the reference note. The weekly refresh routine follows this file.

## What changed from v2, and why

v2 notes recapped press releases. The same facts showed up in the lede, bull case, guidance, bear case,
"priced in" and the scenarios. Hard-coded prices and multiples went stale against the live KPI cards,
and the scenarios had no numbers. v3 notes have to answer three questions: **what is the stock pricing in,
what has to be true for it to work, and what would change our mind.**

Every page also gets a computed **Quality & expectations check** from the filings: growth trajectory,
margin trend, cash conversion, NI vs operating income, dilution, balance sheet, capex intensity, and
priced-in vs delivered. Read it before writing. When it flags something amber or red, the note must
address it, either in a debate or a risk.

## Fields (v3 additions first)

| Field | Content |
|---|---|
| `asOf` | Date of this revision (YYYY-MM-DD). |
| `oneLiner` | 1-2 sentences: what the business is and **what the market is betting on**. No facts that are repeated below. |
| `verdict.stance` | Short label: `Positive`, `Neutral`, `Cautious`, optionally with a qualifier (`Positive - sized for a cycle`). |
| `verdict.summary` | 3-5 sentences: the view, the asymmetry, and the 1-2 things that would change it. |
| `verdict.wtb` | 3-4 "what you have to believe at this price" statements, each testable (a number, a date). |
| `scenarioModel` | `horizon` (fiscal year the case describes), `valueDate` (YYYY-MM-DD the value is struck at, ~12-15 months out), `metric` (`eps` or `sales`), `bear`/`base`/`bull`: `{p, rev ($B), eps, multiple, why}`. For `sales` use `rev` + `multiple` (EV/Sales); omit `eps`. Probabilities sum to 1. `note` states the arithmetic. The page computes value per share, return vs the live price, the probability-weighted value and the up/down skew. |
| `debates` | 2-4 cards: `q` (the question that sets the multiple), `bull`, `bear`, `view` (our read, a decision, not a summary), `signpost: {metric, threshold, when}`. The threshold says what result moves the view. |
| `changelog` | Newest first: `{date, change}`. Each revision says what changed and whether the view moved. Keep 6. |
| `thesis` / `risks` | 3-5 each, `Headline. Evidence.` form (the renderer bolds text up to the first period). Arguments, not fact lists. |
| `bullCharts` / `bearCharts` | Index -> chart keys (`revA niA fcfA capexA revQ niQ fcfQ gmA omA revYoyA capexPctA priceH peerFpe peerEvS peerGm peerRg`). Pick the chart that **evidences that bullet**. |
| `catalysts` | Dated. Tie each to a debate where possible ("(debate 2)"). |
| `latestQuarter`, `latestProse`, `guidanceProse`, `guide` | The latest print and guide, stated once. |
| `segments`, `competitive`, `moat` | Short reference material. |
| `valPresets` | Valuation-lab inputs (unchanged). |
| `sources` | Every number needs one. |

When `scenarioModel` is present, `pricedIn` and `scenarios` are no longer rendered. Delete them.

## Writing rules

1. **No live market numbers in prose.** No current price, market cap or P/E in text. The KPI cards and
   scenario table hold those, and they stay live. Talk about multiples in scenarios as assumptions
   ("pays 18x FY2028 EPS").
2. **Each fact appears once.** If it's in the latest-quarter prose, the bull case can refer to it but
   not restate it.
3. **Scenarios must be internally consistent:** revenue x margin / shares = EPS, and the `why` explains
   both the fundamentals and why the market pays that multiple.
4. **A debate is only a debate if the answer moves the value.** Name the signpost metric, the
   threshold and the date.
5. Numbers come from filings or named sources, with period labels. Mark unverifiable claims
   "unverified". ASCII only. Valid JSON.
6. Target the same length as the NVDA reference. More words is not more analysis.

## After editing

```
node scripts/sync-research-index.mjs      # card dates on /research/
node scripts/test/single-name-render.mjs  # every page renders; v3 pages price their scenarios
npm run check
```
