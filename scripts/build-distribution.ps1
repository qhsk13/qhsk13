$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $repo "dist"
$stage = Join-Path $dist "offline-messenger"
$zip = Join-Path $dist "offline-messenger-deploy.zip"

if (Test-Path $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
if (Test-Path $zip) { Remove-Item -LiteralPath $zip -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

Copy-Item -LiteralPath (Join-Path $repo "target\offline-messenger-0.0.1-SNAPSHOT.jar") -Destination $stage
Copy-Item -LiteralPath (Join-Path $repo "browser-extension") -Destination $stage -Recurse
Copy-Item -LiteralPath (Join-Path $repo "run-h2.bat") -Destination $stage
Copy-Item -LiteralPath (Join-Path $repo "run-hsqldb.bat") -Destination $stage
Copy-Item -LiteralPath (Join-Path $repo "run-h2-postgres-mode.bat") -Destination $stage
Copy-Item -LiteralPath (Join-Path $repo "run-app-window.bat") -Destination $stage
Copy-Item -LiteralPath (Join-Path $repo "create-desktop-shortcut.bat") -Destination $stage
Copy-Item -LiteralPath (Join-Path $repo "backup-data.bat") -Destination $stage
Copy-Item -LiteralPath (Join-Path $repo "prune-backups.bat") -Destination $stage
Copy-Item -LiteralPath (Join-Path $repo "USER_DISTRIBUTION_GUIDE.md") -Destination $stage
Copy-Item -LiteralPath (Join-Path $repo "EXTENSION_NOTIFICATIONS.md") -Destination $stage
Copy-Item -LiteralPath (Join-Path $repo "DATABASE_OPTIONS.md") -Destination $stage

New-Item -ItemType Directory -Path (Join-Path $stage "scripts") | Out-Null
Copy-Item -LiteralPath (Join-Path $repo "scripts\open-app-window.ps1") -Destination (Join-Path $stage "scripts")
Copy-Item -LiteralPath (Join-Path $repo "scripts\create-desktop-shortcut.ps1") -Destination (Join-Path $stage "scripts")
Copy-Item -LiteralPath (Join-Path $repo "scripts\backup-data.ps1") -Destination (Join-Path $stage "scripts")
Copy-Item -LiteralPath (Join-Path $repo "scripts\prune-backups.ps1") -Destination (Join-Path $stage "scripts")

Compress-Archive -LiteralPath $stage -DestinationPath $zip -Force
Write-Host "Created $zip"
