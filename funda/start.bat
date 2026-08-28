@echo off
title FUNDA Startup
echo ============================================
echo  FUNDA - Fundamental Analysis
echo  Backend: http://localhost:5001
echo  Frontend: http://localhost:3001
echo ============================================

:: Kill any process holding port 5001 or 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5001 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 "') do taskkill /F /PID %%a >nul 2>&1
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
start "FUNDA-Backend-5001" cmd /k "node server.js"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: Build frontend and start dev server
start "FUNDA-Frontend-3001" cmd /k "cd frontend && npx vite --port 3001"

echo.
echo Servers starting...
echo Backend : http://localhost:5001/api/funda/health
echo Frontend: http://localhost:3001
echo.
