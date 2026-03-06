// Background service worker for tab audio capture
let mediaRecorder = null;
let audioChunks = [];

// Listen for messages from the page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startCapture') {
        startCapture(request.tabId);
        sendResponse({ status: 'starting' });
    } else if (request.action === 'stopCapture') {
        stopCapture();
        sendResponse({ status: 'stopping' });
    } else if (request.action === 'getAudio') {
        sendResponse({ chunks: audioChunks.length });
    }
    return true;
});

// Also listen for extension icon click
chrome.action.onClicked.addListener((tab) => {
    startCapture(tab.id);
});

async function startCapture(tabId) {
    try {
        console.log('[Extension] Starting tab capture for tab:', tabId);

        const stream = await chrome.tabCapture.capture({
            audio: true,
            video: false
        });

        if (!stream) {
            console.error('[Extension] Failed to get stream');
            return;
        }

        console.log('[Extension] Got audio stream, starting recorder...');

        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                // Convert to base64 and store
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result.split(',')[1];
                    audioChunks.push(base64);
                    console.log('[Extension] Captured chunk, total:', audioChunks.length);
                };
                reader.readAsDataURL(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            console.log('[Extension] Recording stopped, chunks:', audioChunks.length);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start(3000); // Capture every 3 seconds
        console.log('[Extension] Recording started!');

    } catch (error) {
        console.error('[Extension] Capture error:', error);
    }
}

function stopCapture() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        console.log('[Extension] Stopped recording');
    }
}

// Make audioChunks accessible
self.getAudioChunks = () => audioChunks;
