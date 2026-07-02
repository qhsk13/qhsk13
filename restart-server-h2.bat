@echo off
setlocal
cd /d "%~dp0"

set "APP_JAR=%~dp0target\offline-messenger-0.0.1-SNAPSHOT.jar"
set "MAVEN_CMD=mvn"
set "JAVA_CMD=java"
if exist "C:\bin\apache-maven-3.8.8\bin\mvn.cmd" set "MAVEN_CMD=C:\bin\apache-maven-3.8.8\bin\mvn.cmd"

if exist "C:\bin\jdk\jdk-8u202-windows-x64\jdk1.8.0_202\bin\java.exe" (
  set "JAVA_HOME=C:\bin\jdk\jdk-8u202-windows-x64\jdk1.8.0_202"
  set "JAVA_CMD=C:\bin\jdk\jdk-8u202-windows-x64\jdk1.8.0_202\bin\java.exe"
  set "PATH=%JAVA_HOME%\bin;%PATH%"
)

echo [1/3] Stopping existing Offline Messenger server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-server.ps1"
if errorlevel 1 exit /b 1

echo.
echo [2/3] Building jar...
call "%MAVEN_CMD%" clean package
if errorlevel 1 (
  echo.
  echo Build failed. Server was not restarted.
  pause
  exit /b 1
)

echo.
echo [3/3] Starting server...

echo.
echo Browser URL: http://localhost:8080
echo Reload the browser extension before checking extension changes.
echo To stop the server, press Ctrl+C in this terminal.
echo.
"%JAVA_CMD%" -jar "%APP_JAR%" --spring.profiles.active=h2 %*

set "SERVER_EXIT_CODE=%ERRORLEVEL%"
echo.
echo Server stopped. Exit code: %SERVER_EXIT_CODE%
pause
endlocal
exit /b %SERVER_EXIT_CODE%
