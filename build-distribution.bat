@echo off
setlocal
cd /d "%~dp0"

set "MAVEN_CMD=mvn"
if exist "C:\util\apache-maven-3.8.8\bin\mvn.cmd" set "MAVEN_CMD=C:\util\apache-maven-3.8.8\bin\mvn.cmd"

if exist "C:\util\jdk\jdk-8u202-windows-x64\jdk1.8.0_202\bin\java.exe" (
  set "JAVA_HOME=C:\util\jdk\jdk-8u202-windows-x64\jdk1.8.0_202"
  set "PATH=%JAVA_HOME%\bin;%PATH%"
)

echo [1/2] Building jar...
call "%MAVEN_CMD%" clean package
if errorlevel 1 (
  echo Build failed. Distribution package was not created.
  pause
  exit /b 1
)

echo.
echo [2/2] Creating distribution zip...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-distribution.ps1"
if errorlevel 1 exit /b 1

echo.
echo Distribution package created under dist.
pause
endlocal
