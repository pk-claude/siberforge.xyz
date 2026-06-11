# Deploy: Plug Power Q1 2026 update (May 11, 2026 earnings release)
# Updates cashflow / balance / liquidity views. Revenue/map unchanged.

Set-Location C:\Claude\Economics\MacroDashboard\siberforge

Write-Host "=== files changed ===" -ForegroundColor Cyan
git status --short core/plug

Write-Host "`n=== diff stat ===" -ForegroundColor Cyan
git diff --stat core/plug

Write-Host "`n=== staging all plug changes ===" -ForegroundColor Cyan
git add -A core/plug

$msg = @'
plug: refresh company views with Q1 2026 earnings (May 11, 2026)

- cashflow: add 2026-Q1 (CFO -150M, CFI -8M, CFF -32M; ending cash $802M)
  with full driver decomposition pulled from press release.
- balance: refresh Mar 31, 2026 snapshot - cash $223M unrestricted /
  $578M restricted, working capital adds Q1 2026 TTM row (CCC 199 days),
  share count 1,395.6M issued, $7.75 warrant liability $107M. Maturity
  ladder + restricted-cash sub-buckets kept at FY25 (pending Q1 10-Q).
- liquidity: $7.75 warrants now exercisable (no exercises through Q1).
  Added St. Gabriel ITC sale ($39M, target May 2026). WNY closing now
  ~$142M in June. ATM/SEPA unused in Q1.
- index/balance/liquidity HTML: headline KPIs and "as of" dates updated.
- revenue and map: unchanged (annual / static disclosures).
'@

git commit -m $msg
git push origin main
