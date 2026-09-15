@echo off
setlocal
set "ROOT=%~dp0"
netstat -ano -p tcp | findstr /R /C:":3000 .*LISTENING" >nul
if %errorlevel%==0 (
  echo FH6 Telemetry is already running. Opening dashboard...
  start "" http://localhost:3000
  exit /b 0
)
echo Starting FH6 Telemetry...
start "FH6 Telemetry" /wait "%ROOT%fh6-telemetry.exe"
if errorlevel 1 (
  echo.
  echo FH6 Telemetry stopped. Check the error above.
  pause
)
