/**
 * API Integration Examples for Professional Live Transcription
 * 
 * This file contains ready-to-use examples for integrating the live transcription
 * service with various APIs and services.
 * 
 * Simply uncomment the examples you want to use and configure the API keys.
 */

const axios = require('axios');
const { extractTasksFromTranscript } = require('./taskExtractionService');

/**
 * Example 1: OpenAI GPT Integration
 * Analyze transcripts in real-time with GPT-4
 */
async function analyzeWithOpenAI(sentence, fullTranscript) {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a meeting assistant. Analyze this sentence and identify key points, action items, and important decisions.'
                    },
                    {
                        role: 'user',
                        content: `Sentence: "${sentence}"\n\nFull context: "${fullTranscript.slice(-500)}"`
                    }
                ],
                max_tokens: 150
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API error:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Example 2: Anthropic Claude Integration
 * Use Claude for real-time meeting insights
 */
async function analyzeWithClaude(sentences) {
    try {
        const text = sentences.map(s => s.text).join(' ');
        
        const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 200,
                messages: [
                    {
                        role: 'user',
                        content: `Analyze this meeting excerpt and provide key insights:\n\n${text}`
                    }
                ]
            },
            {
                headers: {
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.content[0].text;
    } catch (error) {
        console.error('Claude API error:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Example 3: Webhook Integration
 * Send transcripts to any webhook endpoint
 */
async function sendToWebhook(sentence, metadata) {
    try {
        await axios.post(process.env.WEBHOOK_URL, {
            event: 'sentence_complete',
            data: {
                sentence: sentence.text,
                confidence: sentence.confidence,
                timestamp: sentence.timestamp,
                wordCount: sentence.wordCount,
                metadata: metadata
            }
        });
    } catch (error) {
        console.error('Webhook error:', error.message);
    }
}

/**
 * Example 4: Slack Integration
 * Post important sentences to Slack
 */
async function postToSlack(text, channel = '#meetings') {
    try {
        await axios.post(
            'https://slack.com/api/chat.postMessage',
            {
                channel: channel,
                text: `🎙️ Meeting Update: ${text}`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*Live Transcript Update*\n\n${text}`
                        }
                    }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
    } catch (error) {
        console.error('Slack API error:', error.message);
    }
}

/**
 * Example 5: Microsoft Teams Integration
 * Send updates to Teams channel
 */
async function postToTeams(text) {
    try {
        await axios.post(
            process.env.TEAMS_WEBHOOK_URL,
            {
                '@type': 'MessageCard',
                '@context': 'http://schema.org/extensions',
                'summary': 'Meeting Transcript Update',
                'themeColor': '0076D7',
                'title': '🎙️ Live Transcript',
                'text': text
            }
        );
    } catch (error) {
        console.error('Teams webhook error:', error.message);
    }
}

/**
 * Example 6: Database Storage
 * Store sentences in MongoDB with rich metadata
 */
async function storeSentenceInDatabase(sentence, meetingId, metadata) {
    try {
        const Meeting = require('../models/Meeting');
        
        await Meeting.findByIdAndUpdate(meetingId, {
            $push: {
                liveTranscriptSentences: {
                    text: sentence.text,
                    confidence: sentence.confidence,
                    timestamp: sentence.timestamp,
                    wordCount: sentence.wordCount,
                    metadata: {
                        totalWords: metadata.totalWords,
                        totalSentences: metadata.totalSentences,
                        averageConfidence: metadata.averageConfidence
                    }
                }
            },
            $set: {
                liveTranscriptUpdatedAt: new Date()
            }
        });
    } catch (error) {
        console.error('Database storage error:', error.message);
    }
}

/**
 * Example 7: Email Alerts
 * Send email when important keywords are detected
 */
async function sendEmailAlert(sentence, keywords) {
    try {
        const nodemailer = require('nodemailer');
        
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.ALERT_EMAIL,
            subject: `🚨 Keywords Detected: ${keywords.join(', ')}`,
            html: `
                <h2>Important Meeting Content Detected</h2>
                <p><strong>Keywords:</strong> ${keywords.join(', ')}</p>
                <p><strong>Sentence:</strong> ${sentence.text}</p>
                <p><strong>Confidence:</strong> ${(sentence.confidence * 100).toFixed(1)}%</p>
                <p><strong>Time:</strong> ${new Date(sentence.timestamp).toLocaleString()}</p>
            `
        });
    } catch (error) {
        console.error('Email alert error:', error.message);
    }
}

/**
 * Example 8: Real-Time Translation
 * Translate sentences using Google Cloud Translation
 */
async function translateSentence(text, targetLanguage = 'es') {
    try {
        const response = await axios.post(
            `https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`,
            {
                q: text,
                target: targetLanguage,
                format: 'text'
            }
        );

        return response.data.data.translations[0].translatedText;
    } catch (error) {
        console.error('Translation error:', error.message);
        return null;
    }
}

/**
 * Example 9: Sentiment Analysis
 * Analyze sentiment using Azure Text Analytics
 */
async function analyzeSentiment(text) {
    try {
        const response = await axios.post(
            `${process.env.AZURE_TEXT_ANALYTICS_ENDPOINT}/text/analytics/v3.1/sentiment`,
            {
                documents: [
                    {
                        id: '1',
                        language: 'en',
                        text: text
                    }
                ]
            },
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': process.env.AZURE_TEXT_ANALYTICS_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        const result = response.data.documents[0];
        return {
            sentiment: result.sentiment,
            confidence: result.confidenceScores[result.sentiment],
            scores: result.confidenceScores
        };
    } catch (error) {
        console.error('Sentiment analysis error:', error.message);
        return null;
    }
}

/**
 * Example 10: Keyword Extraction
 * Extract key phrases using Azure Text Analytics
 */
async function extractKeywords(text) {
    try {
        const response = await axios.post(
            `${process.env.AZURE_TEXT_ANALYTICS_ENDPOINT}/text/analytics/v3.1/keyPhrases`,
            {
                documents: [
                    {
                        id: '1',
                        language: 'en',
                        text: text
                    }
                ]
            },
            {
                headers: {
                    'Ocp-Apim-Subscription-Key': process.env.AZURE_TEXT_ANALYTICS_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data.documents[0].keyPhrases;
    } catch (error) {
        console.error('Keyword extraction error:', error.message);
        return [];
    }
}

/**
 * COMPLETE INTEGRATION SETUP
 * Copy this into bot.js where the hooks are registered
 */
function setupCompleteIntegration(liveTranscriber, meetingId) {
    const IMPORTANT_KEYWORDS = ['action item', 'todo', 'deadline', 'important', 'urgent', 'decision'];
    let sentenceBuffer = [];
    
    liveTranscriber.registerHooks({
        // Process each complete sentence
        onSentenceComplete: async (data) => {
            const { sentence, fullTranscript, metadata } = data;
            
            console.log('[Integration] Processing sentence:', sentence.text);
            
            // 1. Store in database
            await storeSentenceInDatabase(sentence, meetingId, metadata);
            
            // 2. Check for important keywords
            const text = sentence.text.toLowerCase();
            const foundKeywords = IMPORTANT_KEYWORDS.filter(kw => text.includes(kw));
            
            if (foundKeywords.length > 0) {
                console.log('[Integration] ⚠️ Important keywords detected:', foundKeywords);
                
                // Send alerts
                await Promise.all([
                    postToSlack(sentence.text),
                    sendEmailAlert(sentence, foundKeywords),
                    sendToWebhook(sentence, metadata)
                ]);
            }
            
            // 3. Analyze sentiment
            const sentiment = await analyzeSentiment(sentence.text);
            if (sentiment && sentiment.sentiment === 'negative') {
                console.log('[Integration] ⚠️ Negative sentiment detected');
                global.io.emit('sentiment-alert', {
                    meetingId,
                    sentence: sentence.text,
                    sentiment: sentiment
                });
            }
            
            // 4. Extract keywords
            const keywords = await extractKeywords(sentence.text);
            if (keywords.length > 0) {
                global.io.emit('keywords-extracted', {
                    meetingId,
                    keywords,
                    sentence: sentence.text
                });
            }
            
            // 5. Translate if needed
            if (process.env.ENABLE_TRANSLATION === 'true') {
                const translated = await translateSentence(sentence.text, 'es');
                global.io.emit('translated-sentence', {
                    meetingId,
                    original: sentence.text,
                    translated
                });
            }
        },
        
        // Process when speaker finishes
        onUtteranceEnd: async (data) => {
            const { lastSentences, fullTranscript, metadata } = data;
            
            console.log('[Integration] Speaker finished, processing context...');
            
            // Extract tasks from recent sentences
            const recentText = lastSentences.map(s => s.text).join(' ');
            const tasks = await extractTasksFromTranscript(recentText);
            
            if (tasks.length > 0) {
                console.log('[Integration] 📋 Tasks detected:', tasks.length);
                
                global.io.emit('tasks-detected', {
                    meetingId,
                    tasks,
                    context: recentText
                });
            }
            
            // Analyze with AI every few utterances
            sentenceBuffer.push(...lastSentences);
            
            if (sentenceBuffer.length >= 5) {
                const blockText = sentenceBuffer.map(s => s.text).join(' ');
                
                // Choose your AI provider
                const analysis = await analyzeWithOpenAI(blockText, fullTranscript);
                // OR: const analysis = await analyzeWithClaude(sentenceBuffer);
                
                if (analysis) {
                    console.log('[Integration] 🤖 AI Analysis:', analysis);
                    
                    global.io.emit('ai-insights', {
                        meetingId,
                        analysis,
                        sentenceCount: sentenceBuffer.length
                    });
                }
                
                sentenceBuffer = []; // Reset buffer
            }
        },
        
        // Handle errors
        onError: async (error) => {
            console.error('[Integration] Error:', error.message);
            
            // Notify admins
            if (process.env.ALERT_EMAIL) {
                await sendEmailAlert(
                    { text: `Transcription error: ${error.message}`, confidence: 0, timestamp: new Date() },
                    ['error', 'transcription']
                );
            }
        }
    });
}

module.exports = {
    analyzeWithOpenAI,
    analyzeWithClaude,
    sendToWebhook,
    postToSlack,
    postToTeams,
    storeSentenceInDatabase,
    sendEmailAlert,
    translateSentence,
    analyzeSentiment,
    extractKeywords,
    setupCompleteIntegration
};
