const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema({
  meetingLink: {
    type: String,
    required: true,
  },
  meetingId: {
    type: String,
    default: '',
  },
  zoomMeetingId: {
    type: String,
    default: '',
  },
  topic: {
    type: String,
    default: 'Zoom Meeting',
  },
  platform: {
    type: String,
    enum: ['zoom', 'google-meet', 'teams', 'upload', 'unknown'],
    default: 'unknown',
  },
  status: {
    type: String,
    enum: ['pending', 'starting', 'navigating', 'joining', 'waiting', 'in-meeting', 'recording', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  audioPath: {
    type: String,
  },
  transcription: {
    type: String,
    default: '',
  },
  // Live transcription data (sentence-based)
  liveTranscriptSentences: {
    type: [{
      text: String,
      confidence: Number,
      timestamp: Date,
      wordCount: Number,
      metadata: {
        totalWords: Number,
        totalSentences: Number,
        averageConfidence: Number
      }
    }],
    default: [],
  },
  liveTranscriptFull: {
    type: String,
    default: '',
  },
  liveTranscriptUpdatedAt: {
    type: Date,
    default: null,
  },
  speakerSegments: {
    type: Array,
    default: [],
  },
  speakerStats: {
    type: Object,
    default: {},
  },
  totalSpeakers: {
    type: Number,
    default: 0,
  },
  analysis: {
    type: Object,
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  userEmail: {
    type: String,
  },
  extractedTasks: {
    type: Array,
    default: [],
  },
  tasksUpdatedAt: {
    type: Date,
    default: null,
  },
  taskIntegrations: {
    type: Array,
    default: [],
    // Array of { taskIndex, jira: { added, issueKey }, trello: { added, cardId } }
  },
  meetingName: {
    type: String,
    default: 'Meeting',
  },
  botName: {
    type: String,
    default: 'AI Bot',
  },
  collaborators: {
    type: Array,
    default: [],
    // Array of email addresses who have access to this meeting dashboard
  },
  speakerNameMapping: {
    type: Object,
    default: {},
    // Maps original speaker names to custom names: { "Speaker_A": "John Doe", "Speaker_B": "Jane Smith" }
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
});

module.exports = mongoose.model('Meeting', MeetingSchema);
