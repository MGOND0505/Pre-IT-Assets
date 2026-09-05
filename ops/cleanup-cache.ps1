# Runs every 48 hours on this dev machine via a registered Scheduled Task (see
# ops/register-cleanup-task.ps1) - disk-space housekeeping only: npm's package cache, Next.js's
# build/dev cache (frontend/.next, safe to delete - Next regenerates it), and any stray npm/yarn
# debug logs. Never touches node_modules, backend/dist, or backend/uploads.

$ErrorActionPreference = "Continue"
$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "[$(Get-Date -Format o)] Starting cache cleanup..."

npm cache clean --force

$nextCache = Join-Path $repoRoot "frontend\.next"
if (Test-Path $nextCache) {
    Remove-Item -Recurse -Force $nextCache
    Write-Host "Removed $nextCache"
}

Get-ChildItem -Path $repoRoot -Recurse -Depth 2 -Include "npm-debug.log*", "yarn-debug.log*", "yarn-error.log*" -ErrorAction SilentlyContinue |
    ForEach-Object {
        Remove-Item -Force $_.FullName
        Write-Host "Removed $($_.FullName)"
    }

Write-Host "[$(Get-Date -Format o)] Cache cleanup finished."
