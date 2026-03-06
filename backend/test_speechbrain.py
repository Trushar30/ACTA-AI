#!/usr/bin/env python3
"""
Test script for SpeechBrain ECAPA-TDNN speaker identification
Tests real-time speaker identification on audio segments
"""

import os
import sys
import json
import time

def check_gpu_available():
    """Check if GPU is available"""
    print("="*60)
    print("GPU Availability Check")
    print("="*60)
    
    try:
        import torch
        print(f"✅ PyTorch installed: {torch.__version__}")
        
        if torch.cuda.is_available():
            print(f"✅ CUDA available: {torch.version.cuda}")
            print(f"✅ GPU detected: {torch.cuda.get_device_name(0)}")
            return True
        else:
            print("⚠️  CUDA not available - will use CPU")
            return False
    except ImportError:
        print("❌ PyTorch not installed")
        return False

def check_speechbrain():
    """Check if SpeechBrain is installed"""
    print("\n" + "="*60)
    print("SpeechBrain Installation Check")
    print("="*60)
    
    try:
        import speechbrain
        print(f"✅ SpeechBrain installed: {speechbrain.__version__}")
        return True
    except ImportError:
        print("❌ SpeechBrain not installed")
        print("   Install with: pip install speechbrain")
        return False

def test_speaker_identification(audio_file_path):
    """Test speaker identification on audio file"""
    print("\n" + "="*60)
    print("SpeechBrain ECAPA-TDNN Speaker Identification Test")
    print("="*60)
    print(f"\nAudio File: {audio_file_path}")
    
    if not os.path.exists(audio_file_path):
        print(f"\n❌ Error: Audio file not found: {audio_file_path}")
        return False
    
    file_size_mb = os.path.getsize(audio_file_path) / (1024 * 1024)
    print(f"File Size: {file_size_mb:.2f} MB")
    
    try:
        # Import speaker identification module
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src', 'services'))
        from speaker_identification import SpeakerIdentifier
        
        print("\n🎙️  Initializing SpeechBrain ECAPA-TDNN...")
        start_time = time.time()
        
        identifier = SpeakerIdentifier(device="auto", similarity_threshold=0.75)
        
        init_time = time.time() - start_time
        print(f"✅ Model loaded in {init_time:.2f}s")
        
        # Create mock segments for testing
        print("\n📝 Creating test segments...")
        test_segments = [
            {"start": 0.0, "end": 3.0, "text": "Hello, how are you?"},
            {"start": 3.5, "end": 6.0, "text": "I'm doing well, thank you!"},
            {"start": 6.5, "end": 9.0, "text": "That's great to hear."},
            {"start": 9.5, "end": 12.0, "text": "Yes, absolutely."}
        ]
        
        print(f"   Using {len(test_segments)} test segments")
        
        # Run speaker identification
        print("\n🔍 Analyzing speakers...")
        process_start = time.time()
        
        result = identifier.diarize_segments(audio_file_path, test_segments)
        
        process_time = time.time() - process_start
        
        if result.get('success'):
            print("\n" + "="*60)
            print("✅ SUCCESS!")
            print("="*60)
            
            print(f"\n📊 Speaker Identification Results:")
            print(f"   Total Speakers: {result.get('total_speakers', 0)}")
            print(f"   Labeled Segments: {len(result.get('segments', []))}")
            print(f"   Processing Time: {process_time:.2f}s")
            
            # Display speaker statistics
            speaker_stats = result.get('speaker_stats', {})
            if speaker_stats:
                print("\n" + "-"*60)
                print("Speaker Statistics:")
                print("-"*60)
                
                for speaker, stats in speaker_stats.items():
                    total_time = stats.get('total_time', 0)
                    segment_count = stats.get('segment_count', 0)
                    print(f"{speaker:12} | Time: {total_time:6.2f}s | Segments: {segment_count:3d}")
            
            # Display labeled segments
            segments = result.get('segments', [])
            if segments:
                print("\n" + "-"*60)
                print("Labeled Segments:")
                print("-"*60)
                
                for segment in segments:
                    speaker = segment.get('speaker', 'UNKNOWN')
                    start = segment.get('start', 0)
                    end = segment.get('end', 0)
                    text = segment.get('text', '')
                    confidence = segment.get('confidence', 0)
                    
                    print(f"[{start:.2f}s - {end:.2f}s] {speaker} ({confidence:.2%}): {text}")
            
            return True
        else:
            print("\n❌ Speaker identification failed:")
            print(result.get('error', 'Unknown error'))
            return False
            
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main test function"""
    print("\n" + "="*60)
    print("🎤 SpeechBrain ECAPA-TDNN Test Suite")
    print("="*60)
    
    # Run checks
    gpu_available = check_gpu_available()
    speechbrain_installed = check_speechbrain()
    
    if not speechbrain_installed:
        print("\n❌ Cannot run tests: SpeechBrain not installed")
        print("Install dependencies with: pip install -r requirements.txt")
        sys.exit(1)
    
    # Get audio file
    if len(sys.argv) > 1:
        audio_file = sys.argv[1]
    else:
        # Look for sample audio files
        recordings_dir = os.path.join(os.path.dirname(__file__), 'recordings')
        if os.path.exists(recordings_dir):
            audio_files = [f for f in os.listdir(recordings_dir) 
                          if f.endswith(('.wav', '.mp3', '.m4a', '.webm'))]
            if audio_files:
                audio_file = os.path.join(recordings_dir, audio_files[0])
                print(f"\n📁 Using sample audio file: {audio_files[0]}")
            else:
                print("\n❌ No audio files found in recordings directory")
                print("Usage: python test_speechbrain.py <audio_file_path>")
                sys.exit(1)
        else:
            print("\n❌ No audio file specified")
            print("Usage: python test_speechbrain.py <audio_file_path>")
            sys.exit(1)
    
    # Run test
    success = test_speaker_identification(audio_file)
    
    # Final summary
    print("\n" + "="*60)
    print("Test Summary")
    print("="*60)
    print(f"GPU Available: {'✅ Yes' if gpu_available else '⚠️  No (using CPU)'}")
    print(f"SpeechBrain: {'✅ Installed' if speechbrain_installed else '❌ Not installed'}")
    print(f"Speaker ID: {'✅ Success' if success else '❌ Failed'}")
    print("="*60)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
