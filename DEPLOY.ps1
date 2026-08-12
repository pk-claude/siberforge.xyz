# DEPLOY.ps1 -- standing deploy script for siberforge. One command, every time:
#
#   powershell -ExecutionPolicy Bypass -File C:\Claude\Economics\MacroDashboard\siberforge\DEPLOY.ps1
#
# What it does, in order:
#   0. Clears a stale .git\index.lock if no git process is running.
#   1. Stages everything and commits, reading the message from COMMIT-MSG.txt
#      (Claude writes that file each session; falls back to a generic message).
#   2. git pull --rebase. The GitHub bot commits data snapshots daily, so
#      conflicts in */data/* or */snapshots/* are auto-resolved in the
#      remote's favor (newer data). Any OTHER conflict aborts the rebase
#      and restores the pre-deploy state -- paste the output to Claude.
#   3. Runs the test suite. Failure stops before push.
#   4. git push (deploys via Vercel).

$repo = "C:\Claude\Economics\MacroDashboard\siberforge"
Set-Location $repo
$env:GIT_EDITOR = "true"

Write-Host "=== 0. Stale lock check ===" -ForegroundColor Yellow
$lock = ".\.git\index.lock"
if ((Test-Path $lock) -and -not (Get-Process git -ErrorAction SilentlyContinue)) {
    Remove-Item $lock
    Write-Host "Removed stale .git\index.lock"
} else {
    Write-Host "Clean."
}

Write-Host ""
Write-Host "=== 1. Commit local work ===" -ForegroundColor Yellow
git add -A
$staged = git diff --cached --name-only
if ($staged) {
    if (Test-Path .\COMMIT-MSG.txt) {
        git commit -F .\COMMIT-MSG.txt
        Remove-Item .\COMMIT-MSG.txt
    } else {
        git commit -m "siberforge update"
    }
} else {
    Write-Host "Nothing to commit."
}

Write-Host ""
Write-Host "=== 2. Sync with remote (bot data commits) ===" -ForegroundColor Yellow
git pull --rebase 2>&1 | Out-Host
$tries = 0
while ((Test-Path .\.git\rebase-merge) -or (Test-Path .\.git\rebase-apply)) {
    $tries++
    if ($tries -gt 10) {
        Write-Host "Too many conflict rounds - aborting rebase." -ForegroundColor Red
        git rebase --abort
        Write-Host "Repo restored to pre-deploy state. Paste this output to Claude."
        exit 1
    }
    $conf = @(git diff --name-only --diff-filter=U)
    if ($conf.Count -eq 0) { git rebase --continue 2>&1 | Out-Host; continue }
    $nonData = @($conf | Where-Object { ($_ -notmatch "/data/") -and ($_ -notmatch "/snapshots/") })
    if ($nonData.Count -gt 0) {
        Write-Host "Conflict outside data files - not safe to auto-resolve:" -ForegroundColor Red
        $nonData | Out-Host
        git rebase --abort
        Write-Host "Rebase aborted; repo restored to pre-deploy state. Paste this output to Claude." -ForegroundColor Red
        exit 1
    }
    Write-Host "Auto-resolving data-snapshot conflicts (keeping remote's newer data):"
    $conf | Out-Host
    foreach ($f in $conf) {
        git checkout --ours -- $f
        git add -- $f
    }
    git rebase --continue 2>&1 | Out-Host
}

Write-Host ""
Write-Host "=== 3. Tests ===" -ForegroundColor Yellow
node scripts/test/run-all.mjs 2>&1 | Select-Object -Last 2
if ($LASTEXITCODE -ne 0) {
    Write-Host "Tests FAILED - nothing pushed. Paste this output to Claude." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== 4. Push (deploys to Vercel) ===" -ForegroundColor Yellow
git push
if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployed." -ForegroundColor Green
} else {
    Write-Host "Push failed - paste this output to Claude." -ForegroundColor Red
}
git log --oneline -3
