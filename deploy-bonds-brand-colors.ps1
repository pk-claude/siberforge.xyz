# deploy-bonds-brand-colors.ps1
# Pushes batch 11: brand-aligned per-series colors on every bonds chart.
#
# Each multi-series chart now uses distinct colors from the brand palette:
#   blue  (#3EB8E0) - left eye / cool / safer (IG OAS, Yield Vol, 5Y BE)
#   amber (#E09A3E) - right eye / warm / risk (HY OAS, VIX, 5Y5Y, Latest)
#   white (#e8e8e8) - off-white neutral (3m ago, 10Y BE)
#   green (#3ECF8E) - cool / healthy (UMich monthly)
#
# Run from Windows PowerShell.

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Claude\Economics\MacroDashboard\siberforge'

Write-Host '=== Pre-deploy state ===' -ForegroundColor Cyan
git status

Write-Host ''
Write-Host '=== Diff ===' -ForegroundColor Cyan
git diff --stat HEAD -- core/macro/bonds.js

Write-Host ''
Write-Host '=== Run truncation guard ===' -ForegroundColor Cyan
python scripts/check-truncation.py
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Truncation guard flagged issues.' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '=== Staging ===' -ForegroundColor Cyan
git add core/macro/bonds.js
git status

Write-Host ''
Write-Host '=== Commit ===' -ForegroundColor Cyan
git commit -m 'Bonds chart series colors - brand palette per-series for distinguishability on dark bg'

Write-Host ''
Write-Host '=== Push ===' -ForegroundColor Cyan
git push

Write-Host ''
Write-Host '=== Done. Vercel redeploying. ===' -ForegroundColor Green
Write-Host ''
Write-Host 'Hard-reload bonds.html to see the new colors.' -ForegroundColor Yellow
