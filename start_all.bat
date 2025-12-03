@echo off
title Launcher - Bot SDV V2
echo ===================================================
echo   STARTING ALL SERVICES (Backend, Frontend, Bot)
echo ===================================================
echo.

echo 1. Starting Backend Server (Port 8003)...
start "Backend Server" cmd /k "call start_backend.bat"

echo 2. Starting Frontend Server (Port 3000)...
start "Frontend Server" cmd /k "call start_frontend.bat"

echo 3. Starting Telegram Bot...
start "Telegram Bot" cmd /k "call start_bot.bat"

echo.
echo ===================================================
echo   ALL SERVICES STARTED IN NEW WINDOWS
echo ===================================================
echo.
echo Please do not close this window immediately if you want to see this message.
echo You can minimize this window.
echo.
pause
