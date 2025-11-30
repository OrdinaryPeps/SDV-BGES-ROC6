@echo off
REM Script untuk menjalankan BACKEND
REM Jalankan script ini di Command Prompt

echo ====================================
echo   STARTING BACKEND SERVER
echo ====================================
echo.

cd /d "%~dp0backend"

echo [1/2] Mengaktifkan virtual environment...
call venv\Scripts\activate.bat

echo [2/2] Menjalankan Backend Server...
echo.
echo Backend Server: http://localhost:8001
echo API Documentation: http://localhost:8001/docs
echo.
echo Tekan CTRL+C untuk berhenti
echo.

REM Gunakan Python dari venv untuk menjalankan uvicorn
venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload

pause
