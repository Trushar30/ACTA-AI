const nodemailer = require('nodemailer');

// Email configuration - lazy initialization
let transporter = null;
const emailUser = process.env.EMAIL_USER || 'dharmikgohil395003@gmail.com';

function getTransporter() {
    if (!transporter) {
        try {
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: emailUser,
                    pass: process.env.EMAIL_PASS || 'yryu zimj ynjf japr'
                }
            });
            console.log('[Email] Transporter initialized successfully');
        } catch (error) {
            console.error('[Email] Failed to create transporter:', error);
            throw error;
        }
    }
    return transporter;
}

/**
 * Send meeting reminder email
 */
const sendMeetingReminder = async (meeting) => {
    try {
        const scheduledDate = new Date(meeting.scheduledTime);
        const formattedDate = scheduledDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = scheduledDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const meetingTypeNames = {
            zoom: 'Zoom',
            meet: 'Google Meet',
            teams: 'Microsoft Teams'
        };

        const mailOptions = {
            from: emailUser,
            to: emailUser,
            subject: `🔔 Meeting Reminder: ${meeting.title || 'Scheduled Meeting'} Tomorrow`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .meeting-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                        .detail-row { margin: 10px 0; }
                        .label { font-weight: bold; color: #667eea; }
                        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📅 Meeting Reminder</h1>
                            <p>Your meeting is scheduled for tomorrow!</p>
                        </div>
                        <div class="content">
                            <div class="meeting-details">
                                <h2 style="margin-top: 0; color: #333;">${meeting.title || 'Scheduled Meeting'}</h2>
                                
                                <div class="detail-row">
                                    <span class="label">📅 Date:</span> ${formattedDate}
                                </div>
                                
                                <div class="detail-row">
                                    <span class="label">🕐 Time:</span> ${formattedTime}
                                </div>
                                
                                <div class="detail-row">
                                    <span class="label">💻 Platform:</span> ${meetingTypeNames[meeting.meetingType] || meeting.meetingType}
                                </div>
                                
                                <div class="detail-row">
                                    <span class="label">🔗 Meeting Link:</span><br/>
                                    <a href="${meeting.meetingLink}" style="color: #667eea; word-break: break-all;">${meeting.meetingLink}</a>
                                </div>
                                
                                <a href="${meeting.meetingLink}" class="button" style="color: white;">Join Meeting</a>
                            </div>
                            
                            <p style="margin-top: 20px;">
                                ⚡ <strong>Tip:</strong> The bot will automatically join the meeting at the scheduled time to record and transcribe it for you.
                            </p>
                        </div>
                        <div class="footer">
                            <p>This is an automated reminder from ACTA AI Meeting System</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await getTransporter().sendMail(mailOptions);
        console.log('✅ Meeting reminder email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending meeting reminder:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send Minutes of Meeting (MOM) email
 */
const sendDashboardSummary = async (meetingId, dashboardData, recipientEmail = null) => {
    try {
        const emailTo = recipientEmail || emailUser;

        const safeText = (val) => {
            if (!val) return '';
            if (typeof val === 'string') return val;
            if (typeof val === 'object') {
                return val.text || val.conclusion || val.issue || val.priority || val.task || JSON.stringify(val);
            }
            return String(val);
        };

        const title = dashboardData.title || 'Meeting Analysis';
        const summary = dashboardData.summary || '';
        const duration = dashboardData.totalDuration || 'N/A';
        const speakerCount = dashboardData.speakerCount || 0;
        const actionItems = dashboardData.actionItems || [];
        const decisions = dashboardData.decisions || [];
        const risks = dashboardData.risks || [];
        const topPriorities = dashboardData.topPriorities || [];
        const participants = dashboardData.participants || [];

        // Build decisions HTML
        const decisionsHTML = decisions.length > 0 ? `
            <div class="section">
                <div class="section-title">Key Decisions</div>
                ${decisions.map((d, i) => {
                    let conclusion = '', rationale = '';
                    if (typeof d === 'string') { conclusion = d; }
                    else if (typeof d === 'object') {
                        conclusion = d.conclusion || d.decision || d.text || safeText(d);
                        rationale = d.rationale || d.reason || '';
                    }
                    return `<div class="decision-item">
                        <strong>${i + 1}. ${conclusion}</strong>
                        ${rationale ? `<br/><small style="color:#666;">Rationale: ${rationale}</small>` : ''}
                    </div>`;
                }).join('')}
            </div>` : '';

        // Build action items HTML
        const actionItemsHTML = actionItems.length > 0 ? `
            <div class="section">
                <div class="section-title">Action Items</div>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="background:#f0fdf4;">
                            <th style="padding:8px;border:1px solid #d1fae5;text-align:left;color:#059669;">#</th>
                            <th style="padding:8px;border:1px solid #d1fae5;text-align:left;color:#059669;">Task</th>
                            <th style="padding:8px;border:1px solid #d1fae5;text-align:left;color:#059669;">Owner</th>
                            <th style="padding:8px;border:1px solid #d1fae5;text-align:left;color:#059669;">Due Date</th>
                            <th style="padding:8px;border:1px solid #d1fae5;text-align:left;color:#059669;">Priority</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${actionItems.map((item, i) => {
                            const task = typeof item === 'string' ? item : (item.task || item.action || '');
                            const owner = typeof item === 'object' ? (item.owner || item.assignee || '-') : '-';
                            const dueDate = typeof item === 'object' ? (item.dueDate || item.deadline || '-') : '-';
                            const priority = typeof item === 'object' ? (item.priority || 'Medium') : 'Medium';
                            const pColor = priority.toLowerCase() === 'high' ? '#b91c1c' : priority.toLowerCase() === 'low' ? '#065f46' : '#b45309';
                            const pBg = priority.toLowerCase() === 'high' ? '#fee2e2' : priority.toLowerCase() === 'low' ? '#d1fae5' : '#fef3c7';
                            return `<tr>
                                <td style="padding:8px;border:1px solid #e5e7eb;">${i + 1}</td>
                                <td style="padding:8px;border:1px solid #e5e7eb;">${task}</td>
                                <td style="padding:8px;border:1px solid #e5e7eb;">${owner}</td>
                                <td style="padding:8px;border:1px solid #e5e7eb;">${dueDate}</td>
                                <td style="padding:8px;border:1px solid #e5e7eb;"><span style="padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;background:${pBg};color:${pColor};">${priority}</span></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>` : '';

        // Build risks HTML
        const risksHTML = risks.length > 0 ? `
            <div class="section">
                <div class="section-title">Risks &amp; Concerns</div>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="background:#f0fdf4;">
                            <th style="padding:8px;border:1px solid #d1fae5;text-align:left;color:#059669;">#</th>
                            <th style="padding:8px;border:1px solid #d1fae5;text-align:left;color:#059669;">Issue</th>
                            <th style="padding:8px;border:1px solid #d1fae5;text-align:left;color:#059669;">Severity</th>
                            <th style="padding:8px;border:1px solid #d1fae5;text-align:left;color:#059669;">Impact</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${risks.map((r, i) => {
                            let issue = '', severity = '', impact = '';
                            if (typeof r === 'string') { issue = r; }
                            else if (typeof r === 'object') {
                                issue = r.issue || r.risk || r.text || safeText(r);
                                severity = r.severity || 'N/A';
                                impact = r.impact || 'N/A';
                            }
                            return `<tr>
                                <td style="padding:8px;border:1px solid #e5e7eb;">${i + 1}</td>
                                <td style="padding:8px;border:1px solid #e5e7eb;">${issue}</td>
                                <td style="padding:8px;border:1px solid #e5e7eb;">${severity}</td>
                                <td style="padding:8px;border:1px solid #e5e7eb;">${impact}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>` : '';

        // Build priorities HTML
        const prioritiesHTML = topPriorities.length > 0 ? `
            <div class="section">
                <div class="section-title">Top Priorities</div>
                ${topPriorities.slice(0, 5).map((p, i) => {
                    let priorityText = '', speaker = '';
                    if (typeof p === 'string') { priorityText = p; }
                    else if (typeof p === 'object') {
                        priorityText = p.priority || p.text || p.name || safeText(p);
                        speaker = p.speaker || '';
                    }
                    return `<div style="margin:8px 0;padding:10px;background:#f9fafb;border-left:3px solid #10b981;border-radius:4px;">
                        <strong>${i + 1}. ${priorityText}</strong>
                        ${speaker ? `<br/><small style="color:#666;">Speaker: ${speaker}</small>` : ''}
                    </div>`;
                }).join('')}
            </div>` : '';

        // Build participants HTML
        const participantsHTML = participants.length > 0 ? `
            <div class="section">
                <div class="section-title">Participants</div>
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="background:#f0fdf4;">
                            <th style="padding:8px;border:1px solid #d1fae5;text-align:left;color:#059669;">Name</th>
                            <th style="padding:8px;border:1px solid #d1fae5;text-align:left;color:#059669;">Role</th>
                            <th style="padding:8px;border:1px solid #d1fae5;text-align:left;color:#059669;">Contribution</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${participants.map(p => `<tr>
                            <td style="padding:8px;border:1px solid #e5e7eb;">${p.name || 'Unknown'}</td>
                            <td style="padding:8px;border:1px solid #e5e7eb;">${p.role || 'Participant'}</td>
                            <td style="padding:8px;border:1px solid #e5e7eb;">${(p.contribution || 0).toFixed(1)}%</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>` : '';

        const mailOptions = {
            from: emailUser,
            to: emailTo,
            subject: `📋 Minutes of Meeting: ${title}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
                        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; }
                        .section { margin: 25px 0; }
                        .section-title { font-size: 16px; font-weight: bold; color: #10b981; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid #d1fae5; }
                        .meta-table td { padding: 8px 12px; border: 1px solid #e0e0e0; font-size: 13px; }
                        .meta-label { background: #f0fdf4; font-weight: 600; color: #059669; width: 150px; }
                        .decision-item { margin: 8px 0; padding: 10px; background: #f9fafb; border-left: 3px solid #10b981; border-radius: 4px; }
                        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #666; font-size: 12px; }
                        .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📋 Minutes of Meeting</h1>
                            <p style="opacity:0.9;">AI-Powered Meeting Analysis by ACTA AI</p>
                        </div>
                        <div class="content">
                            <!-- Metadata -->
                            <table class="meta-table" style="width:100%;border-collapse:collapse;margin-bottom:20px;">
                                <tr><td class="meta-label">Meeting Title</td><td>${title}</td></tr>
                                <tr><td class="meta-label">Date</td><td>${dashboardData.date || new Date().toLocaleDateString()}</td></tr>
                                <tr><td class="meta-label">Duration</td><td>${duration}</td></tr>
                                <tr><td class="meta-label">Speakers</td><td>${speakerCount}</td></tr>
                                <tr><td class="meta-label">Action Items</td><td>${actionItems.length}</td></tr>
                            </table>

                            <!-- Summary -->
                            ${summary ? `
                            <div class="section">
                                <div class="section-title">Meeting Summary</div>
                                <p style="white-space:pre-line;">${summary}</p>
                            </div>` : ''}

                            ${participantsHTML}
                            ${decisionsHTML}
                            ${actionItemsHTML}
                            ${prioritiesHTML}
                            ${risksHTML}

                            <div style="text-align:center;margin-top:30px;">
                                <a href="http://localhost:5173/dashboard/${meetingId}" class="button" style="color:white;">View Full Dashboard</a>
                            </div>
                        </div>
                        <div class="footer">
                            <p>Generated by ACTA AI Meeting System | Powered by Gemini AI</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await getTransporter().sendMail(mailOptions);
        console.log('✅ MOM email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending MOM email:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send dashboard summary to all collaborators
 */
const sendDashboardToCollaborators = async (meetingId, dashboardData, collaborators) => {
    try {
        if (!collaborators || collaborators.length === 0) {
            console.log('[Email] No collaborators to send dashboard to');
            return { success: true, sent: 0 };
        }

        console.log(`[Email] Sending dashboard to ${collaborators.length} collaborator(s)`);
        
        const results = [];
        for (const email of collaborators) {
            try {
                const result = await sendDashboardSummary(meetingId, dashboardData, email);
                results.push({ email, success: result.success });
                console.log(`[Email] ✅ Dashboard sent to: ${email}`);
            } catch (error) {
                console.error(`[Email] ❌ Failed to send to ${email}:`, error.message);
                results.push({ email, success: false, error: error.message });
            }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`[Email] Dashboard sent to ${successCount}/${collaborators.length} collaborator(s)`);

        return { 
            success: true, 
            sent: successCount, 
            total: collaborators.length,
            results 
        };
    } catch (error) {
        console.error('[Email] Error sending to collaborators:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Send collaborator invitation email
 */
const sendCollaboratorInvite = async (collaboratorEmail, meetingTitle, meetingId, inviterEmail = 'ACTA AI') => {
    try {
        const mailOptions = {
            from: emailUser,
            to: collaboratorEmail,
            subject: `🤝 You've been invited to collaborate on: ${meetingTitle}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1; }
                        .button { display: inline-block; padding: 12px 30px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🤝 Collaboration Invitation</h1>
                            <p>You've been added as a collaborator!</p>
                        </div>
                        <div class="content">
                            <div class="info-box">
                                <h2 style="margin-top: 0; color: #333;">Meeting: ${meetingTitle}</h2>
                                <p style="color: #666;">
                                    <strong>${inviterEmail}</strong> has shared this meeting dashboard with you.
                                </p>
                                <p>
                                    You now have access to:
                                </p>
                                <ul style="color: #555;">
                                    <li>Full meeting transcript</li>
                                    <li>AI-generated analysis and insights</li>
                                    <li>Action items and priorities</li>
                                    <li>Participant contributions</li>
                                    <li>Follow-up recommendations</li>
                                </ul>
                                
                                <a href="http://localhost:5173/collaborate" class="button" style="color: white;">View Dashboard</a>
                            </div>
                            
                            <p style="margin-top: 20px; color: #666; font-size: 14px;">
                                💡 <strong>Tip:</strong> You can ask questions about the meeting using our AI assistant!
                            </p>
                        </div>
                        <div class="footer">
                            <p>This invitation was sent from ACTA AI Meeting System</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        };

        const info = await getTransporter().sendMail(mailOptions);
        console.log('✅ Collaborator invite email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending collaborator invite:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendMeetingReminder,
    sendDashboardSummary,
    sendDashboardToCollaborators,
    sendCollaboratorInvite
};
