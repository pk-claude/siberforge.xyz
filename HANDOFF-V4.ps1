$ErrorActionPreference = 'Stop'
Set-Location 'C:\Claude\Economics\MacroDashboard\siberforge'

# Pull any bot commits first
git pull --rebase origin main 2>&1
# If conflict on data files, take ours
if (Test-Path '.git\rebase-merge') {
  git checkout --ours core/supply/data
  git add core/supply/data
  git rebase --continue
}

git add api core/supply scripts docs HANDOFF-V4.ps1 package.json package-lock.json
git commit -m "Supply Chain v4: GSCPI parser fixed, SCP composite populates, BTS borders + DGS10 + REIT spread + WCI/DAT/ACT cleanup"
git push origin main

gh workflow run refresh-supply.yml --repo pk-claude/siberforge.xyz
Start-Sleep -Seconds 6
gh run list --workflow=refresh-supply.yml --repo pk-claude/siberforge.xyz --limit 1

Write-Output "Done. After ~2 min the SCP composite tile should populate with +1.23 (TIGHT)."
