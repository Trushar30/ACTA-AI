const puppeteer = require('puppeteer');

/**
 * Generate Minutes of Meeting (MOM) PDF
 * Multi-page portrait A4 document
 */
const generateDashboardPDF = async (meetingData, analysisData, userInfo = {}) => {
    try {
        const htmlContent = generateMOMHTML(meetingData, analysisData, userInfo);

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0'
        });

        const pdfBuffer = await page.pdf({
            format: 'A4',
            landscape: false,
            printBackground: true,
            margin: {
                top: '40px',
                right: '40px',
                bottom: '60px',
                left: '40px'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="width: 100%; font-size: 9px; color: #888; padding: 0 40px; display: flex; justify-content: space-between;">
                    <span>ACTA AI - Minutes of Meeting</span>
                    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                </div>
            `
        });

        await browser.close();

        console.log('✅ MOM PDF generated successfully');
        return pdfBuffer;

    } catch (error) {
        console.error('❌ Error generating MOM PDF:', error);
        throw error;
    }
};

const escapeHtml = (str) => {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

/**
 * Generate HTML for Minutes of Meeting (MOM) document
 */
const generateMOMHTML = (meeting, analysis, userInfo = {}) => {
    const {
        title = 'Meeting Analysis',
        summary = '',
        topicSummaries = [],
        participants = [],
        actionItems = [],
        topPriorities = [],
        keyTopics = [],
        decisions = [],
        risks = [],
        speakerSentiments = [],
        totalDuration: analysisDuration,
        speakerCount: analysisSpeakerCount
    } = analysis || {};

    const {
        meetingName = 'Meeting',
        totalDuration: meetingDuration,
        speakerCount: meetingSpeakerCount,
        platform = 'N/A',
        createdAt,
        completedAt,
        speakerNameMapping = {}
    } = meeting || {};

    const duration = analysisDuration || meetingDuration || 'N/A';
    const speakerCount = analysisSpeakerCount || meetingSpeakerCount || participants.length || 0;
    const meetingDate = createdAt ? new Date(createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const meetingTime = createdAt ? new Date(createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
    const endTime = completedAt ? new Date(completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
    const preparedBy = userInfo.preparedByName || userInfo.preparedByEmail || 'ACTA AI System';

    // Build attendees list
    const attendees = participants.map((p, i) => {
        const name = p.name || speakerNameMapping[`Speaker ${String.fromCharCode(65 + i)}`] || `Speaker ${String.fromCharCode(65 + i)}`;
        return {
            name: escapeHtml(name),
            role: escapeHtml(p.role || 'Participant'),
            contribution: (p.contribution || 0).toFixed(1)
        };
    });

    // Build sections
    const attendeesHTML = attendees.length > 0 ? `
        <div class="section">
            <h2>1. Attendees</h2>
            <table class="data-table">
                <thead>
                    <tr><th>#</th><th>Name</th><th>Role</th><th>Contribution</th></tr>
                </thead>
                <tbody>
                    ${attendees.map((a, i) => `
                        <tr><td>${i + 1}</td><td>${a.name}</td><td>${a.role}</td><td>${a.contribution}%</td></tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    ` : '';

    // Key topics / Agenda
    const agendaHTML = keyTopics && keyTopics.length > 0 ? `
        <div class="section">
            <h2>2. Agenda / Key Topics</h2>
            <div class="topics-container">
                ${keyTopics.map(topic => {
                    const topicName = typeof topic === 'string' ? topic : (topic.name || topic.topic || '');
                    const percentage = typeof topic === 'object' ? (topic.percentage || '') : '';
                    return `<span class="topic-chip">${escapeHtml(topicName)}${percentage ? ` (${percentage}%)` : ''}</span>`;
                }).join('')}
            </div>
        </div>
    ` : '';

    // Summary section with overview, topic-wise summaries, and key topics with percentages
    let summaryHTML = '';
    if (summary || (topicSummaries && topicSummaries.length > 0) || (keyTopics && keyTopics.length > 0)) {
        summaryHTML = `<div class="section"><h2>3. Meeting Summary</h2>`;
        
        if (summary) {
            summaryHTML += `
                <h3 class="sub-heading">Overview</h3>
                <p class="summary-text">${escapeHtml(summary)}</p>
            `;
        }

        if (topicSummaries && topicSummaries.length > 0) {
            summaryHTML += `<h3 class="sub-heading">Topic-wise Summary</h3>`;
            topicSummaries.forEach(ts => {
                const topicName = ts.topicName || ts.topic || 'Topic';
                const topicSummary = ts.summary || ts.content || '';
                summaryHTML += `
                    <div class="topic-summary-card">
                        <div class="topic-summary-title">${escapeHtml(topicName)}</div>
                        <p class="topic-summary-text">${escapeHtml(topicSummary)}</p>
                    </div>
                `;
            });
        }

        if (keyTopics && keyTopics.length > 0) {
            summaryHTML += `<h3 class="sub-heading">Key Topics</h3><div class="topics-container">`;
            keyTopics.forEach(topic => {
                const topicName = typeof topic === 'string' ? topic : (topic.name || topic.topic || '');
                const percentage = typeof topic === 'object' ? (topic.percentage || '') : '';
                summaryHTML += `<span class="topic-chip">${escapeHtml(topicName)}${percentage ? ` <strong>${percentage}%</strong>` : ''}</span>`;
            });
            summaryHTML += `</div>`;
        }

        summaryHTML += `</div>`;
    }

    // Decisions
    const decisionsHTML = decisions && decisions.length > 0 ? `
        <div class="section">
            <h2>4. Key Decisions</h2>
            ${decisions.map((d, i) => {
                let conclusion = '', rationale = '';
                if (typeof d === 'string') {
                    conclusion = d;
                } else if (typeof d === 'object') {
                    conclusion = d.conclusion || d.decision || d.text || JSON.stringify(d);
                    rationale = d.rationale || d.reason || '';
                }
                return `
                    <div class="decision-card">
                        <div class="decision-number">${i + 1}</div>
                        <div class="decision-content">
                            <div class="decision-conclusion">${escapeHtml(conclusion)}</div>
                            ${rationale ? `<div class="decision-rationale"><strong>Rationale:</strong> ${escapeHtml(rationale)}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    ` : '';

    // Action Items
    const actionItemsHTML = actionItems && actionItems.length > 0 ? `
        <div class="section">
            <h2>5. Action Items</h2>
            <table class="data-table">
                <thead>
                    <tr><th>#</th><th>Task</th><th>Owner</th><th>Due Date</th><th>Priority</th></tr>
                </thead>
                <tbody>
                    ${actionItems.map((item, i) => {
                        const task = typeof item === 'string' ? item : (item.task || item.action || '');
                        const owner = typeof item === 'object' ? (item.owner || item.assignee || 'Unassigned') : 'Unassigned';
                        const dueDate = typeof item === 'object' ? (item.dueDate || item.deadline || '-') : '-';
                        const priority = typeof item === 'object' ? (item.priority || 'Medium') : 'Medium';
                        const priorityClass = priority.toLowerCase() === 'high' ? 'priority-high' : priority.toLowerCase() === 'low' ? 'priority-low' : 'priority-medium';
                        return `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${escapeHtml(task)}</td>
                                <td>${escapeHtml(owner)}</td>
                                <td>${escapeHtml(dueDate)}</td>
                                <td><span class="priority-badge ${priorityClass}">${escapeHtml(priority)}</span></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    ` : '';

    // Top Priorities
    const prioritiesHTML = topPriorities && topPriorities.length > 0 ? `
        <div class="section">
            <h2>6. Top Priorities</h2>
            ${topPriorities.map((p, i) => {
                let priorityText = '', speaker = '', percentage = '';
                if (typeof p === 'string') {
                    priorityText = p;
                } else if (typeof p === 'object') {
                    priorityText = p.priority || p.text || p.name || JSON.stringify(p);
                    speaker = p.speaker || '';
                    percentage = p.percentage || '';
                }
                return `
                    <div class="priority-item">
                        <div class="priority-num">${i + 1}</div>
                        <div class="priority-content">
                            <div class="priority-text">${escapeHtml(priorityText)}</div>
                            ${speaker || percentage ? `<div class="priority-meta">${speaker ? `Speaker: ${escapeHtml(speaker)}` : ''}${percentage ? ` | ${percentage}%` : ''}</div>` : ''}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    ` : '';

    // Risks
    const risksHTML = risks && risks.length > 0 ? `
        <div class="section">
            <h2>7. Risks & Concerns</h2>
            <table class="data-table">
                <thead>
                    <tr><th>#</th><th>Issue</th><th>Severity</th><th>Impact</th></tr>
                </thead>
                <tbody>
                    ${risks.map((r, i) => {
                        let issue = '', severity = '', impact = '';
                        if (typeof r === 'string') {
                            issue = r;
                        } else if (typeof r === 'object') {
                            issue = r.issue || r.risk || r.text || JSON.stringify(r);
                            severity = r.severity || 'N/A';
                            impact = r.impact || 'N/A';
                        }
                        const sevClass = severity.toLowerCase() === 'high' ? 'severity-high' : severity.toLowerCase() === 'low' ? 'severity-low' : 'severity-medium';
                        return `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${escapeHtml(issue)}</td>
                                <td><span class="severity-badge ${sevClass}">${escapeHtml(severity)}</span></td>
                                <td>${escapeHtml(impact)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    ` : '';

    // Sentiment
    const sentimentHTML = speakerSentiments && speakerSentiments.length > 0 ? `
        <div class="section">
            <h2>8. Participant Sentiment Overview</h2>
            <table class="data-table">
                <thead>
                    <tr><th>Speaker</th><th>Positive</th><th>Neutral</th><th>Negative</th><th>Score</th></tr>
                </thead>
                <tbody>
                    ${speakerSentiments.map(s => {
                        const score = s.averageSentiment || 50;
                        const scoreClass = score >= 65 ? 'sentiment-positive' : score >= 35 ? 'sentiment-neutral' : 'sentiment-negative';
                        return `
                            <tr>
                                <td>${escapeHtml(s.speaker || 'Unknown')}</td>
                                <td>${s.positiveCount || 0}</td>
                                <td>${s.neutralCount || 0}</td>
                                <td>${s.negativeCount || 0}</td>
                                <td><span class="${scoreClass}">${score.toFixed(0)}</span></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    ` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Minutes of Meeting - ${escapeHtml(title || meetingName)}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #fff;
            color: #1a1a2e;
            font-size: 13px;
            line-height: 1.6;
            padding: 0;
        }

        .title-block {
            text-align: center;
            border-bottom: 3px solid #10b981;
            padding-bottom: 18px;
            margin-bottom: 24px;
        }
        .title-block h1 {
            font-size: 26px;
            color: #10b981;
            margin-bottom: 4px;
            font-weight: 700;
        }
        .title-block .meeting-name {
            font-size: 18px;
            color: #333;
            font-weight: 600;
        }
        .title-block .subtitle {
            font-size: 12px;
            color: #888;
            margin-top: 4px;
        }

        .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
        }
        .meta-table td {
            padding: 8px 12px;
            border: 1px solid #e0e0e0;
            font-size: 12px;
        }
        .meta-table .meta-label {
            background: #f0fdf4;
            font-weight: 600;
            color: #059669;
            width: 160px;
        }

        .section {
            margin-bottom: 22px;
            page-break-inside: avoid;
        }
        .section h2 {
            font-size: 16px;
            color: #10b981;
            border-bottom: 2px solid #d1fae5;
            padding-bottom: 6px;
            margin-bottom: 12px;
            font-weight: 700;
        }
        .sub-heading {
            font-size: 13px;
            color: #059669;
            font-weight: 600;
            margin: 14px 0 8px 0;
        }
        .summary-text {
            font-size: 12.5px;
            line-height: 1.7;
            color: #333;
            white-space: pre-line;
        }

        .topic-summary-card {
            background: #f9fafb;
            border-left: 4px solid #10b981;
            padding: 10px 14px;
            margin-bottom: 10px;
            border-radius: 4px;
        }
        .topic-summary-title {
            font-weight: 600;
            color: #059669;
            font-size: 12.5px;
            margin-bottom: 4px;
        }
        .topic-summary-text {
            font-size: 12px;
            color: #444;
            line-height: 1.6;
        }

        .topics-container {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 6px;
        }
        .topic-chip {
            padding: 4px 12px;
            background: #ecfdf5;
            border: 1px solid #a7f3d0;
            border-radius: 16px;
            font-size: 11px;
            color: #065f46;
        }

        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        .data-table th {
            background: #f0fdf4;
            color: #059669;
            font-weight: 600;
            padding: 8px 10px;
            border: 1px solid #d1fae5;
            text-align: left;
        }
        .data-table td {
            padding: 8px 10px;
            border: 1px solid #e5e7eb;
        }
        .data-table tbody tr:nth-child(even) {
            background: #f9fafb;
        }

        .priority-badge, .severity-badge {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .priority-high, .severity-high { background: #fee2e2; color: #b91c1c; }
        .priority-medium, .severity-medium { background: #fef3c7; color: #b45309; }
        .priority-low, .severity-low { background: #d1fae5; color: #065f46; }

        .decision-card {
            display: flex;
            gap: 12px;
            margin-bottom: 10px;
            padding: 10px;
            background: #f9fafb;
            border-radius: 6px;
            border-left: 4px solid #10b981;
        }
        .decision-number {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #10b981;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 13px;
            flex-shrink: 0;
        }
        .decision-content { flex: 1; }
        .decision-conclusion { font-weight: 600; color: #1a1a2e; font-size: 12.5px; }
        .decision-rationale { font-size: 11.5px; color: #666; margin-top: 4px; }

        .priority-item {
            display: flex;
            gap: 12px;
            align-items: flex-start;
            margin-bottom: 8px;
            padding: 8px;
            background: #f9fafb;
            border-radius: 6px;
        }
        .priority-num {
            width: 26px;
            height: 26px;
            border-radius: 6px;
            background: #10b981;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 12px;
            flex-shrink: 0;
        }
        .priority-content { flex: 1; }
        .priority-text { font-size: 12.5px; color: #1a1a2e; font-weight: 500; }
        .priority-meta { font-size: 11px; color: #888; margin-top: 2px; }

        .sentiment-positive { color: #059669; font-weight: 700; }
        .sentiment-neutral { color: #d97706; font-weight: 700; }
        .sentiment-negative { color: #dc2626; font-weight: 700; }

        .footer-block {
            margin-top: 30px;
            padding-top: 14px;
            border-top: 2px solid #10b981;
            text-align: center;
            font-size: 11px;
            color: #888;
        }
    </style>
</head>
<body>
    <!-- Title Block -->
    <div class="title-block">
        <h1>Minutes of Meeting</h1>
        <div class="meeting-name">${escapeHtml(title || meetingName)}</div>
        <div class="subtitle">Generated by ACTA AI Meeting System</div>
    </div>

    <!-- Metadata Table -->
    <table class="meta-table">
        <tr><td class="meta-label">Meeting Title</td><td>${escapeHtml(title || meetingName)}</td></tr>
        <tr><td class="meta-label">Date</td><td>${meetingDate}</td></tr>
        ${meetingTime ? `<tr><td class="meta-label">Time</td><td>${meetingTime}${endTime ? ` - ${endTime}` : ''}</td></tr>` : ''}
        <tr><td class="meta-label">Duration</td><td>${escapeHtml(String(duration))}</td></tr>
        <tr><td class="meta-label">Platform</td><td>${escapeHtml(platform)}</td></tr>
        <tr><td class="meta-label">No. of Speakers</td><td>${speakerCount}</td></tr>
        <tr><td class="meta-label">Prepared By</td><td>${escapeHtml(preparedBy)}</td></tr>
    </table>

    ${attendeesHTML}
    ${agendaHTML}
    ${summaryHTML}
    ${decisionsHTML}
    ${actionItemsHTML}
    ${prioritiesHTML}
    ${risksHTML}
    ${sentimentHTML}

    <div class="footer-block">
        <p>ACTA AI Meeting System | Powered by Gemini AI</p>
        <p>Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>
</body>
</html>`;
};

module.exports = {
    generateDashboardPDF
};
