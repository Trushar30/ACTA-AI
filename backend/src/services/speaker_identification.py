#!/usr/bin/env python3
"""
Real-time Speaker Identification using SpeechBrain ECAPA-TDNN

This service provides real-time speaker identification for live transcription
using SpeechBrain's ECAPA-TDNN model for speaker embeddings.

Features:
- GPU-accelerated speaker embedding extraction
- Real-time speaker clustering
- Speaker enrollment from audio samples
- Cosine similarity-based speaker matching
- Low latency suitable for live transcription
"""

# Fix OpenMP library conflict (MUST be set before importing any libraries)
import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

import sys
import json
import warnings
import tempfile
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import numpy as np

# Suppress warnings
warnings.filterwarnings('ignore')

try:
    import torch
    import torchaudio
    from speechbrain.pretrained import EncoderClassifier
except ImportError as e:
    print(json.dumps({
        "success": False,
        "error": f"Required library not installed: {str(e)}. Install with: pip install speechbrain torch torchaudio"
    }))
    sys.exit(1)


class SpeakerIdentifier:
    """
    Real-time speaker identification using SpeechBrain ECAPA-TDNN
    """
    
    def __init__(self, device: str = "auto", similarity_threshold: float = 0.75):
        """
        Initialize the speaker identifier
        
        Args:
            device: Device to use ("cuda", "cpu", or "auto")
            similarity_threshold: Cosine similarity threshold for speaker matching (0.0-1.0)
        """
        # Auto-detect device
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"
        
        self.device = device
        self.similarity_threshold = similarity_threshold
        self.speaker_embeddings = {}  # Store known speaker embeddings
        self.speaker_labels = {}  # Map speaker IDs to labels
        self.next_speaker_id = 0
        
        print(f"⚙️  Initializing SpeechBrain ECAPA-TDNN...", file=sys.stderr)
        print(f"   Device: {device}", file=sys.stderr)
        print(f"   Similarity Threshold: {similarity_threshold}", file=sys.stderr)
        
        try:
            # Load pre-trained ECAPA-TDNN model for speaker recognition
            self.classifier = EncoderClassifier.from_hparams(
                source="speechbrain/spkrec-ecapa-voxceleb",
                savedir="pretrained_models/spkrec-ecapa-voxceleb",
                run_opts={"device": device}
            )
            print(f"✅ ECAPA-TDNN model loaded successfully", file=sys.stderr)
        except Exception as e:
            print(f"❌ Error loading model: {e}", file=sys.stderr)
            raise
    
    def extract_embedding(self, audio_path: str) -> np.ndarray:
        """
        Extract speaker embedding from audio file
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            numpy array: Speaker embedding vector
        """
        try:
            # Load audio
            signal, fs = torchaudio.load(audio_path)
            
            # Resample to 16kHz if needed (ECAPA-TDNN expects 16kHz)
            if fs != 16000:
                resampler = torchaudio.transforms.Resample(fs, 16000)
                signal = resampler(signal)
            
            # Convert to mono if stereo
            if signal.shape[0] > 1:
                signal = torch.mean(signal, dim=0, keepdim=True)
            
            # Extract embedding
            with torch.no_grad():
                embedding = self.classifier.encode_batch(signal)
                embedding = embedding.squeeze().cpu().numpy()
            
            # Normalize embedding
            embedding = embedding / np.linalg.norm(embedding)
            
            return embedding
            
        except Exception as e:
            print(f"❌ Error extracting embedding: {e}", file=sys.stderr)
            raise
    
    def extract_embeddings_from_segments(
        self, 
        audio_path: str, 
        segments: List[Dict]
    ) -> List[Tuple[Dict, np.ndarray]]:
        """
        Extract embeddings for each segment with timestamps
        
        Args:
            audio_path: Path to full audio file
            segments: List of segments with start/end times and text
            
        Returns:
            List of (segment, embedding) tuples
        """
        results = []
        
        try:
            # Load full audio
            full_audio, fs = torchaudio.load(audio_path)
            
            # Resample to 16kHz if needed
            if fs != 16000:
                resampler = torchaudio.transforms.Resample(fs, 16000)
                full_audio = resampler(full_audio)
                fs = 16000
            
            # Convert to mono if stereo
            if full_audio.shape[0] > 1:
                full_audio = torch.mean(full_audio, dim=0, keepdim=True)
            
            for segment in segments:
                start_sample = int(segment['start'] * fs)
                end_sample = int(segment['end'] * fs)
                
                # Extract segment audio
                segment_audio = full_audio[:, start_sample:end_sample]
                
                # Skip very short segments (< 0.5 seconds)
                if segment_audio.shape[1] < fs * 0.5:
                    continue
                
                # Extract embedding
                with torch.no_grad():
                    embedding = self.classifier.encode_batch(segment_audio)
                    embedding = embedding.squeeze().cpu().numpy()
                
                # Normalize
                embedding = embedding / np.linalg.norm(embedding)
                
                results.append((segment, embedding))
            
            return results
            
        except Exception as e:
            print(f"❌ Error extracting segment embeddings: {e}", file=sys.stderr)
            raise
    
    def cosine_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings"""
        return float(np.dot(emb1, emb2))
    
    def identify_speaker(self, embedding: np.ndarray) -> Tuple[str, float]:
        """
        Identify speaker from embedding
        
        Args:
            embedding: Speaker embedding vector
            
        Returns:
            (speaker_id, confidence): Speaker ID and confidence score
        """
        if not self.speaker_embeddings:
            # First speaker
            speaker_id = f"SPEAKER_{self.next_speaker_id}"
            self.next_speaker_id += 1
            self.speaker_embeddings[speaker_id] = [embedding]
            return speaker_id, 1.0
        
        # Compare with known speakers
        best_match = None
        best_score = 0.0
        
        for speaker_id, embeddings in self.speaker_embeddings.items():
            # Calculate average similarity with all embeddings of this speaker
            similarities = [self.cosine_similarity(embedding, emb) for emb in embeddings]
            avg_similarity = np.mean(similarities)
            
            if avg_similarity > best_score:
                best_score = avg_similarity
                best_match = speaker_id
        
        # Check if best match is above threshold
        if best_score >= self.similarity_threshold:
            # Add to existing speaker's embeddings
            self.speaker_embeddings[best_match].append(embedding)
            return best_match, best_score
        else:
            # New speaker
            speaker_id = f"SPEAKER_{self.next_speaker_id}"
            self.next_speaker_id += 1
            self.speaker_embeddings[speaker_id] = [embedding]
            return speaker_id, 1.0
    
    def diarize_segments(
        self, 
        audio_path: str, 
        transcription_segments: List[Dict]
    ) -> Dict:
        """
        Perform speaker diarization on transcription segments
        
        Args:
            audio_path: Path to audio file
            transcription_segments: List of segments from Whisper with start/end times and text
            
        Returns:
            dict: Segments with speaker labels and statistics
        """
        try:
            print(f"\n📁 Processing: {Path(audio_path).name}", file=sys.stderr)
            print(f"🎙️  Analyzing {len(transcription_segments)} segments...", file=sys.stderr)
            
            # Extract embeddings for all segments
            segment_embeddings = self.extract_embeddings_from_segments(
                audio_path, 
                transcription_segments
            )
            
            # Identify speakers for each segment
            labeled_segments = []
            speaker_stats = {}
            
            for segment, embedding in segment_embeddings:
                speaker_id, confidence = self.identify_speaker(embedding)
                
                # Add speaker info to segment
                labeled_segment = {
                    "speaker": speaker_id,
                    "start": segment['start'],
                    "end": segment['end'],
                    "duration": segment['end'] - segment['start'],
                    "text": segment.get('text', ''),
                    "confidence": confidence
                }
                
                labeled_segments.append(labeled_segment)
                
                # Update statistics
                if speaker_id not in speaker_stats:
                    speaker_stats[speaker_id] = {
                        "total_time": 0,
                        "segment_count": 0
                    }
                
                speaker_stats[speaker_id]["total_time"] += labeled_segment["duration"]
                speaker_stats[speaker_id]["segment_count"] += 1
            
            result = {
                "success": True,
                "segments": labeled_segments,
                "speaker_stats": speaker_stats,
                "total_speakers": len(speaker_stats)
            }
            
            print(f"\n✅ Speaker identification complete!", file=sys.stderr)
            print(f"   Speakers identified: {len(speaker_stats)}", file=sys.stderr)
            print(f"   Segments processed: {len(labeled_segments)}", file=sys.stderr)
            
            return result
            
        except Exception as e:
            error_msg = f"Speaker identification error: {str(e)}"
            print(f"\n❌ {error_msg}", file=sys.stderr)
            
            return {
                "success": False,
                "error": error_msg
            }


def main():
    """
    CLI entry point
    
    Usage:
        python speaker_identification.py <audio_path> <segments_json>
    
    Examples:
        python speaker_identification.py audio.wav '{"segments": [{"start": 0, "end": 2.5, "text": "Hello"}]}'
    """
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python speaker_identification.py <audio_path> <segments_json>"
        }))
        sys.exit(1)
    
    audio_path = sys.argv[1]
    
    try:
        segments_data = json.loads(sys.argv[2])
        segments = segments_data.get('segments', [])
    except json.JSONDecodeError as e:
        print(json.dumps({
            "success": False,
            "error": f"Invalid JSON for segments: {e}"
        }))
        sys.exit(1)
    
    # Initialize speaker identifier
    identifier = SpeakerIdentifier(
        device="auto",
        similarity_threshold=0.75
    )
    
    # Perform speaker diarization
    result = identifier.diarize_segments(audio_path, segments)
    
    # Output JSON result
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
