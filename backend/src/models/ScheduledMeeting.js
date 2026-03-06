const mongoose = require('mongoose');

const ScheduledMeetingSchema = new mongoose.Schema({
  meetingType: {
    type: String,
    enum: ['meet', 'zoom', 'teams'],
    required: true,
  },
  meetingLink: {
    type: String,
    required: true,
  },
  scheduledTime: {
    type: Date,
    required: true,
  },
  title: {
    type: String,
    default: 'Scheduled Meeting',
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  userEmail: {
    type: String,
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ScheduledMeeting', ScheduledMeetingSchema);
