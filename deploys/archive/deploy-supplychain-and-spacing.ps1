# deploy-supplychain-and-spacing.ps1
# Pushes batch 4: Supply Chain in dashboard nav, tighter brand banner spacing,
# restored CSS tail (.ai-watch + @media block lost in batch 3).
# Run from Windows PowerShell.

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Claude\Economics\MacroDashboard\siberforge'

Write-Host '=== Pre-deploy state ===' -ForegroundColor Cyan
git status

Write-Host ''
Write-Host '=== Diff stats vs HEAD ===' -ForegroundColor Cyan
git diff --stat HEAD -- core/

Write-Host ''
Write-Host '=== Staging core/ tree only ===' -ForegroundColor Cyan
git add core/
git status

Write-Host ''
Write-Host '=== Commit ===' -ForegroundColor Cyan
git commit -m 'Dashboard nav adds Supply Chain - tighter brand banner spacing - restore lost AI styles tail'

Write-Host ''
Write-Host '=== Push ===' -ForegroundColor Cyan
git push

Write-Host ''
Write-Host '=== Done. Vercel redeploying. ===' -ForegroundColor Green
Write-Host ''
Write-Host 'After Vercel finishes:' -ForegroundColor Yellow
Write-Host '  1. Hard-reload bonds.html (Ctrl+Shift+R) to bypass any stale cache'
Write-Host '  2. If charts still empty, open DevTools Console and look for the actual error'
Write-Host '  3. Also worth checking view-source on https://www.siberforge.xyz/core/macro/stock-bond-corr.js'
Write-Host '     -- it should be ~8KB and end with a closing brace, not truncated'
