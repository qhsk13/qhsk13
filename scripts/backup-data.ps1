param(
    [switch]$AllowRunning
)

$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$jarName = "offline-messenger-0.0.1-SNAPSHOT.jar"
$backupRoot = Join-Path $repo "backups"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stage = Join-Path $backupRoot "messenger-backup-$timestamp"
$zip = "$stage.zip"

$serverProcess = Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" |
    Where-Object { $_.CommandLine -like "*$jarName*" }

if ($serverProcess -and -not $AllowRunning) {
    Write-Host "Server is running. Stop it before backup for a consistent DB file."
    Write-Host "Run scripts\stop-server.ps1 first, or run backup-data.bat -AllowRunning for a best-effort backup."
    exit 1
}

New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

$dataPath = Join-Path $repo "data"
$uploadsPath = Join-Path $repo "uploads"

if (Test-Path $dataPath) {
    Copy-Item -LiteralPath $dataPath -Destination $stage -Recurse
}

if (Test-Path $uploadsPath) {
    Copy-Item -LiteralPath $uploadsPath -Destination $stage -Recurse
}

$meta = @(
    "Offline Messenger backup",
    "Created: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "Source: $repo",
    "Includes: data, uploads"
)
$meta | Set-Content -LiteralPath (Join-Path $stage "BACKUP_INFO.txt") -Encoding UTF8

Compress-Archive -LiteralPath $stage -DestinationPath $zip -Force
Remove-Item -LiteralPath $stage -Recurse -Force

Write-Host "Backup created: $zip"
