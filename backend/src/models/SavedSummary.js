const mongoose = require('mongoose');

const SavedSummarySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  meetingIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
  }],
  summaryData: {
    type: Object,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('SavedSummary', SavedSummarySchema);
