const nodemailer = require('nodemailer');

const emailUser = process.env.EMAIL_USER || 'dharmikgohil395003@gmail.com';

let transporter = null;

function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: process.env.EMAIL_PASS || 'yryu zimj ynjf japr'
            }
        });
    }
    return transporter;
}

/**
 * Send notification email for team/classroom/company invites and meetings
 */
const sendTeamNotification = async (toEmail, groupName, inviterName, type, meetingInfo = null) => {
    try {
        let subject, html;

        if (type === 'meeting' && meetingInfo) {
            subject = `📅 New Meeting: ${meetingInfo.title} - ${groupName}`;
            html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea; }
                        .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>📅 Meeting Notification</h1>
                            <p>New meeting shared in ${groupName}</p>
                        </div>
                        <div class="content">
                            <div class="info-box">
                                <h2 style="margin-top: 0;">${meetingInfo.title}</h2>
                                <p><strong>Shared by:</strong> ${inviterName}</p>
                                <p><strong>Group:</strong> ${groupName}</p>
                                ${meetingInfo.scheduledTime ? `<p><strong>Time:</strong> ${new Date(meetingInfo.scheduledTime).toLocaleString()}</p>` : ''}
                                <p><strong>Link:</strong> <a href="${meetingInfo.link}" style="color: #667eea;">${meetingInfo.link}</a></p>
                                <a href="${meetingInfo.link}" class="btn" style="color: white;">Join Meeting</a>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;
        } else {
            const typeLabels = {
                team: 'Team',
                classroom: 'Classroom',
                company: 'Company'
            };
            const label = typeLabels[type] || 'Group';

            subject = `🎉 You've been invited to ${groupName} - ACTA AI`;
            html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea; }
                        .btn { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🎉 ${label} Invitation</h1>
                            <p>You're invited to join a ${label.toLowerCase()}</p>
                        </div>
                        <div class="content">
                            <div class="info-box">
                                <h2 style="margin-top: 0;">${groupName}</h2>
                                <p><strong>Invited by:</strong> ${inviterName}</p>
                                <p><strong>Type:</strong> ${label}</p>
                                <p>Log in to ACTA AI to accept this invitation and access shared meetings, chats, and more.</p>
                                <a href="http://localhost:5173/teams" class="btn" style="color: white;">Open ACTA AI</a>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;
        }

        await getTransporter().sendMail({
            from: `"ACTA AI" <${emailUser}>`,
            to: toEmail,
            subject,
            html
        });

        console.log(`[TeamEmail] Notification sent to ${toEmail} for ${type}`);
    } catch (error) {
        console.error('[TeamEmail] Send error:', error.message);
        throw error;
    }
};

module.exports = { sendTeamNotification };
