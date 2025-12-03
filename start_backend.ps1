# Script untuk menjalankan BACKEND
# Jalankan script ini di PowerShell/Terminal

# Masuk ke folder backend
Set-Location -Path "$PSScriptRoot\backend"

# Aktifkan virtual environment
Write-Host "🔄 Mengaktifkan virtual environment..." -ForegroundColor Cyan
.\venv\Scripts\Activate.ps1

# Jalankan server
Write-Host "🚀 Menjalankan Backend Server di http://localhost:8004..." -ForegroundColor Green
Write-Host "📝 API Documentation: http://localhost:8004/docs" -ForegroundColor Yellow
Write-Host "" 
Write-Host "Tekan CTRL+C untuk berhenti" -ForegroundColor Red
Write-Host ""

uvicorn app.main:app --host 0.0.0.0 --port 8004 --reload
