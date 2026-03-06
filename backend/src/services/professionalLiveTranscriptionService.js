const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

/**
 * Professional Live Transcription Service
 * 
 * Features:
 * - Sentence-based transcription aggregation
 * - Smart interim/final result handling
 * - API-ready hooks for external integrations
 * - Context-aware transcript management
 * - Duplicate prevention and text cleanup
 */

class ProfessionalLiveTranscriber {
    constructor(meetingId, apiKey, options = {}) {
        this.meetingId = meetingId;
        this.apiKey = apiKey;
        this.isConnected = false;
        this.connection = null;
        
        // Configuration
        this.config = {
            model: options.model || 'nova-2',
            language: options.language || 'en',
            utteranceEndMs: options.utteranceEndMs || 1500,
            interimResults: options.interimResults !== false,
            smartFormat: options.smartFormat !== false,
            punctuate: options.punctuate !== false,
            diarize: options.diarize || false,
            ...options
        };

        // Transcript management
        this.transcriptBuffer = {
            current: '',              // Current building sentence
            sentences: [],            // Complete sentences
            fullTranscript: '',       // All text accumulated
            lastFinalText: '',        // Last final transcript received
            lastInterimText: '',      // Last interim transcript received
            pendingSentence: ''       // Sentence being built from multiple finals
        };

        // Metadata tracking
        this.metadata = {
            startTime: null,
            totalWords: 0,
            totalSentences: 0,
            averageConfidence: 0,
            confidenceScores: []
        };

        // API Integration hooks (user-configurable)
        this.hooks = {
            onSentenceComplete: null,     // Called when a sentence is finalized
            onTranscriptUpdate: null,     // Called on every transcript update
            onUtteranceEnd: null,         // Called when speaker finishes
            onError: null                 // Called on errors
        };

        console.log('[Professional Live Transcription] Initialized for meeting:', meetingId);
    }

    /**
     * Register callback hooks for API integration
     */
    registerHooks(hooks = {}) {
        this.hooks = { ...this.hooks, ...hooks };
        console.log('[Professional Live Transcription] Hooks registered:', Object.keys(hooks));
    }

    /**
     * Connect to Deepgram streaming service
     */
    async connect() {
        try {
            const deepgram = createClient(this.apiKey);

            // Create streaming connection
            this.connection = deepgram.listen.live({
                model: this.config.model,
                language: this.config.language,
                smart_format: this.config.smartFormat,
                interim_results: this.config.interimResults,
                utterance_end_ms: this.config.utteranceEndMs,
                vad_events: true,
                punctuate: this.config.punctuate,
                diarize: this.config.diarize,
                encoding: 'linear16',
                sample_rate: 16000,
                channels: 1
            });

            // Setup event handlers
            this.setupEventHandlers();

            this.isConnected = true;
            this.metadata.startTime = new Date();
            
            console.log('[Professional Live Transcription] ✅ Connected to Deepgram');
            this.emitToFrontend('live-transcript-status', {
                status: 'connected',
                message: 'Professional live transcription active',
                config: this.config
            });

        } catch (error) {
            console.error('[Professional Live Transcription] Connection failed:', error);
            this.isConnected = false;
            if (this.hooks.onError) {
                await this.hooks.onError(error);
            }
            throw error;
        }
    }

    /**
     * Setup Deepgram event handlers
     */
    setupEventHandlers() {
        // Connection opened
        this.connection.on(LiveTranscriptionEvents.Open, () => {
            console.log('[Professional Live Transcription] Stream opened');
        });

        // Main transcript handler
        this.connection.on(LiveTranscriptionEvents.Transcript, async (data) => {
            await this.handleTranscript(data);
        });

        // Utterance end (speaker finished speaking)
        this.connection.on(LiveTranscriptionEvents.UtteranceEnd, async (data) => {
            await this.handleUtteranceEnd(data);
        });

        // Speech started
        this.connection.on(LiveTranscriptionEvents.SpeechStarted, () => {
            console.log('[Professional Live Transcription] 🎤 Speech started');
        });

        // Metadata
        this.connection.on(LiveTranscriptionEvents.Metadata, (data) => {
            console.log('[Professional Live Transcription] Metadata:', {
                requestId: data.request_id,
                model: data.model_info
            });
        });

        // Errors
        this.connection.on(LiveTranscriptionEvents.Error, async (error) => {
            console.error('[Professional Live Transcription] Error:', error);
            this.emitToFrontend('live-transcript-error', {
                message: error.message || 'Transcription error'
            });
            
            if (this.hooks.onError) {
                await this.hooks.onError(error);
            }
        });

        // Connection closed
        this.connection.on(LiveTranscriptionEvents.Close, () => {
            this.isConnected = false;
            console.log('[Professional Live Transcription] Connection closed');
            this.emitToFrontend('live-transcript-status', {
                status: 'disconnected',
                message: 'Live transcription ended',
                summary: this.getSummary()
            });
        });
    }

    /**
     * Handle incoming transcript data
     */
    async handleTranscript(data) {
        try {
            const transcript = data.channel?.alternatives?.[0];
            if (!transcript?.transcript) return;

            const text = transcript.transcript.trim();
            if (!text) return;

            const isFinal = data.is_final;
            const confidence = transcript.confidence || 0;

            // Track confidence
            if (isFinal && confidence > 0) {
                this.metadata.confidenceScores.push(confidence);
                this.metadata.averageConfidence = 
                    this.metadata.confidenceScores.reduce((a, b) => a + b, 0) / 
                    this.metadata.confidenceScores.length;
            }

            if (isFinal) {
                await this.processFinalTranscript(text, confidence);
            } else {
                await this.processInterimTranscript(text, confidence);
            }

            // Call update hook
            if (this.hooks.onTranscriptUpdate) {
                await this.hooks.onTranscriptUpdate({
                    text,
                    isFinal,
                    confidence,
                    fullTranscript: this.transcriptBuffer.fullTranscript,
                    currentSentence: this.transcriptBuffer.current,
                    metadata: this.getMetadata()
                });
            }

        } catch (error) {
            console.error('[Professional Live Transcription] Error handling transcript:', error);
        }
    }

    /**
     * Process final transcript results
     */
    async processFinalTranscript(text, confidence) {
        console.log(`[Professional Live Transcription] ✅ FINAL: "${text}" (confidence: ${(confidence * 100).toFixed(1)}%)`);

        // Prevent duplicate final results
        if (this.transcriptBuffer.lastFinalText === text) {
            console.log('[Professional Live Transcription] Skipping duplicate final transcript');
            return;
        }

        this.transcriptBuffer.lastFinalText = text;
        this.transcriptBuffer.lastInterimText = ''; // Clear interim

        // Check if this completes a sentence
        const endsWithPunctuation = /[.!?]$/.test(text);
        
        if (this.transcriptBuffer.pendingSentence) {
            // Append to pending sentence
            this.transcriptBuffer.pendingSentence += ' ' + text;
        } else {
            this.transcriptBuffer.pendingSentence = text;
        }

        // If sentence is complete, finalize it
        if (endsWithPunctuation) {
            await this.finalizeSentence(this.transcriptBuffer.pendingSentence, confidence);
            this.transcriptBuffer.pendingSentence = '';
        }

        // Update current building text
        this.transcriptBuffer.current = this.transcriptBuffer.pendingSentence;

        // Emit to frontend
        this.emitToFrontend('live-transcript-final', {
            text: text,
            fullText: this.transcriptBuffer.fullTranscript + ' ' + this.transcriptBuffer.current,
            confidence,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Process interim transcript results
     */
    async processInterimTranscript(text, confidence) {
        // Only log occasional interim updates to reduce noise
        if (Math.random() < 0.1) {
            console.log(`[Professional Live Transcription] ⏳ Interim: "${text.substring(0, 50)}..."`);
        }

        this.transcriptBuffer.lastInterimText = text;

        // Show interim as current building text
        const preview = this.transcriptBuffer.pendingSentence 
            ? this.transcriptBuffer.pendingSentence + ' ' + text
            : text;

        this.transcriptBuffer.current = preview;

        // Emit to frontend (throttled)
        if (Math.random() < 0.3) { // Only emit 30% of interim results to reduce load
            this.emitToFrontend('live-transcript-interim', {
                text: text,
                currentSentence: preview,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Finalize a complete sentence
     */
    async finalizeSentence(sentence, confidence) {
        const cleanSentence = sentence.trim();
        if (!cleanSentence) return;

        console.log(`[Professional Live Transcription] 📝 SENTENCE COMPLETE: "${cleanSentence}"`);

        // Add to sentences array
        const sentenceObject = {
            text: cleanSentence,
            confidence,
            timestamp: new Date().toISOString(),
            wordCount: cleanSentence.split(/\s+/).length
        };

        this.transcriptBuffer.sentences.push(sentenceObject);
        
        // Update full transcript
        if (this.transcriptBuffer.fullTranscript) {
            this.transcriptBuffer.fullTranscript += ' ' + cleanSentence;
        } else {
            this.transcriptBuffer.fullTranscript = cleanSentence;
        }

        // Update metadata
        this.metadata.totalSentences++;
        this.metadata.totalWords += sentenceObject.wordCount;

        // Emit sentence completion
        this.emitToFrontend('live-transcript-sentence', {
            sentence: sentenceObject,
            fullTranscript: this.transcriptBuffer.fullTranscript,
            sentenceNumber: this.metadata.totalSentences,
            metadata: this.getMetadata()
        });

        // Call sentence complete hook - PERFECT FOR API CALLS
        if (this.hooks.onSentenceComplete) {
            try {
                await this.hooks.onSentenceComplete({
                    sentence: sentenceObject,
                    fullTranscript: this.transcriptBuffer.fullTranscript,
                    allSentences: this.transcriptBuffer.sentences,
                    metadata: this.getMetadata()
                });
            } catch (error) {
                console.error('[Professional Live Transcription] Error in onSentenceComplete hook:', error);
            }
        }
    }

    /**
     * Handle utterance end (speaker finished)
     */
    async handleUtteranceEnd(data) {
        console.log('[Professional Live Transcription] 🔚 Utterance ended');

        // Finalize any pending sentence
        if (this.transcriptBuffer.pendingSentence) {
            await this.finalizeSentence(this.transcriptBuffer.pendingSentence, 0.9);
            this.transcriptBuffer.pendingSentence = '';
            this.transcriptBuffer.current = '';
        }

        // Call utterance end hook
        if (this.hooks.onUtteranceEnd) {
            try {
                await this.hooks.onUtteranceEnd({
                    fullTranscript: this.transcriptBuffer.fullTranscript,
                    lastSentences: this.transcriptBuffer.sentences.slice(-3), // Last 3 sentences
                    metadata: this.getMetadata()
                });
            } catch (error) {
                console.error('[Professional Live Transcription] Error in onUtteranceEnd hook:', error);
            }
        }

        this.emitToFrontend('live-transcript-utterance-end', {
            message: 'Speaker finished',
            fullTranscript: this.transcriptBuffer.fullTranscript
        });
    }

    /**
     * Send audio data to Deepgram
     */
    sendAudio(pcmBuffer) {
        if (this.isConnected && this.connection) {
            try {
                this.connection.send(pcmBuffer);
            } catch (error) {
                console.error('[Professional Live Transcription] Error sending audio:', error.message);
            }
        }
    }

    /**
     * Get current metadata
     */
    getMetadata() {
        return {
            totalWords: this.metadata.totalWords,
            totalSentences: this.metadata.totalSentences,
            averageConfidence: this.metadata.averageConfidence,
            duration: this.metadata.startTime 
                ? Math.floor((Date.now() - this.metadata.startTime) / 1000) 
                : 0
        };
    }

    /**
     * Get summary of transcription session
     */
    getSummary() {
        return {
            fullTranscript: this.transcriptBuffer.fullTranscript,
            sentences: this.transcriptBuffer.sentences,
            metadata: this.getMetadata(),
            config: this.config
        };
    }

    /**
     * Get full transcript
     */
    getFullTranscript() {
        return this.transcriptBuffer.fullTranscript;
    }

    /**
     * Get all sentences
     */
    getAllSentences() {
        return this.transcriptBuffer.sentences;
    }

    /**
     * Get current building sentence
     */
    getCurrentSentence() {
        return this.transcriptBuffer.current;
    }

    /**
     * Close connection and finalize
     */
    async close() {
        if (this.connection) {
            try {
                // Finalize any pending content
                if (this.transcriptBuffer.pendingSentence) {
                    await this.finalizeSentence(this.transcriptBuffer.pendingSentence, 0.9);
                }

                this.connection.finish();
                this.isConnected = false;
                
                const summary = this.getSummary();
                console.log('[Professional Live Transcription] ✅ Session finalized');
                console.log(`  - Total sentences: ${summary.metadata.totalSentences}`);
                console.log(`  - Total words: ${summary.metadata.totalWords}`);
                console.log(`  - Average confidence: ${(summary.metadata.averageConfidence * 100).toFixed(1)}%`);
                console.log(`  - Duration: ${summary.metadata.duration}s`);
                
                return summary;
            } catch (error) {
                console.error('[Professional Live Transcription] Error closing connection:', error);
                throw error;
            }
        }
        return this.getSummary();
    }

    /**
     * Emit events to frontend via Socket.IO
     */
    emitToFrontend(event, data) {
        if (global.io) {
            global.io.emit(event, { 
                meetingId: this.meetingId.toString(), 
                ...data 
            });
        }
    }
}

/**
 * Factory function to create a professional live transcriber
 */
function createProfessionalLiveTranscriber(meetingId, apiKey, options = {}) {
    return new ProfessionalLiveTranscriber(meetingId, apiKey, options);
}

module.exports = {
    ProfessionalLiveTranscriber,
    createProfessionalLiveTranscriber
};
