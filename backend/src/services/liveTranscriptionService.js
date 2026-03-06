const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

/**
 * Live Transcription Service
 * Processes audio chunks in real-time and emits transcripts via Socket.IO
 */

/**
 * Get Python executable path
 */
function getPythonExecutable() {
    if (process.env.PYTHON_EXECUTABLE) {
        return process.env.PYTHON_EXECUTABLE;
    }
    
    const venvPython = path.join(__dirname, '..', '..', 'myenv', 'Scripts', 'python.exe');
    if (fs.existsSync(venvPython)) {
        return venvPython;
    }
    
    return 'python';
}

/**
 * Live Transcription Processor
 * Buffers audio chunks and transcribes them periodically
 */
class LiveTranscriptionProcessor {
    constructor(meetingId, socketEmitFn, options = {}) {
        this.meetingId = meetingId;
        this.emitFn = socketEmitFn;
        this.options = {
            modelSize: options.modelSize || 'tiny',  // Use tiny/base for real-time
            chunkDuration: options.chunkDuration || 5,  // Seconds of audio to buffer
            language: options.language || null,
            enableSpeakerID: options.enableSpeakerID !== false
        };
        
        this.audioBuffer = [];
        this.chunkCounter = 0;
        this.isProcessing = false;
        this.tempDir = path.join(os.tmpdir(), `live_transcript_${meetingId}`);
        this.allSegments = [];  // Store all segments for speaker tracking
        
        // Create temp directory
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        
        console.log(`[Live Transcription] Initialized for meeting ${meetingId}`);
        console.log(`[Live Transcription] Model: ${this.options.modelSize}, Chunk duration: ${this.options.chunkDuration}s`);
    }
    
    /**
     * Add audio chunk to buffer
     */
    addChunk(audioChunk) {
        this.audioBuffer.push(audioChunk);
        
        // Check if we have enough data to transcribe
        // Estimate: ~10KB per second of WebM audio (stereo, 48kHz)
        const totalBytes = this.audioBuffer.reduce((sum, chunk) => sum + chunk.length, 0);
        const estimatedSeconds = totalBytes / (10 * 1024);
        
        if (estimatedSeconds >= this.options.chunkDuration && !this.isProcessing) {
            this.processBuffer();
        }
    }
    
    /**
     * Process buffered audio chunks
     */
    async processBuffer() {
        if (this.audioBuffer.length === 0 || this.isProcessing) {
            return;
        }
        
        this.isProcessing = true;
        this.chunkCounter++;
        
        try {
            // Combine audio chunks
            const audioData = Buffer.concat(this.audioBuffer);
            this.audioBuffer = [];  // Clear buffer
            
            // Save to temporary file
            const chunkPath = path.join(this.tempDir, `chunk_${this.chunkCounter}.webm`);
            fs.writeFileSync(chunkPath, audioData);
            
            const size = (audioData.length / 1024).toFixed(1);
            console.log(`[Live Transcription] Processing chunk ${this.chunkCounter} (${size} KB)`);
            
            // Emit processing status
            this.emitFn(this.meetingId, 'transcribing', {
                message: 'Transcribing audio...',
                chunk: this.chunkCounter
            });
            
            // Transcribe
            const result = await this.transcribeChunk(chunkPath);
            
            // Check if we have meaningful speech (not just punctuation or noise)
            const transcript = result.transcript?.trim() || '';
            const wordCount = transcript.split(/\s+/).filter(w => w.length > 1).length;
            const hasRealSpeech = wordCount >= 3 && transcript.length > 10;
            
            if (result.success && hasRealSpeech) {
                const preview = transcript.length > 100 ? transcript.substring(0, 100) + '...' : transcript;
                console.log(`[Live Transcription] Chunk ${this.chunkCounter}: "${preview}"`);
                console.log(`[Live Transcription] Words: ${wordCount}, Segments: ${result.segments?.length || 0}, Language: ${result.metadata?.language || 'unknown'}`);
                
                // Emit transcript
                this.emitFn(this.meetingId, 'transcript', {
                    chunk: this.chunkCounter,
                    transcript: transcript,
                    segments: result.segments,
                    timestamp: new Date().toISOString(),
                    language: result.metadata?.language
                });
                
                // Store segments for speaker identification
                if (result.segments) {
                    this.allSegments.push(...result.segments);
                }
            } else {
                const reason = !result.success ? 'error' : 
                              !transcript ? 'empty' : 
                              wordCount < 3 ? `only ${wordCount} words` : 
                              'too short';
                console.log(`[Live Transcription] Chunk ${this.chunkCounter}: No speech detected (${reason}, ${result.segments?.length || 0} segments)`);
            }
            
            // Clean up chunk file
            try {
                fs.unlinkSync(chunkPath);
            } catch (e) {}
            
        } catch (error) {
            console.error(`[Live Transcription] Error processing chunk ${this.chunkCounter}:`, error.message);
            this.emitFn(this.meetingId, 'transcript-error', {
                message: error.message,
                chunk: this.chunkCounter
            });
        } finally {
            this.isProcessing = false;
        }
    }
    
    /**
     * Transcribe audio chunk using Faster-Whisper
     */
    async transcribeChunk(audioPath) {
        return new Promise((resolve, reject) => {
            const pythonExe = getPythonExecutable();
            const scriptPath = path.join(__dirname, 'transcribe_audio.py');
            
            // For live transcription: disable VAD, force English language
            const args = [
                scriptPath,
                audioPath,
                this.options.modelSize,
                'auto',
                'en',  // Force English to avoid wrong language detection on short clips
                'false'  // Disable VAD for live chunks
            ];
            
            let stdout = '';
            let stderr = '';
            
            const pythonProcess = spawn(pythonExe, args, {
                cwd: path.dirname(scriptPath)
            });
            
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Transcription failed: ${stderr}`));
                } else {
                    try {
                        const result = JSON.parse(stdout);
                        resolve(result);
                    } catch (parseError) {
                        reject(new Error(`Failed to parse transcription output: ${parseError.message}`));
                    }
                }
            });
            
            pythonProcess.on('error', (error) => {
                reject(new Error(`Failed to start transcription: ${error.message}`));
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Transcription timeout'));
            }, 30000);
        });
    }
    
    /**
     * Process final buffer and cleanup
     */
    async finalize() {
        console.log(`[Live Transcription] Finalizing for meeting ${this.meetingId}`);
        
        // Process any remaining buffer
        if (this.audioBuffer.length > 0) {
            await this.processBuffer();
        }
        
        // Wait for any ongoing processing
        while (this.isProcessing) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Emit completion
        this.emitFn(this.meetingId, 'transcription-complete', {
            totalChunks: this.chunkCounter,
            totalSegments: this.allSegments.length
        });
        
        // Clean up temp directory
        try {
            if (fs.existsSync(this.tempDir)) {
                fs.rmSync(this.tempDir, { recursive: true, force: true });
            }
        } catch (e) {
            console.error(`[Live Transcription] Failed to clean up temp dir:`, e.message);
        }
        
        console.log(`[Live Transcription] Finalized. Processed ${this.chunkCounter} chunks`);
    }
}

/**
 * Create a live transcription processor for a meeting
 */
function createLiveTranscriber(meetingId, socketEmitFn, options = {}) {
    return new LiveTranscriptionProcessor(meetingId, socketEmitFn, options);
}

module.exports = {
    createLiveTranscriber,
    LiveTranscriptionProcessor
};
