# Deploy: Plug Power Q2 2026 update (Aug 10, 2026 earnings + 10-Q)
# Updates all five existing PLUG views and adds the new P&L / Path-to-EBITDAS page.

Set-Location C:\Claude\Economics\MacroDashboard\siberforge

# Guard: refuse to commit if the repo has unmerged (conflict) files.
$unmerged = git ls-files -u
if ($unmerged) {
    Write-Host "ABORT: repo has unmerged files (a previous merge did not finish):" -ForegroundColor Red
    git ls-files -u | ForEach-Object { $_.Split("`t")[-1] } | Sort-Object -Unique
    Write-Host "Resolve the merge first (or ask Claude), then re-run this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "=== files changed ===" -ForegroundColor Cyan
git status --short

Write-Host "`n=== diff stat ===" -ForegroundColor Cyan
git diff --stat

Write-Host "`n=== staging ALL changes ===" -ForegroundColor Cyan
git add -A

$msg = @'
plug: Q2 2026 refresh + new P&L / Path-to-EBITDAS view

Data (Q2 2026 press release + 10-Q, both filed 2026-08-10):
- cashflow: add 2026-Q2 (CFO -94M, CFI +0.3M, CFF -36M; unrestricted
  cash $161.9M, total $671.5M) with full driver decomposition.
- balance: Jun 30 snapshot; restricted-cash buckets now ACTUAL from
  10-Q Note 17 (S/LB $279.2M, LC $150.4M, TX escrow $62M, GA $18M);
  ladder adjusted (7.00pct 2026 notes repaid, fin obligations $57.7M
  current); Q2'26 TTM working-capital row (CCC 206d); warrant liab
  $136.3M; D/E 2.76x.
- liquidity: DOE loan TERMINATED by DOE Aug 4, 2026 (removed from
  live capacity, card kept as tombstone); WNY sale restructured as
  NY Gateway staged closing ($142M fixed, outside Mar 2027); NEW
  Graham TX sale lever ($50M + $26.5M earnout, $40M HV closing
  received Aug 7); St. Gabriel ITC closed ($39.2M gross, note on
  $16.5M Olin NCI distribution); fixed pre-existing Sankey bug
  (itc lever missing from depByOption produced an undefined node).
- map: Graham TX added as second divesting site; DOE four-question
  panel rewritten as resolution; data-center-pivot storyline.
- NEW pnl.html/pnl.js/pnl-data.js: quarterly P&L Q1'24-Q2'26 - GM
  march from -132pct to -0.9pct, segment margins, opex discipline
  (with the $39.7M recovery caveat), distance-to-EBITDAS math.
  All quarters tie to FY 10-K / H1 press-release totals.
- index/nav/sitemap/single-name: new card + counts and stale text.

Guidance: FY26 revenue growth raised to 15-16pct (from 13-15pct);
EBITDAS-positive target Q4 2026 reiterated.
'@

git commit -m $msg
git push origin main

Write-Host "`n=== done - verify at siberforge.xyz/core/plug/ ===" -ForegroundColor Green
