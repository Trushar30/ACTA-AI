#!/usr/bin/env python3
"""
Audio Transcription Service using Faster-Whisper with GPU acceleration

This service provides high-performance audio transcription using the faster-whisper library,
which is optimized for GPU inference using CTranslate2.

Features:
- GPU-accelerated transcription (CUDA support)
- Multiple model sizes (tiny, base, small, medium, large-v3)
- Word-level timestamps
- Language detection
- Automatic fallback to CPU if GPU not available
- VAD (Voice Activity Detection) filtering
- Progress callbacks for real-time updates
"""

# Fix OpenMP library conflict (MUST be set before importing any libraries)
import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

import sys
import json
import warnings
from pathlib import Path
from typing import Optional, Callable
import tempfile

# Suppress warnings
warnings.filterwarnings('ignore')

try:
    from faster_whisper import WhisperModel
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "faster-whisper not installed. Install with: pip install faster-whisper"
    }))
    sys.exit(1)


class FasterWhisperTranscriber:
    """
    Faster-Whisper based transcription service with GPU support
    """
    
    def __init__(
        self, 
        model_size: str = "base",
        device: str = "auto",
        compute_type: str = "auto"
    ):
        """
        Initialize the transcriber
        
        Args:
            model_size: Model size (tiny, base, small, medium, large-v3)
            device: Device to use ("cuda", "cpu", or "auto")
            compute_type: Computation precision ("float16", "int8", "auto")
        """
        self.model_size = model_size
        
        # Auto-detect device with cuDNN check
        if device == "auto":
            # Force CPU mode to avoid cuDNN issues
            # GPU requires cuDNN library which may not be installed
            device = "cpu"
            print("💻 Using CPU mode (avoiding cuDNN dependency)", file=sys.stderr)
            
            # Uncomment below to try GPU (requires cuDNN installed)
            # try:
            #     import torch
            #     if torch.cuda.is_available():
            #         device = "cuda"
            #         print(f"🎮 GPU detected: {torch.cuda.get_device_name(0)}", file=sys.stderr)
            #     else:
            #         device = "cpu"
            #         print("💻 Using CPU (no GPU available)", file=sys.stderr)
            # except:
            #     device = "cpu"
            #     print("💻 Using CPU (torch not available)", file=sys.stderr)
        
        # Auto-detect compute type based on device
        if compute_type == "auto":
            if device == "cuda":
                compute_type = "float16"  # Best for GPU
            else:
                compute_type = "int8"  # Best for CPU
        
        self.device = device
        self.compute_type = compute_type
        
        print(f"⚙️  Initializing Faster-Whisper...", file=sys.stderr)
        print(f"   Model: {model_size}", file=sys.stderr)
        print(f"   Device: {device}", file=sys.stderr)
        print(f"   Compute Type: {compute_type}", file=sys.stderr)
        
        # Load model with GPU fallback to CPU
        try:
            self.model = WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
                download_root=None,  # Use default cache directory
                local_files_only=False
            )
            print(f"✅ Model loaded successfully", file=sys.stderr)
        except Exception as e:
            # If GPU fails (e.g., missing cuDNN), fallback to CPU
            if device == "cuda":
                print(f"⚠️  GPU initialization failed: {str(e)[:100]}", file=sys.stderr)
                print(f"🔄 Falling back to CPU...", file=sys.stderr)
                self.device = "cpu"
                self.compute_type = "int8"
                try:
                    self.model = WhisperModel(
                        model_size,
                        device="cpu",
                        compute_type="int8",
                        download_root=None,
                        local_files_only=False
                    )
                    print(f"✅ Model loaded successfully on CPU", file=sys.stderr)
                except Exception as cpu_error:
                    print(f"❌ CPU fallback also failed: {cpu_error}", file=sys.stderr)
                    raise
            else:
                print(f"❌ Error loading model: {e}", file=sys.stderr)
                raise
    
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        task: str = "transcribe",
        vad_filter: bool = True,
        word_timestamps: bool = True,
        progress_callback: Optional[Callable] = None
    ) -> dict:
        """
        Transcribe audio file
        
        Args:
            audio_path: Path to audio file (supports WAV, MP3, M4A, WebM, etc.)
            language: Source language code (None for auto-detection)
            task: "transcribe" or "translate" (translate to English)
            vad_filter: Use Voice Activity Detection to filter silence
            word_timestamps: Include word-level timestamps
            progress_callback: Optional callback for progress updates
            
        Returns:
            dict: Transcription result with text, segments, and metadata
        """
        try:
            # Check if file exists
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Audio file not found: {audio_path}")
            
            file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
            print(f"\n📁 Processing: {Path(audio_path).name} ({file_size_mb:.2f} MB)", file=sys.stderr)
            
            if progress_callback:
                progress_callback("loading", "Loading audio file...")
            
            # Convert WebM to WAV if needed (Whisper works better with WAV)
            temp_wav = None
            original_path = audio_path
            if audio_path.lower().endswith('.webm'):
                try:
                    from pydub import AudioSegment
                    print("🔄 Converting WebM to WAV...", file=sys.stderr)
                    
                    temp_wav = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                    temp_wav.close()
                    
                    # Load WebM and convert to mono 16kHz WAV (optimal for Whisper)
                    audio = AudioSegment.from_file(audio_path, format='webm')
                    audio = audio.set_channels(1)  # Mono
                    audio = audio.set_frame_rate(16000)  # 16kHz
                    audio.export(temp_wav.name, format='wav', parameters=["-ac", "1", "-ar", "16000"])
                    audio_path = temp_wav.name
                    
                    print("✅ Conversion complete", file=sys.stderr)
                except Exception as e:
                    print(f"⚠️  WebM conversion failed: {str(e)[:100]}", file=sys.stderr)
                    # If conversion fails, try using original file
                    audio_path = original_path
                    if temp_wav:
                        try:
                            os.unlink(temp_wav.name)
                        except:
                            pass
                        temp_wav = None
            
            if progress_callback:
                progress_callback("transcribing", "Transcribing audio...")
            
            print(f"🎙️  Starting transcription...", file=sys.stderr)
            
            # Transcribe
            segments, info = self.model.transcribe(
                audio_path,
                language=language,
                task=task,
                vad_filter=vad_filter,
                word_timestamps=word_timestamps,
                beam_size=5,
                best_of=5,
                temperature=0.0
            )
            
            # Process segments
            all_segments = []
            full_text = []
            
            for i, segment in enumerate(segments):
                segment_data = {
                    "id": i,
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": segment.text.strip(),
                    "avg_logprob": round(segment.avg_logprob, 4),
                    "no_speech_prob": round(segment.no_speech_prob, 4)
                }
                
                # Add word-level timestamps if available
                if word_timestamps and hasattr(segment, 'words') and segment.words:
                    segment_data["words"] = [
                        {
                            "word": word.word,
                            "start": round(word.start, 2),
                            "end": round(word.end, 2),
                            "probability": round(word.probability, 4)
                        }
                        for word in segment.words
                    ]
                
                all_segments.append(segment_data)
                full_text.append(segment.text.strip())
                
                # Progress update every 10 segments
                if progress_callback and (i + 1) % 10 == 0:
                    progress_callback("processing", f"Processed {i + 1} segments...")
            
            # Clean up temp file
            if temp_wav:
                try:
                    os.unlink(temp_wav.name)
                except:
                    pass
            
            # Build result
            transcript_text = " ".join(full_text)
            
            result = {
                "success": True,
                "transcript": transcript_text,
                "segments": all_segments,
                "metadata": {
                    "language": info.language,
                    "language_probability": round(info.language_probability, 4),
                    "duration": round(info.duration, 2),
                    "model_size": self.model_size,
                    "device": self.device,
                    "compute_type": self.compute_type,
                    "total_segments": len(all_segments)
                }
            }
            
            print(f"\n✅ Transcription complete!", file=sys.stderr)
            print(f"   Language: {info.language} ({info.language_probability:.2%})", file=sys.stderr)
            print(f"   Duration: {info.duration:.2f}s", file=sys.stderr)
            print(f"   Segments: {len(all_segments)}", file=sys.stderr)
            print(f"   Characters: {len(transcript_text)}", file=sys.stderr)
            
            if progress_callback:
                progress_callback("complete", "Transcription complete!")
            
            return result
            
        except Exception as e:
            error_msg = f"Transcription error: {str(e)}"
            print(f"\n❌ {error_msg}", file=sys.stderr)
            
            if progress_callback:
                progress_callback("error", error_msg)
            
            return {
                "success": False,
                "error": error_msg
            }


def main():
    """
    CLI entry point
    
    Usage:
        python transcribe_audio.py <audio_path> [model_size] [device] [language] [vad_filter]
    
    Examples:
        python transcribe_audio.py audio.wav
        python transcribe_audio.py audio.wav large-v3 cuda en
        python transcribe_audio.py audio.webm medium auto null false
    """
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python transcribe_audio.py <audio_path> [model_size] [device] [language] [vad_filter]"
        }))
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"
    device = sys.argv[3] if len(sys.argv) > 3 else "auto"
    language = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != 'null' else None
    vad_filter = sys.argv[5].lower() != 'false' if len(sys.argv) > 5 else True
    
    # Initialize transcriber
    transcriber = FasterWhisperTranscriber(
        model_size=model_size,
        device=device,
        compute_type="auto"
    )
    
    # Transcribe - Use relaxed VAD for live/short chunks
    result = transcriber.transcribe(
        audio_path=audio_path,
        language=language,
        vad_filter=vad_filter,
        word_timestamps=True
    )
    
    # Output JSON result
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
