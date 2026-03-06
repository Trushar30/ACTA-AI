const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createDeepgramLiveTranscriber } = require('../services/deepgramLiveService');
const meetService = require('../services/meetService');
const { joinMSTeams, checkMeetingEnded: checkTeamsMeetingEnded } = require('./msteamsBot');
const User = require('../models/User');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const activeBots = new Map();

// Password decryption helper (matches server.js)
const ENCRYPTION_KEY = process.env.BOT_ENCRYPTION_KEY || 'default-key-please-change-in-production-32-chars-long!';
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

function decryptPassword(encryptedData) {
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// Detect platform from meeting link
function detectPlatform(link) {
    if (link.includes('zoom.us')) return 'zoom';
    if (link.includes('meet.google.com')) return 'google-meet';
    if (link.includes('teams.microsoft.com') || link.includes('teams.live.com')) return 'teams';
    return 'unknown';
}

// Emit status to connected clients
const emitStatus = (meetingId, status, data = {}) => {
    if (global.io) {
        global.io.emit('meetingUpdate', { meetingId: meetingId.toString(), status, ...data });
    }
};

async function runBot(meetingLink, meetingIdMongo, userId = null, botName = 'AI Bot') {
    console.log(`[Bot] Launching for meeting: ${meetingLink} with bot name: ${botName}`);

    emitStatus(meetingIdMongo, 'starting', { message: 'Launching browser...' });

    // Recording setup
    const recordingsDir = path.join(__dirname, '../../recordings');
    if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });
    const audioPath = path.join(recordingsDir, `${meetingIdMongo}.webm`);

    // Detect platform and get browser profile if needed
    const platform = detectPlatform(meetingLink);
    let browserOptions = {
        headless: false,
        defaultViewport: null,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--autoplay-policy=no-user-gesture-required',
            '--use-fake-ui-for-media-stream',
            '--start-maximized',
            '--window-size=1280,720',
            '--window-position=0,0',
            '--disable-infobars',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--enable-usermedia-screen-capturing',
            '--allow-http-screen-capture',
            '--auto-select-desktop-capture-source=Zoom',
            '--enable-features=GetDisplayMediaSet,GetDisplayMediaSetAutoSelectAllScreens',
        ],
    };

    // If Google Meet and user is logged in, try to use saved profile
    if (platform === 'google-meet' && userId) {
        const user = await User.findById(userId);
        if (user && user.meetBotConfig && user.meetBotConfig.browserProfilePath) {
            const profilePath = user.meetBotConfig.browserProfilePath;
            // Only use profile if it exists
            if (fs.existsSync(profilePath)) {
                try {
                    // Check if profile is not locked by another browser instance
                    browserOptions.userDataDir = profilePath;
                    browserOptions.args.push('--disable-blink-features=AutomationControlled');
                    browserOptions.ignoreDefaultArgs = ['--enable-automation'];
                    console.log(`[Bot] Using saved Google Meet browser profile: ${profilePath}`);
                } catch (err) {
                    console.log(`[Bot] Warning: Could not use saved profile: ${err.message}`);
                }
            }
        }
    }

    // If MS Teams and user is logged in, try to use saved Teams profile
    if (platform === 'teams' && userId) {
        const user = await User.findById(userId);
        if (user && user.teamsBotConfig && user.teamsBotConfig.browserProfilePath) {
            const profilePath = user.teamsBotConfig.browserProfilePath;
            // Only use profile if it exists
            if (fs.existsSync(profilePath)) {
                try {
                    browserOptions.userDataDir = profilePath;
                    browserOptions.args.push('--disable-blink-features=AutomationControlled');
                    browserOptions.ignoreDefaultArgs = ['--enable-automation'];
                    console.log(`[Bot] Using saved Teams browser profile: ${profilePath}`);
                } catch (err) {
                    console.log(`[Bot] Warning: Could not use saved Teams profile: ${err.message}`);
                }
            }
        }
    }

    // Launch browser with specific flags for audio capture
    const browser = await puppeteer.launch(browserOptions);

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    // Bring browser window to front
    await page.bringToFront();
    console.log(`[Bot] ✅ Browser window opened and brought to front`);

    // Audio chunk collection  
    let audioChunks = [];

    // Initialize live transcription with Deepgram
    let liveTranscriber = null;
    if (process.env.DEEPGRAM_API_KEY) {
        liveTranscriber = createDeepgramLiveTranscriber(meetingIdMongo, process.env.DEEPGRAM_API_KEY);
        console.log('[Bot] ✅ Live transcription ready (will connect when audio starts)');
    } else {
        console.log('[Bot] ⚠️ DEEPGRAM_API_KEY not set - live transcription disabled');
    }

    // Store bot reference with transcriber
    activeBots.set(meetingIdMongo.toString(), { browser, page, audioChunks, liveTranscriber });

    browser.on('disconnected', async () => {
        console.log(`[Bot] Browser disconnected`);

        // Finalize live transcription
        if (liveTranscriber && liveTranscriber.isConnected) {
            try {
                const transcripts = await liveTranscriber.close();
                console.log('[Bot] ✅ Live transcription finalized');
                emitStatus(meetingIdMongo, 'live-transcription-finalized', {
                    message: `Captured ${transcripts.length} final transcripts`
                });
            } catch (error) {
                console.error('[Bot] Error finalizing transcription:', error);
            }
        }

        await saveAudioFile(audioChunks, audioPath, meetingIdMongo);
        await updateMeetingStatus(meetingIdMongo, 'completed');
        emitStatus(meetingIdMongo, 'completed', { message: 'Meeting ended' });
        activeBots.delete(meetingIdMongo.toString());
    });

    // Handle Google Meet with saved session
    if (platform === 'google-meet') {
        console.log('[Bot] Starting Google Meet flow with saved session...');

        // Install audio hooks BEFORE navigating to the page
        await page.evaluateOnNewDocument(() => {
            console.log('[Hook] Installing Google Meet audio hooks...');

            // Track all audio nodes
            window.__audioNodes = [];
            window.__speakerNodes = [];
            window.__mainAudioContext = null;

            // Hook AudioContext
            const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
            function AudioContextProxy(...args) {
                const ctx = new OriginalAudioContext(...args);
                if (!window.__mainAudioContext) window.__mainAudioContext = ctx;

                const origCreateMediaStreamSource = ctx.createMediaStreamSource;
                ctx.createMediaStreamSource = function (stream) {
                    const node = origCreateMediaStreamSource.call(ctx, stream);
                    window.__audioNodes.push({ node, stream, type: 'stream' });
                    console.log('[Hook] MediaStreamSource created:', stream.id);
                    return node;
                };

                const origCreateMediaElementSource = ctx.createMediaElementSource;
                ctx.createMediaElementSource = function (element) {
                    const node = origCreateMediaElementSource.call(ctx, element);
                    window.__audioNodes.push({ node, element, type: 'element' });
                    console.log('[Hook] MediaElementSource created');
                    return node;
                };

                return ctx;
            }
            AudioContextProxy.prototype = OriginalAudioContext.prototype;
            window.AudioContext = AudioContextProxy;
            if (window.webkitAudioContext) window.webkitAudioContext = AudioContextProxy;

            console.log('[Hook] Google Meet audio hooks installed');
        });

        try {
            await page.goto(meetingLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
            console.log('[GoogleMeet] Page loaded');
            await delay(3000);

            // Check for access denial or errors
            const pageText = await page.evaluate(() => document.body.innerText);

            if (pageText.includes("You can't join this video call") ||
                pageText.includes("You cannot join this call") ||
                pageText.includes("access denied")) {
                console.log('[GoogleMeet] ❌ Access denied - account may not have permission');
                emitStatus(meetingIdMongo, 'failed', {
                    message: 'Cannot join: Account not authorized or meeting restricted'
                });
                await browser.close();
                return { browser: null, page: null };
            }

            // Check if login is required
            if (pageText.includes("Sign in") || pageText.includes("Choose an account")) {
                console.log('[GoogleMeet] ⚠️ Not logged in - browser profile may be invalid');
                emitStatus(meetingIdMongo, 'failed', {
                    message: 'Not logged in. Please re-authenticate your Google account.'
                });
                await browser.close();
                return { browser: null, page: null };
            }

            // Disable camera/mic before joining
            console.log('[GoogleMeet] Disabling camera and mic...');
            await delay(2000); // Wait for controls to load

            // Method 1: Click toggle buttons by aria-label
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
                buttons.forEach(btn => {
                    const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                    const dataTooltip = (btn.getAttribute('data-tooltip') || '').toLowerCase();
                    const combinedLabel = label + ' ' + dataTooltip;

                    // Turn off camera if it's on
                    if ((combinedLabel.includes('camera') || combinedLabel.includes('video'))
                        && (combinedLabel.includes('turn off') || combinedLabel.includes('stop'))) {
                        console.log('[GoogleMeet] Clicking camera off button');
                        btn.click();
                    }

                    // Turn off microphone if it's on
                    if ((combinedLabel.includes('microphone') || combinedLabel.includes('mic'))
                        && (combinedLabel.includes('turn off') || combinedLabel.includes('mute'))) {
                        console.log('[GoogleMeet] Clicking mic off button');
                        btn.click();
                    }
                });
            });

            // Method 2: Use keyboard shortcuts (more reliable)
            await page.keyboard.press('KeyD'); // Toggle camera off (Ctrl+E in Meet)
            await delay(500);
            await page.keyboard.press('KeyE'); // Toggle mic off (Ctrl+D in Meet)
            await delay(500);

            console.log('[GoogleMeet] Camera and mic should now be disabled');
            await delay(1000);

            // Join meeting
            emitStatus(meetingIdMongo, 'joining', { message: 'Joining Google Meet...' });
            const joinClicked = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                const joinBtn = buttons.find(btn => {
                    const text = (btn.textContent || '').toLowerCase();
                    return text.includes('join now') || text.includes('ask to join');
                });
                if (joinBtn) {
                    joinBtn.click();
                    return true;
                }
                return false;
            });

            if (!joinClicked) {
                console.log('[GoogleMeet] ⚠️ Join button not found');
            }

            await delay(5000);

            // Re-check for access issues after trying to join
            const postJoinText = await page.evaluate(() => document.body.innerText);
            if (postJoinText.includes("You can't join this video call") ||
                postJoinText.includes("waiting for the host")) {
                console.log('[GoogleMeet] ⚠️ Waiting for host or access denied');
                emitStatus(meetingIdMongo, 'waiting', {
                    message: 'Waiting for host to admit or meeting may be restricted'
                });
            } else {
                console.log('[GoogleMeet] ✅ Joined meeting');
                emitStatus(meetingIdMongo, 'in-meeting', { message: 'Bot in Google Meet!' });
            }

        } catch (err) {
            console.error('[GoogleMeet] Error:', err.message);
            emitStatus(meetingIdMongo, 'failed', { message: `Google Meet failed: ${err.message}` });
            await browser.close();
            return { browser: null, page: null };
        }

        // Google Meet joined successfully
        await updateMeetingStatus(meetingIdMongo, 'in-meeting');
        activeBots.set(meetingIdMongo.toString(), { browser, page, audioChunks, liveTranscriber });

        console.log('[GoogleMeet] Bot is in meeting, setting up audio...');
        await setupAudioCapture(page, meetingIdMongo, audioChunks);

        monitorMeetingEnd(page, meetingIdMongo, audioChunks, audioPath);
        return { browser, page };

    } else if (platform === 'zoom') {
        // ===== ZOOM FLOW =====

        // Navigate to Zoom
        let targetUrl = meetingLink;
        if (meetingLink.includes('/j/')) {
            try {
                const url = new URL(meetingLink);
                const pathParts = url.pathname.split('/');
                const cleanId = pathParts[pathParts.length - 1];
                const pwd = url.searchParams.get('pwd');
                targetUrl = `https://zoom.us/wc/${cleanId}/join${pwd ? `?pwd=${pwd}` : ''}`;
            } catch (e) { }
        }

        console.log(`[Bot] Navigating to: ${targetUrl}`);
        emitStatus(meetingIdMongo, 'navigating', { message: 'Opening Zoom...' });

        // Override getDisplayMedia to auto-select the current tab with audio
        await page.evaluateOnNewDocument(() => {
            // Store all audio elements for later capture
            window.__audioElements = [];
            window.__videoElements = [];

            // Override createElement to track audio/video elements
            const originalCreateElement = document.createElement.bind(document);
            document.createElement = function (tagName) {
                const element = originalCreateElement(tagName);
                if (tagName.toLowerCase() === 'audio') {
                    window.__audioElements.push(element);
                    console.log('[Hook] Audio element created');
                } else if (tagName.toLowerCase() === 'video') {
                    window.__videoElements.push(element);
                    console.log('[Hook] Video element created');
                }
                return element;
            };

            // Override Audio constructor
            const OriginalAudio = window.Audio;
            window.Audio = function (src) {
                const audio = new OriginalAudio(src);
                window.__audioElements.push(audio);
                console.log('[Hook] Audio object created');
                return audio;
            };

            // Hook Web Audio API to capture the full audio graph
            window.__audioNodes = [];
            window.__audioDestinations = [];

            const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;

            const AudioContextProxy = function (...args) {
                const ctx = new OriginalAudioContext(...args);
                console.log('[Hook] AudioContext created');

                // Store reference
                window.__mainAudioContext = ctx;

                // Hook createMediaStreamSource
                const origCreateMSS = ctx.createMediaStreamSource.bind(ctx);
                ctx.createMediaStreamSource = function (stream) {
                    const node = origCreateMSS(stream);
                    window.__audioNodes.push({ type: 'MediaStreamSource', node, stream });
                    console.log('[Hook] MediaStreamSource created');
                    return node;
                };

                // Hook createMediaStreamDestination
                const origCreateMSD = ctx.createMediaStreamDestination.bind(ctx);
                ctx.createMediaStreamDestination = function () {
                    const node = origCreateMSD();
                    window.__audioDestinations.push(node);
                    console.log('[Hook] MediaStreamDestination created');
                    return node;
                };

                // Hook connect on AudioNode prototype to see where audio flows
                const origConnect = AudioNode.prototype.connect;
                AudioNode.prototype.connect = function (destination, ...args) {
                    if (destination === ctx.destination) {
                        console.log('[Hook] Audio connected to speakers!');
                        window.__speakerNodes = window.__speakerNodes || [];
                        window.__speakerNodes.push(this);
                    }
                    return origConnect.call(this, destination, ...args);
                };

                return ctx;
            };

            AudioContextProxy.prototype = OriginalAudioContext.prototype;
            window.AudioContext = AudioContextProxy;
            if (window.webkitAudioContext) {
                window.webkitAudioContext = AudioContextProxy;
            }

            console.log('[Hook] All audio hooks installed');
        });

        try {
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            console.log('[Bot] Page loaded successfully');
            await delay(8000); // Wait longer for page to fully render

            // Check for specific error messages indicating invalid meeting
            const pageText = await page.evaluate(() => document.body?.innerText || '');
            const hasInvalidError = pageText.includes('Invalid meeting ID') ||
                pageText.includes('This meeting ID is not valid') ||
                pageText.includes('Meeting ID is invalid') ||
                pageText.includes('Meeting not found') ||
                pageText.includes('has been removed') ||
                pageText.includes('Error Code: 3001') ||
                pageText.includes('Error Code: 3,001');

            if (hasInvalidError) {
                console.log('[Bot] ❌ Meeting link is invalid or expired');
                console.log('[Bot] Page text:', pageText.substring(0, 500)); // Log first 500 chars for debugging
                emitStatus(meetingIdMongo, 'failed', { message: 'Invalid or expired meeting link' });
                await browser.close();
                return { browser: null, page: null };
            }

            console.log('[Bot] ✅ Meeting link appears valid, proceeding...');
        } catch (e) {
            console.log('[Bot] Navigation timeout, continuing...');
        }

        // --- JOIN FLOW ---
        try {
            await delay(3000);

            // Cookie
            try {
                const cookieBtn = await page.$('#onetrust-accept-btn-handler');
                if (cookieBtn) await cookieBtn.click();
            } catch (e) { }

            // Name input
            emitStatus(meetingIdMongo, 'joining', { message: 'Entering meeting...' });
            console.log('[Bot] Entering name:', botName);
            await delay(2000);

            const nameSelectors = ['#inputname', 'input[id*="name"]', 'input[type="text"]'];

            for (const sel of nameSelectors) {
                const input = await page.$(sel);
                if (input) {
                    await input.click({ clickCount: 3 });
                    await input.type(botName, { delay: 30 });
                    break;
                }
            }

            await delay(1000);

            // Join button
            console.log('[Bot] Looking for join button...');
            let joinClicked = false;

            const joinSelectors = ['.preview-join-button', '#joinBtn', 'button.btn-join'];
            for (const sel of joinSelectors) {
                try {
                    await page.waitForSelector(sel, { timeout: 3000 }).catch(() => null);
                    const btn = await page.$(sel);
                    if (btn) {
                        await btn.click();
                        console.log(`[Bot] Clicked join button: ${sel}`);
                        joinClicked = true;
                        break;
                    }
                } catch (e) {
                    console.log(`[Bot] Join selector ${sel} not found`);
                }
            }

            // Fallback: try finding by text
            if (!joinClicked) {
                try {
                    await page.evaluate(() => {
                        const btn = [...document.querySelectorAll('button')].find(b =>
                            b.textContent?.toLowerCase().includes('join')
                        );
                        if (btn) {
                            btn.click();
                            return true;
                        }
                        return false;
                    });
                    console.log('[Bot] Clicked join button by text content');
                    joinClicked = true;
                } catch (e) {
                    console.log('[Bot] Could not find join button by text:', e.message);
                }
            }

            if (!joinClicked) {
                console.log('[Bot] Warning: Join button not found, meeting may require manual join');
            }
            await page.evaluate(() => {
                const btn = [...document.querySelectorAll('button')].find(b =>
                    b.textContent?.toLowerCase().includes('join')
                );
                if (btn) btn.click();
            });

            console.log('[Bot] Waiting to enter meeting...');
            emitStatus(meetingIdMongo, 'waiting', { message: 'Waiting to enter...' });
            await delay(15000);

            // Join audio
            console.log('[Bot] Joining audio...');
            try {
                const audioJoined = await page.evaluate(() => {
                    const btn = [...document.querySelectorAll('button')].find(b => {
                        const t = (b.textContent || '').toLowerCase();
                        return t.includes('computer audio') || t.includes('join audio');
                    });
                    if (btn) {
                        btn.click();
                        return true;
                    }
                    return false;
                });

                if (audioJoined) {
                    console.log('[Bot] Audio join button clicked');
                } else {
                    console.log('[Bot] Audio join button not found, may already be in meeting');
                }
            } catch (e) {
                console.log('[Bot] Error joining audio:', e.message);
            }

            await delay(3000);

            // Mute our mic
            console.log('[Bot] Attempting to mute microphone...');
            try {
                // Check if page is still attached before evaluating
                if (!page.isClosed()) {
                    const muted = await page.evaluate(() => {
                        const btn = [...document.querySelectorAll('button')].find(b => {
                            const l = (b.getAttribute('aria-label') || '').toLowerCase();
                            return l.includes('mute') && !l.includes('unmute');
                        });
                        if (btn) {
                            btn.click();
                            return true;
                        }
                        return false;
                    });

                    if (muted) {
                        console.log('[Bot] Microphone muted');
                    } else {
                        console.log('[Bot] Mute button not found, may already be muted');
                    }
                } else {
                    console.log('[Bot] Page closed, cannot mute');
                }
            } catch (e) {
                console.log('[Bot] Error muting (non-critical):', e.message);
            }

            console.log('[Bot] ✅ Joined meeting!');
            emitStatus(meetingIdMongo, 'in-meeting', { message: 'Bot is in the meeting!' });

            // --- START AUDIO CAPTURE ---
            await setupAudioCapture(page, meetingIdMongo, audioChunks);

            await updateMeetingStatus(meetingIdMongo, 'recording');

            // Update bot reference with chunks
            activeBots.set(meetingIdMongo.toString(), { browser, page, audioChunks });

            monitorMeetingEnd(page, meetingIdMongo, audioChunks, audioPath);

        } catch (err) {
            console.error('[Bot] Error:', err.message);
            console.error('[Bot] Stack trace:', err.stack);
            emitStatus(meetingIdMongo, 'failed', { message: `Error: ${err.message}` });

            // Clean up on error
            try {
                if (browser) {
                    await browser.close();
                }
            } catch (closeErr) {
                console.error('[Bot] Error closing browser:', closeErr.message);
            }

            activeBots.delete(meetingIdMongo.toString());
            return { browser: null, page: null };
        }

        return { browser, page };
    } else if (platform === 'teams') {
        // ===== MS TEAMS FLOW =====
        console.log('[Bot] Starting Microsoft Teams flow...');

        // Install audio hooks BEFORE navigating to the page
        await page.evaluateOnNewDocument(() => {
            console.log('[Hook] Installing Teams audio hooks (WebRTC enhanced)...');

            // Track all audio sources
            window.__audioNodes = [];
            window.__speakerNodes = [];
            window.__mainAudioContext = null;
            window.__rtcStreams = []; // Track WebRTC streams

            // Hook RTCPeerConnection to capture WebRTC audio (Teams uses this)
            const OriginalRTCPeerConnection = window.RTCPeerConnection;
            window.RTCPeerConnection = function (...args) {
                const pc = new OriginalRTCPeerConnection(...args);

                // Intercept ontrack to capture remote audio streams
                const originalOnTrackSetter = Object.getOwnPropertyDescriptor(RTCPeerConnection.prototype, 'ontrack')?.set;
                let ontrackHandler = null;

                Object.defineProperty(pc, 'ontrack', {
                    set: function (handler) {
                        ontrackHandler = handler;
                        if (originalOnTrackSetter) {
                            originalOnTrackSetter.call(pc, function (event) {
                                // Capture audio tracks from remote participants
                                if (event.track && event.track.kind === 'audio') {
                                    console.log('[Hook] WebRTC audio track received:', event.track.id);
                                    const stream = event.streams?.[0] || new MediaStream([event.track]);
                                    window.__rtcStreams.push(stream);
                                }
                                if (handler) handler.call(this, event);
                            });
                        }
                    },
                    get: function () { return ontrackHandler; }
                });

                // Also hook addEventListener for ontrack
                const origAddEventListener = pc.addEventListener;
                pc.addEventListener = function (type, listener, options) {
                    if (type === 'track') {
                        const wrappedListener = function (event) {
                            if (event.track && event.track.kind === 'audio') {
                                console.log('[Hook] WebRTC audio track (addEventListener):', event.track.id);
                                const stream = event.streams?.[0] || new MediaStream([event.track]);
                                window.__rtcStreams.push(stream);
                            }
                            listener.call(this, event);
                        };
                        return origAddEventListener.call(pc, type, wrappedListener, options);
                    }
                    return origAddEventListener.call(pc, type, listener, options);
                };

                return pc;
            };
            window.RTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;

            // Hook AudioContext
            const OriginalAudioContext = window.AudioContext || window.webkitAudioContext;
            function AudioContextProxy(...args) {
                const ctx = new OriginalAudioContext(...args);
                if (!window.__mainAudioContext) window.__mainAudioContext = ctx;

                const origCreateMediaStreamSource = ctx.createMediaStreamSource;
                ctx.createMediaStreamSource = function (stream) {
                    const node = origCreateMediaStreamSource.call(ctx, stream);
                    window.__audioNodes.push({ node, stream, type: 'stream' });
                    console.log('[Hook] MediaStreamSource created:', stream.id);
                    return node;
                };

                const origCreateMediaElementSource = ctx.createMediaElementSource;
                ctx.createMediaElementSource = function (element) {
                    const node = origCreateMediaElementSource.call(ctx, element);
                    window.__audioNodes.push({ node, element, type: 'element' });
                    console.log('[Hook] MediaElementSource created');
                    return node;
                };

                return ctx;
            }
            AudioContextProxy.prototype = OriginalAudioContext.prototype;
            window.AudioContext = AudioContextProxy;
            if (window.webkitAudioContext) window.webkitAudioContext = AudioContextProxy;

            console.log('[Hook] Teams WebRTC audio hooks installed');
        });

        try {
            // Use dedicated Teams join flow
            const joined = await joinMSTeams(page, meetingLink, meetingIdMongo, botName);

            if (!joined) {
                console.log('[Bot] Teams join failed');
                await browser.close();
                return { browser: null, page: null };
            }

            // Teams joined successfully
            await updateMeetingStatus(meetingIdMongo, 'in-meeting');
            activeBots.set(meetingIdMongo.toString(), { browser, page, audioChunks, liveTranscriber });

            console.log('[MSTeams] Bot is in meeting, setting up audio...');
            await setupAudioCapture(page, meetingIdMongo, audioChunks);

            // Monitor for Teams-specific meeting end
            monitorMeetingEnd(page, meetingIdMongo, audioChunks, audioPath);
            return { browser, page };

        } catch (err) {
            console.error('[MSTeams] Error:', err.message);
            emitStatus(meetingIdMongo, 'failed', { message: `Teams failed: ${err.message}` });
            await browser.close();
            return { browser: null, page: null };
        }

    } else {
        // Generic fallback for unknown platforms
        console.log('[Bot] Unknown platform detected. Using generic flow.');

        try {
            emitStatus(meetingIdMongo, 'navigating', { message: 'Opening link...' });
            await page.goto(meetingLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await delay(5000);

            console.log('[Bot] Setting up generic audio capture...');
            await setupAudioCapture(page, meetingIdMongo, audioChunks);

            await updateMeetingStatus(meetingIdMongo, 'in-meeting');
            activeBots.set(meetingIdMongo.toString(), { browser, page, audioChunks });

            emitStatus(meetingIdMongo, 'in-meeting', {
                message: 'Bot loaded page. Please interact manually if needed.'
            });

            monitorMeetingEnd(page, meetingIdMongo, audioChunks, audioPath);
            return { browser, page };

        } catch (e) {
            console.error('[Bot] Generic flow failed:', e);
            emitStatus(meetingIdMongo, 'failed', { message: `Failed to load: ${e.message}` });
            try { await browser.close(); } catch (err) { }
            activeBots.delete(meetingIdMongo.toString());
            return { browser: null, page: null };
        }
    }
}

async function saveAudioFile(audioChunks, audioPath, meetingIdMongo) {
    console.log(`[Bot] saveAudioFile called - chunks: ${audioChunks.length}, meetingId: ${meetingIdMongo}`);

    if (audioChunks.length > 0) {
        const fullBuffer = Buffer.concat(audioChunks);
        const size = (fullBuffer.length / 1024 / 1024).toFixed(2);
        console.log(`[Bot] Audio buffer size: ${size} MB (${fullBuffer.length} bytes)`);

        if (fullBuffer.length > 1000) {
            try {
                fs.writeFileSync(audioPath, fullBuffer);
                console.log(`[Bot] ✅ Audio saved to: ${audioPath} (${size} MB)`);

                const Meeting = require('../models/Meeting');
                const result = await Meeting.findByIdAndUpdate(meetingIdMongo, {
                    audioPath: `/recordings/${meetingIdMongo}.webm`,
                    status: 'completed'
                });

                console.log(`[Bot] Database updated for meeting: ${meetingIdMongo}`);
                console.log(`[Bot] Update result:`, result ? 'Success' : 'Meeting not found');

                emitStatus(meetingIdMongo, 'completed', {
                    message: `Audio saved! (${size} MB)`,
                    audioPath: `/recordings/${meetingIdMongo}.webm`
                });
                return true;
            } catch (error) {
                console.error(`[Bot] Error saving audio or updating DB:`, error);
                return false;
            }
        } else {
            console.log(`[Bot] ⚠️ Audio buffer too small: ${fullBuffer.length} bytes`);
        }
    } else {
        console.log('[Bot] ⚠️ No audio chunks recorded');
    }
    return false;
}

async function updateMeetingStatus(meetingId, status) {
    try {
        const Meeting = require('../models/Meeting');
        await Meeting.findByIdAndUpdate(meetingId, { status });
    } catch (e) { }
}

function monitorMeetingEnd(page, meetingIdMongo, audioChunks, audioPath) {
    const interval = setInterval(async () => {
        try {
            if (page.isClosed()) {
                clearInterval(interval);
                return;
            }

            const ended = await page.evaluate(() => {
                const body = document.body?.innerText || '';
                // Check for Zoom, Google Meet, AND Teams end indicators
                return body.includes('meeting has been ended') ||
                    body.includes('host has ended') ||
                    body.includes('Meeting Ended') ||
                    // Teams-specific indicators
                    body.includes('call has ended') ||
                    body.includes('You left the meeting') ||
                    body.includes('The meeting ended') ||
                    body.includes('Call ended');
            });

            if (ended) {
                console.log('[Bot] Meeting ended!');
                clearInterval(interval);

                await page.evaluate(() => {
                    if (window.__mediaRecorder && window.__mediaRecorder.state !== 'inactive') {
                        window.__mediaRecorder.stop();
                    }
                });

                await delay(2000);

                // Finalize transcription
                const bot = activeBots.get(meetingIdMongo.toString());
                if (bot && bot.liveTranscriber && bot.liveTranscriber.isConnected) {
                    try {
                        const transcripts = await bot.liveTranscriber.close();
                        console.log('[Bot] ✅ Meeting ended - Live transcription finalized');
                        emitStatus(meetingIdMongo, 'live-transcription-finalized', {
                            message: `Captured ${transcripts.length} final transcripts`
                        });
                    } catch (error) {
                        console.error('[Bot] Error finalizing transcription:', error);
                    }
                }

                await saveAudioFile(audioChunks, audioPath, meetingIdMongo);

                if (bot) {
                    try { await bot.browser.close(); } catch (e) { }
                }
            }
        } catch (e) {
            clearInterval(interval);
        }
    }, 5000);
}

async function stopBot(meetingId) {
    const bot = activeBots.get(meetingId);
    if (bot) {
        try {
            await bot.page.evaluate(() => {
                if (window.__mediaRecorder && window.__mediaRecorder.state !== 'inactive') {
                    window.__mediaRecorder.stop();
                }
            });
            await delay(2000);
        } catch (e) { }

        // Finalize live transcription
        if (bot.liveTranscriber && bot.liveTranscriber.isConnected) {
            try {
                const transcripts = await bot.liveTranscriber.close();
                console.log('[Bot] ✅ Live transcription finalized with', transcripts.length, 'transcripts');
            } catch (error) {
                console.error('[Bot] Error finalizing transcription:', error);
            }
        }

        const recordingsDir = path.join(__dirname, '../../recordings');
        const audioPath = path.join(recordingsDir, `${meetingId}.webm`);
        await saveAudioFile(bot.audioChunks, audioPath, meetingId);

        try {
            await bot.browser.close();
        } catch (e) { }

        activeBots.delete(meetingId);
        return true;
    }
    return false;
}

async function setupAudioCapture(page, meetingIdMongo, audioChunks) {
    // --- START AUDIO CAPTURE ---
    console.log('[Bot] 🎙️ Starting audio capture (Shared)...');

    // Get live transcriber from active bots
    const bot = activeBots.get(meetingIdMongo.toString());
    const liveTranscriber = bot?.liveTranscriber;

    // Expose function to send PCM audio to Deepgram
    await page.exposeFunction('sendPCMAudioToLive', (base64PCM) => {
        if (liveTranscriber && liveTranscriber.isConnected) {
            try {
                const pcmBuffer = Buffer.from(base64PCM, 'base64');
                liveTranscriber.sendAudio(pcmBuffer);
            } catch (error) {
                console.error('[Bot] Error sending PCM to Deepgram:', error.message);
            }
        }
    });

    // Connect to Deepgram when audio starts
    await page.exposeFunction('onAudioStarted', (info) => {
        console.log('[Bot] 🔴 Recording started!', info);
        emitStatus(meetingIdMongo, 'recording', { message: 'Recording audio...' });

        // NOW connect to Deepgram (audio is flowing)
        if (liveTranscriber && !liveTranscriber.isConnected) {
            console.log('[Bot] 🔌 Connecting to Deepgram Live Stream...');
            liveTranscriber.connect().catch(err => {
                console.warn('[Bot] Live transcription connection failed:', err.message);
                emitStatus(meetingIdMongo, 'live-transcription-error', {
                    message: `Failed to connect: ${err.message}`
                });
            });
        }
    });

    // Expose function to receive chunks
    await page.exposeFunction('sendAudioChunk', (base64) => {
        const buffer = Buffer.from(base64, 'base64');
        audioChunks.push(buffer);

        if (audioChunks.length % 10 === 0) {
            const size = (Buffer.concat(audioChunks).length / 1024 / 1024).toFixed(2);
            console.log(`[Bot] Recording: ${audioChunks.length} chunks (${size} MB)`);
            emitStatus(meetingIdMongo, 'recording', {
                message: `Recording... ${size} MB`,
                chunks: audioChunks.length,
                size: parseFloat(size)
            });
        }
    });

    await page.exposeFunction('onAudioError', (error) => {
        console.log('[Bot] ⚠️ Audio error:', error);
    });

    await page.exposeFunction('onAudioDebug', (msg) => {
        console.log('[Bot] Debug:', msg);
    });

    // Start the actual recording
    const started = await page.evaluate(() => {
        return new Promise((resolve) => {
            try {
                console.log('[Recording] Starting capture...');
                window.onAudioDebug('Initializing audio capture...');

                const audioContext = window.__mainAudioContext || new (window.AudioContext || window.webkitAudioContext)();
                const destination = audioContext.createMediaStreamDestination();
                let sourcesConnected = 0;

                // Capture all sources
                if (window.__speakerNodes) window.__speakerNodes.forEach(n => { try { n.connect(destination); sourcesConnected++; } catch (e) { } });
                if (window.__audioNodes) window.__audioNodes.forEach(i => { try { if (i.node && !i.node._captured) { i.node.connect(destination); sourcesConnected++; } } catch (e) { } });

                // Capture WebRTC streams (Teams uses these for remote audio)
                if (window.__rtcStreams && window.__rtcStreams.length > 0) {
                    window.onAudioDebug(`Found ${window.__rtcStreams.length} WebRTC streams`);
                    window.__rtcStreams.forEach((stream, idx) => {
                        try {
                            const source = audioContext.createMediaStreamSource(stream);
                            source.connect(destination);
                            sourcesConnected++;
                            console.log('[Recording] Connected WebRTC stream', idx);
                        } catch (e) {
                            console.log('[Recording] Failed to connect WebRTC stream', idx, e.message);
                        }
                    });
                }

                const captureElement = (el) => {
                    try {
                        if (el.srcObject) { audioContext.createMediaStreamSource(el.srcObject).connect(destination); sourcesConnected++; return; }
                        if (el.captureStream) { audioContext.createMediaStreamSource(el.captureStream()).connect(destination); sourcesConnected++; return; }
                        if (!el._capturedElement) { audioContext.createMediaElementSource(el).connect(destination); el._capturedElement = true; sourcesConnected++; }
                    } catch (e) { }
                };

                document.querySelectorAll('audio, video').forEach(captureElement);

                if (sourcesConnected === 0) {
                    // Fallback to display media if no sources found
                    window.onAudioDebug('No sources, trying display capture...');
                }

                // Create 16kHz audio context for Deepgram
                const sampleRate = 16000;
                const liveContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
                const liveSource = liveContext.createMediaStreamSource(destination.stream);

                // Script processor for PCM encoding
                const bufferSize = 4096;
                const processor = liveContext.createScriptProcessor(bufferSize, 1, 1);

                processor.onaudioprocess = (e) => {
                    const inputData = e.inputBuffer.getChannelData(0);

                    // Convert Float32 to Int16 (PCM 16-bit)
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        const s = Math.max(-1, Math.min(1, inputData[i]));
                        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }

                    // Send PCM to Deepgram via Node backend
                    const buffer = new Uint8Array(pcmData.buffer);
                    const base64 = btoa(String.fromCharCode.apply(null, buffer));
                    window.sendPCMAudioToLive(base64);
                };

                // Connect: destination stream → processor → context destination
                liveSource.connect(processor);
                processor.connect(liveContext.destination);

                console.log('[Live Transcription] ✅ PCM processor started (16kHz, 16-bit)');

                // Also record WebM for post-meeting transcription
                const recorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus' });
                recorder.ondataavailable = e => { if (e.data.size > 0) { const r = new FileReader(); r.onloadend = () => window.sendAudioChunk(r.result.split(',')[1]); r.readAsDataURL(e.data); } };
                recorder.onerror = e => window.onAudioError(e.error?.message);
                recorder.start(1000);

                window.__mediaRecorder = recorder;
                window.onAudioStarted({ sources: sourcesConnected });
                resolve(true);
            } catch (e) {
                window.onAudioError(e.message);
                resolve(false);
            }
        });
    });

    return started;
}

module.exports = { runBot, stopBot, activeBots };
