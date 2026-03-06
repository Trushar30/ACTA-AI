const { GoogleGenAI, Type } = require("@google/genai");
const Meeting = require('../models/Meeting');
const { sendDashboardSummary, sendDashboardToCollaborators, sendCollaboratorInvite } = require('../services/emailService');

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ANALYSIS_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        date: { type: Type.STRING },
        summary: { type: Type.STRING },
        totalDuration: { type: Type.STRING },
        speakerCount: { type: Type.NUMBER },
        actionItemCount: { type: Type.NUMBER },
        overallSentiment: { type: Type.STRING },
        topPriorities: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    priority: { type: Type.STRING },
                    speaker: { type: Type.STRING },
                    percentage: { type: Type.NUMBER }
                }
            }
        },
        participants: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    contribution: { type: Type.NUMBER },
                    role: { type: Type.STRING },
                    persona: { type: Type.STRING }
                }
            }
        },
        actionItems: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    task: { type: Type.STRING },
                    owner: { type: Type.STRING },
                    dueDate: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    status: { type: Type.STRING }
                }
            }
        },
        decisions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    conclusion: { type: Type.STRING },
                    rationale: { type: Type.STRING }
                }
            }
        },
        risks: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    issue: { type: Type.STRING },
                    impact: { type: Type.STRING },
                    severity: { type: Type.STRING }
                }
            }
        },
        timeline: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    time: { type: Type.STRING },
                    event: { type: Type.STRING },
                    description: { type: Type.STRING }
                }
            }
        },
        importantDates: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING },
                    event: { type: Type.STRING },
                    description: { type: Type.STRING }
                }
            }
        },
        followUpDrafts: {
            type: Type.OBJECT,
            properties: {
                email: { type: Type.STRING },
                slack: { type: Type.STRING }
            }
        },
        sentimentTimeline: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    time: { type: Type.STRING },
                    sentiment: { type: Type.NUMBER }
                }
            }
        },
        speakerSentiments: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    speaker: { type: Type.STRING },
                    averageSentiment: { type: Type.NUMBER },
                    positiveCount: { type: Type.NUMBER },
                    neutralCount: { type: Type.NUMBER },
                    negativeCount: { type: Type.NUMBER },
                    sentimentTrend: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                sentiment: { type: Type.STRING },
                                score: { type: Type.NUMBER }
                            }
                        }
                    }
                }
            }
        },
        buzzwords: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    word: { type: Type.STRING },
                    frequency: { type: Type.NUMBER },
                    context: { type: Type.STRING }
                }
            }
        },
        emotionalMoments: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    timestamp: { type: Type.STRING },
                    speaker: { type: Type.STRING },
                    emotion: { type: Type.STRING },
                    text: { type: Type.STRING },
                    intensity: { type: Type.NUMBER }
                }
            }
        },
        keyTopics: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    percentage: { type: Type.NUMBER }
                }
            }
        },
        topicBreakdown: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    topic: { type: Type.STRING },
                    details: { type: Type.STRING },
                    subtopics: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            }
        },
        transcriptTimeline: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    startTime: { type: Type.STRING },
                    endTime: { type: Type.STRING },
                    speaker: { type: Type.STRING },
                    text: { type: Type.STRING }
                }
            }
        },
        progress: { type: Type.NUMBER }
    },
    required: ["title", "summary", "participants", "actionItems", "decisions", "keyTopics", "progress", "risks", "followUpDrafts", "topPriorities", "timeline", "importantDates", "topicBreakdown", "transcriptTimeline"]
};

/**
 * Robust JSON extraction helper
 */
const extractJson = (text) => {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse AI response as JSON:", text);
        throw new Error("Invalid response format from AI");
    }
};

/**
 * Format seconds to HH:MM:SS.mmm format for SRT
 */
const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
};

/**
 * Extract timeline from speaker segments
 * Normalizes speaker names to "Speaker A", "Speaker B" format
 */
const extractTimelineFromSegments = (speakerSegments) => {
    if (!speakerSegments || speakerSegments.length === 0) {
        return [];
    }

    // Create a map to normalize speaker names
    const speakerMap = {};
    let speakerCounter = 0;

    return speakerSegments.map(segment => {
        let speaker = segment.speaker || 'Unknown';

        // Normalize speaker name to "Speaker A", "Speaker B" format
        if (speaker.match(/^Speaker [A-Z0-9]+$/)) {
            if (!speakerMap[speaker]) {
                const speakerLetter = String.fromCharCode(65 + speakerCounter); // A=65, B=66, C=67...
                speakerMap[speaker] = `Speaker ${speakerLetter}`;
                speakerCounter++;
            }
            speaker = speakerMap[speaker];
        }

        return {
            startTime: formatTime(segment.start || 0),
            endTime: formatTime(segment.end || segment.start + 5),
            speaker: speaker,
            text: segment.text || ''
        };
    });
};

/**
 * Extract and normalize participant data from speaker stats
 * Converts "Speaker 1, 2, 3" to "Speaker A, B, C" format
 */
const extractParticipantsFromStats = (speakerStats) => {
    if (!speakerStats || Object.keys(speakerStats).length === 0) {
        return [];
    }

    const participants = [];
    const speakerKeys = Object.keys(speakerStats).sort();

    speakerKeys.forEach((speaker, index) => {
        const stats = speakerStats[speaker];
        // Normalize speaker name: convert "Speaker 1, 2, 3" to "Speaker A, B, C"
        let displayName = speaker;
        if (speaker.match(/^Speaker [A-Z0-9]+$/)) {
            const speakerLetter = String.fromCharCode(65 + index); // A=65, B=66, C=67...
            displayName = `Speaker ${speakerLetter}`;
        }

        participants.push({
            name: displayName,
            contribution: parseFloat((stats.percentage || 0).toFixed(1)),
            role: 'Participant',
            persona: ''
        });
    });

    return participants;
};

/**
 * Generate timeline from raw transcript text
 * Used as a fallback when no speaker segments or AI-generated timeline exists
 */
const generateTimelineFromTranscript = (transcript) => {
    if (!transcript || transcript.trim().length === 0) {
        return [];
    }

    const segments = [];
    let currentTime = 0;
    const wordsPerSecond = 2.5; // Average speaking rate

    // Try to detect speaker patterns like "Speaker 1:", "John:", etc.
    const speakerPattern = /^(Speaker\s*\d+|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*:/gm;

    // Split by speaker patterns or by sentences if no speakers found
    const parts = transcript.split(speakerPattern).filter(p => p && p.trim());

    // Check if we found speaker patterns
    let hasSpeakers = false;
    for (let i = 0; i < parts.length; i++) {
        if (speakerPattern.test(parts[i] + ':')) {
            hasSpeakers = true;
            break;
        }
    }

    if (hasSpeakers && parts.length >= 2) {
        // Process speaker-based segments
        for (let i = 0; i < parts.length - 1; i += 2) {
            const speaker = parts[i].trim();
            const text = parts[i + 1]?.trim() || '';

            if (text.length > 0) {
                const wordCount = text.split(/\s+/).length;
                const duration = wordCount / wordsPerSecond;

                segments.push({
                    startTime: formatTime(currentTime),
                    endTime: formatTime(currentTime + duration),
                    speaker: speaker,
                    text: text
                });

                currentTime += duration;
            }
        }
    } else {
        // No speakers detected, split by sentences/paragraphs
        const sentences = transcript.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);

        // Group sentences into ~30-second chunks
        let accumText = '';
        let chunkWordCount = 0;
        const maxChunkDuration = 30; // seconds

        sentences.forEach((sentence, idx) => {
            const sentenceWords = sentence.split(/\s+/).length;
            const sentenceDuration = sentenceWords / wordsPerSecond;

            if (chunkWordCount / wordsPerSecond + sentenceDuration > maxChunkDuration && accumText.length > 0) {
                // Save current chunk
                const duration = chunkWordCount / wordsPerSecond;
                segments.push({
                    startTime: formatTime(currentTime),
                    endTime: formatTime(currentTime + duration),
                    speaker: 'Transcript',
                    text: accumText.trim()
                });
                currentTime += duration;
                accumText = '';
                chunkWordCount = 0;
            }

            accumText += sentence + ' ';
            chunkWordCount += sentenceWords;
        });

        // Don't forget the last chunk
        if (accumText.trim().length > 0) {
            const duration = chunkWordCount / wordsPerSecond;
            segments.push({
                startTime: formatTime(currentTime),
                endTime: formatTime(currentTime + duration),
                speaker: 'Transcript',
                text: accumText.trim()
            });
        }
    }

    return segments;
};

exports.generateDashboard = async (req, res) => {
    try {
        const { id } = req.params;
        const meeting = await Meeting.findById(id);

        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        if (!meeting.transcription) {
            return res.status(400).json({ error: 'Meeting does not have a transcript yet.' });
        }

        if (!process.env.GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is missing');
            return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY missing' });
        }

        console.log(`[Dashboard] Generating analysis for meeting ${id}...`);

        const prompt = `Analyze this transcript and extract comprehensive insights for a meeting dashboard.
        1. Identify Risks/Blockers (severity: High/Medium/Low).
        2. Generate a professional Follow-up Email draft.
        3. Generate a concise Slack update.
        4. Identify Top Priorities: For each priority, extract the speaker name who mentioned it and calculate their contribution percentage (0-100) based on how much they discussed this topic.
        5. Create a Meeting Timeline (time, event, description).
        6. Extract Important Dates (date, event, description) for a calendar.
        7. Provide a Topic Breakdown with subtopics.
        8. Identify speaker names from the transcript (look for patterns like "Speaker 1:", "John:", names followed by colons, etc.).
        9. Create a Transcript Timeline in SRT subtitle format: Break the transcript into segments with startTime (HH:MM:SS), endTime (HH:MM:SS), speaker name, and text for each segment. Estimate timestamps based on word count (average 2-3 words per second).
        10. Sentiment Analysis: For each speaker, analyze their sentiment across the conversation. Provide averageSentiment (0-100, where 0=negative, 50=neutral, 100=positive), count of positive/neutral/negative statements, and a sentimentTrend array with their key statements labeled as positive/neutral/negative with scores.
        11. Buzzwords: Extract 15-20 frequently used words or phrases (excluding common words) with their frequency count and context of usage.
        12. Emotional Moments: Identify 5-10 key emotional moments in the meeting with timestamp, speaker, emotion type (excited, frustrated, concerned, enthusiastic, etc.), the text spoken, and intensity (0-100).
        Focus on accuracy and detail. Return raw JSON matching the schema.
        TRANSCRIPT: ${meeting.transcription}`;

        const response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: ANALYSIS_SCHEMA
            }
        });

        const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text?.() || '{}';
        const data = extractJson(rawText);

        // Enhance data with real metrics if available

        // 1. Transcript Timeline
        // Priority: Use real speaker segments from transcription service if available (most accurate timestamps)
        if (meeting.speakerSegments && meeting.speakerSegments.length > 0) {
            console.log(`[Dashboard] Using real speaker segments for timeline: ${meeting.speakerSegments.length} segments`);
            data.transcriptTimeline = extractTimelineFromSegments(meeting.speakerSegments);

            // Also try to align AI participant names with speaker segments if possible, 
            // but for now we prioritize AI's rich participant data (roles/personas) over speakerStats
        }
        // Fallback: Use generated timeline from raw transcript if AI didn't provide good one
        else if (!data.transcriptTimeline || data.transcriptTimeline.length === 0) {
            console.log(`[Dashboard] Generating fallback timeline from transcript...`);
            data.transcriptTimeline = generateTimelineFromTranscript(meeting.transcription);
        }

        const analysisData = {
            ...data,
            id: meeting._id,
            rawTranscript: meeting.transcription
        };

        meeting.analysis = analysisData;
        await meeting.save();

        console.log(`[Dashboard] Analysis saved for meeting ${id}`);
        
        // Automatically send dashboard summary email to owner
        console.log(`[Dashboard] Sending dashboard summary email...`);
        sendDashboardSummary(meeting._id, analysisData).catch(err => {
            console.error('[Dashboard] Email sending failed (non-blocking):', err);
        });

        // Send dashboard to all collaborators
        if (meeting.collaborators && meeting.collaborators.length > 0) {
            console.log(`[Dashboard] Sending dashboard to ${meeting.collaborators.length} collaborator(s)...`);
            sendDashboardToCollaborators(meeting._id, analysisData, meeting.collaborators).catch(err => {
                console.error('[Dashboard] Collaborator email sending failed (non-blocking):', err);
            });
        }

        res.json({ success: true, analysis: analysisData });

    } catch (err) {
        console.error('[Dashboard] Error generating analysis:', err);
        if (err.response) {
            console.error('[Dashboard] API Error details:', JSON.stringify(err.response, null, 2));
        }
        res.status(500).json({ error: 'Failed to generate dashboard analysis: ' + err.message });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const { id } = req.params;
        const meeting = await Meeting.findById(id);

        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        let analysis = meeting.analysis || null;

        // Apply speaker name mappings if they exist
        if (analysis && analysis.participants && meeting.speakerNameMapping) {
            analysis.participants = analysis.participants.map(participant => {
                const mappedName = meeting.speakerNameMapping[participant.name];
                if (mappedName) {
                    return { ...participant, name: mappedName };
                }
                return participant;
            });
            
            console.log('[Dashboard] Applied speaker name mappings:', meeting.speakerNameMapping);
        }

        // No dynamic overwriting - return exactly what was generated and saved.
        // This ensures that "what you see is what you get" stored in the database.
        // If the user wants to update the analysis with new data/transcript, they must Regenerate.

        res.json({ success: true, analysis });

    } catch (err) {
        console.error('[Dashboard] Error fetching analysis:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard analysis' });
    }
};

exports.askQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { question } = req.body;

        const meeting = await Meeting.findById(id);
        if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
        if (!meeting.transcription) return res.status(400).json({ error: 'No transcript available' });

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });
        }

        const prompt = `You are an AI assistant answering questions about a meeting transcript.
        TRANSCRIPT: ${meeting.transcription}
        
        QUESTION: ${question}
        
        Answer concisely and accurately based ONLY on the transcript.`;

        const response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: prompt
        });

        const answer = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text?.();

        res.json({ success: true, answer });

    } catch (err) {
        console.error('[Dashboard] Ask AI error:', err);
        res.status(500).json({ error: 'Failed to get answer' });
    }
};

// Add collaborator to meeting
exports.addCollaborator = async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email is required' });
        }

        const meeting = await Meeting.findById(id);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        // Check if email is already a collaborator
        if (meeting.collaborators.includes(email)) {
            return res.status(400).json({ error: 'Email already added as collaborator' });
        }

        // Add email to collaborators array
        meeting.collaborators.push(email);
        await meeting.save();

        // Send invitation email to the new collaborator
        const meetingTitle = meeting.title || meeting.meetingId || 'Meeting Dashboard';
        sendCollaboratorInvite(email, meetingTitle, meeting._id).catch(err => {
            console.error('[Dashboard] Failed to send invite email (non-blocking):', err);
        });

        // If dashboard already exists, send it to the new collaborator
        if (meeting.analysis) {
            console.log(`[Dashboard] Sending existing dashboard to new collaborator: ${email}`);
            sendDashboardSummary(meeting._id, meeting.analysis, email).catch(err => {
                console.error('[Dashboard] Failed to send dashboard to collaborator (non-blocking):', err);
            });
        }

        res.json({ success: true, collaborators: meeting.collaborators });

    } catch (err) {
        console.error('[Dashboard] Add collaborator error:', err);
        res.status(500).json({ error: 'Failed to add collaborator' });
    }
};

// Remove collaborator from meeting
exports.removeCollaborator = async (req, res) => {
    try {
        const { id } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const meeting = await Meeting.findById(id);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        // Remove email from collaborators array
        meeting.collaborators = meeting.collaborators.filter(e => e !== email);
        await meeting.save();

        res.json({ success: true, collaborators: meeting.collaborators });

    } catch (err) {
        console.error('[Dashboard] Remove collaborator error:', err);
        res.status(500).json({ error: 'Failed to remove collaborator' });
    }
};

// Get all meetings shared with the current user
exports.getSharedMeetings = async (req, res) => {
    try {
        const userEmail = req.query.email;

        if (!userEmail) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Find all meetings where the user's email is in the collaborators array
        const sharedMeetings = await Meeting.find({
            collaborators: { $in: [userEmail] }
        }).sort({ createdAt: -1 });

        res.json({ success: true, meetings: sharedMeetings });

    } catch (err) {
        console.error('[Dashboard] Get shared meetings error:', err);
        res.status(500).json({ error: 'Failed to fetch shared meetings' });
    }
};

// Export dashboard to email (Outlook)
exports.exportDashboardToEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const { recipientEmail } = req.body;

        if (!recipientEmail) {
            return res.status(400).json({ error: 'Recipient email is required' });
        }

        const meeting = await Meeting.findById(id);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        if (!meeting.analysis) {
            return res.status(400).json({ error: 'Meeting analysis not available. Please generate dashboard first.' });
        }

        console.log(`[Dashboard] Exporting dashboard to email: ${recipientEmail}`);
        const result = await sendDashboardSummary(meeting._id, meeting.analysis, recipientEmail);

        if (result.success) {
            res.json({ 
                success: true, 
                message: 'Dashboard exported to your email successfully!',
                messageId: result.messageId 
            });
        } else {
            res.status(500).json({ error: 'Failed to send email: ' + result.error });
        }

    } catch (err) {
        console.error('[Dashboard] Export to email error:', err);
        res.status(500).json({ error: 'Failed to export dashboard to email' });
    }
};

// Generate and download dashboard PDF
exports.downloadDashboardPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const meeting = await Meeting.findById(id);

        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        if (!meeting.analysis) {
            return res.status(400).json({ error: 'Meeting analysis not available. Please generate dashboard first.' });
        }

        console.log(`[Dashboard] Generating PDF for meeting: ${id}`);
        
        const { generateDashboardPDF } = require('../services/pdfService');
        const pdfBuffer = await generateDashboardPDF(meeting, meeting.analysis);

        // Set headers for PDF download
        const filename = `${meeting.meetingName || 'Meeting'}_${meeting.analysis.title || 'Dashboard'}.pdf`.replace(/[^a-z0-9_\-]/gi, '_');
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        res.send(pdfBuffer);
        console.log(`[Dashboard] ✅ PDF generated and sent: ${filename}`);

    } catch (err) {
        console.error('[Dashboard] PDF generation error:', err);
        res.status(500).json({ error: 'Failed to generate PDF: ' + err.message });
    }
};

// Update speaker name mapping
exports.updateSpeakerName = async (req, res) => {
    try {
        const { id } = req.params;
        const { originalName, newName } = req.body;

        if (!originalName || !newName) {
            return res.status(400).json({ error: 'Original name and new name are required' });
        }

        const meeting = await Meeting.findById(id);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        // Initialize speakerNameMapping if it doesn't exist
        if (!meeting.speakerNameMapping) {
            meeting.speakerNameMapping = {};
        }

        // Update the mapping
        meeting.speakerNameMapping[originalName] = newName.trim();
        
        // Mark as modified (required for nested objects in Mongoose)
        meeting.markModified('speakerNameMapping');
        
        // Also update in analysis if it exists
        if (meeting.analysis && meeting.analysis.participants) {
            meeting.analysis.participants = meeting.analysis.participants.map(p => {
                if (p.name === originalName) {
                    return { ...p, name: newName.trim() };
                }
                return p;
            });
            
            // Mark analysis as modified too
            meeting.markModified('analysis');
        }

        await meeting.save();

        // Verify the update was saved by fetching fresh data
        const updatedMeeting = await Meeting.findById(id);
        console.log(`[Dashboard] Speaker name update saved to database:`);
        console.log(`  - Original: "${originalName}" -> New: "${newName}"`);
        console.log(`  - Mapping in DB:`, updatedMeeting.speakerNameMapping);

        res.json({ 
            success: true, 
            speakerNameMapping: updatedMeeting.speakerNameMapping,
            analysis: updatedMeeting.analysis
        });

    } catch (err) {
        console.error('[Dashboard] Update speaker name error:', err);
        res.status(500).json({ error: 'Failed to update speaker name' });
    }
};
