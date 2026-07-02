param(
    [int]$Keep = 12
)

$ErrorActionPreference = "Stop"

if ($Keep -lt 1) {
    Write-Host "Keep must be 1 or greater."
    exit 1
}

$repo = Split-Path -Parent $PSScriptRoot
$backupRoot = Join-Path $repo "backups"

if (-not (Test-Path $backupRoot)) {
    Write-Host "No backups folder found."
    exit 0
}

$backups = Get-ChildItem -LiteralPath $backupRoot -Filter "messenger-backup-*.zip" -File |
    Sort-Object LastWriteTime -Descending

$deleteTargets = $backups | Select-Object -Skip $Keep

foreach ($target in $deleteTargets) {
    Remove-Item -LiteralPath $target.FullName -Force
    Write-Host "Deleted old backup: $($target.Name)"
}

Write-Host "Backup cleanup complete. Kept $Keep backup file(s)."
