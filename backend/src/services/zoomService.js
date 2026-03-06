const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ZoomService {
    constructor() {
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Get OAuth access token using Server-to-Server OAuth
     */
    async getAccessToken() {
        // Return cached token if still valid
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        // Read credentials at request time (not constructor time)
        const accountId = process.env.ZOOM_ACCOUNT_ID;
        const clientId = process.env.ZOOM_CLIENT_ID;
        const clientSecret = process.env.ZOOM_CLIENT_SECRET;

        if (!accountId || !clientId || !clientSecret) {
            console.error('[ZoomService] Missing Zoom credentials in environment variables');
            throw new Error('Missing Zoom API credentials');
        }

        const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`;
        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        try {
            const response = await axios.post(tokenUrl, null, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this.accessToken = response.data.access_token;
            // Token expires in 1 hour, refresh 5 minutes early
            this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

            console.log('[ZoomService] Access token obtained successfully');
            return this.accessToken;
        } catch (error) {
            console.error('[ZoomService] Failed to get access token:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Zoom API');
        }
    }

    /**
     * List all cloud recordings for the authenticated user
     */
    async listRecordings(from = null, to = null) {
        const token = await this.getAccessToken();

        // Default to last 30 days
        const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = to || new Date().toISOString().split('T')[0];

        try {
            const response = await axios.get('https://api.zoom.us/v2/users/me/recordings', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                params: {
                    from: fromDate,
                    to: toDate,
                    page_size: 30
                }
            });

            console.log(`[ZoomService] Found ${response.data.total_records} recordings`);
            return response.data.meetings || [];
        } catch (error) {
            // Check if it's a scope error
            if (error.response?.data?.code === 4711) {
                console.log('[ZoomService] Missing required scopes for listing recordings.');
                console.log('[ZoomService] Your Zoom account may need to be upgraded to Pro/Business for this feature.');
                return []; // Return empty array instead of throwing
            }
            console.error('[ZoomService] Failed to list recordings:', error.response?.data || error.message);
            throw new Error('Failed to list recordings from Zoom');
        }
    }

    /**
     * Get recording details for a specific meeting
     */
    async getRecordingByMeetingId(meetingId) {
        const token = await this.getAccessToken();

        try {
            const response = await axios.get(`https://api.zoom.us/v2/meetings/${meetingId}/recordings`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                }
            });

            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                console.log(`[ZoomService] No recordings found for meeting ${meetingId}`);
                return null;
            }
            console.error('[ZoomService] Failed to get recording:', error.response?.data || error.message);
            throw new Error('Failed to get recording from Zoom');
        }
    }

    /**
     * Download a recording file
     */
    async downloadRecording(downloadUrl, savePath) {
        const token = await this.getAccessToken();

        try {
            // Zoom download URLs need the token appended
            const urlWithToken = `${downloadUrl}?access_token=${token}`;

            const response = await axios({
                method: 'get',
                url: urlWithToken,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(savePath);
            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`[ZoomService] Downloaded recording to ${savePath}`);
                    resolve(savePath);
                });
                writer.on('error', reject);
            });
        } catch (error) {
            console.error('[ZoomService] Failed to download recording:', error.message);
            throw new Error('Failed to download recording');
        }
    }

    /**
     * Find and download recordings for a meeting, return audio path and transcript
     */
    async fetchRecordingsForMeeting(zoomMeetingId, localMeetingId) {
        const recording = await this.getRecordingByMeetingId(zoomMeetingId);

        if (!recording || !recording.recording_files) {
            return { audioPath: null, transcript: null };
        }

        const recordingsDir = path.join(__dirname, '../../recordings');
        if (!fs.existsSync(recordingsDir)) {
            fs.mkdirSync(recordingsDir, { recursive: true });
        }

        let audioPath = null;
        let transcript = null;

        for (const file of recording.recording_files) {
            // Download audio file (mp4 or m4a)
            if ((file.file_type === 'MP4' || file.file_type === 'M4A') && file.download_url) {
                const ext = file.file_type.toLowerCase();
                const filePath = path.join(recordingsDir, `${localMeetingId}.${ext}`);
                await this.downloadRecording(file.download_url, filePath);
                audioPath = `/recordings/${localMeetingId}.${ext}`;
            }

            // Download transcript (VTT)
            if (file.file_type === 'TRANSCRIPT' && file.download_url) {
                const filePath = path.join(recordingsDir, `${localMeetingId}_transcript.vtt`);
                await this.downloadRecording(file.download_url, filePath);
                // Read transcript content
                transcript = fs.readFileSync(filePath, 'utf-8');
            }
        }

        // If no transcript file, check for audio_transcript
        if (!transcript && recording.recording_files) {
            const transcriptFile = recording.recording_files.find(f => f.recording_type === 'audio_transcript');
            if (transcriptFile && transcriptFile.download_url) {
                const filePath = path.join(recordingsDir, `${localMeetingId}_transcript.vtt`);
                await this.downloadRecording(transcriptFile.download_url, filePath);
                transcript = fs.readFileSync(filePath, 'utf-8');
            }
        }

        return { audioPath, transcript };
    }

    /**
     * Extract Zoom meeting ID from a meeting link
     */
    extractMeetingId(meetingLink) {
        // Handle various Zoom URL formats
        // https://us04web.zoom.us/j/12345678901?pwd=...
        // https://zoom.us/j/12345678901
        const match = meetingLink.match(/\/j\/(\d+)/);
        return match ? match[1] : null;
    }
}

module.exports = new ZoomService();
