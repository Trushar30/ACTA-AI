const cron = require('node-cron');
const ScheduledMeeting = require('../models/ScheduledMeeting');
const Meeting = require('../models/Meeting');
const { runBot } = require('../bot/bot');
const { sendMeetingReminder } = require('./emailService');

// Store active scheduled jobs
const activeJobs = new Map();

// Check for meetings to join every minute
let schedulerJob = null;

// Reminder job for sending emails at 8 PM
let reminderJob = null;

/**
 * Start the meeting scheduler service
 */
function startScheduler() {
    if (schedulerJob) {
        console.log('[Scheduler] Already running');
        return;
    }

    console.log('[Scheduler] 🚀 Starting automatic meeting scheduler...');
    
    // Run every minute to check for scheduled meetings
    schedulerJob = cron.schedule('* * * * *', async () => {
        try {
            await checkAndJoinScheduledMeetings();
        } catch (error) {
            console.error('[Scheduler] Error in cron job:', error);
        }
    });

    // Run daily at 8 PM (20:00) to send reminders for tomorrow's meetings
    reminderJob = cron.schedule('0 20 * * *', async () => {
        try {
            await sendTomorrowMeetingReminders();
        } catch (error) {
            console.error('[Scheduler] Error sending reminders:', error);
        }
    });

    console.log('[Scheduler] ✅ Scheduler started - checking every minute');
    console.log('[Scheduler] ✅ Reminder service started - running daily at 8 PM');
}

/**
 * Stop the meeting scheduler service
 */
function stopScheduler() {
    if (schedulerJob) {
        schedulerJob.stop();
        schedulerJob = null;
        console.log('[Scheduler] ⏹️ Scheduler stopped');
    }
    if (reminderJob) {
        reminderJob.stop();
        reminderJob = null;
        console.log('[Scheduler] ⏹️ Reminder service stopped');
    }
}

/**
 * Clean up expired scheduled meetings (older than 30 minutes)
 * Also clean up old completed meetings (older than 7 days)
 * Works for ALL meeting types: Zoom, Google Meet, Microsoft Teams
 * 
 * Cleanup Rules:
 * - Scheduled meetings: Remove after 30 minutes past scheduled time
 * - Completed meetings: Remove after 7 days
 * - Cancelled meetings: Remove after 1 day
 */
async function cleanupExpiredMeetings() {
    try {
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60000); // 30 minutes ago
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60000); // 7 days ago
        
        let totalDeleted = 0;

        // 1. Clean up expired SCHEDULED meetings (older than 30 minutes)
        // Applies to all meeting types: Zoom, Meet, Teams
        const expiredScheduled = await ScheduledMeeting.find({
            status: 'scheduled',
            scheduledTime: { $lt: thirtyMinutesAgo }
        });

        if (expiredScheduled.length > 0) {
            console.log(`[Scheduler] 🗑️ Cleaning up ${expiredScheduled.length} expired scheduled meeting(s)`);
            
            const scheduledResult = await ScheduledMeeting.deleteMany({
                status: 'scheduled',
                scheduledTime: { $lt: thirtyMinutesAgo }
            });
            
            console.log(`[Scheduler] ✅ Deleted ${scheduledResult.deletedCount} expired scheduled meeting(s)`);
            totalDeleted += scheduledResult.deletedCount;
        }

        // 2. Clean up old COMPLETED meetings (older than 7 days)
        // Applies to all meeting types: Zoom, Meet, Teams
        const oldCompleted = await ScheduledMeeting.find({
            status: 'completed',
            scheduledTime: { $lt: sevenDaysAgo }
        });

        if (oldCompleted.length > 0) {
            console.log(`[Scheduler] 🗑️ Cleaning up ${oldCompleted.length} old completed meeting(s)`);
            
            const completedResult = await ScheduledMeeting.deleteMany({
                status: 'completed',
                scheduledTime: { $lt: sevenDaysAgo }
            });
            
            console.log(`[Scheduler] ✅ Deleted ${completedResult.deletedCount} old completed meeting(s)`);
            totalDeleted += completedResult.deletedCount;
        }

        // 3. Clean up CANCELLED meetings (older than 1 day)
        // Applies to all meeting types: Zoom, Meet, Teams
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60000);
        const cancelledResult = await ScheduledMeeting.deleteMany({
            status: 'cancelled',
            scheduledTime: { $lt: oneDayAgo }
        });

        if (cancelledResult.deletedCount > 0) {
            console.log(`[Scheduler] 🗑️ Deleted ${cancelledResult.deletedCount} cancelled meeting(s)`);
            totalDeleted += cancelledResult.deletedCount;
        }
        
        return totalDeleted;
    } catch (error) {
        console.error('[Scheduler] Error cleaning up expired meetings:', error);
        return 0;
    }
}

/**
 * Check for scheduled meetings that need to be joined
 */
async function checkAndJoinScheduledMeetings() {
    try {
        const now = new Date();
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60000); // 5 minutes buffer

        // Clean up expired meetings first
        await cleanupExpiredMeetings();

        // Find scheduled meetings that should start now (within 5 minute window)
        const upcomingMeetings = await ScheduledMeeting.find({
            status: 'scheduled',
            scheduledTime: {
                $gte: now,
                $lte: fiveMinutesFromNow
            }
        });

        if (upcomingMeetings.length > 0) {
            console.log(`[Scheduler] 📅 Found ${upcomingMeetings.length} meeting(s) to join`);
        }

        for (const scheduledMeeting of upcomingMeetings) {
            await joinScheduledMeeting(scheduledMeeting);
        }

    } catch (error) {
        console.error('[Scheduler] Error checking scheduled meetings:', error);
    }
}

/**
 * Join a scheduled meeting automatically
 */
async function joinScheduledMeeting(scheduledMeeting) {
    try {
        const meetingId = scheduledMeeting._id.toString();
        
        // Check if already joined
        if (activeJobs.has(meetingId)) {
            console.log(`[Scheduler] Meeting ${meetingId} already being processed`);
            return;
        }

        // Mark as being processed
        activeJobs.set(meetingId, true);

        console.log(`[Scheduler] 🤖 Auto-joining meeting: ${scheduledMeeting.title || 'Scheduled Meeting'}`);
        console.log(`[Scheduler] Type: ${scheduledMeeting.meetingType}, Time: ${scheduledMeeting.scheduledTime}`);

        // Create a Meeting record for this scheduled meeting
        const meeting = new Meeting({
            meetingLink: scheduledMeeting.meetingLink,
            meetingName: scheduledMeeting.title || 'Scheduled Meeting',
            status: 'pending',
            userId: scheduledMeeting.userId,
            userEmail: scheduledMeeting.userEmail,
            botName: 'AI Bot (Scheduled)',
            createdAt: new Date()
        });

        await meeting.save();
        console.log(`[Scheduler] Created meeting record: ${meeting._id}`);

        // Update scheduled meeting status to 'completed' (being processed)
        scheduledMeeting.status = 'completed';
        await scheduledMeeting.save();

        // Launch the bot to join the meeting
        const botName = `AI Bot - ${scheduledMeeting.title || 'Scheduled'}`;
        
        // Run bot in background (don't wait for it to complete)
        runBot(
            scheduledMeeting.meetingLink,
            meeting._id,
            scheduledMeeting.userId,
            botName
        ).then(() => {
            console.log(`[Scheduler] ✅ Bot successfully joined scheduled meeting: ${meeting._id}`);
            activeJobs.delete(meetingId);
        }).catch((error) => {
            console.error(`[Scheduler] ❌ Failed to join scheduled meeting:`, error);
            activeJobs.delete(meetingId);
            
            // Update meeting status to failed
            Meeting.findByIdAndUpdate(meeting._id, { 
                status: 'failed',
                error: error.message 
            }).catch(err => console.error('[Scheduler] Error updating meeting status:', err));
        });

        console.log(`[Scheduler] 🎯 Bot launch initiated for meeting: ${meeting._id}`);

    } catch (error) {
        console.error('[Scheduler] Error joining scheduled meeting:', error);
        activeJobs.delete(scheduledMeeting._id.toString());
        
        // Update scheduled meeting status to cancelled on error
        scheduledMeeting.status = 'cancelled';
        await scheduledMeeting.save().catch(err => 
            console.error('[Scheduler] Error updating scheduled meeting status:', err)
        );
    }
}

/**
 * Manually trigger a scheduled meeting (for testing)
 */
async function triggerScheduledMeeting(scheduledMeetingId) {
    try {
        const scheduledMeeting = await ScheduledMeeting.findById(scheduledMeetingId);
        
        if (!scheduledMeeting) {
            throw new Error('Scheduled meeting not found');
        }

        if (scheduledMeeting.status !== 'scheduled') {
            throw new Error('Meeting is not in scheduled status');
        }

        console.log(`[Scheduler] 🔧 Manually triggering scheduled meeting: ${scheduledMeetingId}`);
        await joinScheduledMeeting(scheduledMeeting);
        
        return { success: true, message: 'Meeting triggered successfully' };
    } catch (error) {
        console.error('[Scheduler] Error triggering meeting:', error);
        throw error;
    }
}

/**
 * Send meeting reminders for tomorrow's meetings
 * Runs daily at 8 PM (20:00)
 */
async function sendTomorrowMeetingReminders() {
    try {
        console.log('[Scheduler] 📧 Checking for tomorrow\'s meetings to send reminders...');
        
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Set to start of tomorrow (00:00:00)
        const tomorrowStart = new Date(tomorrow);
        tomorrowStart.setHours(0, 0, 0, 0);
        
        // Set to end of tomorrow (23:59:59)
        const tomorrowEnd = new Date(tomorrow);
        tomorrowEnd.setHours(23, 59, 59, 999);
        
        // Find all scheduled meetings for tomorrow
        const tomorrowMeetings = await ScheduledMeeting.find({
            status: 'scheduled',
            scheduledTime: {
                $gte: tomorrowStart,
                $lte: tomorrowEnd
            }
        });
        
        if (tomorrowMeetings.length === 0) {
            console.log('[Scheduler] 📭 No meetings scheduled for tomorrow');
            return;
        }
        
        console.log(`[Scheduler] 📬 Found ${tomorrowMeetings.length} meeting(s) for tomorrow`);
        
        // Send reminder for each meeting
        for (const meeting of tomorrowMeetings) {
            try {
                await sendMeetingReminder(meeting);
                console.log(`[Scheduler] ✅ Reminder sent for: ${meeting.title || 'Scheduled Meeting'}`);
            } catch (error) {
                console.error(`[Scheduler] ❌ Failed to send reminder for meeting ${meeting._id}:`, error);
            }
        }
        
        console.log('[Scheduler] 📧 Reminder sending complete');
    } catch (error) {
        console.error('[Scheduler] Error in sendTomorrowMeetingReminders:', error);
    }
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
    return {
        running: schedulerJob !== null,
        reminderServiceRunning: reminderJob !== null,
        activeJobs: activeJobs.size,
        activeJobIds: Array.from(activeJobs.keys())
    };
}

module.exports = {
    startScheduler,
    stopScheduler,
    checkAndJoinScheduledMeetings,
    triggerScheduledMeeting,
    getSchedulerStatus,
    cleanupExpiredMeetings,
    sendTomorrowMeetingReminders
};
