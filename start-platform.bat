@echo off
title Aladdin Investor Platform — All Services
echo.
echo  ============================================================
echo   ALADDIN INVESTOR PLATFORM — UNIFIED STARTUP
echo  ============================================================
echo.
echo  Services:
echo    [1] Aladdin API + React SPA         :3001
echo    [2] Financial Monitor API           :5000
echo    [3] NewsFeed Google AI              :3002
echo    [4] Vite Dev Server (HMR)           :3000
echo.

REM ── Kill any stale node/vite processes on our ports ──────────────────────────
echo  Clearing stale processes on 3001, 5000, 3002, 3000...
for %%P in (3001 5000 3002 3000) do (
  for /f "tokens=5" %%A in ('netstat -aon 2^>nul ^| findstr ":%%P " ^| findstr LISTENING') do (
    taskkill /F /PID %%A >nul 2>&1
  )
)
timeout /t 1 /nobreak >nul

REM ── Service 1: Aladdin Express API (:3001) ───────────────────────────────────
echo  [1/4] Starting Aladdin API on :3001 ...
start "Aladdin API :3001" cmd /k "cd /d %~dp0 && node server.js"
timeout /t 2 /nobreak >nul

REM ── Service 2: Financial Monitor Express API (:5000) ─────────────────────────
echo  [2/4] Starting Financial Monitor API on :5000 ...
start "FinMonitor API :5000" cmd /k "cd /d %~dp0financial-monitor && node server\server.js"
timeout /t 2 /nobreak >nul

REM ── Service 3: NewsFeed Google AI (:3002) ─────────────────────────────────────
echo  [3/4] Starting NewsFeed Google AI on :3002 ...
start "NewsFeed :3002" cmd /k "cd /d %~dp0NewsFeed-Google-AI- && SET PORT=3002 && node dist\server.cjs"
timeout /t 2 /nobreak >nul

REM ── Service 4: Vite Dev Server (:3000) ───────────────────────────────────────
echo  [4/4] Starting Vite dev server on :3000 ...
start "Vite Dev :3000" cmd /k "cd /d %~dp0frontend && npx vite --port 3000 --host"
timeout /t 3 /nobreak >nul

echo.
echo  ============================================================
echo   ALL 4 SERVICES STARTED
echo  ============================================================
echo.
echo  PRIMARY ACCESS (with live HMR):
echo    http://localhost:3000              ^(Vite Dev — use this!^)
echo.
echo  PRODUCTION ACCESS ^(pre-built React^):
echo    http://localhost:3001              ^(Full Platform - Dashboard^)
echo    http://localhost:3001/markets      ^(Markets + Commodities^)
echo    http://localhost:3001/news         ^(News Intelligence^)
echo    http://localhost:3001/newsmap      ^(News MindMap^)
echo    http://localhost:3001/monitor      ^(Financial Monitor^)
echo    http://localhost:3001/ipo          ^(IPO Calendar^)
echo    http://localhost:3001/screener     ^(Stock Screener - 23 filters^)
echo    http://localhost:3001/advanced-screener ^(GS Screener - Composite Score^)
echo    http://localhost:3001/sankey       ^(SankeyMATIC Financial Flow^)
echo    http://localhost:3001/fundamentals ^(Fundamentals^)
echo    http://localhost:3001/technical    ^(Technical Analysis - Live OHLCV^)
echo    http://localhost:3001/compare      ^(Peer Comparison^)
echo    http://localhost:3001/portfolio    ^(Portfolio X-Ray^)
echo    http://localhost:3001/dcf          ^(DCF Valuation Calculator^)
echo    http://localhost:3001/strategies   ^(Strategies^)
echo.
echo  API HEALTH:
echo    http://localhost:3001/api/quotes/health
echo    http://localhost:3001/api/ai/health
echo    http://localhost:5000/api/health
echo    http://localhost:3002/
echo.
echo  STANDALONE APPS:
echo    http://localhost:3002              ^(NewsFeed standalone^)
echo    http://localhost:3005              ^(FinancialMonitor standalone UI^)
echo.
pause
