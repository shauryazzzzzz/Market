@echo off
title Financial Monitor - NSE 500 Stock Dashboard

echo.
echo  ============================================================
echo   Financial Monitor - Starting Server...
echo   NSE 500 Dashboard (Express + React client)
echo  ============================================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo  [INFO] Installing server dependencies...
    call npm install
)

if not exist ".env" (
    if exist ".env.example" (
        echo  [WARN] .env not found. Copying from .env.example...
        copy ".env.example" ".env" >nul
    )
)

if not exist "financial_monitor.db" (
    echo  [INFO] Initialising database...
    call node server\database\init.js
)

echo  [OK] Starting API server on http://localhost:5000
echo  [OK] Press Ctrl+C to stop
echo.
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:5000"
node server\server.js

echo.
echo  [INFO] Server stopped.
pause
