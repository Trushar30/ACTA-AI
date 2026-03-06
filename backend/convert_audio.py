"""
Simple script to convert WebM to WAV using pydub
Requires FFmpeg to be installed on the system
"""
import sys
import os
import json
from pathlib import Path

# Set UTF-8 encoding for Windows console
if os.name == 'nt':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except:
        pass

try:
    from pydub import AudioSegment
    
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python convert_audio.py <input_file>"
        }))
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = Path(input_file).with_suffix('.wav')
    
    # Log to stderr so stdout only contains JSON
    print(f"Converting {input_file} to {output_file}...", file=sys.stderr)
    
    # Load audio file
    audio = AudioSegment.from_file(input_file)
    
    # Export as WAV
    audio.export(output_file, format='wav')
    
    # Log to stderr
    print(f"[OK] Conversion successful: {output_file}", file=sys.stderr)
    print(f"Duration: {len(audio) / 1000:.2f} seconds", file=sys.stderr)
    
    # Output JSON result to stdout
    print(json.dumps({
        "success": True,
        "output_file": str(output_file),
        "duration_seconds": len(audio) / 1000
    }))
    
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "pydub not installed. Run: pip install pydub"
    }))
    sys.exit(1)
except FileNotFoundError as e:
    if 'ffmpeg' in str(e).lower() or 'avconv' in str(e).lower():
        print(json.dumps({
            "success": False,
            "error": "FFmpeg not found! Install from: https://www.gyan.dev/ffmpeg/builds/ or use: choco install ffmpeg"
        }))
    else:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
    sys.exit(1)
except Exception as e:
    print(json.dumps({
        "success": False,
        "error": str(e)
    }))
    sys.exit(1)
