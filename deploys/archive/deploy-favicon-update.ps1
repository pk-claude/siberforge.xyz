# deploy-favicon-update.ps1
# Pushes batch 9: replace favicon trio with the canonical eye-mark design.
# Run from Windows PowerShell.
#
# Files updated:
#   - favicon.ico             (multi-size: 16 + 32 + 48)
#   - siberforge-mark.png     (96x96)
#   - apple-touch-icon.png    (180x180)
# All three now show the blue + amber eyes on transparent background,
# matching the inline brand-eyes SVG used everywhere else on the site.
# Source SVG saved at branding/eye-mark.svg (re-render anytime via convert).

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Claude\Economics\MacroDashboard\siberforge'

Write-Host '=== Pre-deploy state ===' -ForegroundColor Cyan
git status

Write-Host ''
Write-Host '=== Diff stats vs HEAD (binary files - sizes only) ===' -ForegroundColor Cyan
git diff --stat HEAD -- favicon.ico siberforge-mark.png apple-touch-icon.png branding/eye-mark.svg

Write-Host ''
Write-Host '=== Run truncation guard ===' -ForegroundColor Cyan
python scripts/check-truncation.py
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Truncation guard flagged issues. Review and re-run with --force only if intentional.' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '=== Staging icon files + new source SVG ===' -ForegroundColor Cyan
git add favicon.ico siberforge-mark.png apple-touch-icon.png branding/eye-mark.svg
git status

Write-Host ''
Write-Host '=== Commit ===' -ForegroundColor Cyan
git commit -m 'Favicon trio updated to canonical eye-mark - blue and amber husky eyes - source SVG at branding/eye-mark.svg'

Write-Host ''
Write-Host '=== Push ===' -ForegroundColor Cyan
git push

Write-Host ''
Write-Host '=== Done. Vercel redeploying. ===' -ForegroundColor Green
Write-Host ''
Write-Host 'After Vercel finishes:' -ForegroundColor Yellow
Write-Host '  - Hard-reload any siberforge.xyz tab (Ctrl+Shift+R) and check the browser tab icon'
Write-Host '  - Some browsers cache favicons aggressively; try opening in incognito if it does not update'
