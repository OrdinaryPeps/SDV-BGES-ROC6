@echo off
REM Script untuk menjalankan TELEGRAM BOT
REM Jalankan script ini di Command Prompt

echo ====================================
echo   STARTING TELEGRAM BOT
echo ====================================
echo.

REM Set API URL ke port 8001 (sesuai backend)
set API_URL=http://localhost:8001/api

echo Bot akan terhubung ke: %API_URL%
echo.
echo Tekan CTRL+C untuk berhenti
echo.

node bot_telegram_backend.js
pause

