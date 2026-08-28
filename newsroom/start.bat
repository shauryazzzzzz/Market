@echo off
title NEWSROOM Startup
echo ============================================
echo  NEWSROOM - Financial News Intelligence
echo  Backend: http://localhost:5003
echo  Frontend: http://localhost:3003
echo ============================================

:: Kill any process holding port 5003 or 3003
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5003 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3003 "') do taskkill /F /PID %%a >nul 2>&1
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
start "NEWSROOM-Backend-5003" cmd /k "node server.js"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend dev server
start "NEWSROOM-Frontend-3003" cmd /k "cd frontend && npx vite --port 3003"

echo.
echo Servers starting...
echo Backend : http://localhost:5003/api/news/health
echo Frontend: http://localhost:3003
echo.
