@echo off
title Aladdin Investing — Unified Platform
color 0A

echo ============================================================
echo   🧞  Aladdin Investing — Unified Financial Platform
echo ============================================================
echo.
echo  Starting all services:
echo    [1] Aladdin API server     → http://localhost:3001
echo    [2] Financial Monitor API  → http://localhost:5000
echo    [3] NewsFeed-Google-AI-    → http://localhost:3002
echo    [4] React Frontend (Vite)  → http://localhost:3000
echo.
echo  Press Ctrl+C in any window to stop that service.
echo ============================================================
echo.

REM ── 1. Aladdin/TradingView Economy API server (port 3001) ──────────────────
start "Aladdin API :3001" cmd /k "cd /d "%~dp0" && node server.js"

REM ── 2. Financial Monitor Express server (port 5000) ───────────────────────
start "Financial Monitor :5000" cmd /k "cd /d "%~dp0financial-monitor" && node server/server.js"

REM ── 3. NewsFeed-Google-AI- Vite+Express server (port 3002) ────────────────
start "NewsFeed AI :3002" cmd /k "cd /d "%~dp0NewsFeed-Google-AI-" && set PORT=3002 && npm run dev"

REM ── 4. Wait a moment then launch Vite React frontend ──────────────────────
timeout /t 3 /nobreak > nul
start "React Frontend :3000" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo  All services launched in separate windows.
echo.
echo  Open your browser: http://localhost:3000
echo.
pause
