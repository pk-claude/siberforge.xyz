# deploy-bonds-chart-colors.ps1
# Pushes batch 10: fix invisible-chart-line bug on bonds page.
#
# Root cause: theme-toggle.js was REMOVING the data-theme attribute in dark
# mode (instead of setting it to "dark"). bonds.js read the attribute and
# fell back to "light" when null, so chart lines drew in #1a1a1a (near-black)
# on the near-black background. Data was loading fine, just invisible.
#
# Two fixes:
#   - theme-toggle.js: always set data-theme to "dark" or "light" explicitly
#   - bonds.js: defense-in-depth, default to "dark" when attribute missing
#
# Run from Windows PowerShell.

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Claude\Economics\MacroDashboard\siberforge'

Write-Host '=== Pre-deploy state ===' -ForegroundColor Cyan
git status

Write-Host ''
Write-Host '=== Diff ===' -ForegroundColor Cyan
git diff --stat HEAD -- core/macro/bonds.js core/lib/theme-toggle.js

Write-Host ''
Write-Host '=== Run truncation guard ===' -ForegroundColor Cyan
python scripts/check-truncation.py
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Truncation guard flagged issues. Review and re-run with --force only if intentional.' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '=== Staging the two changed files ===' -ForegroundColor Cyan
git add core/macro/bonds.js core/lib/theme-toggle.js
git status

Write-Host ''
Write-Host '=== Commit ===' -ForegroundColor Cyan
git commit -m 'Fix invisible chart lines on bonds page - theme-toggle now always sets data-theme attribute - bonds.js defaults to dark when missing'

Write-Host ''
Write-Host '=== Push ===' -ForegroundColor Cyan
git push

Write-Host ''
Write-Host '=== Done. Vercel redeploying. ===' -ForegroundColor Green
Write-Host ''
Write-Host 'After Vercel finishes:' -ForegroundColor Yellow
Write-Host '  - Hard-reload bonds.html (Ctrl+Shift+R)'
Write-Host '  - Chart lines should now render in light gray (#e8e8e8) on the dark background'
