const path = require('path');
const fs = require('fs');
const { createClient } = require('@deepgram/sdk');

/**
 * Live Transcription Service using Deepgram
 * Processes audio chunks in real-time and emits transcripts via Socket.IO
 */

/**
 * Live Transcription Processor with Deepgram
 */
class LiveTranscriptionProcessor {
    constructor(meetingId, socketEmitFn, options = {}) {
        this.meetingId = meetingId;
        this.emitFn = socketEmitFn;
        this.options = {
            chunkDuration: options.chunkDuration || 10,  // Seconds of audio to buffer
            language: options.language || 'en'
        };
        
        this.audioBuffer = [];
        this.chunkCounter = 0;
        this.isProcessing = false;
        this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
        
        console.log(`[Live Transcription] Initialized for meeting ${meetingId} (Deepgram)`);
        console.log(`[Live Transcription] Chunk duration: ${this.options.chunkDuration}s`);
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
     * Process buffered audio chunks using Deepgram
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
            
            const size = (audioData.length / 1024).toFixed(1);
            console.log(`[Live Transcription] Processing chunk ${this.chunkCounter} (${size} KB)`);
            
            // Emit processing status
            this.emitFn(this.meetingId, 'transcribing', {
                message: 'Transcribing audio...',
                chunk: this.chunkCounter
            });
            
            // Transcribe with Deepgram
            const result = await this.transcribeChunk(audioData);
            
            // Check if we have meaningful speech
            const transcript = result.transcript?.trim() || '';
            const wordCount = transcript.split(/\s+/).filter(w => w.length > 1).length;
            const hasRealSpeech = wordCount >= 2 && transcript.length > 5;
            
            if (result.success && hasRealSpeech) {
                const preview = transcript.length > 100 ? transcript.substring(0, 100) + '...' : transcript;
                console.log(`[Live Transcription] Chunk ${this.chunkCounter}: "${preview}"`);
                console.log(`[Live Transcription] Words: ${wordCount}, Confidence: ${result.confidence || 'N/A'}`);
                
                // Emit transcript
                this.emitFn(this.meetingId, 'transcript', {
                    chunk: this.chunkCounter,
                    transcript: transcript,
                    confidence: result.confidence,
                    timestamp: new Date().toISOString(),
                    language: this.options.language
                });
            } else {
                const reason = !result.success ? 'error' : 
                              !transcript ? 'empty' : 
                              wordCount < 2 ? `only ${wordCount} words` : 
                              'too short';
                console.log(`[Live Transcription] Chunk ${this.chunkCounter}: No speech detected (${reason})`);
            }
            
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
     * Transcribe audio chunk using Deepgram
     */
    async transcribeChunk(audioBuffer) {
        try {
            let result, error;
            let retries = 2; // Fewer retries for live transcription
            
            while (retries > 0) {
                try {
                    const response = await this.deepgram.listen.prerecorded.transcribeFile(
                        audioBuffer,
                        {
                            model: 'nova-2',
                            language: this.options.language,
                            smart_format: true,
                            punctuate: true,
                            utterances: false,
                            diarize: false,  // Disable for live chunks
                            timeout: 30000 // 30 seconds timeout for live chunks
                        }
                    );
                    
                    result = response.result;
                    error = response.error;
                    
                    if (result && !error) {
                        break;
                    }
                    
                    if (error && retries > 1) {
                        console.log(`[Live Transcription] Retry ${3 - retries}/2:`, error.message);
                        retries--;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                    
                    break;
                } catch (err) {
                    error = err;
                    if (retries > 1) {
                        retries--;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        break;
                    }
                }
            }

            if (error) {
                throw new Error(error.message || 'Deepgram transcription failed');
            }

            const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
            const confidence = result?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

            return {
                success: true,
                transcript: transcript,
                confidence: confidence
            };
        } catch (error) {
            console.error('[Live Transcription] Deepgram error:', error.message);
            return {
                success: false,
                transcript: '',
                error: error.message
            };
        }
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
            totalChunks: this.chunkCounter
        });
        
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
