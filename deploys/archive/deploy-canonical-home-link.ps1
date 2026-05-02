# deploy-canonical-home-link.ps1
# Pushes batch 7: canonical home-link icon (house glyph, points to /) on every dashboard.
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
git commit -m 'Canonical home-link icon across all dashboards - house glyph linked to /'

Write-Host ''
Write-Host '=== Push ===' -ForegroundColor Cyan
git push

Write-Host ''
Write-Host '=== Done. Vercel redeploying. ===' -ForegroundColor Green
