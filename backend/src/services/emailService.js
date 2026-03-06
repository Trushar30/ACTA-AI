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
 * Send dashboard summary email
 */
const sendDashboardSummary = async (meetingId, dashboardData, recipientEmail = null) => {
    try {
        const emailTo = recipientEmail || emailUser;
        
        const mailOptions = {
            from: emailUser,
            to: emailTo,
            subject: `📊 Meeting Dashboard Summary: ${dashboardData.title || 'Meeting Analysis'}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
                        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                        .content { background: white; padding: 30px; border-radius: 0 0 10px 10px; }
                        .section { margin: 25px 0; padding: 20px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #10b981; }
                        .section-title { font-size: 18px; font-weight: bold; color: #10b981; margin-bottom: 10px; }
                        .summary-box { background: #ecfdf5; padding: 15px; border-radius: 6px; margin: 15px 0; }
                        .stat { display: inline-block; margin: 10px 20px 10px 0; }
                        .stat-label { font-weight: bold; color: #059669; }
                        .action-item { background: white; padding: 12px; margin: 8px 0; border-left: 3px solid #f59e0b; border-radius: 4px; }
                        .priority-high { border-left-color: #ef4444; }
                        .priority-medium { border-left-color: #f59e0b; }
                        .priority-low { border-left-color: #10b981; }
                        .participant { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
                        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #666; font-size: 12px; }
                        .button { display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📊 Meeting Dashboard Summary</h1>
                            <p>AI-Powered Meeting Analysis</p>
                        </div>
                        <div class="content">
                            <!-- Meeting Overview -->
                            <div class="summary-box">
                                <h2 style="margin-top: 0; color: #059669;">${dashboardData.title || 'Meeting Analysis'}</h2>
                                <p style="color: #666;">${dashboardData.date || ''}</p>
                                
                                <div class="stat">
                                    <span class="stat-label">⏱️ Duration:</span> ${dashboardData.totalDuration || 'N/A'}
                                </div>
                                <div class="stat">
                                    <span class="stat-label">👥 Speakers:</span> ${dashboardData.speakerCount || 0}
                                </div>
                                <div class="stat">
                                    <span class="stat-label">✅ Action Items:</span> ${dashboardData.actionItemCount || 0}
                                </div>
                                <div class="stat">
                                    <span class="stat-label">😊 Sentiment:</span> ${dashboardData.overallSentiment || 'N/A'}
                                </div>
                            </div>

                            <!-- Summary -->
                            ${dashboardData.summary ? `
                            <div class="section">
                                <div class="section-title">📝 Summary</div>
                                <p>${dashboardData.summary}</p>
                            </div>
                            ` : ''}

                            <!-- Top Priorities -->
                            ${dashboardData.topPriorities && dashboardData.topPriorities.length > 0 ? `
                            <div class="section">
                                <div class="section-title">🎯 Top Priorities</div>
                                ${dashboardData.topPriorities.slice(0, 5).map((priority, index) => `
                                    <div style="margin: 10px 0;">
                                        <strong>${index + 1}. ${priority.priority}</strong>
                                        ${priority.speaker ? `<br/><small style="color: #666;">Mentioned by: ${priority.speaker}</small>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                            ` : ''}

                            <!-- Action Items -->
                            ${dashboardData.actionItems && dashboardData.actionItems.length > 0 ? `
                            <div class="section">
                                <div class="section-title">✅ Action Items</div>
                                ${dashboardData.actionItems.map(item => `
                                    <div class="action-item priority-${(item.priority || 'medium').toLowerCase()}">
                                        <strong>${item.task}</strong><br/>
                                        <small style="color: #666;">
                                            ${item.owner ? `👤 ${item.owner}` : ''} 
                                            ${item.dueDate ? `| 📅 ${item.dueDate}` : ''} 
                                            ${item.priority ? `| 🔥 ${item.priority}` : ''}
                                        </small>
                                    </div>
                                `).join('')}
                            </div>
                            ` : ''}

                            <!-- Participants -->
                            ${dashboardData.participants && dashboardData.participants.length > 0 ? `
                            <div class="section">
                                <div class="section-title">👥 Participants</div>
                                ${dashboardData.participants.map(participant => `
                                    <div class="participant">
                                        <strong>${participant.name}</strong> 
                                        ${participant.role ? `- ${participant.role}` : ''}<br/>
                                        <small style="color: #666;">
                                            Contribution: ${participant.contribution || 0}%
                                            ${participant.persona ? ` | Persona: ${participant.persona}` : ''}
                                        </small>
                                    </div>
                                `).join('')}
                            </div>
                            ` : ''}

                            <!-- Follow-up Email -->
                            ${dashboardData.followUpEmail ? `
                            <div class="section">
                                <div class="section-title">📧 Suggested Follow-up Email</div>
                                <div style="white-space: pre-wrap; font-size: 14px; color: #374151;">${dashboardData.followUpEmail}</div>
                            </div>
                            ` : ''}

                            <a href="http://localhost:5173/dashboard/${meetingId}" class="button" style="color: white;">View Full Dashboard</a>
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
        console.log('✅ Dashboard summary email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending dashboard summary:', error);
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
