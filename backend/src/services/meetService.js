/**
 * Google Meet Service
 * Handles Google Meet-specific operations
 */

class MeetService {
    /**
     * Extract Google Meet meeting ID/code from a meeting link
     * Supports various Google Meet URL formats
     */
    extractMeetingCode(meetingLink) {
        // Handle various Google Meet URL formats:
        // https://meet.google.com/abc-defg-hij
        // https://meet.google.com/lookup/abc123def
        // meet.google.com/abc-defg-hij

        try {
            // Method 1: Direct code format (abc-defg-hij)
            const directMatch = meetingLink.match(/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/i);
            if (directMatch) {
                return directMatch[1];
            }

            // Method 2: Lookup format
            const lookupMatch = meetingLink.match(/meet\.google\.com\/lookup\/([a-zA-Z0-9]+)/);
            if (lookupMatch) {
                return lookupMatch[1];
            }

            // Method 3: Any code after meet.google.com/
            const generalMatch = meetingLink.match(/meet\.google\.com\/([a-zA-Z0-9-]+)/);
            if (generalMatch) {
                return generalMatch[1];
            }

            return null;
        } catch (error) {
            console.error('[MeetService] Error extracting meeting code:', error.message);
            return null;
        }
    }

    /**
     * Check if a link is a Google Meet link
     */
    isMeetLink(link) {
        return link.includes('meet.google.com');
    }

    /**
     * Build clean Google Meet URL from code
     */
    buildMeetUrl(meetingCode) {
        return `https://meet.google.com/${meetingCode}`;
    }
}

module.exports = new MeetService();
