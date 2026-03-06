const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { createClient } = require('@deepgram/sdk');
const speakerDiarizationService = require('./speakerDiarizationService');

/**
 * Dual-Mode Transcription Service
 * 
 * LIVE MODE (During Meeting):
 * - Faster-Whisper (GPU-accelerated) for real-time transcription
 * - SpeechBrain ECAPA-TDNN for real-time speaker identification
 * - Low latency, fully local processing
 * 
 * POST-MEETING MODE (After Meeting Ends):
 * - Deepgram API for high-quality full transcription
 * - Assembly AI for accurate speaker diarization
 * - Cloud-based, highest accuracy
 */

/**
 * Get Python executable path from environment
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
 * LIVE MODE: Transcribe audio using Faster-Whisper + SpeechBrain
 * Used for real-time transcription during meetings
 * 
 * @param {string} audioPath - Path to the audio file
 * @param {function} onProgress - Callback for progress updates
 * @param {boolean} enableSpeakerDiarization - Enable speaker identification (default: true)
 * @param {string} modelSize - Whisper model: tiny, base, small, medium, large-v3 (default: base)
 * @param {string} language - Language code or null for auto-detection
 * @returns {Promise<Object>} - Transcript with speaker information
 */
async function transcribeLive(audioPath, onProgress = () => { }, enableSpeakerDiarization = true, modelSize = 'base', language = null) {
    try {
        onProgress('starting', 'Starting live transcription with Faster-Whisper...');

        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        const fileSize = fs.statSync(audioPath).size;
        console.log(`[Live Transcription] Processing: ${path.basename(audioPath)} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

        onProgress('loading', 'Loading Faster-Whisper model...');

        const pythonExe = getPythonExecutable();
        const scriptPath = path.join(__dirname, 'transcribe_audio.py');

        const args = [scriptPath, audioPath, modelSize, 'auto'];
        if (language) {
            args.push(language);
        }

        console.log(`[Live Transcription] Model: ${modelSize}, Device: GPU/CPU auto`);

        onProgress('transcribing', 'Live transcription in progress...');

        // Run Faster-Whisper transcription
        const transcriptionResult = await new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';

            const pythonProcess = spawn(pythonExe, args, {
                cwd: path.dirname(scriptPath)
            });

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                const message = data.toString();
                stderr += message;

                if (message.includes('Loading audio') || message.includes('Converting')) {
                    onProgress('loading', 'Loading audio...');
                } else if (message.includes('Starting transcription')) {
                    onProgress('transcribing', 'Transcribing...');
                } else if (message.includes('Processing')) {
                    onProgress('transcribing', 'Processing segments...');
                }

                console.log(`[Live Transcription] ${message.trim()}`);
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Transcription failed: ${stderr}`));
                } else {
                    try {
                        resolve(JSON.parse(stdout));
                    } catch (parseError) {
                        reject(new Error(`Failed to parse output: ${parseError.message}`));
                    }
                }
            });

            pythonProcess.on('error', (error) => {
                reject(new Error(`Failed to start transcription: ${error.message}`));
            });
        });

        if (!transcriptionResult.success) {
            throw new Error(transcriptionResult.error || 'Transcription failed');
        }

        console.log(`[Live Transcription] ✅ Transcript: ${transcriptionResult.transcript.length} chars`);
        console.log(`[Live Transcription] Language: ${transcriptionResult.metadata.language}`);
        console.log(`[Live Transcription] Device: ${transcriptionResult.metadata.device}`);

        const response = {
            transcript: transcriptionResult.transcript.trim(),
            segments: transcriptionResult.segments || [],
            metadata: transcriptionResult.metadata || {},
            speakerSegments: [],
            speakerStats: {},
            totalSpeakers: 0,
            mode: 'live'
        };

        // SpeechBrain speaker identification for live mode
        if (enableSpeakerDiarization && response.segments.length > 0) {
            try {
                onProgress('diarizing', 'Identifying speakers (SpeechBrain)...');
                console.log('[Live Transcription] Running SpeechBrain speaker identification...');

                const speakerScriptPath = path.join(__dirname, 'speaker_identification.py');
                const segmentsJson = JSON.stringify({ segments: response.segments });

                const speakerResult = await new Promise((resolve, reject) => {
                    let stdout = '';
                    let stderr = '';

                    const pythonProcess = spawn(pythonExe, [speakerScriptPath, audioPath, segmentsJson], {
                        cwd: path.dirname(speakerScriptPath)
                    });

                    pythonProcess.stdout.on('data', (data) => {
                        stdout += data.toString();
                    });

                    pythonProcess.stderr.on('data', (data) => {
                        stderr += data.toString();
                        console.log(`[Speaker ID] ${data.toString().trim()}`);
                    });

                    pythonProcess.on('close', (code) => {
                        if (code !== 0) {
                            reject(new Error(`Speaker identification failed: ${stderr}`));
                        } else {
                            try {
                                resolve(JSON.parse(stdout));
                            } catch (parseError) {
                                reject(new Error(`Failed to parse speaker output: ${parseError.message}`));
                            }
                        }
                    });

                    pythonProcess.on('error', (error) => {
                        reject(new Error(`Failed to start speaker identification: ${error.message}`));
                    });
                });

                if (speakerResult.success) {
                    response.speakerSegments = speakerResult.segments;
                    response.speakerStats = speakerResult.speaker_stats;
                    response.totalSpeakers = speakerResult.total_speakers;

                    console.log(`[Live Transcription] ✅ Speakers identified: ${response.totalSpeakers}`);
                }
            } catch (speakerError) {
                console.warn('[Live Transcription] Speaker identification failed:', speakerError.message);
            }
        }

        onProgress('completed', 'Live transcription complete!');
        return response;

    } catch (error) {
        console.error('[Live Transcription] Error:', error.message);
        onProgress('error', error.message);
        throw error;
    }
}

/**
 * POST-MEETING MODE: Transcribe using Deepgram + Assembly AI
 * Used for final high-quality transcription after meeting ends
 * 
 * @param {string} audioPath - Path to the audio file
 * @param {function} onProgress - Callback for progress updates
 * @param {boolean} enableSpeakerDiarization - Enable speaker identification (default: true)
 * @returns {Promise<Object>} - Transcript with speaker information
 */
async function transcribePostMeeting(audioPath, onProgress = () => { }, enableSpeakerDiarization = true) {
    try {
        onProgress('starting', 'Starting post-meeting transcription with Deepgram...');

        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        const fileSize = fs.statSync(audioPath).size;
        console.log(`[Post-Meeting] Processing: ${path.basename(audioPath)} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

        // Check Deepgram API key
        const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
        if (!deepgramApiKey) {
            throw new Error('DEEPGRAM_API_KEY not configured');
        }

        onProgress('uploading', 'Sending to Deepgram API...');

        const audioBuffer = fs.readFileSync(audioPath);
        const fileSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
        console.log(`[Post-Meeting] Audio file size: ${fileSizeMB} MB`);

        const ext = path.extname(audioPath).toLowerCase();
        const mimeTypes = {
            '.webm': 'audio/webm',
            '.wav': 'audio/wav',
            '.mp3': 'audio/mpeg',
            '.m4a': 'audio/mp4',
            '.ogg': 'audio/ogg',
            '.flac': 'audio/flac'
        };
        const mimetype = mimeTypes[ext] || 'audio/webm';

        const deepgram = createClient(deepgramApiKey);

        onProgress('transcribing', 'Deepgram is transcribing...');

        console.log(`[Post-Meeting] Sending to Deepgram (${mimetype})...`);

        // Add timeout and retry logic
        let result, error;
        let retries = 3;

        while (retries > 0) {
            try {
                const response = await deepgram.listen.prerecorded.transcribeFile(
                    audioBuffer,
                    {
                        model: 'nova-2',
                        language: 'en',
                        smart_format: true,
                        punctuate: true,
                        paragraphs: true,
                        diarize: true,
                        utterances: true,
                        mimetype: mimetype,
                        timeout: 120000 // 2 minutes timeout
                    }
                );

                result = response.result;
                error = response.error;

                // If successful, break the loop
                if (result && !error) {
                    break;
                }

                // If there's an error but we have retries left
                if (error && retries > 1) {
                    console.log(`[Post-Meeting] Retry ${4 - retries}/3 due to error:`, error.message);
                    retries--;
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
                    continue;
                }

                break;
            } catch (err) {
                error = err;
                if (retries > 1) {
                    console.log(`[Post-Meeting] Retry ${4 - retries}/3 due to exception:`, err.message);
                    retries--;
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    break;
                }
            }
        }

        if (error) {
            console.error('[Post-Meeting] Deepgram error:', error);
            const errorMsg = error.message || JSON.stringify(error) || 'Unknown error';

            // Check for specific error types
            if (errorMsg.includes('SLOW_UPLOAD') || errorMsg.includes('timeout')) {
                throw new Error(`Upload timeout: File too large (${fileSizeMB} MB) or slow connection. Try with a smaller file.`);
            }

            throw new Error(`Deepgram error: ${errorMsg}`);
        }

        console.log('[Post-Meeting] Deepgram response:', JSON.stringify(result, null, 2));

        const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

        if (!transcript || transcript.trim().length === 0) {
            console.error('[Post-Meeting] No transcript in response. Full result:', JSON.stringify(result, null, 2));
            throw new Error('No transcript returned from Deepgram. The audio file may be empty, corrupted, or contain no speech.');
        }

        console.log(`[Post-Meeting] ✅ Transcript: ${transcript.length} chars`);

        const response = {
            transcript: transcript.trim(),
            speakerSegments: [],
            speakerStats: {},
            totalSpeakers: 0,
            mode: 'post-meeting'
        };

        // Assembly AI speaker diarization for post-meeting mode
        if (enableSpeakerDiarization && speakerDiarizationService.checkAssemblyAIConfigured()) {
            try {
                onProgress('diarizing', 'Identifying speakers (Assembly AI)...');
                console.log('[Post-Meeting] Running Assembly AI speaker diarization...');

                const diarizationResult = await speakerDiarizationService.diarizeAudio(
                    audioPath,
                    (status, message) => {
                        console.log(`[Assembly AI] ${status}: ${message}`);
                        onProgress('diarizing', message);
                    }
                );

                if (diarizationResult.success) {
                    response.speakerSegments = diarizationResult.segments;
                    response.speakerStats = diarizationResult.speaker_stats;
                    response.totalSpeakers = diarizationResult.total_speakers;
                    response.transcript = diarizationResult.full_transcript || response.transcript;

                    console.log(`[Post-Meeting] ✅ Speakers identified: ${response.totalSpeakers}`);
                }
            } catch (diarizationError) {
                console.warn('[Post-Meeting] Assembly AI diarization failed:', diarizationError.message);
            }
        } else if (enableSpeakerDiarization) {
            console.warn('[Post-Meeting] ASSEMBLYAI_API_KEY not configured');
        }

        onProgress('completed', 'Post-meeting transcription complete!');
        return response;

    } catch (error) {
        console.error('[Post-Meeting] Error:', error.message);
        onProgress('error', error.message);
        throw error;
    }
}

/**
 * Main transcription function with mode selection
 * 
 * @param {string} audioPath - Path to audio file
 * @param {function} onProgress - Callback for progress updates
 * @param {boolean} enableSpeakerDiarization - Enable speaker identification
 * @param {Object} options - Additional options
 * @param {string} options.mode - 'live' or 'post-meeting' (default: 'live')
 * @param {string} options.modelSize - Whisper model size for live mode
 * @param {string} options.language - Language code for live mode
 * @returns {Promise<Object>} - Transcript with speaker information
 */
async function transcribeAudio(audioPath, onProgress = () => { }, enableSpeakerDiarization = true, options = {}) {
    const mode = options.mode || 'live';

    if (mode === 'post-meeting') {
        return transcribePostMeeting(audioPath, onProgress, enableSpeakerDiarization);
    } else {
        const modelSize = options.modelSize || 'base';
        const language = options.language || null;
        return transcribeLive(audioPath, onProgress, enableSpeakerDiarization, modelSize, language);
    }
}

/**
 * Check if services are configured
 */
function checkServicesConfigured() {
    return {
        live: {
            whisper: fs.existsSync(path.join(__dirname, 'transcribe_audio.py')),
            speechbrain: fs.existsSync(path.join(__dirname, 'speaker_identification.py'))
        },
        postMeeting: {
            deepgram: !!process.env.DEEPGRAM_API_KEY,
            assemblyAI: speakerDiarizationService.checkAssemblyAIConfigured()
        }
    };
}

/**
 * Get service information
 */
function getServiceInfo() {
    return {
        modes: {
            live: {
                transcription: 'Faster-Whisper (GPU-accelerated)',
                speakerDiarization: 'SpeechBrain ECAPA-TDNN',
                location: 'Local',
                latency: 'Low'
            },
            postMeeting: {
                transcription: 'Deepgram API',
                speakerDiarization: 'Assembly AI',
                location: 'Cloud',
                accuracy: 'Highest'
            }
        },
        configured: checkServicesConfigured()
    };
}

module.exports = {
    transcribeAudio,
    transcribeLive,
    transcribePostMeeting,
    checkServicesConfigured,
    getServiceInfo
};
