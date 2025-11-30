@echo off
REM Script untuk menjalankan FRONTEND
REM Jalankan script ini di Command Prompt

echo ====================================
echo   STARTING FRONTEND SERVER
echo ====================================
echo.

cd /d "%~dp0frontend"

echo Starting Frontend Development Server...
echo.
echo Frontend Server: http://localhost:3000
echo.
echo Tekan CTRL+C untuk berhenti
echo.

call npm start

pause
