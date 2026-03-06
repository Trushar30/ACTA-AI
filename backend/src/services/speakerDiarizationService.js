const { AssemblyAI } = require('assemblyai');
const fs = require('fs');

/**
 * Speaker Diarization Service using AssemblyAI
 * 
 * Features:
 * - Identifies who spoke when in audio recordings
 * - Returns speaker segments with timestamps
 * - Provides speaker statistics (total speaking time, segment count)
 * - Much simpler and more reliable than Python-based solutions
 */

/**
 * Perform speaker diarization on an audio file using AssemblyAI
 * @param {string} audioPath - Path to the audio file
 * @param {function} onProgress - Optional callback for progress updates
 * @returns {Promise<Object>} - Speaker segments and statistics
 */
async function diarizeAudio(audioPath, onProgress = () => {}) {
    try {
        onProgress('starting', 'Starting speaker identification...');

        // Check if file exists
        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        // Get AssemblyAI API key
        const apiKey = process.env.ASSEMBLYAI_API_KEY;
        if (!apiKey || apiKey === 'your_assemblyai_api_key_here') {
            throw new Error('ASSEMBLYAI_API_KEY not configured. Get your API key from https://www.assemblyai.com/');
        }

        // Initialize AssemblyAI client
        const client = new AssemblyAI({ apiKey });

        console.log(`[Speaker Diarization] Processing: ${audioPath}`);
        onProgress('uploading', 'Uploading audio to AssemblyAI...');

        // Upload audio file and transcribe with speaker labels
        const transcript = await client.transcripts.transcribe({
            audio: audioPath,
            speaker_labels: true,
            // speakers_expected: 2, // Optional: uncomment if you know the number of speakers
        });

        if (transcript.status === 'error') {
            throw new Error(transcript.error);
        }

        onProgress('processing', 'Analyzing speaker patterns...');

        // Convert AssemblyAI utterances to our format
        const segments = [];
        const speakerStats = {};

        if (transcript.utterances && transcript.utterances.length > 0) {
            for (const utterance of transcript.utterances) {
                const speakerId = `SPEAKER_${utterance.speaker}`;
                const duration = (utterance.end - utterance.start) / 1000; // Convert ms to seconds

                segments.push({
                    speaker: speakerId,
                    start: utterance.start / 1000, // Convert ms to seconds
                    end: utterance.end / 1000,
                    duration: duration,
                    text: utterance.text,
                    confidence: utterance.confidence
                });

                // Update speaker stats
                if (!speakerStats[speakerId]) {
                    speakerStats[speakerId] = {
                        total_time: 0,
                        segment_count: 0
                    };
                }
                speakerStats[speakerId].total_time += duration;
                speakerStats[speakerId].segment_count += 1;
            }
        }

        const result = {
            success: true,
            segments,
            speaker_stats: speakerStats,
            total_speakers: Object.keys(speakerStats).length,
            full_transcript: transcript.text
        };

        console.log(`[Speaker Diarization] ✅ Found ${result.total_speakers} speakers in ${segments.length} segments`);
        onProgress('completed', `Identified ${result.total_speakers} speakers`);

        return result;

    } catch (error) {
        console.error('[Speaker Diarization] Error:', error.message);
        onProgress('error', error.message);
        throw error;
    }
}


/**
 * Merge speaker segments with transcript (for Deepgram compatibility)
 * Note: AssemblyAI already provides aligned transcript, so this is simplified
 * @param {Array} speakerSegments - Speaker diarization segments (from AssemblyAI)
 * @param {Object} deepgramResult - Deepgram transcript (not used with AssemblyAI)
 * @returns {Array} - Transcript segments with speaker labels
 */
function mergeSpeakersWithTranscript(speakerSegments, deepgramResult) {
    // AssemblyAI already provides aligned transcripts with speaker labels
    // Just return the segments as-is
    return speakerSegments;
}

/**
 * Check if AssemblyAI API key is configured
 */
function checkAssemblyAIConfigured() {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    return apiKey && apiKey !== 'your_assemblyai_api_key_here';
}

/**
 * Legacy function for backward compatibility
 */
async function checkPythonEnvironment() {
    return { 
        available: false, 
        error: 'Using AssemblyAI instead of Python-based diarization'
    };
}

/**
 * Legacy function for backward compatibility
 */
function checkHuggingFaceConfigured() {
    return false;
}

module.exports = {
    diarizeAudio,
    mergeSpeakersWithTranscript,
    checkPythonEnvironment,
    checkHuggingFaceConfigured,
    checkAssemblyAIConfigured
};

