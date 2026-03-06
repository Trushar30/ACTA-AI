#!/bin/bash
# Linux/Mac Installation Script for Speaker Identification Setup

echo "========================================"
echo "Speaker Identification Setup"
echo "========================================"
echo ""

# Check if Python is installed
echo "Checking for Python..."
if ! command -v python3 &> /dev/null; then
    echo "[ERROR] Python 3 is not installed"
    echo "Please install Python 3.8+ from https://www.python.org/downloads/"
    exit 1
fi

python3 --version
echo ""

# Check if pip is available
echo "Checking for pip..."
if ! command -v pip3 &> /dev/null; then
    echo "[ERROR] pip3 is not available"
    echo "Install with: sudo apt-get install python3-pip (Ubuntu/Debian)"
    echo "           or: brew install python3 (macOS)"
    exit 1
fi
echo "pip is available"
echo ""

# Install Python dependencies
echo "Installing Python dependencies..."
echo "This may take several minutes..."
echo ""
pip3 install -r requirements.txt

if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Failed to install dependencies"
    echo "Try running manually: pip3 install -r requirements.txt"
    exit 1
fi

echo ""
echo "========================================"
echo "Installation Complete!"
echo "========================================"
echo ""

# Run environment test
echo "Running environment tests..."
echo ""
python3 test_environment.py

echo ""
echo "========================================"
echo "Next Steps:"
echo "========================================"
echo "1. Get Hugging Face token from: https://huggingface.co/settings/tokens"
echo "2. Accept model license at: https://huggingface.co/pyannote/speaker-diarization-3.1"
echo "3. Add HUGGINGFACE_TOKEN to your .env file"
echo "4. Restart your backend server"
echo ""
echo "For detailed instructions, see SPEAKER_IDENTIFICATION_SETUP.md"
echo ""
