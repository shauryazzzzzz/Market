@echo off
title TradingView Platform - All Sub-Projects
echo ============================================================
echo  TRADINGVIEW ECONOMY PLATFORM
echo  Starting all 3 sub-projects...
echo ============================================================
echo.
echo  FUNDA    (Fundamental Analysis)  -> http://localhost:3001
echo  ANALYZER (AI Stock Analysis)     -> http://localhost:3002
echo  NEWSROOM (News Intelligence)     -> http://localhost:3003
echo.
echo ============================================================

:: Kill any lingering processes on all ports
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5001 :5002 :5003 :3001 :3002 :3003 "') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

:: Launch FUNDA in its own window
start "FUNDA-5001-3001" cmd /k "cd /d "%~dp0funda" && start.bat"

timeout /t 3 /nobreak >nul

:: Launch ANALYZER in its own window
start "ANALYZER-5002-3002" cmd /k "cd /d "%~dp0analyzer" && start.bat"

timeout /t 3 /nobreak >nul

:: Launch NEWSROOM in its own window
start "NEWSROOM-5003-3003" cmd /k "cd /d "%~dp0newsroom" && start.bat"

echo.
echo All 3 sub-projects launched in separate windows.
echo Waiting 15 seconds for servers to start...
timeout /t 15 /nobreak

echo.
echo ============================================================
echo  HEALTH CHECKS
echo ============================================================
echo Checking backends...
powershell -command "foreach ($ep in @('http://localhost:5001/api/funda/health','http://localhost:5002/api/analyzer/health','http://localhost:5003/api/news/health')) { try { $r = Invoke-WebRequest $ep -UseBasicParsing -TimeoutSec 5; Write-Host \"OK  $ep\" } catch { Write-Host \"ERR $ep\" } }"
echo.
echo Open your browser:
echo   FUNDA    -> http://localhost:3001
echo   ANALYZER -> http://localhost:3002
echo   NEWSROOM -> http://localhost:3003
echo.
pause
