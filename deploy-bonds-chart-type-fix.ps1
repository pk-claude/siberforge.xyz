# deploy-bonds-chart-type-fix.ps1
# Pushes batch 12: fix the actual reason bonds chart lines don't draw.
#
# Root cause: Four bonds charts use type: 'scatter' with pointRadius: 0.
# In Chart.js v4, scatter charts only draw POINTS (not lines) by default,
# unless showLine: true is explicitly set per dataset. Combined with
# pointRadius: 0 (no points), the result was nothing visible.
#
# Fix: switch type: 'scatter' -> type: 'line' on all 4 affected charts.
# 'line' draws connecting lines by default; pointRadius: 0 keeps it clean.
# Yield curve was already type: 'line' (correctly).
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
git commit -m 'Bonds chart type scatter to line - scatter with pointRadius 0 was drawing nothing'

Write-Host ''
Write-Host '=== Push ===' -ForegroundColor Cyan
git push

Write-Host ''
Write-Host '=== Done. Vercel redeploying. ===' -ForegroundColor Green
Write-Host ''
Write-Host 'Hard-reload bonds.html. Lines should now actually appear.' -ForegroundColor Yellow
