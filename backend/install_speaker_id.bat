@echo off
REM Windows Installation Script for Speaker Identification Setup

echo ========================================
echo Speaker Identification Setup
echo ========================================
echo.

REM Check if Python is installed
echo Checking for Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

python --version
echo.

REM Check if pip is available
echo Checking for pip...
pip --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] pip is not available
    echo Please reinstall Python with pip included
    pause
    exit /b 1
)
echo pip is available
echo.

REM Install Python dependencies
echo Installing Python dependencies...
echo This may take several minutes...
echo.
pip install -r requirements.txt

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to install dependencies
    echo Try running manually: pip install -r requirements.txt
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.

REM Run environment test
echo Running environment tests...
echo.
python test_environment.py

echo.
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Get Hugging Face token from: https://huggingface.co/settings/tokens
echo 2. Accept model license at: https://huggingface.co/pyannote/speaker-diarization-3.1
echo 3. Add HUGGINGFACE_TOKEN to your .env file
echo 4. Restart your backend server
echo.
echo For detailed instructions, see SPEAKER_IDENTIFICATION_SETUP.md
echo.
pause
