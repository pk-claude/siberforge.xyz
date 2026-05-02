# ============================================================================
# deploy-unified-layout-refactor.ps1
# Commits the full Siberforge unified-layout refactor and pushes.
# Run from the siberforge repo root.
# ============================================================================
$ErrorActionPreference = "Stop"
Set-Location "C:\Claude\Economics\MacroDashboard\siberforge"

Write-Host "[1/5] Repo status check"
git status --short

Write-Host ""
Write-Host "[2/5] Removing stale index.lock if present"
$lock = Join-Path $PSScriptRoot ".git\index.lock"
if (Test-Path $lock) {
    Remove-Item $lock -Force
    Write-Host "      removed stale .git/index.lock"
}

Write-Host ""
Write-Host "[3/5] Staging all changes (git add -A handles new + deleted + modified)"
git add -A

Write-Host ""
Write-Host "[4/5] Diff stat preview"
git diff --cached --stat | Select-Object -Last 6

Write-Host ""
Write-Host "[5/5] Committing"
$msg = @'
Unified layout refactor across all dashboards

Replace per-page hand-copied header/nav with shared runtime layout.
Every dashboard page now declares identity via <body> data-attrs and
the header + two-tier nav are rendered from a single nav-config.

- Added /core/lib/tokens.css       Design tokens (colors, type, spacing)
- Added /core/lib/layout.css       Shared header, two-tier nav, theme toggle
- Added /core/lib/nav-config.js    Single source of truth for nav structure
- Added /core/lib/layout.js        Renders header + nav from data attrs
- Added /core/tools/index.html     Tools hub (was orphan link in nav)
- Migrated 51 pages to unified layout (zero inline header/nav copies)
- Renamed nav buckets: Equity / Markets, Macro, AI, Supply Chain, Tools, Reference
- Fixed mis-grouping: markets/bonds/ticker now under Equity, not Macro
- Removed duplicate theme-toggle button from supply/index.html
- Merged landing.new.css into landing.css; landing.new.css now a stub
- Index.html updated to load tokens.css, drop landing.new.css

Result: adding a new page is now one nav-config entry. Renaming a section
is one edit. No more hand-copied header/nav drift.
'@
git commit -m $msg

Write-Host ""
Write-Host "Pushing to origin"
git push

Write-Host ""
Write-Host "Done. Visit https://siberforge.xyz/ to verify."
Write-Host "Note: landing.new.css is now a deprecated stub. Safe to delete with:"
Write-Host "  git rm landing.new.css; git commit -m 'remove deprecated landing.new.css'; git push"
