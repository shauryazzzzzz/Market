@echo off
title ANALYZER Startup
echo ============================================
echo  ANALYZER - AI Stock Analysis
echo  Backend: http://localhost:5002
echo  Frontend: http://localhost:3002
echo ============================================

:: Kill any process holding port 5002 or 3002
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5002 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3002 "') do taskkill /F /PID %%a >nul 2>&1
timeout /t 2 /nobreak >nul

:: Install backend deps if needed
if not exist "node_modules" (
  echo Installing backend dependencies...
  call npm install
)

:: Install frontend deps if needed
if not exist "frontend\node_modules" (
  echo Installing frontend dependencies...
  cd frontend
  call npm install
  cd ..
)

:: Start backend in new window
start "ANALYZER-Backend-5002" cmd /k "node server.js"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend dev server
start "ANALYZER-Frontend-3002" cmd /k "cd frontend && npx vite --port 3002"

echo.
echo Servers starting...
echo Backend : http://localhost:5002/api/analyzer/health
echo Frontend: http://localhost:3002
echo.
