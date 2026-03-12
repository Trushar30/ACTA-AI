const Classroom = require('../models/Classroom');
const User = require('../models/User');
const crypto = require('crypto');
const { sendTeamNotification } = require('../services/teamEmailService');

// Create classroom (teacher only)
exports.createClassroom = async (req, res) => {
    try {
        const { name, subject, description, section, visibility } = req.body;
        if (!name) return res.status(400).json({ error: 'Classroom name is required' });

        const classroom = new Classroom({
            name,
            subject: subject || '',
            description: description || '',
            section: section || '',
            visibility: visibility || 'private',
            teacherId: req.user._id,
            teacherEmail: req.user.email,
            teacherName: req.user.name || ''
        });

        await classroom.save();
        res.json({ success: true, classroom });
    } catch (err) {
        console.error('[Classroom] Create error:', err);
        res.status(500).json({ error: 'Failed to create classroom' });
    }
};

// Get my classrooms (as teacher or student)
exports.getMyClassrooms = async (req, res) => {
    try {
        const classrooms = await Classroom.find({
            $or: [
                { teacherId: req.user._id },
                { 'students.email': req.user.email, 'students.status': { $ne: 'removed' } }
            ]
        }).sort({ updatedAt: -1 });

        res.json({ success: true, classrooms });
    } catch (err) {
        console.error('[Classroom] Get classrooms error:', err);
        res.status(500).json({ error: 'Failed to fetch classrooms' });
    }
};

// Get public classrooms
exports.getPublicClassrooms = async (req, res) => {
    try {
        const classrooms = await Classroom.find({ visibility: 'public' })
            .sort({ updatedAt: -1 })
            .select('name subject description section teacherName students.length createdAt');
        res.json({ success: true, classrooms });
    } catch (err) {
        console.error('[Classroom] Get public classrooms error:', err);
        res.status(500).json({ error: 'Failed to fetch public classrooms' });
    }
};

// Get single classroom
exports.getClassroom = async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

        // Access check
        const isTeacher = classroom.teacherId.toString() === req.user._id.toString();
        const isStudent = classroom.students.some(s => s.email === req.user.email && s.status !== 'removed');
        if (classroom.visibility === 'private' && !isTeacher && !isStudent) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ success: true, classroom, isTeacher });
    } catch (err) {
        console.error('[Classroom] Get classroom error:', err);
        res.status(500).json({ error: 'Failed to fetch classroom' });
    }
};

// Update classroom
exports.updateClassroom = async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

        if (classroom.teacherId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the teacher can update this classroom' });
        }

        const { name, subject, description, section, visibility, settings } = req.body;
        if (name) classroom.name = name;
        if (subject !== undefined) classroom.subject = subject;
        if (description !== undefined) classroom.description = description;
        if (section !== undefined) classroom.section = section;
        if (visibility) classroom.visibility = visibility;
        if (settings) classroom.settings = { ...classroom.settings.toObject(), ...settings };

        await classroom.save();
        res.json({ success: true, classroom });
    } catch (err) {
        console.error('[Classroom] Update error:', err);
        res.status(500).json({ error: 'Failed to update classroom' });
    }
};

// Delete classroom
exports.deleteClassroom = async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

        if (classroom.teacherId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the teacher can delete this classroom' });
        }

        await Classroom.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('[Classroom] Delete error:', err);
        res.status(500).json({ error: 'Failed to delete classroom' });
    }
};

// Add student to classroom
exports.addStudent = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Student email is required' });

        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

        if (classroom.teacherId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the teacher can add students' });
        }

        const existing = classroom.students.find(s => s.email === email);
        if (existing && existing.status !== 'removed') {
            return res.status(400).json({ error: 'Student already exists in classroom' });
        }

        const user = await User.findOne({ email });

        if (existing && existing.status === 'removed') {
            existing.status = 'pending';
            existing.userId = user?._id || null;
            existing.name = user?.name || '';
        } else {
            classroom.students.push({
                email,
                userId: user?._id || null,
                name: user?.name || '',
                status: 'pending'
            });
        }

        await classroom.save();

        // Send notification
        try {
            await sendTeamNotification(email, classroom.name, req.user.name || req.user.email, 'classroom');
        } catch (emailErr) {
            console.error('[Classroom] Email notification failed:', emailErr.message);
        }

        res.json({ success: true, classroom });
    } catch (err) {
        console.error('[Classroom] Add student error:', err);
        res.status(500).json({ error: 'Failed to add student' });
    }
};

// Remove student
exports.removeStudent = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

        if (classroom.teacherId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the teacher can remove students' });
        }

        const student = classroom.students.find(s => s.email === email);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        student.status = 'removed';
        await classroom.save();
        res.json({ success: true, classroom });
    } catch (err) {
        console.error('[Classroom] Remove student error:', err);
        res.status(500).json({ error: 'Failed to remove student' });
    }
};

// Share meeting link to classroom
exports.shareMeetingLink = async (req, res) => {
    try {
        const { link, title, scheduledTime, platform } = req.body;
        if (!link) return res.status(400).json({ error: 'Meeting link is required' });

        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

        if (classroom.teacherId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the teacher can share meetings' });
        }

        classroom.meetingLinks.push({
            link,
            title: title || 'Class Meeting',
            scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
            platform: platform || 'unknown'
        });

        await classroom.save();

        // Send email to all active students
        if (classroom.settings.emailNotifications) {
            const activeStudents = classroom.students.filter(s => s.status === 'active');
            for (const student of activeStudents) {
                try {
                    await sendTeamNotification(
                        student.email,
                        classroom.name,
                        req.user.name || req.user.email,
                        'meeting',
                        { link, title: title || 'Class Meeting', scheduledTime }
                    );
                } catch (emailErr) {
                    console.error('[Classroom] Meeting email failed for:', student.email);
                }
            }
        }

        res.json({ success: true, classroom });
    } catch (err) {
        console.error('[Classroom] Share meeting error:', err);
        res.status(500).json({ error: 'Failed to share meeting link' });
    }
};

// Add announcement
exports.addAnnouncement = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Announcement text is required' });

        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

        if (classroom.teacherId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the teacher can post announcements' });
        }

        classroom.announcements.push({ text });
        await classroom.save();
        res.json({ success: true, classroom });
    } catch (err) {
        console.error('[Classroom] Announcement error:', err);
        res.status(500).json({ error: 'Failed to post announcement' });
    }
};

// Join public classroom
exports.joinClassroom = async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
        if (classroom.visibility !== 'public') {
            return res.status(403).json({ error: 'This classroom is private. Use an invite code to join.' });
        }

        const existing = classroom.students.find(s => s.email === req.user.email);
        if (existing && existing.status !== 'removed') {
            return res.status(400).json({ error: 'Already enrolled' });
        }

        if (existing && existing.status === 'removed') {
            existing.status = 'active';
            existing.userId = req.user._id;
            existing.name = req.user.name || '';
        } else {
            classroom.students.push({
                email: req.user.email,
                userId: req.user._id,
                name: req.user.name || '',
                status: 'active'
            });
        }

        await classroom.save();
        res.json({ success: true, classroom });
    } catch (err) {
        console.error('[Classroom] Join error:', err);
        res.status(500).json({ error: 'Failed to join classroom' });
    }
};

// Join by invite code (works for private classrooms)
exports.joinByCode = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Invite code is required' });

        const classroom = await Classroom.findOne({ inviteCode: code.trim().toLowerCase() });
        if (!classroom) return res.status(404).json({ error: 'Invalid invite code' });

        if (classroom.teacherId.toString() === req.user._id.toString()) {
            return res.status(400).json({ error: 'You are the teacher of this classroom' });
        }

        const existing = classroom.students.find(s => s.email === req.user.email);
        if (existing && existing.status !== 'removed') {
            return res.status(400).json({ error: 'Already enrolled' });
        }

        if (existing && existing.status === 'removed') {
            existing.status = 'active';
            existing.userId = req.user._id;
            existing.name = req.user.name || '';
        } else {
            classroom.students.push({
                email: req.user.email,
                userId: req.user._id,
                name: req.user.name || '',
                status: 'active'
            });
        }

        await classroom.save();
        res.json({ success: true, classroom, entityType: 'classroom' });
    } catch (err) {
        console.error('[Classroom] Join by code error:', err);
        res.status(500).json({ error: 'Failed to join' });
    }
};

// Regenerate invite code
exports.regenerateCode = async (req, res) => {
    try {
        const classroom = await Classroom.findById(req.params.id);
        if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

        if (classroom.teacherId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only the teacher can regenerate the code' });
        }

        classroom.inviteCode = crypto.randomBytes(4).toString('hex');
        await classroom.save();
        res.json({ success: true, inviteCode: classroom.inviteCode });
    } catch (err) {
        console.error('[Classroom] Regenerate code error:', err);
        res.status(500).json({ error: 'Failed to regenerate code' });
    }
};
