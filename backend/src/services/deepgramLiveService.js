const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');

class DeepgramLiveTranscriber {
    constructor(meetingId, apiKey) {
        this.meetingId = meetingId;
        this.apiKey = apiKey;
        this.isConnected = false;
        this.connection = null;
        this.finalTranscripts = [];
        this.buffer = [];
        this.bufferTimeout = null;
    }

    async connect() {
        try {
            const deepgram = createClient(this.apiKey);

            // Create streaming connection with optimal settings
            this.connection = deepgram.listen.live({
                model: 'nova-2',
                language: 'en',
                smart_format: true,
                interim_results: true,
                utterance_end_ms: 1000,
                vad_events: true,
                encoding: 'linear16',
                sample_rate: 16000,
                channels: 1
            });

            // Handle connection open
            this.connection.on(LiveTranscriptionEvents.Open, () => {
                this.isConnected = true;
                console.log('[Deepgram Live] ✅ Connected to streaming API');
                this.emitToFrontend('live-transcript-status', {
                    status: 'connected',
                    message: 'Live transcription active'
                });
            });

            // Handle transcripts
            this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
                const transcript = data.channel?.alternatives?.[0];
                if (!transcript?.transcript) return;

                const text = transcript.transcript;
                const isFinal = data.is_final;

                console.log(`[Deepgram] ${isFinal ? '✅ Final' : '⏳ Interim'}: ${text}`);

                if (isFinal) {
                    this.finalTranscripts.push({
                        text,
                        timestamp: new Date().toISOString(),
                        confidence: transcript.confidence || 0
                    });
                }

                // Emit to frontend
                this.emitToFrontend('live-transcript', {
                    text,
                    isFinal,
                    confidence: transcript.confidence || 0,
                    timestamp: new Date().toISOString()
                });
            });

            // Handle metadata for additional info
            this.connection.on(LiveTranscriptionEvents.Metadata, (data) => {
                console.log('[Deepgram] Metadata:', data.metadata);
            });

            // Handle errors
            this.connection.on(LiveTranscriptionEvents.Error, (error) => {
                console.error('[Deepgram Live] Error:', error);
                this.emitToFrontend('live-transcript-status', {
                    status: 'error',
                    message: `Transcription error: ${error.message}`
                });
            });

            // Handle close
            this.connection.on(LiveTranscriptionEvents.Close, () => {
                this.isConnected = false;
                console.log('[Deepgram Live] Connection closed');
                this.emitToFrontend('live-transcript-status', {
                    status: 'disconnected',
                    message: 'Live transcription ended'
                });
            });

            // Handle speech started
            this.connection.on(LiveTranscriptionEvents.SpeechStarted, (data) => {
                console.log('[Deepgram] Speech started');
            });

        } catch (error) {
            console.error('[Deepgram Live] Connection failed:', error);
            this.isConnected = false;
            throw error;
        }
    }

    sendAudio(pcmBuffer) {
        if (this.isConnected && this.connection) {
            try {
                this.connection.send(pcmBuffer);
            } catch (error) {
                console.error('[Deepgram Live] Error sending audio:', error.message);
            }
        }
    }

    async close() {
        if (this.connection) {
            try {
                this.connection.finish();
                this.isConnected = false;
                console.log(`[Deepgram Live] ✅ Finalized with ${this.finalTranscripts.length} final transcripts`);
                return this.finalTranscripts;
            } catch (error) {
                console.error('[Deepgram Live] Error closing connection:', error);
            }
        }
    }

    emitToFrontend(event, data) {
        if (global.io) {
            global.io.emit(event, { meetingId: this.meetingId.toString(), ...data });
        }
    }

    getFinalTranscripts() {
        return this.finalTranscripts;
    }
}

module.exports = {
    createDeepgramLiveTranscriber: (meetingId, apiKey) => {
        return new DeepgramLiveTranscriber(meetingId, apiKey);
    }
};
