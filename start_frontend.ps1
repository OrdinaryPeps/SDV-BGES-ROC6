# Script untuk menjalankan FRONTEND
# Jalankan script ini di PowerShell/Terminal

# Masuk ke folder frontend
Set-Location -Path "$PSScriptRoot\frontend"

# Jalankan development server
Write-Host "🔄 Starting Frontend Development Server..." -ForegroundColor Cyan
Write-Host "🚀 Frontend akan berjalan di http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Tekan CTRL+C untuk berhenti" -ForegroundColor Red
Write-Host ""

npm start
