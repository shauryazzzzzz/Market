@echo off
title Financial Monitor — Full Stack
echo.
echo  ====================================
echo   FINANCIAL MONITOR — STARTUP
echo  ====================================
echo.
echo  Starting services:
echo    [1] Backend API    :5000
echo    [2] React Frontend :3005
echo.

REM ── Start backend (no wait — poll until ready instead)
echo [1/2] Starting Financial Monitor backend on :5000 ...
start "FM Backend :5000" cmd /k "cd /d %~dp0 && node server\server.js"

REM ── Poll for backend readiness (max 8 seconds, check every 250ms)
echo Waiting for backend on :5000 ...
set /a attempts=0
:poll_backend
set /a attempts+=1
if %attempts% gtr 32 goto backend_timeout
powershell -NoProfile -Command "try{$r=Invoke-WebRequest http://localhost:5000/api/health -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop;if($r.StatusCode -eq 200){exit 0}}catch{exit 1}" >nul 2>&1
if %errorlevel%==0 goto backend_ready
timeout /t 0 /nobreak >nul 2>&1
ping -n 1 -w 250 127.0.0.1 >nul 2>&1
goto poll_backend

:backend_timeout
echo   [WARN] Backend not responding after 8s — starting frontend anyway
goto start_frontend

:backend_ready
echo   Backend ready!

:start_frontend
echo [2/2] Starting React frontend (Vite) on :3005 ...
start "FM Frontend :3005" cmd /k "cd /d %~dp0client && npm run dev"

REM ── Wait 2s then open browser (Vite takes ~1-2s to boot)
timeout /t 2 /nobreak >nul

echo.
echo  ====================================
echo   FINANCIAL MONITOR IS READY
echo  ====================================
echo.
echo  Open: http://localhost:3005
echo.
echo  Pages:
echo    /             Dashboard   (KPI cards + top 20 stocks)
echo    /stocks       NSE 500     (1298 stocks, search, sort)
echo    /markets      Markets     (Global indices + sectors)
echo    /shockers     Shockers    (52W high/low, momentum)
echo    /ai           AI Analyst  (WatsonX sentiment)
echo.
echo  API on :5000 proxied via /api/*
echo.
start "" http://localhost:3005
pause
