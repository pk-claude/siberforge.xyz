# deploy-dashboard-brand.ps1
# Pushes batch 3: unified brand mark on every dashboard header.
# Run from Windows PowerShell.

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Claude\Economics\MacroDashboard\siberforge'

Write-Host '=== Pre-deploy state ===' -ForegroundColor Cyan
git status

Write-Host ''
Write-Host '=== Diff stats for what changed under core/ ===' -ForegroundColor Cyan
git diff --stat HEAD -- core/

Write-Host ''
Write-Host '=== Staging core/ tree only ===' -ForegroundColor Cyan
git add core/
git status

Write-Host ''
Write-Host '=== Commit ===' -ForegroundColor Cyan
git commit -m 'Unified brand mark across all 50 dashboards - eye SVG + white SIBER red FORGE'

Write-Host ''
Write-Host '=== Push ===' -ForegroundColor Cyan
git push

Write-Host ''
Write-Host '=== Done. Vercel redeploying. ===' -ForegroundColor Green
