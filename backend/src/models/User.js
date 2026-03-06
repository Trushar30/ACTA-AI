const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    name: String,
    picture: String,
    jiraConfig: {
        domain: String,
        email: String,
        apiToken: String,
        projectKey: String
    },
    trelloConfig: {
        apiKey: String,
        apiToken: String,
        listId: String
    },
    meetBotConfig: {
        browserProfilePath: String,  // Path to saved browser session
        isConfigured: {
            type: Boolean,
            default: false
        }
    },
    teamsBotConfig: {
        browserProfilePath: String,  // Path to saved Teams browser session
        isConfigured: {
            type: Boolean,
            default: false
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', UserSchema);
