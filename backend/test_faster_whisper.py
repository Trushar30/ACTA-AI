#!/usr/bin/env python3
"""
Test script for Faster-Whisper GPU-accelerated transcription
Tests the transcription service with a sample audio file
"""

import os
import sys
import json
import subprocess
import time

def check_gpu_available():
    """Check if GPU is available for transcription"""
    print("="*60)
    print("GPU Availability Check")
    print("="*60)
    
    try:
        import torch
        print(f"✅ PyTorch installed: {torch.__version__}")
        
        if torch.cuda.is_available():
            print(f"✅ CUDA available: {torch.version.cuda}")
            print(f"✅ GPU detected: {torch.cuda.get_device_name(0)}")
            print(f"   GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
            return True
        else:
            print("⚠️  CUDA not available - will use CPU")
            return False
    except ImportError:
        print("❌ PyTorch not installed")
        return False
    except Exception as e:
        print(f"❌ Error checking GPU: {e}")
        return False

def check_faster_whisper():
    """Check if faster-whisper is installed"""
    print("\n" + "="*60)
    print("Faster-Whisper Installation Check")
    print("="*60)
    
    try:
        from faster_whisper import WhisperModel
        print("✅ faster-whisper is installed")
        return True
    except ImportError:
        print("❌ faster-whisper not installed")
        print("   Install with: pip install faster-whisper")
        return False

def get_python_executable():
    """Get the Python executable path"""
    # 1. Check environment variable
    python_exe = os.environ.get('PYTHON_EXECUTABLE')
    
    # 2. Try to read from .env file
    if not python_exe:
        env_path = os.path.join(os.path.dirname(__file__), '.env')
        if os.path.exists(env_path):
            with open(env_path, 'r') as f:
                for line in f:
                    if line.startswith('PYTHON_EXECUTABLE='):
                        python_exe = line.split('=', 1)[1].strip()
                        break
    
    # 3. Try virtual environment
    if not python_exe:
        venv_python = os.path.join(os.path.dirname(__file__), 'myenv', 'Scripts', 'python.exe')
        if os.path.exists(venv_python):
            python_exe = venv_python
    
    # 4. Fall back to system python
    if not python_exe:
        python_exe = 'python'
    
    return python_exe

def test_transcription(audio_file_path, model_size='base'):
    """
    Test transcription on an audio file
    
    Args:
        audio_file_path: Path to the audio file
        model_size: Whisper model size (tiny, base, small, medium, large-v3)
    """
    print("\n" + "="*60)
    print("Faster-Whisper Transcription Test")
    print("="*60)
    print(f"\nAudio File: {audio_file_path}")
    print(f"Model Size: {model_size}")
    
    # Check if file exists
    if not os.path.exists(audio_file_path):
        print(f"\n❌ Error: Audio file not found: {audio_file_path}")
        return False
    
    # Get file size
    file_size_mb = os.path.getsize(audio_file_path) / (1024 * 1024)
    print(f"File Size: {file_size_mb:.2f} MB")
    
    try:
        # Path to transcription script
        script_path = os.path.join(os.path.dirname(__file__), 'src', 'services', 'transcribe_audio.py')
        
        if not os.path.exists(script_path):
            print(f"\n❌ Error: Script not found: {script_path}")
            return False
        
        # Get Python executable
        python_exe = get_python_executable()
        print(f"\nUsing Python: {python_exe}")
        print(f"Script: {script_path}")
        print("\nStarting transcription...\n")
        print("-"*60)
        
        # Run the transcription script
        start_time = time.time()
        
        result = subprocess.run(
            [python_exe, script_path, audio_file_path, model_size, 'auto'],
            capture_output=True,
            text=True
        )
        
        elapsed_time = time.time() - start_time
        
        print("-"*60)
        print(f"\nElapsed Time: {elapsed_time:.2f} seconds")
        
        if result.returncode == 0:
            # Parse JSON output
            try:
                output = json.loads(result.stdout)
            except json.JSONDecodeError:
                print("\n❌ Failed to parse JSON output:")
                print(result.stdout)
                return False
            
            if output.get('success'):
                print("\n" + "="*60)
                print("✅ SUCCESS!")
                print("="*60)
                
                # Display metadata
                metadata = output.get('metadata', {})
                print(f"\n📊 Transcription Metadata:")
                print(f"   Language: {metadata.get('language', 'unknown')} ({metadata.get('language_probability', 0):.2%})")
                print(f"   Duration: {metadata.get('duration', 0):.2f}s")
                print(f"   Model: {metadata.get('model_size', 'unknown')}")
                print(f"   Device: {metadata.get('device', 'unknown')}")
                print(f"   Compute Type: {metadata.get('compute_type', 'unknown')}")
                print(f"   Total Segments: {metadata.get('total_segments', 0)}")
                
                # Display transcript
                transcript = output.get('transcript', '')
                print(f"\n📝 Transcript ({len(transcript)} characters):")
                print("-"*60)
                print(transcript[:500] + ('...' if len(transcript) > 500 else ''))
                print("-"*60)
                
                # Display performance metrics
                audio_duration = metadata.get('duration', 0)
                if audio_duration > 0:
                    rtf = elapsed_time / audio_duration
                    print(f"\n⚡ Performance Metrics:")
                    print(f"   Audio Duration: {audio_duration:.2f}s")
                    print(f"   Processing Time: {elapsed_time:.2f}s")
                    print(f"   Real-Time Factor: {rtf:.2f}x")
                    
                    if rtf < 1.0:
                        print(f"   🚀 Faster than real-time! ({1/rtf:.2f}x speed)")
                    elif rtf < 2.0:
                        print(f"   ✅ Good performance")
                    else:
                        print(f"   ⚠️  Slower than expected")
                
                # Display first 5 segments with timestamps
                segments = output.get('segments', [])
                if segments:
                    print(f"\n📍 First 5 Segments with Timestamps:")
                    print("-"*60)
                    for i, segment in enumerate(segments[:5]):
                        start = segment.get('start', 0)
                        end = segment.get('end', 0)
                        text = segment.get('text', '')
                        print(f"[{start:.2f}s - {end:.2f}s] {text}")
                
                return True
            else:
                print("\n❌ Transcription failed:")
                print(output.get('error', 'Unknown error'))
                return False
        else:
            print(f"\n❌ Script execution failed (exit code {result.returncode}):")
            print("\nStderr:")
            print(result.stderr)
            if result.stdout:
                print("\nStdout:")
                print(result.stdout)
            return False
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test function"""
    print("\n" + "="*60)
    print("🎙️  Faster-Whisper GPU Transcription Test Suite")
    print("="*60)
    
    # Run checks
    gpu_available = check_gpu_available()
    whisper_installed = check_faster_whisper()
    
    if not whisper_installed:
        print("\n❌ Cannot run tests: faster-whisper not installed")
        print("Install dependencies with: pip install -r requirements.txt")
        sys.exit(1)
    
    # Get audio file from command line or use default
    if len(sys.argv) > 1:
        audio_file = sys.argv[1]
    else:
        # Look for sample audio files in recordings directory
        recordings_dir = os.path.join(os.path.dirname(__file__), 'recordings')
        if os.path.exists(recordings_dir):
            audio_files = [f for f in os.listdir(recordings_dir) 
                          if f.endswith(('.wav', '.mp3', '.m4a', '.webm'))]
            if audio_files:
                audio_file = os.path.join('backend\recordings\695b9e515eace70b3a75c608.webm')
                print(f"\n📁 Using sample audio file: {audio_files[0]}")
            else:
                print("\n❌ No audio files found in recordings directory")
                print("Usage: python test_faster_whisper.py <audio_file_path>")
                sys.exit(1)
        else:
            print("\n❌ No audio file specified")
            print("Usage: python test_faster_whisper.py <audio_file_path>")
            sys.exit(1)
    
    # Get model size from command line or use default
    model_size = sys.argv[2] if len(sys.argv) > 2 else 'base'
    
    # Run transcription test
    success = test_transcription(audio_file, model_size)
    
    # Final summary
    print("\n" + "="*60)
    print("Test Summary")
    print("="*60)
    print(f"GPU Available: {'✅ Yes' if gpu_available else '⚠️  No (using CPU)'}")
    print(f"Faster-Whisper: {'✅ Installed' if whisper_installed else '❌ Not installed'}")
    print(f"Transcription: {'✅ Success' if success else '❌ Failed'}")
    print("="*60)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
