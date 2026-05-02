# deploy-nav-sync.ps1
# Pushes batch 5: synced header + section-tabs nav across 22 dashboard pages,
# plus matching nav CSS added to econ/plug/supply stylesheets.
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
git commit -m 'Sync dashboard headers - shared section-tabs nav across supply econ plug single-name and AI sub pages'

Write-Host ''
Write-Host '=== Push ===' -ForegroundColor Cyan
git push

Write-Host ''
Write-Host '=== Done. Vercel redeploying. ===' -ForegroundColor Green
Write-Host ''
Write-Host 'Verify after Vercel finishes:' -ForegroundColor Yellow
Write-Host '  - https://www.siberforge.xyz/core/supply/                       (Supply Chain tab should be active)'
Write-Host '  - https://www.siberforge.xyz/core/econ/recession.html           (Macro tab active, Recession composite active)'
Write-Host '  - https://www.siberforge.xyz/core/plug/cashflow.html            (Financials tab active, Cash flow active)'
Write-Host '  - https://www.siberforge.xyz/core/single-name/                  (Financials tab active)'
Write-Host '  - https://www.siberforge.xyz/core/ai/screen/                    (AI Beneficiaries tab active)'
Write-Host '  Hard-reload (Ctrl+Shift+R) to bypass cache. All headers should look identical.'
