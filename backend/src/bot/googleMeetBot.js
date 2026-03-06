/**
 * Google Meet Join Flow
 * Handles joining Google Meet with bot credentials
 */
async function joinGoogleMeet(page, meetingLink, meetingIdMongo, botEmail, botPassword) {
    console.log('[GoogleMeet] Starting join flow...');
    emitStatus(meetingIdMongo, 'joining', { message: 'Navigating to Google Meet...' });

    try {
        // Navigate to meeting
        await page.goto(meetingLink, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log('[GoogleMeet] Page loaded');
        await delay(3000);

        // Check if we need to login
        const needsLogin = await page.evaluate(() => {
            return document.body.innerText.includes('Sign in') ||
                document.body.innerText.includes('Use another account') ||
                document.querySelector('input[type="email"]') !== null;
        });

        if (needsLogin) {
            console.log('[GoogleMeet] Login required, entering credentials...');
            emitStatus(meetingIdMongo, 'authenticating', { message: 'Logging into Google account...' });

            // Enter email
            await page.waitForSelector('input[type="email"]', { timeout: 10000 });
            await page.type('input[type="email"]', botEmail, { delay: 100 });
            await delay(1000);

            // Click Next
            await page.keyboard.press('Enter');
            await delay(3000);

            // Enter password
            await page.waitForSelector('input[type="password"]', { timeout: 10000 });
            await page.type('input[type="password"]', botPassword, { delay: 100 });
            await delay(1000);

            // Click Next
            await page.keyboard.press('Enter');
            await delay(5000);

            console.log('[GoogleMeet] Login completed');
        } else {
            console.log('[GoogleMeet] Already logged in or no login required');
        }

        // Wait for meeting page to load
        await delay(3000);

        // Turn off camera and microphone BEFORE joining
        console.log('[GoogleMeet] Disabling camera and microphone...');

        try {
            // Turn off camera
            const cameraBtn = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
                const camButton = buttons.find(btn => {
                    const ariaLabel = btn.getAttribute('aria-label') || '';
                    return ariaLabel.toLowerCase().includes('camera') ||
                        ariaLabel.toLowerCase().includes('cam') ||
                        ariaLabel.toLowerCase().includes('video');
                });

                if (camButton) {
                    const isOn = camButton.getAttribute('aria-label')?.toLowerCase().includes('off') === false;
                    if (isOn || camButton.getAttribute('data-is-muted') === 'false') {
                        camButton.click();
                        return true;
                    }
                }
                return false;
            });

            if (cameraBtn) {
                console.log('[GoogleMeet] Camera turned off');
                await delay(500);
            }

            // Turn off microphone
            const micBtn = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('div[role="button"], button'));
                const micButton = buttons.find(btn => {
                    const ariaLabel = btn.getAttribute('aria-label') || '';
                    return ariaLabel.toLowerCase().includes('microphone') ||
                        ariaLabel.toLowerCase().includes('mic') ||
                        ariaLabel.toLowerCase().includes('mute');
                });

                if (micButton) {
                    const isOn = micButton.getAttribute('aria-label')?.toLowerCase().includes('off') === false;
                    if (isOn || micButton.getAttribute('data-is-muted') === 'false') {
                        micButton.click();
                        return true;
                    }
                }
                return false;
            });

            if (micBtn) {
                console.log('[GoogleMeet] Microphone turned off');
                await delay(500);
            }
        } catch (e) {
            console.log('[GoogleMeet] Error toggling camera/mic (may already be off):', e.message);
        }

        // Click "Join now" or "Ask to join"
        console.log('[GoogleMeet] Looking for join button...');
        emitStatus(meetingIdMongo, 'joining', { message: 'Joining meeting...' });

        const joined = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));

            // Try "Join now" button first
            let joinBtn = buttons.find(btn =>
                btn.textContent?.toLowerCase().includes('join now') ||
                btn.textContent?.toLowerCase().includes('ask to join')
            );

            if (joinBtn) {
                joinBtn.click();
                return true;
            }

            // Try other variations
            joinBtn = buttons.find(btn => {
                const text = btn.textContent?.toLowerCase() || '';
                return text.includes('join') && !text.includes('rejoin');
            });

            if (joinBtn) {
                joinBtn.click();
                return true;
            }

            return false;
        });

        if (joined) {
            console.log('[GoogleMeet] Join button clicked');
        } else {
            console.log('[GoogleMeet] Warning: Could not find join button');
        }

        await delay(5000);

        console.log('[GoogleMeet] ✅ Successfully joined meeting');
        emitStatus(meetingIdMongo, 'in-meeting', { message: 'Bot joined Google Meet!' });

        return true;

    } catch (err) {
        console.error('[GoogleMeet] Join error:', err.message);
        emitStatus(meetingIdMongo, 'failed', { message: `Google Meet join failed: ${err.message}` });
        throw err;
    }
}

module.exports = { joinGoogleMeet };
