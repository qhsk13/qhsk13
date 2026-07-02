param(
    [string]$Port = $env:MESSENGER_PORT
)

$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$shortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "Offline Messenger.lnk"
$targetPath = Join-Path $repo "run-app-window.bat"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.Arguments = if ([string]::IsNullOrWhiteSpace($Port)) { "" } else { "-Port $Port" }
$shortcut.WorkingDirectory = $repo
$shortcut.WindowStyle = 7
$shortcut.Description = "Open Offline Messenger"
$shortcut.Save()

Write-Host "Desktop shortcut created: $shortcutPath"
Write-Host "To pin it, right-click the shortcut or the running taskbar icon and choose pin to taskbar."
