const Team = require('../models/Team');
const User = require('../models/User');
const crypto = require('crypto');
const { sendTeamNotification } = require('../services/teamEmailService');

// Create a new team
exports.createTeam = async (req, res) => {
    try {
        const { name, description, type, category, visibility } = req.body;
        if (!name || !type) {
            return res.status(400).json({ error: 'Team name and type are required' });
        }

        const team = new Team({
            name,
            description: description || '',
            type,
            category: category || 'general',
            visibility: visibility || 'private',
            createdBy: req.user._id,
            members: [{
                email: req.user.email,
                userId: req.user._id,
                name: req.user.name || '',
                role: 'owner',
                status: 'active',
                joinedAt: new Date()
            }]
        });

        await team.save();
        res.json({ success: true, team });
    } catch (err) {
        console.error('[Team] Create error:', err);
        res.status(500).json({ error: 'Failed to create team' });
    }
};

// Get teams for current user (created by + member of)
exports.getMyTeams = async (req, res) => {
    try {
        const teams = await Team.find({
            $or: [
                { createdBy: req.user._id },
                { 'members.email': req.user.email, 'members.status': { $ne: 'removed' } }
            ]
        }).sort({ updatedAt: -1 });

        res.json({ success: true, teams });
    } catch (err) {
        console.error('[Team] Get teams error:', err);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
};

// Get public teams
exports.getPublicTeams = async (req, res) => {
    try {
        const teams = await Team.find({ visibility: 'public' })
            .sort({ updatedAt: -1 })
            .select('name description type category members.length createdAt');
        res.json({ success: true, teams });
    } catch (err) {
        console.error('[Team] Get public teams error:', err);
        res.status(500).json({ error: 'Failed to fetch public teams' });
    }
};

// Get single team
exports.getTeam = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Check access: public teams are accessible, private need membership
        const isMember = team.members.some(m => m.email === req.user.email && m.status !== 'removed');
        if (team.visibility === 'private' && !isMember) {
            return res.status(403).json({ error: 'Access denied. This is a private team.' });
        }

        res.json({ success: true, team });
    } catch (err) {
        console.error('[Team] Get team error:', err);
        res.status(500).json({ error: 'Failed to fetch team' });
    }
};

// Update team
exports.updateTeam = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Only owner/admin can update
        const member = team.members.find(m => m.email === req.user.email);
        if (!member || !['owner', 'admin'].includes(member.role)) {
            return res.status(403).json({ error: 'Only team owner or admin can update' });
        }

        const { name, description, category, visibility, settings } = req.body;
        if (name) team.name = name;
        if (description !== undefined) team.description = description;
        if (category) team.category = category;
        if (visibility) team.visibility = visibility;
        if (settings) team.settings = { ...team.settings.toObject(), ...settings };

        await team.save();
        res.json({ success: true, team });
    } catch (err) {
        console.error('[Team] Update error:', err);
        res.status(500).json({ error: 'Failed to update team' });
    }
};

// Delete team
exports.deleteTeam = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found' });

        if (team.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Only team owner can delete' });
        }

        await Team.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        console.error('[Team] Delete error:', err);
        res.status(500).json({ error: 'Failed to delete team' });
    }
};

// Add member to team
exports.addMember = async (req, res) => {
    try {
        const { email, role } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Check permission
        const requester = team.members.find(m => m.email === req.user.email);
        if (!requester || !['owner', 'admin'].includes(requester.role)) {
            if (!team.settings.allowMemberInvite) {
                return res.status(403).json({ error: 'Permission denied' });
            }
        }

        // Check if already a member
        const existing = team.members.find(m => m.email === email);
        if (existing && existing.status !== 'removed') {
            return res.status(400).json({ error: 'User is already a member' });
        }

        // Find user by email
        const user = await User.findOne({ email });

        if (existing && existing.status === 'removed') {
            existing.status = 'pending';
            existing.role = role || 'member';
            existing.userId = user?._id || null;
            existing.name = user?.name || '';
        } else {
            team.members.push({
                email,
                userId: user?._id || null,
                name: user?.name || '',
                role: role || 'member',
                status: 'pending'
            });
        }

        await team.save();

        // Send email notification
        try {
            await sendTeamNotification(email, team.name, req.user.name || req.user.email, 'team');
        } catch (emailErr) {
            console.error('[Team] Email notification failed:', emailErr.message);
        }

        res.json({ success: true, team });
    } catch (err) {
        console.error('[Team] Add member error:', err);
        res.status(500).json({ error: 'Failed to add member' });
    }
};

// Remove member
exports.removeMember = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found' });

        const requester = team.members.find(m => m.email === req.user.email);
        if (!requester || !['owner', 'admin'].includes(requester.role)) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const member = team.members.find(m => m.email === email);
        if (!member) return res.status(404).json({ error: 'Member not found' });
        if (member.role === 'owner') return res.status(400).json({ error: 'Cannot remove team owner' });

        member.status = 'removed';
        await team.save();
        res.json({ success: true, team });
    } catch (err) {
        console.error('[Team] Remove member error:', err);
        res.status(500).json({ error: 'Failed to remove member' });
    }
};

// Update member role
exports.updateMemberRole = async (req, res) => {
    try {
        const { email, role } = req.body;
        if (!email || !role) return res.status(400).json({ error: 'Email and role are required' });

        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found' });

        const requester = team.members.find(m => m.email === req.user.email);
        if (!requester || requester.role !== 'owner') {
            return res.status(403).json({ error: 'Only owner can change roles' });
        }

        const member = team.members.find(m => m.email === email);
        if (!member) return res.status(404).json({ error: 'Member not found' });

        member.role = role;
        await team.save();
        res.json({ success: true, team });
    } catch (err) {
        console.error('[Team] Update role error:', err);
        res.status(500).json({ error: 'Failed to update role' });
    }
};

// Share meeting link to team
exports.shareMeetingLink = async (req, res) => {
    try {
        const { link, title, scheduledTime, platform } = req.body;
        if (!link) return res.status(400).json({ error: 'Meeting link is required' });

        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found' });

        team.meetingLinks.push({
            link,
            title: title || 'Team Meeting',
            scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
            platform: platform || 'unknown',
            addedBy: req.user._id
        });

        await team.save();

        // Send email to all active members if notifications enabled
        if (team.settings.emailNotifications) {
            const activeMembers = team.members.filter(m => m.status === 'active' && m.email !== req.user.email);
            for (const member of activeMembers) {
                try {
                    await sendTeamNotification(
                        member.email,
                        team.name,
                        req.user.name || req.user.email,
                        'meeting',
                        { link, title: title || 'Team Meeting', scheduledTime }
                    );
                } catch (emailErr) {
                    console.error('[Team] Meeting email failed for:', member.email);
                }
            }
        }

        res.json({ success: true, team });
    } catch (err) {
        console.error('[Team] Share meeting error:', err);
        res.status(500).json({ error: 'Failed to share meeting link' });
    }
};

// Join public team
exports.joinTeam = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found' });
        if (team.visibility !== 'public') {
            return res.status(403).json({ error: 'This team is private. Use an invite code to join.' });
        }

        const existing = team.members.find(m => m.email === req.user.email);
        if (existing && existing.status !== 'removed') {
            return res.status(400).json({ error: 'Already a member' });
        }

        if (existing && existing.status === 'removed') {
            existing.status = 'active';
            existing.userId = req.user._id;
            existing.name = req.user.name || '';
        } else {
            team.members.push({
                email: req.user.email,
                userId: req.user._id,
                name: req.user.name || '',
                role: 'member',
                status: 'active'
            });
        }

        await team.save();
        res.json({ success: true, team });
    } catch (err) {
        console.error('[Team] Join error:', err);
        res.status(500).json({ error: 'Failed to join team' });
    }
};

// Join by invite code (works for private teams)
exports.joinByCode = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Invite code is required' });

        const team = await Team.findOne({ inviteCode: code.trim().toLowerCase() });
        if (!team) return res.status(404).json({ error: 'Invalid invite code' });

        const existing = team.members.find(m => m.email === req.user.email);
        if (existing && existing.status !== 'removed') {
            return res.status(400).json({ error: 'Already a member' });
        }

        if (existing && existing.status === 'removed') {
            existing.status = 'active';
            existing.userId = req.user._id;
            existing.name = req.user.name || '';
        } else {
            team.members.push({
                email: req.user.email,
                userId: req.user._id,
                name: req.user.name || '',
                role: 'member',
                status: 'active'
            });
        }

        await team.save();
        res.json({ success: true, team, entityType: 'team' });
    } catch (err) {
        console.error('[Team] Join by code error:', err);
        res.status(500).json({ error: 'Failed to join' });
    }
};

// Regenerate invite code
exports.regenerateCode = async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ error: 'Team not found' });

        const member = team.members.find(m => m.email === req.user.email);
        if (!member || !['owner', 'admin'].includes(member.role)) {
            return res.status(403).json({ error: 'Only owner or admin can regenerate code' });
        }

        team.inviteCode = crypto.randomBytes(4).toString('hex');
        await team.save();
        res.json({ success: true, inviteCode: team.inviteCode });
    } catch (err) {
        console.error('[Team] Regenerate code error:', err);
        res.status(500).json({ error: 'Failed to regenerate code' });
    }
};
