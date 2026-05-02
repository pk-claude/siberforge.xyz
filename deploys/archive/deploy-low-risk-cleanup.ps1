# deploy-low-risk-cleanup.ps1
# Pushes batch 8 + bonds.js fix:
#   - Removes 207 bytes of duplicate tail from core/macro/bonds.js
#     (this is the actual production bug causing "Initializing..." to stick)
#   - Strips trailing NUL byte padding from 6 files
#   - Standardizes 32 page titles to "Siberforge - {section}"
#   - Updates theme-toggle.js to attach to all .theme-toggle elements
#   - Adds scripts/check-truncation.py pre-deploy guard
#   - Expands .gitignore
# Run from Windows PowerShell.

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Claude\Economics\MacroDashboard\siberforge'

Write-Host '=== Pre-deploy state ===' -ForegroundColor Cyan
git status

Write-Host ''
Write-Host '=== Diff stats vs HEAD ===' -ForegroundColor Cyan
git diff --stat HEAD

Write-Host ''
Write-Host '=== Run truncation guard before staging ===' -ForegroundColor Cyan
python scripts/check-truncation.py
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Truncation guard flagged issues. Review and re-run with --force only if intentional.' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '=== Staging core/, scripts/, .gitignore, and the null-stripped files ===' -ForegroundColor Cyan
git add core/ scripts/ .gitignore index.html README.md
git status

Write-Host ''
Write-Host '=== Commit ===' -ForegroundColor Cyan
git commit -m 'Fix bonds.js duplicate-tail syntax error breaking all bond charts - low-risk cleanup pass - canonical titles - theme-toggle multi-element - truncation guard tool'

Write-Host ''
Write-Host '=== Push ===' -ForegroundColor Cyan
git push

Write-Host ''
Write-Host '=== Done. Vercel redeploying. ===' -ForegroundColor Green
Write-Host ''
Write-Host 'After Vercel finishes:' -ForegroundColor Yellow
Write-Host '  - https://www.siberforge.xyz/core/macro/bonds.html  (all 6 chart sections should render)'
Write-Host '  Hard-reload (Ctrl+Shift+R) to bypass cache.'
