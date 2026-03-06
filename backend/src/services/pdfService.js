const puppeteer = require('puppeteer');

/**
 * Generate PDF from meeting dashboard data
 * Single page landscape overview
 */
const generateDashboardPDF = async (meetingData, analysisData) => {
    try {
        // Create HTML content with beautiful styling
        const htmlContent = generateDashboardHTML(meetingData, analysisData);

        // Launch puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        
        // Set content
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0'
        });

        // Generate PDF in landscape
        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: true,
            printBackground: true,
            margin: {
                top: '15px',
                right: '15px',
                bottom: '15px',
                left: '15px'
            },
            displayHeaderFooter: false
        });

        await browser.close();

        console.log('✅ PDF generated successfully');
        return pdfBuffer;

    } catch (error) {
        console.error('❌ Error generating PDF:', error);
        throw error;
    }
};

/**
 * Generate HTML content for the dashboard PDF
 * Single page landscape overview
 */
const generateDashboardHTML = (meeting, analysis) => {
    const {
        title = 'Meeting Analysis',
        summary = '',
        participants = [],
        actionItems = [],
        topPriorities = [],
        keyTopics = [],
        decisions = [],
        risks = [],
        speakerSentiments = [],
        buzzwords = [],
        emotionalMoments = []
    } = analysis || {};

    const {
        meetingName = 'Meeting',
        totalDuration = 'N/A',
        speakerCount = 0,
        overallSentiment = 'N/A'
    } = meeting || {};

    // Get top 5 action items for overview
    const topActionItems = actionItems.slice(0, 5);
    
    // Get top 3 participants by contribution
    const topParticipants = [...participants].sort((a, b) => (b.contribution || 0) - (a.contribution || 0)).slice(0, 3);
    
    // Get top 3 priorities
    const topThreePriorities = topPriorities.slice(0, 3);
    
    // Get top 3 speaker sentiments
    const topSpeakerSentiments = speakerSentiments.slice(0, 3);
    
    // Get top 8 buzzwords
    const topBuzzwords = buzzwords.slice(0, 8);
    
    // Get top 2 emotional moments
    const topEmotionalMoments = emotionalMoments.slice(0, 2);
    
    // Calculate overall sentiment stats
    const totalPositive = speakerSentiments.reduce((acc, s) => acc + (s.positiveCount || 0), 0);
    const totalNeutral = speakerSentiments.reduce((acc, s) => acc + (s.neutralCount || 0), 0);
    const totalNegative = speakerSentiments.reduce((acc, s) => acc + (s.negativeCount || 0), 0);
    const totalStatements = totalPositive + totalNeutral + totalNegative;
    
    // Truncate summary if too long
    const summaryText = summary.length > 400 ? summary.substring(0, 400) + '...' : summary;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Meeting Dashboard</title>
    <style>
        * {
            box-sizing: border-box;
            padding: 0;
            margin: 0;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0B0E14;
            padding: 0;
            margin: 0;
            height: 100vh;
            overflow: hidden;
        }

        .container {
            width: 100%;
            height: 100%;
            background: #1C1F2E;
            display: flex;
            flex-direction: column;
            padding: 20px;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 30px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            border-radius: 12px;
            margin-bottom: 20px;
        }

        .header-left h1 {
            font-size: 24px;
            font-weight: 700;
            color: white;
            margin: 0;
        }

        .header-left p {
            font-size: 13px;
            color: rgba(255, 255, 255, 0.9);
            margin-top: 4px;
        }

        .header-right {
            display: flex;
            gap: 15px;
        }

        .stat-card {
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            padding: 12px;
            border-radius: 8px;
            text-align: center;
            min-width: 90px;
        }

        .stat-card .icon {
            font-size: 20px;
            margin-bottom: 4px;
        }

        .stat-card .value {
            font-size: 20px;
            font-weight: 700;
            color: white;
            margin: 2px 0;
        }

        .stat-card .label {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.8);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .content {
            flex: 1;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            overflow: hidden;
        }

        .column {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }

        .section {
            background: #252836;
            padding: 15px;
            border-radius: 10px;
            border: 1px solid #2D3142;
        }

        .section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            font-weight: 600;
            color: #10b981;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .section-title .icon {
            font-size: 16px;
        }

        .summary-text {
            font-size: 12px;
            line-height: 1.6;
            color: #B8BCC8;
        }

        .topics {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .topic-tag {
            padding: 4px 10px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 20px;
            font-size: 10px;
            color: #10b981;
            white-space: nowrap;
        }

        .participant {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px;
            background: #2D3142;
            border-radius: 8px;
            margin-bottom: 8px;
        }

        .participant-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 700;
            color: white;
        }

        .participant-info {
            flex: 1;
        }

        .participant-name {
            font-size: 12px;
            font-weight: 600;
            color: white;
            margin-bottom: 2px;
        }

        .participant-role {
            font-size: 9px;
            color: #10b981;
            margin-left: 6px;
        }

        .participant-stats {
            font-size: 10px;
            color: #B8BCC8;
        }

        .participant-contribution {
            font-weight: 600;
            color: #10b981;
        }

        .action-item {
            padding: 10px;
            background: #2D3142;
            border-radius: 8px;
            border-left: 3px solid #10b981;
            margin-bottom: 8px;
        }

        .action-task {
            font-size: 11px;
            color: white;
            font-weight: 500;
            margin-bottom: 4px;
        }

        .action-meta {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .action-badge {
            font-size: 8px;
            padding: 2px 6px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 4px;
            color: #10b981;
        }

        .priority-item {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            padding: 8px;
            background: #2D3142;
            border-radius: 8px;
            margin-bottom: 8px;
        }

        .priority-number {
            width: 24px;
            height: 24px;
            border-radius: 6px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: 700;
            color: white;
            flex-shrink: 0;
        }

        .priority-text {
            font-size: 11px;
            color: #B8BCC8;
            line-height: 1.5;
        }

        .decision-item, .risk-item {
            padding: 8px;
            background: #2D3142;
            border-radius: 6px;
            font-size: 10px;
            color: #B8BCC8;
            margin-bottom: 8px;
            line-height: 1.5;
        }

        .sentiment-speaker {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 8px;
            background: #2D3142;
            border-radius: 6px;
            margin-bottom: 6px;
        }

        .sentiment-name {
            font-size: 10px;
            font-weight: 600;
            color: white;
        }

        .sentiment-score {
            font-size: 11px;
            font-weight: 700;
        }

        .sentiment-positive { color: #10b981; }
        .sentiment-neutral { color: #f59e0b; }
        .sentiment-negative { color: #ef4444; }

        .sentiment-bar {
            width: 100%;
            height: 3px;
            background: #1C1F2E;
            border-radius: 2px;
            overflow: hidden;
            display: flex;
            margin-top: 4px;
        }

        .buzzword-tag {
            display: inline-block;
            padding: 3px 8px;
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 12px;
            font-size: 9px;
            color: #10b981;
            margin: 2px;
            white-space: nowrap;
        }

        .buzzword-freq {
            font-weight: 700;
            margin-left: 3px;
        }

        .emotion-item {
            padding: 6px 8px;
            background: #2D3142;
            border-radius: 6px;
            margin-bottom: 6px;
            font-size: 9px;
            line-height: 1.4;
        }

        .emotion-header {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 3px;
        }

        .emotion-badge {
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 8px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .emotion-text {
            color: #B8BCC8;
            font-style: italic;
        }

        .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 20px;
            background: #252836;
            border-radius: 8px;
            margin-top: 15px;
        }

        .footer-logo {
            font-size: 11px;
            font-weight: 600;
            color: #10b981;
        }

        .footer-text {
            font-size: 9px;
            color: #B8BCC8;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-left">
                <h1>${title || meetingName}</h1>
                <p>Meeting Overview & Analysis</p>
            </div>
            <div class="header-right">
                <div class="stat-card">
                    <div class="icon">○</div>
                    <div class="value">${totalDuration || 'N/A'}</div>
                    <div class="label">Duration</div>
                </div>
                <div class="stat-card">
                    <div class="icon">◉</div>
                    <div class="value">${speakerCount || participants.length || 0}</div>
                    <div class="label">Speakers</div>
                </div>
                <div class="stat-card">
                    <div class="icon">◆</div>
                    <div class="value">${actionItems.length || 0}</div>
                    <div class="label">Actions</div>
                </div>
                <div class="stat-card">
                    <div class="icon">◇</div>
                    <div class="value">${overallSentiment || 'N/A'}</div>
                    <div class="label">Sentiment</div>
                </div>
            </div>
        </div>

        <!-- Content Grid -->
        <div class="content">
            <!-- Left Column -->
            <div class="column">
                <!-- Summary -->
                <div class="section">
                    <div class="section-title">
                        <span class="icon">▸</span> Summary
                    </div>
                    <div class="summary-text">${summaryText}</div>
                </div>

                <!-- Key Topics -->
                ${keyTopics && keyTopics.length > 0 ? `
                <div class="section">
                    <div class="section-title">
                        <span class="icon">●</span> Key Topics
                    </div>
                    <div class="topics">
                        ${keyTopics.map(topic => {
                            const topicName = typeof topic === 'string' ? topic : topic.name || topic.topic;
                            return `<div class="topic-tag">${topicName}</div>`;
                        }).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Top Participants -->
                ${topParticipants && topParticipants.length > 0 ? `
                <div class="section">
                    <div class="section-title">
                        <span class="icon">▪</span> Top Participants
                    </div>
                    ${topParticipants.map((p, i) => `
                        <div class="participant">
                            <div class="participant-avatar">${p.name?.charAt(0) || 'S'}</div>
                            <div class="participant-info">
                                <div class="participant-name">${p.name || `Speaker ${String.fromCharCode(65 + i)}`}</div>
                                <div class="participant-stats">
                                    <span class="participant-contribution">${(p.contribution || 0).toFixed(1)}%</span> contribution
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>

            <!-- Right Column -->
            <div class="column">
                <!-- Speaker Sentiment -->
                ${topSpeakerSentiments && topSpeakerSentiments.length > 0 ? `
                <div class="section">
                    <div class="section-title">
                        <span class="icon">◆</span> Speaker Sentiment
                    </div>
                    ${topSpeakerSentiments.map(speaker => {
                        const total = (speaker.positiveCount || 0) + (speaker.neutralCount || 0) + (speaker.negativeCount || 0);
                        const posPercent = total > 0 ? ((speaker.positiveCount || 0) / total) * 100 : 0;
                        const neuPercent = total > 0 ? ((speaker.neutralCount || 0) / total) * 100 : 0;
                        const negPercent = total > 0 ? ((speaker.negativeCount || 0) / total) * 100 : 0;
                        const score = speaker.averageSentiment || 50;
                        const scoreClass = score >= 65 ? 'sentiment-positive' : score >= 35 ? 'sentiment-neutral' : 'sentiment-negative';
                        return `
                        <div class="sentiment-speaker">
                            <div>
                                <div class="sentiment-name">${speaker.speaker || 'Unknown'}</div>
                                <div class="sentiment-bar">
                                    <div style="width: ${posPercent}%; height: 100%; background: #10b981;"></div>
                                    <div style="width: ${neuPercent}%; height: 100%; background: #f59e0b;"></div>
                                    <div style="width: ${negPercent}%; height: 100%; background: #ef4444;"></div>
                                </div>
                            </div>
                            <div class="sentiment-score ${scoreClass}">${score.toFixed(0)}</div>
                        </div>
                        `;
                    }).join('')}
                </div>
                ` : ''}

                <!-- Buzzwords -->
                ${topBuzzwords && topBuzzwords.length > 0 ? `
                <div class="section">
                    <div class="section-title">
                        <span class="icon">○</span> Key Terms
                    </div>
                    <div>
                        ${topBuzzwords.map(buzz => `
                            <span class="buzzword-tag">${buzz.word}<span class="buzzword-freq">${buzz.frequency}</span></span>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Action Items -->
                ${topActionItems && topActionItems.length > 0 ? `
                <div class="section">
                    <div class="section-title">
                        <span class="icon">□</span> Action Items
                    </div>
                    ${topActionItems.slice(0, 3).map(item => {
                        const task = typeof item === 'string' ? item : item.task || item.action;
                        const assignee = typeof item === 'object' ? item.assignee : null;
                        return `
                        <div class="action-item">
                            <div class="action-task">${task}</div>
                            ${assignee ? `<div class="action-meta"><span class="action-badge">Assigned: ${assignee}</span></div>` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
                ` : ''}

                <!-- Emotional Moments -->
                ${topEmotionalMoments && topEmotionalMoments.length > 0 ? `
                <div class="section">
                    <div class="section-title">
                        <span class="icon">♦</span> Key Moments
                    </div>
                    ${topEmotionalMoments.map(moment => `
                        <div class="emotion-item">
                            <div class="emotion-header">
                                <span class="emotion-badge" style="background: rgba(16,185,129,0.2); color: #10b981;">${moment.emotion || 'Neutral'}</span>
                                <span style="color: #B8BCC8; font-size: 8px;">${moment.speaker || 'Unknown'}</span>
                            </div>
                            <div class="emotion-text">${moment.text?.substring(0, 80) || ''}${moment.text?.length > 80 ? '...' : ''}</div>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="footer-logo">ACTA AI Meeting System | Powered by Gemini AI</div>
            <div class="footer-text">
                Generated on ${new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                })}
            </div>
        </div>
    </div>
</body>
</html>
    `;
};

module.exports = {
    generateDashboardPDF
};
