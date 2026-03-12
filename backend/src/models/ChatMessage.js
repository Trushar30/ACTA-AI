const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema({
    // Context: which group/channel this message belongs to
    contextType: {
        type: String,
        enum: ['team', 'classroom', 'company', 'direct'],
        required: true
    },
    contextId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderEmail: { type: String, required: true },
    senderName: { type: String, default: '' },
    senderPicture: { type: String, default: '' },
    message: { type: String, required: true, trim: true },
    messageType: {
        type: String,
        enum: ['text', 'meeting-link', 'announcement', 'system'],
        default: 'text'
    },
    readBy: [{ type: String }], // email list
}, { timestamps: true });

ChatMessageSchema.index({ contextType: 1, contextId: 1, createdAt: -1 });
ChatMessageSchema.index({ senderId: 1 });

module.exports = mongoose.model('ChatMessage', ChatMessageSchema);
