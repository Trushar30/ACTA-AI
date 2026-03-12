const mongoose = require('mongoose');
const crypto = require('crypto');

const MemberSchema = new mongoose.Schema({
    email: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, default: '' },
    role: {
        type: String,
        enum: ['owner', 'admin', 'teacher', 'student', 'member'],
        default: 'member'
    },
    status: {
        type: String,
        enum: ['pending', 'active', 'removed'],
        default: 'pending'
    },
    joinedAt: { type: Date, default: Date.now }
});

const TeamSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
        type: String,
        enum: ['student', 'employee'],
        required: true
    },
    category: {
        type: String,
        enum: ['classroom', 'study-group', 'department', 'project', 'general'],
        default: 'general'
    },
    visibility: {
        type: String,
        enum: ['public', 'private'],
        default: 'private'
    },
    inviteCode: {
        type: String,
        unique: true,
        default: () => crypto.randomBytes(4).toString('hex')
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [MemberSchema],
    meetingLinks: [{
        link: String,
        title: String,
        scheduledTime: Date,
        platform: String,
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        addedAt: { type: Date, default: Date.now }
    }],
    settings: {
        autoShareMeetings: { type: Boolean, default: true },
        allowMemberInvite: { type: Boolean, default: false },
        emailNotifications: { type: Boolean, default: true }
    }
}, { timestamps: true });

TeamSchema.index({ createdBy: 1 });
TeamSchema.index({ 'members.email': 1 });
TeamSchema.index({ visibility: 1 });
TeamSchema.index({ inviteCode: 1 });

module.exports = mongoose.model('Team', TeamSchema);
