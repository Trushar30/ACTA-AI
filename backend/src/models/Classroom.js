const mongoose = require('mongoose');
const crypto = require('crypto');

const ClassroomStudentSchema = new mongoose.Schema({
    email: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, default: '' },
    status: {
        type: String,
        enum: ['pending', 'active', 'removed'],
        default: 'pending'
    },
    joinedAt: { type: Date, default: Date.now }
});

const ClassroomSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    subject: { type: String, default: '' },
    description: { type: String, default: '' },
    section: { type: String, default: '' },
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
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teacherEmail: { type: String, required: true },
    teacherName: { type: String, default: '' },
    students: [ClassroomStudentSchema],
    meetingLinks: [{
        link: String,
        title: String,
        scheduledTime: Date,
        platform: String,
        addedAt: { type: Date, default: Date.now }
    }],
    announcements: [{
        text: String,
        createdAt: { type: Date, default: Date.now }
    }],
    settings: {
        autoShareMeetings: { type: Boolean, default: true },
        emailNotifications: { type: Boolean, default: true },
        allowStudentChat: { type: Boolean, default: true }
    }
}, { timestamps: true });

ClassroomSchema.index({ teacherId: 1 });
ClassroomSchema.index({ 'students.email': 1 });
ClassroomSchema.index({ visibility: 1 });
ClassroomSchema.index({ inviteCode: 1 });

module.exports = mongoose.model('Classroom', ClassroomSchema);
