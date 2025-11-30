# Script untuk menjalankan TELEGRAM BOT
# Jalankan script ini di PowerShell

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "   STARTING TELEGRAM BOT" -ForegroundColor Cyan
Write-Host "===================================="
Write-Host ""

# Set API URL ke port 8001 (sesuai backend)
$env:API_URL = "http://localhost:8001/api"

Write-Host "Bot akan terhubung ke: $env:API_URL" -ForegroundColor Green
Write-Host ""
Write-Host "Tekan CTRL+C untuk berhenti" -ForegroundColor Red
Write-Host ""

node bot_telegram_backend.js

