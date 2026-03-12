const mongoose = require('mongoose');
const crypto = require('crypto');

const EmployeeSchema = new mongoose.Schema({
    email: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, default: '' },
    role: {
        type: String,
        enum: ['ceo', 'cto', 'hr', 'manager', 'team-lead', 'employee', 'intern'],
        default: 'employee'
    },
    department: { type: String, default: '' },
    status: {
        type: String,
        enum: ['pending', 'active', 'removed'],
        default: 'pending'
    },
    joinedAt: { type: Date, default: Date.now }
});

const CompanySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    industry: { type: String, default: '' },
    website: { type: String, default: '' },
    size: {
        type: String,
        enum: ['1-10', '11-50', '51-200', '201-500', '500+'],
        default: '1-10'
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
    employees: [EmployeeSchema],
    departments: [{ type: String }],
    meetingLinks: [{
        link: String,
        title: String,
        scheduledTime: Date,
        platform: String,
        department: String,
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        addedAt: { type: Date, default: Date.now }
    }],
    settings: {
        autoShareMeetings: { type: Boolean, default: true },
        emailNotifications: { type: Boolean, default: true },
        allowEmployeeInvite: { type: Boolean, default: false }
    }
}, { timestamps: true });

CompanySchema.index({ createdBy: 1 });
CompanySchema.index({ 'employees.email': 1 });
CompanySchema.index({ visibility: 1 });
CompanySchema.index({ inviteCode: 1 });

module.exports = mongoose.model('Company', CompanySchema);
