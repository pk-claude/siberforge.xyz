# ============================================================================
# cleanup-cruft.ps1 -- One-shot cleanup of accumulated patch/mockup/deploy
# cruft in MacroDashboard parent and the siberforge repo root.
#
# Run AFTER deploy-unified-layout-refactor.ps1 has been pushed.
# ============================================================================
$ErrorActionPreference = "Stop"
$parent = "C:\Claude\Economics\MacroDashboard"
$repo   = "C:\Claude\Economics\MacroDashboard\siberforge"
$archive = Join-Path $parent "_archive"

Write-Host ""
Write-Host "STAGE 1 -- Parent folder _archive (design docs + decks)"
if (-not (Test-Path $archive)) { New-Item -ItemType Directory -Path $archive | Out-Null }

$archiveFiles = @(
    "dashboard_reorg_plan.md",
    "dashboard_symmetry_proposals.md",
    "ai-beneficiaries-design.md",
    "macro_dashboard_redesign.md",
    "regime_returns_verification.md",
    "MyWeekWithAI.pptx",
    "MyTwoWeeksWithAI.pptx",
    "MyWeekWithAI_TalkingPoints.md",
    "MyWeekWithAI_ShotList.md",
    "MyTwoWeeksWithAI_TalkingPoints.md"
)
foreach ($f in $archiveFiles) {
    $src = Join-Path $parent $f
    if (Test-Path $src) {
        Move-Item -Force $src $archive
        Write-Host "  archived  $f"
    }
}

Write-Host ""
Write-Host "STAGE 2 -- Parent folder deletions (patches, mockups, loose images)"
$delPatterns = @(
    "*.patch",
    "mockup_*.html",
    "CIK0001093691.json",
    "siberforge_logo1.jpg",
    "siberforge_eyes.png",
    "deploy-chart-fixes.ps1"
)
foreach ($pat in $delPatterns) {
    $found = Get-ChildItem -Path $parent -Filter $pat -File -ErrorAction SilentlyContinue
    foreach ($file in $found) {
        Remove-Item -Force $file.FullName
        Write-Host "  deleted   $($file.Name)"
    }
}

Write-Host ""
Write-Host "STAGE 3 -- Repo: archive prior deploy-*.ps1 scripts"
Set-Location $repo
$deployArchive = "deploys\archive"
if (-not (Test-Path $deployArchive)) { New-Item -ItemType Directory -Path $deployArchive -Force | Out-Null }

$deployScripts = Get-ChildItem -Path $repo -Filter "deploy-*.ps1" -File
foreach ($d in $deployScripts) {
    Move-Item -Force $d.FullName (Join-Path $deployArchive $d.Name)
    Write-Host "  moved     $($d.Name) -> $deployArchive\"
}

Write-Host ""
Write-Host "STAGE 4 -- git rm deprecated landing.new.css stub"
if (Test-Path (Join-Path $repo "landing.new.css")) {
    git rm landing.new.css
    Write-Host "  git rm landing.new.css"
}

Write-Host ""
Write-Host "STAGE 5 -- Update stale doc reference in regimes.js"
$regimesPath = Join-Path $repo "core\macro\regimes.js"
if (Test-Path $regimesPath) {
    $content = Get-Content -Raw -Path $regimesPath
    $oldRef = "see macro_dashboard_redesign.md"
    $newRef = "see ../../../_archive/macro_dashboard_redesign.md"
    if ($content -match [regex]::Escape($oldRef)) {
        $content = $content -replace [regex]::Escape($oldRef), $newRef
        [System.IO.File]::WriteAllText($regimesPath, $content, [System.Text.UTF8Encoding]::new($false))
        Write-Host "  updated comment path in core/macro/regimes.js"
    } else {
        Write-Host "  no stale reference found in regimes.js (skipped)"
    }
}

Write-Host ""
Write-Host "STAGE 6 -- Stage and commit repo changes"
git add -A

$msg = @'
Repo cleanup: archive old deploy scripts, drop landing.new.css stub

- Moved 11 prior deploy-*.ps1 scripts into /deploys/archive/
- Removed deprecated landing.new.css (content already merged into landing.css)
- Updated regimes.js methodology-doc comment to new _archive/ path

Parent-folder cleanup (not tracked in this repo):
- Deleted 30 superseded *.patch files
- Deleted 4 pre-build mockup_*.html files
- Deleted loose CIK0001093691.json + old logo files
- Archived design docs and presentation decks under /MacroDashboard/_archive/
'@
git commit -m $msg
git push

Write-Host ""
Write-Host "Done."
Write-Host ""
Write-Host "Summary of what was kept:"
Write-Host "  - siberforge-offline.html (12 MB) -- you opted to keep"
Write-Host "  - influencers-staging/, proj_screenshots/, screenshots/ -- active or in-use"
Write-Host "  - HANDOFF-*.ps1 in repo root -- gitignored, kept as deploy log"
Write-Host "  - All design docs are now in $archive"
