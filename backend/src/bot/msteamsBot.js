/**
 * MS Teams Join Flow
 * Handles joining Microsoft Teams meetings with proper automation
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Emit status to connected clients
const emitStatus = (meetingId, status, data = {}) => {
    if (global.io) {
        global.io.emit('meetingUpdate', { meetingId: meetingId.toString(), status, ...data });
    }
};

/**
 * Join MS Teams meeting
 * @param {Object} page - Puppeteer page instance
 * @param {string} meetingLink - Teams meeting URL
 * @param {string} meetingIdMongo - MongoDB meeting ID
 * @param {string} botName - Display name for the bot in the meeting
 */
async function joinMSTeams(page, meetingLink, meetingIdMongo, botName = 'AI Bot') {
    console.log('[MSTeams] Starting join flow...');
    emitStatus(meetingIdMongo, 'joining', { message: 'Navigating to Microsoft Teams...' });

    try {
        // Navigate to the Teams meeting link
        await page.goto(meetingLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log('[MSTeams] Page loaded');
        await delay(5000); // Wait for page to fully render

        // Check for "Continue on this browser" option
        console.log('[MSTeams] Looking for "Continue on this browser" button...');
        const continueOnBrowser = await page.evaluate(() => {
            // Try multiple selectors for the "Continue on this browser" button
            const selectors = [
                'button[data-tid="joinOnWeb"]',
                'a[data-tid="joinOnWeb"]',
                '[data-tid="prejoin-join-button"]',
                'button:has-text("Continue on this browser")',
                'a:has-text("Continue on this browser")',
            ];

            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el) {
                    el.click();
                    return true;
                }
            }

            // Fallback: find by text content
            const allElements = document.querySelectorAll('button, a, div[role="button"]');
            for (const el of allElements) {
                const text = (el.textContent || '').toLowerCase();
                if (text.includes('continue on this browser') ||
                    text.includes('join on the web') ||
                    text.includes('join meeting')) {
                    el.click();
                    return true;
                }
            }

            return false;
        });

        if (continueOnBrowser) {
            console.log('[MSTeams] Clicked "Continue on this browser" button');
            await delay(5000);
        } else {
            console.log('[MSTeams] "Continue on this browser" not found, may already be on web client');
        }

        // Wait for the pre-join screen to load
        await delay(3000);
        emitStatus(meetingIdMongo, 'joining', { message: 'Configuring meeting settings...' });

        // Enter bot name if there's an input field
        console.log('[MSTeams] Looking for name input...');
        const nameEntered = await page.evaluate((name) => {
            const nameInputs = document.querySelectorAll('input[type="text"], input[placeholder*="name"], input[data-tid="prejoin-display-name-input"]');
            for (const input of nameInputs) {
                // Clear and type new name
                input.value = '';
                input.focus();
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(input, name);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
            return false;
        }, botName);

        if (nameEntered) {
            console.log(`[MSTeams] Entered bot name: ${botName}`);
            await delay(1000);
        }

        // Disable camera
        console.log('[MSTeams] Disabling camera...');
        await page.evaluate(() => {
            // Try various camera button selectors
            const cameraButtons = document.querySelectorAll(
                'button[data-tid="toggle-video"], ' +
                '[aria-label*="camera"], ' +
                '[aria-label*="Camera"], ' +
                '[aria-label*="video"], ' +
                '[aria-label*="Video"], ' +
                'button[id*="video"], ' +
                'button[id*="camera"]'
            );

            for (const btn of cameraButtons) {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                // Click if camera is ON (label says "turn off" or doesn't say "turn on")
                if (label.includes('turn off') || label.includes('stop') ||
                    (!label.includes('turn on') && !label.includes('start'))) {
                    btn.click();
                    console.log('[MSTeams] Clicked camera button to disable');
                    return true;
                }
            }
            return false;
        });
        await delay(500);

        // Disable microphone
        console.log('[MSTeams] Disabling microphone...');
        await page.evaluate(() => {
            const micButtons = document.querySelectorAll(
                'button[data-tid="toggle-mute"], ' +
                '[aria-label*="microphone"], ' +
                '[aria-label*="Microphone"], ' +
                '[aria-label*="mic"], ' +
                '[aria-label*="Mic"], ' +
                '[aria-label*="mute"], ' +
                '[aria-label*="Mute"], ' +
                'button[id*="mic"], ' +
                'button[id*="audio"]'
            );

            for (const btn of micButtons) {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                // Click if mic is ON
                if (label.includes('turn off') || label.includes('mute') && !label.includes('unmute')) {
                    btn.click();
                    console.log('[MSTeams] Clicked mic button to disable');
                    return true;
                }
            }
            return false;
        });
        await delay(500);

        console.log('[MSTeams] Camera and microphone should now be disabled');

        // Click "Join now" button
        console.log('[MSTeams] Looking for Join button...');
        emitStatus(meetingIdMongo, 'joining', { message: 'Joining meeting...' });

        const joinClicked = await page.evaluate(() => {
            // Try specific Teams selectors first
            const joinSelectors = [
                'button[data-tid="prejoin-join-button"]',
                'button[data-tid="joinButton"]',
                '#prejoin-join-button',
                'button.join-btn',
            ];

            for (const selector of joinSelectors) {
                const btn = document.querySelector(selector);
                if (btn && !btn.disabled) {
                    btn.click();
                    return { success: true, method: selector };
                }
            }

            // Fallback: find by text content
            const allButtons = document.querySelectorAll('button, div[role="button"]');
            for (const btn of allButtons) {
                const text = (btn.textContent || '').toLowerCase().trim();
                if ((text === 'join now' || text === 'join' || text.includes('join meeting')) && !btn.disabled) {
                    btn.click();
                    return { success: true, method: 'text-content' };
                }
            }

            return { success: false };
        });

        if (joinClicked.success) {
            console.log(`[MSTeams] Join button clicked (method: ${joinClicked.method})`);
        } else {
            console.log('[MSTeams] Warning: Could not find Join button');
        }

        await delay(8000); // Wait for join to complete

        // Check if we're in the meeting
        const inMeeting = await page.evaluate(() => {
            const meetingIndicators = [
                '[data-tid="hangup-main-btn"]', // Hangup button
                '[data-tid="call-composite"]',
                '.meeting-panel',
                '[data-tid="participants-button"]',
                '[class*="callingScreen"]',
                '[class*="meeting-stage"]'
            ];

            for (const selector of meetingIndicators) {
                if (document.querySelector(selector)) {
                    return true;
                }
            }

            // Check URL changed to indicate we're in meeting
            return window.location.href.includes('/meetup-join') ||
                window.location.href.includes('/meet');
        });

        if (inMeeting) {
            console.log('[MSTeams] ✅ Successfully joined meeting');
            emitStatus(meetingIdMongo, 'in-meeting', { message: 'Bot joined Microsoft Teams!' });
        } else {
            // Check for waiting room or other states
            const pageText = await page.evaluate(() => document.body.innerText);

            if (pageText.includes('waiting') || pageText.includes('lobby')) {
                console.log('[MSTeams] ⏳ In waiting room/lobby');
                emitStatus(meetingIdMongo, 'waiting', { message: 'Waiting for host to admit...' });
            } else if (pageText.includes('access denied') || pageText.includes('can\'t join')) {
                console.log('[MSTeams] ❌ Access denied');
                emitStatus(meetingIdMongo, 'failed', { message: 'Access denied to join meeting' });
                return false;
            } else {
                console.log('[MSTeams] ⚠️ Join status uncertain, continuing...');
                emitStatus(meetingIdMongo, 'in-meeting', { message: 'Bot may have joined Teams' });
            }
        }

        return true;

    } catch (err) {
        console.error('[MSTeams] Join error:', err.message);
        emitStatus(meetingIdMongo, 'failed', { message: `Teams join failed: ${err.message}` });
        throw err;
    }
}

/**
 * Check if meeting has ended in Teams
 * @param {Object} page - Puppeteer page instance
 * @returns {boolean} - Whether meeting has ended
 */
async function checkMeetingEnded(page) {
    try {
        const ended = await page.evaluate(() => {
            const body = document.body?.innerText || '';
            return body.includes('meeting has ended') ||
                body.includes('call has ended') ||
                body.includes('You left the meeting') ||
                body.includes('The meeting ended') ||
                body.includes('Call ended') ||
                // Check if hangup button is gone (meeting ended)
                !document.querySelector('[data-tid="hangup-main-btn"]');
        });
        return ended;
    } catch (e) {
        return false;
    }
}

/**
 * Extract Teams meeting ID from various URL formats
 * @param {string} meetingLink - Teams meeting URL
 * @returns {string|null} - Meeting ID or null
 */
function extractTeamsMeetingId(meetingLink) {
    try {
        // Handle various Teams URL formats:
        // https://teams.microsoft.com/l/meetup-join/...
        // https://teams.live.com/meet/...

        const url = new URL(meetingLink);

        // Format 1: meetup-join format
        const meetupMatch = meetingLink.match(/meetup-join\/([^\/\?]+)/);
        if (meetupMatch) {
            return meetupMatch[1];
        }

        // Format 2: teams.live.com/meet/xxx
        const liveMatch = meetingLink.match(/teams\.live\.com\/meet\/([^\/\?]+)/);
        if (liveMatch) {
            return liveMatch[1];
        }

        // Format 3: meeting ID in query params
        const meetingId = url.searchParams.get('meetingId');
        if (meetingId) {
            return meetingId;
        }

        return null;
    } catch (error) {
        console.error('[MSTeams] Error extracting meeting ID:', error.message);
        return null;
    }
}

/**
 * Check if a link is a Teams meeting link
 * @param {string} link - URL to check
 * @returns {boolean}
 */
function isTeamsLink(link) {
    return link.includes('teams.microsoft.com') || link.includes('teams.live.com');
}

module.exports = {
    joinMSTeams,
    checkMeetingEnded,
    extractTeamsMeetingId,
    isTeamsLink
};
