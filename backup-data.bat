@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\backup-data.ps1" %*
if errorlevel 1 (
  echo.
  echo Backup failed.
  pause
  exit /b 1
)

echo.
pause
endlocal
