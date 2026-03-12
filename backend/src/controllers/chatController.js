const ChatMessage = require('../models/ChatMessage');

// Get chat messages for a context (team/classroom/company)
exports.getMessages = async (req, res) => {
    try {
        const { contextType, contextId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const messages = await ChatMessage.find({ contextType, contextId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await ChatMessage.countDocuments({ contextType, contextId });

        res.json({
            success: true,
            messages: messages.reverse(),
            total,
            hasMore: total > page * limit
        });
    } catch (err) {
        console.error('[Chat] Get messages error:', err);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};

// Send message
exports.sendMessage = async (req, res) => {
    try {
        const { contextType, contextId } = req.params;
        const { message, messageType } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const chatMessage = new ChatMessage({
            contextType,
            contextId,
            senderId: req.user._id,
            senderEmail: req.user.email,
            senderName: req.user.name || '',
            senderPicture: req.user.picture || '',
            message: message.trim(),
            messageType: messageType || 'text',
            readBy: [req.user.email]
        });

        await chatMessage.save();

        // Emit via Socket.IO for real-time
        if (global.io) {
            global.io.emit(`chat:${contextType}:${contextId}`, {
                type: 'new-message',
                message: chatMessage
            });
        }

        res.json({ success: true, message: chatMessage });
    } catch (err) {
        console.error('[Chat] Send message error:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

// Mark messages as read
exports.markRead = async (req, res) => {
    try {
        const { contextType, contextId } = req.params;

        await ChatMessage.updateMany(
            {
                contextType,
                contextId,
                readBy: { $ne: req.user.email }
            },
            { $push: { readBy: req.user.email } }
        );

        res.json({ success: true });
    } catch (err) {
        console.error('[Chat] Mark read error:', err);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
    try {
        const { contextType, contextId } = req.params;

        const count = await ChatMessage.countDocuments({
            contextType,
            contextId,
            readBy: { $ne: req.user.email }
        });

        res.json({ success: true, unreadCount: count });
    } catch (err) {
        console.error('[Chat] Unread count error:', err);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
};
