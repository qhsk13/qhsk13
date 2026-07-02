$ErrorActionPreference = "Stop"

$jarName = "offline-messenger-0.0.1-SNAPSHOT.jar"
$processes = Get-CimInstance Win32_Process |
    Where-Object {
        $_.Name -match "^java(\.exe)?$" -and
        $_.CommandLine -like "*$jarName*"
    }

foreach ($process in $processes) {
    Write-Host "Stopping PID $($process.ProcessId)"
    Stop-Process -Id $process.ProcessId -Force
}

if (-not $processes) {
    Write-Host "No running Offline Messenger server found."
}
