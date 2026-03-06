# ====================================================================
# AUTOMATED SETUP SCRIPT FOR LIVE TRANSCRIPTION
# ====================================================================
# This script installs all dependencies for the dual-mode transcription system
# Run this after cloning the repository

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  ZOOM AUDIO - LIVE TRANSCRIPTION SETUP" -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

$ErrorActionPreference = "Continue"

# Check if in backend directory
if (-not (Test-Path "requirements.txt")) {
    Write-Host "❌ Error: Please run this script from the backend directory" -ForegroundColor Red
    Write-Host "   cd backend" -ForegroundColor Yellow
    Write-Host "   ./install_live_transcription.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Checking prerequisites...`n" -ForegroundColor Yellow

# Check Python
Write-Host "🐍 Checking Python installation..." -ForegroundColor Cyan
try {
    $pythonVersion = python --version 2>&1
    Write-Host "   ✅ $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Python not found! Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Check CUDA (optional)
Write-Host "`n🎮 Checking GPU/CUDA availability..." -ForegroundColor Cyan
try {
    $cudaCheck = nvidia-smi 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ NVIDIA GPU detected!" -ForegroundColor Green
        $hasGPU = $true
    } else {
        Write-Host "   ⚠️  No NVIDIA GPU detected - will use CPU" -ForegroundColor Yellow
        $hasGPU = $false
    }
} catch {
    Write-Host "   ⚠️  No NVIDIA GPU detected - will use CPU" -ForegroundColor Yellow
    $hasGPU = $false
}

# Install PyTorch
Write-Host "`n📦 Installing PyTorch...`n" -ForegroundColor Cyan

if ($hasGPU) {
    Write-Host "   Installing CUDA-enabled PyTorch..." -ForegroundColor Yellow
    $choice = Read-Host "   Which CUDA version? (1=CUDA 12.1, 2=CUDA 11.8, 3=CPU only) [1]"
    
    switch ($choice) {
        "2" {
            Write-Host "   Installing PyTorch with CUDA 11.8..." -ForegroundColor Green
            python -m pip install torch==2.3.0+cu118 torchaudio==2.3.0+cu118 --index-url https://download.pytorch.org/whl/cu118
        }
        "3" {
            Write-Host "   Installing CPU-only PyTorch..." -ForegroundColor Green
            python -m pip install torch==2.3.0 torchaudio==2.3.0
        }
        default {
            Write-Host "   Installing PyTorch with CUDA 12.1..." -ForegroundColor Green
            python -m pip install torch==2.3.0+cu121 torchaudio==2.3.0+cu121 --index-url https://download.pytorch.org/whl/cu121
        }
    }
} else {
    Write-Host "   Installing CPU-only PyTorch..." -ForegroundColor Green
    python -m pip install torch==2.3.0 torchaudio==2.3.0
}

# Install requirements
Write-Host "`n📦 Installing Python dependencies...`n" -ForegroundColor Cyan
python -m pip install -r requirements.txt

# Verify installations
Write-Host "`n🔍 Verifying installations...`n" -ForegroundColor Cyan

# Check torch
Write-Host "   Checking PyTorch..." -ForegroundColor Yellow
$torchCheck = python -c "import torch; print(f'PyTorch {torch.__version__}')" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ $torchCheck" -ForegroundColor Green
} else {
    Write-Host "   ❌ PyTorch installation failed!" -ForegroundColor Red
}

# Check faster-whisper
Write-Host "   Checking faster-whisper..." -ForegroundColor Yellow
$whisperCheck = python -c "import faster_whisper; print('faster-whisper installed')" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ $whisperCheck" -ForegroundColor Green
} else {
    Write-Host "   ❌ faster-whisper installation failed!" -ForegroundColor Red
}

# Check speechbrain
Write-Host "   Checking SpeechBrain..." -ForegroundColor Yellow
$speechbrainCheck = python -c "import speechbrain; print(f'SpeechBrain {speechbrain.__version__}')" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ $speechbrainCheck" -ForegroundColor Green
} else {
    Write-Host "   ❌ SpeechBrain installation failed!" -ForegroundColor Red
}

# Check CUDA availability in Python
Write-Host "`n   Checking CUDA in PyTorch..." -ForegroundColor Yellow
$cudaAvailable = python -c "import torch; print('CUDA available' if torch.cuda.is_available() else 'CUDA not available')" 2>&1
if ($cudaAvailable -match "CUDA available") {
    Write-Host "   ✅ $cudaAvailable" -ForegroundColor Green
    $gpuName = python -c "import torch; print(torch.cuda.get_device_name(0)) if torch.cuda.is_available() else print('')" 2>&1
    Write-Host "   🎮 GPU: $gpuName" -ForegroundColor Cyan
} else {
    Write-Host "   ⚠️  $cudaAvailable (CPU mode)" -ForegroundColor Yellow
}

# Run tests
Write-Host "`n🧪 Running tests...`n" -ForegroundColor Cyan

$runTests = Read-Host "   Run installation tests? (Y/n) [Y]"
if ($runTests -ne "n" -and $runTests -ne "N") {
    # Check for test audio
    if (Test-Path "recordings") {
        $audioFiles = Get-ChildItem "recordings\*.wav", "recordings\*.mp3", "recordings\*.webm" -ErrorAction SilentlyContinue
        if ($audioFiles.Count -gt 0) {
            $testAudio = $audioFiles[0].FullName
            Write-Host "   Using test audio: $($audioFiles[0].Name)" -ForegroundColor Cyan
            
            Write-Host "`n   Testing Faster-Whisper..." -ForegroundColor Yellow
            python test_faster_whisper.py "$testAudio"
            
            Write-Host "`n   Testing SpeechBrain..." -ForegroundColor Yellow
            python test_speechbrain.py "$testAudio"
        } else {
            Write-Host "   ⚠️  No audio files found in recordings/ directory" -ForegroundColor Yellow
            Write-Host "   Skipping tests. Add audio files and run:" -ForegroundColor Yellow
            Write-Host "      python test_faster_whisper.py path/to/audio.wav" -ForegroundColor Cyan
        }
    } else {
        Write-Host "   ⚠️  recordings/ directory not found" -ForegroundColor Yellow
        Write-Host "   Create it and add audio files, then run:" -ForegroundColor Yellow
        Write-Host "      python test_faster_whisper.py path/to/audio.wav" -ForegroundColor Cyan
    }
}

# Setup complete
Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  ✅ INSTALLATION COMPLETE!" -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Green

Write-Host "📖 Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   1. Configure API keys (optional for post-meeting mode):" -ForegroundColor White
Write-Host "      Create backend/.env file with:" -ForegroundColor Gray
Write-Host "      DEEPGRAM_API_KEY=your_key_here" -ForegroundColor Gray
Write-Host "      ASSEMBLYAI_API_KEY=your_key_here" -ForegroundColor Gray
Write-Host ""
Write-Host "   2. Test live transcription:" -ForegroundColor White
Write-Host "      python test_faster_whisper.py audio.wav" -ForegroundColor Cyan
Write-Host ""
Write-Host "   3. Test speaker identification:" -ForegroundColor White
Write-Host "      python test_speechbrain.py audio.wav" -ForegroundColor Cyan
Write-Host ""
Write-Host "   4. Start your Node.js application:" -ForegroundColor White
Write-Host "      npm start" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - LIVE_TRANSCRIPTION_SETUP.md - Complete guide" -ForegroundColor White
Write-Host "   - ARCHITECTURE.md - System architecture" -ForegroundColor White
Write-Host "   - FASTER_WHISPER_SETUP.md - Whisper details" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Your dual-mode transcription system is ready!" -ForegroundColor Green
Write-Host ""
