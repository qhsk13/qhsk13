@echo off
cd /d "%~dp0"
mvn clean package
echo.
echo Build complete. Copy this whole folder to the closed network and run one of:
echo   run-h2.bat
echo   run-h2-postgres-mode.bat
echo   run-hsqldb.bat
