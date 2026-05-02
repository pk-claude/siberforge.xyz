# deploy-restore-truncations-and-supply-css.ps1
# Pushes batch 6: restored 8 truncated HTML files + Supply Chain CSS sync.
#
# What broke: The brand-mark Python script in batch 3 silently truncated
# the tail of 8 HTML files. Most-visible casualty was core/ai/index.html
# losing its <script type="module" src="./hub.js"></script> tag, which
# meant the Sankey "capex flow" chart never loaded.
#
# What this fixes:
#   - core/ai/index.html        (capex flow chart now renders)
#   - core/ai/adopters/, compute/, hyperscalers/, power/  (footers + script tags)
#   - core/ai/screen/, top-5/   (footers + script tags)
#   - core/macro/cycle/         (footer + script tags)
#   - core/supply/styles.css    (.top, .home-link, .brand .sub now match macro)
#
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
git commit -m 'Restore 8 HTML files truncated by batch 3 brand-mark script - fixes AI capex flow Sankey - sync supply CSS header rules to macro'

Write-Host ''
Write-Host '=== Push ===' -ForegroundColor Cyan
git push

Write-Host ''
Write-Host '=== Done. Vercel redeploying. ===' -ForegroundColor Green
Write-Host ''
Write-Host 'Verify after Vercel finishes:' -ForegroundColor Yellow
Write-Host '  - https://www.siberforge.xyz/core/ai/                  capex flow Sankey chart should render'
Write-Host '  - https://www.siberforge.xyz/core/ai/screen/           page footer + scripts intact'
Write-Host '  - https://www.siberforge.xyz/core/macro/cycle/         page footer + scripts intact'
Write-Host '  - https://www.siberforge.xyz/core/supply/              header rules now identical to macro'
Write-Host '  Hard-reload (Ctrl+Shift+R) to bypass cache.'
