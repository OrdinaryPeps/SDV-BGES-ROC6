@echo off
title Restarter - Bot SDV V2
echo ====================================
echo   RESTARTING ALL SERVICES
echo ====================================
echo.

echo [1/2] Stopping any running node/python processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM uvicorn.exe >nul 2>&1

echo.
echo [2/2] Starting All Services...
call start_all.bat

echo.
echo ====================================
echo   RESTART COMPLETE
echo ====================================
echo.
pause
