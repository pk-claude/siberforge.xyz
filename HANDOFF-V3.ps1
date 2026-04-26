$ErrorActionPreference = 'Stop'
Set-Location 'C:\Claude\Economics\MacroDashboard\siberforge'

git add api core/supply scripts docs HANDOFF-V3.ps1
git commit -m "Supply Chain v3: variance percent display, light mode, mobile, tinted panels, 4-per-quadrant"
git push origin main

gh workflow run refresh-supply.yml --repo pk-claude/siberforge.xyz
Start-Sleep -Seconds 6
gh run list --workflow=refresh-supply.yml --repo pk-claude/siberforge.xyz --limit 1

Write-Output "Done. After ~2 min:"
Write-Output "  https://siberforge.xyz/core/supply/"
Write-Output "Try the sun/moon icon in the top bar to flip light mode."
