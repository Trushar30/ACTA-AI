const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const http = require('http');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const crypto = require('crypto');
const puppeteer = require('puppeteer');
const multer = require('multer');
const fs = require('fs').promises;
const Groq = require('groq-sdk');

// Load environment variables FIRST
dotenv.config();

// Initialize Groq AI
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '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' });

// Import passport AFTER env vars are loaded
const passport = require('./config/passport');
const { generateToken, verifyToken, optionalAuth } = require('./middleware/auth');
const { Server } = require('socket.io');
const { runBot, stopBot, activeBots } = require('./bot/bot');
const Meeting = require('./models/Meeting');
const User = require('./models/User');
const ScheduledMeeting = require('./models/ScheduledMeeting');
const zoomService = require('./services/zoomService');
const meetService = require('./services/meetService');
const transcriptionService = require('./services/transcriptionService');
const taskExtractionService = require('./services/taskExtractionService');
const dashboardController = require('./controllers/dashboardController');
const translationService = require('./services/translationService');
const meetingSchedulerService = require('./services/meetingSchedulerService');

const app = express();
const server = http.createServer(app);

// Socket.IO for real-time updates
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
        methods: ["GET", "POST"]
    }
});

// Make io globally accessible for bot to emit events
global.io = io;

app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../recordings');
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (err) {
            cb(err);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `upload-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/x-m4a',
            'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
        ];
        const allowedExts = ['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.mov', '.avi'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only audio and video files are allowed.'));
        }
    }
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected');
        console.log('Database:', mongoose.connection.name);
    })
    .catch(err => {
        console.error('MongoDB Connection Error:', err);
        process.exit(1);
    });

// Monitor connection status
mongoose.connection.on('connected', () => {
    console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('Mongoose disconnected from MongoDB');
});

// Serve recordings
app.use('/recordings', express.static(path.join(__dirname, '../recordings')));

// Socket.IO Events
io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('[Socket] Client disconnected:', socket.id);
    });
});

// Helper to emit status updates
const emitStatus = (meetingId, status, data = {}) => {
    io.emit('meetingUpdate', { meetingId, status, ...data });
};

// Authentication Routes
app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: 'http://localhost:5173' }),
    (req, res) => {
        // Generate JWT token
        const token = generateToken(req.user);

        // Set token in httpOnly cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            sameSite: 'lax'
        });

        // Redirect to frontend with token in URL (for localStorage)
        res.redirect(`http://localhost:5173?token=${token}`);
    }
);

app.get('/api/auth/user', optionalAuth, (req, res) => {
    if (req.isAuthenticated() || req.user) {
        res.json({ user: req.user });
    } else {
        res.status(401).json({ user: null });
    }
});

// Verify JWT token
app.get('/api/auth/verify', verifyToken, (req, res) => {
    res.json({ user: req.user });
});

app.get('/api/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }

        // Clear cookie
        res.clearCookie('token');
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Integration Routes
// Save user integrations (Jira & Trello)
app.post('/api/integrations/save', verifyToken, async (req, res) => {
    try {
        const { jiraConfig, trelloConfig } = req.body;

        const updateData = {};
        if (jiraConfig) updateData.jiraConfig = jiraConfig;
        if (trelloConfig) updateData.trelloConfig = trelloConfig;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true }
        );

        res.json({ success: true, user });
    } catch (err) {
        console.error('Save integrations error:', err);
        res.status(500).json({ error: 'Failed to save integrations' });
    }
});

// Get user integrations
app.get('/api/integrations', optionalAuth, async (req, res) => {
    try {
        // If not authenticated, return empty configs
        if (!req.user) {
            return res.json({
                jiraConfig: {},
                trelloConfig: {}
            });
        }

        const user = await User.findById(req.user._id);
        res.json({
            jiraConfig: user.jiraConfig || {},
            trelloConfig: user.trelloConfig || {}
        });
    } catch (err) {
        console.error('Get integrations error:', err);
        res.status(500).json({ error: 'Failed to fetch integrations' });
    }
});

// Test Jira connection (no auth required - just testing if credentials work)
app.post('/api/integrations/test/jira', async (req, res) => {
    try {
        const { domain, email, apiToken, projectKey } = req.body;

        console.log('[Jira Test] Request received:', { domain, email: email ? '***' : 'missing', apiToken: apiToken ? '***' : 'missing', projectKey });

        if (!domain || !email || !apiToken) {
            console.log('[Jira Test] Missing credentials');
            return res.status(400).json({ error: 'Missing Jira credentials' });
        }

        // Ensure domain starts with https://
        let formattedDomain = domain;
        if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
            formattedDomain = `https://${domain}`;
        }

        // Test Jira connection
        const jiraUrl = `${formattedDomain}/rest/api/3/myself`;
        const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');

        console.log('[Jira Test] Testing connection to:', jiraUrl);

        const response = await axios.get(jiraUrl, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        console.log('[Jira Test] Connection successful, user:', response.data.displayName);

        // If projectKey provided, verify project access
        if (projectKey) {
            const projectUrl = `${formattedDomain}/rest/api/3/project/${projectKey}`;
            console.log('[Jira Test] Testing project access:', projectUrl);
            await axios.get(projectUrl, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });
            console.log('[Jira Test] Project access verified');
        }

        res.json({
            success: true,
            message: 'Jira connection successful',
            user: response.data.displayName
        });
    } catch (err) {
        console.error('[Jira Test] Error:', err.message);
        console.error('[Jira Test] Error details:', err.response?.data || err.stack);

        let errorMessage = 'Failed to connect to Jira';

        if (err.code === 'ENOTFOUND') {
            errorMessage = 'Invalid Jira domain';
        } else if (err.response?.status === 401) {
            errorMessage = 'Invalid email or API token';
        } else if (err.response?.status === 404) {
            errorMessage = 'Project not found or no access';
        } else if (err.response?.data?.message) {
            errorMessage = err.response.data.message;
        }

        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

// Test Trello connection (no auth required - just testing if credentials work)
app.post('/api/integrations/test/trello', async (req, res) => {
    try {
        const { apiKey, apiToken, listId } = req.body;

        console.log('[Trello Test] Request received:', { apiKey: apiKey ? '***' : 'missing', apiToken: apiToken ? '***' : 'missing', listId });

        if (!apiKey || !apiToken) {
            console.log('[Trello Test] Missing credentials');
            return res.status(400).json({ error: 'Missing Trello credentials' });
        }

        // Test Trello connection
        const trelloUrl = `https://api.trello.com/1/members/me?key=${apiKey}&token=${apiToken}`;

        console.log('[Trello Test] Testing connection');

        const response = await axios.get(trelloUrl, {
            timeout: 10000
        });

        console.log('[Trello Test] Connection successful, user:', response.data.fullName);

        // If listId provided, verify list access
        if (listId) {
            console.log('[Trello Test] Testing list access');
            const listUrl = `https://api.trello.com/1/lists/${listId}?key=${apiKey}&token=${apiToken}`;
            await axios.get(listUrl, {
                timeout: 10000
            });
            console.log('[Trello Test] List access verified');
        }

        res.json({
            success: true,
            message: 'Trello connection successful',
            user: response.data.fullName
        });
    } catch (err) {
        console.error('[Trello Test] Error:', err.message);
        console.error('[Trello Test] Error details:', err.response?.data || err.stack);

        let errorMessage = 'Failed to connect to Trello';

        if (err.response?.status === 401) {
            errorMessage = 'Invalid API key or token';
        } else if (err.response?.status === 404) {
            errorMessage = 'List not found or no access';
        }

        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

// Create task in Jira
app.post('/api/tasks/create/jira', optionalAuth, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { task, assignee, deadline, priority, meetingId, taskIndex } = req.body;

        if (!task) {
            return res.status(400).json({ error: 'Task description is required' });
        }

        const user = await User.findById(req.user._id);
        const jiraConfig = user?.jiraConfig || {};

        if (!jiraConfig.domain || !jiraConfig.email || !jiraConfig.apiToken || !jiraConfig.projectKey) {
            return res.status(400).json({ error: 'Jira credentials not configured. Please setup Jira in Settings first.' });
        }

        // Prepare description in Atlassian Document Format (ADF)
        let descriptionText = `Task: ${task}`;
        if (deadline) descriptionText += `\nDeadline: ${deadline}`;

        const description = {
            version: 1,
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: descriptionText
                        }
                    ]
                }
            ]
        };

        // Map priority to Jira priority IDs
        const priorityMap = {
            'high': { id: '1' },
            'medium': { id: '2' },
            'low': { id: '3' }
        };

        // Prepare Jira issue data
        const issueData = {
            fields: {
                project: { key: jiraConfig.projectKey },
                summary: task,
                issuetype: { name: 'Task' },
                description: description
            }
        };

        // Add priority if provided and valid
        if (priority && priorityMap[priority.toLowerCase()]) {
            issueData.fields.priority = priorityMap[priority.toLowerCase()];
        }

        if (assignee) {
            issueData.fields.assignee = { name: assignee };
        }

        // Create issue in Jira
        // Handle domain that may already include .atlassian.net
        const jiraDomain = jiraConfig.domain.includes('.atlassian.net') ?
            jiraConfig.domain :
            `${jiraConfig.domain}.atlassian.net`;
        const jiraUrl = `https://${jiraDomain}/rest/api/3/issue`;
        const auth = Buffer.from(`${jiraConfig.email}:${jiraConfig.apiToken}`).toString('base64');

        console.log('[Jira Create] Creating issue:', { domain: jiraDomain, projectKey: jiraConfig.projectKey, task });

        const response = await axios.post(jiraUrl, issueData, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        console.log('[Jira Create] Issue created successfully:', response.data.key);

        // Save task integration status to database if meetingId and taskIndex provided
        if (meetingId && taskIndex !== undefined) {
            await Meeting.findByIdAndUpdate(
                meetingId,
                {
                    $push: {
                        taskIntegrations: {
                            taskIndex: taskIndex,
                            jira: { added: true, issueKey: response.data.key }
                        }
                    }
                },
                { new: true }
            );
            console.log('[Jira Create] Saved to database:', { meetingId, taskIndex, issueKey: response.data.key });
        }

        res.json({
            success: true,
            message: `Task created in Jira: ${response.data.key}`,
            issueKey: response.data.key,
            issueId: response.data.id
        });
    } catch (err) {
        console.error('[Jira Create] Error:', err.message);
        console.error('[Jira Create] Error details:', err.response?.data || err.stack);

        let errorMessage = 'Failed to create task in Jira';

        if (err.response?.status === 401) {
            errorMessage = 'Invalid Jira credentials';
        } else if (err.response?.status === 404) {
            errorMessage = 'Project not found';
        } else if (err.response?.data?.errorMessages) {
            errorMessage = err.response.data.errorMessages[0];
        }

        res.status(500).json({ error: errorMessage });
    }
});

// Create task in Trello
app.post('/api/tasks/create/trello', optionalAuth, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { task, assignee, deadline, priority, meetingId, taskIndex } = req.body;

        if (!task) {
            return res.status(400).json({ error: 'Task description is required' });
        }

        const user = await User.findById(req.user._id);
        const trelloConfig = user?.trelloConfig || {};

        if (!trelloConfig.apiKey || !trelloConfig.apiToken || !trelloConfig.listId) {
            return res.status(400).json({ error: 'Trello credentials not configured. Please setup Trello in Settings first.' });
        }

        // Prepare card description
        let description = task;
        if (assignee) description += `\nAssignee: ${assignee}`;
        if (deadline) description += `\nDeadline: ${deadline}`;
        if (priority) description += `\nPriority: ${priority}`;

        // Create card in Trello
        const trelloUrl = `https://api.trello.com/1/cards?idList=${trelloConfig.listId}&key=${trelloConfig.apiKey}&token=${trelloConfig.apiToken}`;

        console.log('[Trello Create] Creating card:', { listId: trelloConfig.listId, task });

        const response = await axios.post(trelloUrl, {
            name: task,
            desc: description,
            labels: priority ? [priority.toLowerCase()] : []
        }, {
            timeout: 10000
        });

        console.log('[Trello Create] Card created successfully:', response.data.id);

        // Save task integration status to database if meetingId and taskIndex provided
        if (meetingId && taskIndex !== undefined) {
            await Meeting.findByIdAndUpdate(
                meetingId,
                {
                    $push: {
                        taskIntegrations: {
                            taskIndex: taskIndex,
                            trello: { added: true, cardId: response.data.id }
                        }
                    }
                },
                { new: true }
            );
            console.log('[Trello Create] Saved to database:', { meetingId, taskIndex, cardId: response.data.id });
        }

        res.json({
            success: true,
            message: `Task created in Trello: ${response.data.name}`,
            cardId: response.data.id,
            cardUrl: response.data.url
        });
    } catch (err) {
        console.error('[Trello Create] Error:', err.message);
        console.error('[Trello Create] Error details:', err.response?.data || err.stack);

        let errorMessage = 'Failed to create task in Trello';

        if (err.response?.status === 401) {
            errorMessage = 'Invalid Trello credentials';
        } else if (err.response?.status === 404) {
            errorMessage = 'List not found';
        }

        res.status(500).json({ error: errorMessage });
    }
});

// User Settings Routes
app.get('/api/user/settings', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const user = await User.findById(req.user._id);
        res.json({
            jiraConfig: user.jiraConfig || {},
            trelloConfig: user.trelloConfig || {}
        });
    } catch (err) {
        console.error('[Server] Get settings error:', err.message);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.put('/api/user/settings', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { jiraConfig, trelloConfig } = req.body;

        const updateData = {};
        if (jiraConfig) updateData.jiraConfig = jiraConfig;
        if (trelloConfig) updateData.trelloConfig = trelloConfig;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true }
        );

        res.json({
            success: true,
            message: 'Settings updated successfully',
            user
        });
    } catch (err) {
        console.error('[Server] Update settings error:', err.message);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Launch browser for user to setup Google account
app.post('/api/bot/setup/start', verifyToken, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const profilePath = path.join(__dirname, '../browser-profiles', userId);

        // Create profile directory if it doesn't exist
        if (!require('fs').existsSync(profilePath)) {
            require('fs').mkdirSync(profilePath, { recursive: true });
        }

        console.log('[Bot Setup] Launching browser for setup:', userId);

        // Launch browser with user data dir to save session
        const browser = await puppeteer.launch({
            headless: false,
            userDataDir: profilePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--start-maximized',
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            ignoreDefaultArgs: ['--enable-automation'],
        });

        const pages = await browser.pages();
        const page = pages[0] || await browser.newPage();

        // Set additional properties to avoid detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // Navigate to Google Accounts login
        await page.goto('https://accounts.google.com/signin', { waitUntil: 'domcontentloaded' });

        console.log('[Bot Setup] Browser opened - waiting for user to login');

        // Monitor when browser closes
        browser.on('disconnected', async () => {
            console.log('[Bot Setup] Browser closed - saving profile');

            // Mark as configured
            await User.findByIdAndUpdate(userId, {
                meetBotConfig: {
                    browserProfilePath: profilePath,
                    isConfigured: true
                }
            });

            console.log('[Bot Setup] Profile saved for user:', userId);
        });

        res.json({
            success: true,
            message: 'Browser launched. Please log into your Google account and close the browser when done.'
        });

    } catch (err) {
        console.error('[Bot Setup] Launch error:', err);
        res.status(500).json({ error: 'Failed to launch setup browser' });
    }
});

// Get bot setup status
app.get('/api/bot/setup', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user.meetBotConfig || !user.meetBotConfig.isConfigured) {
            return res.json({
                isConfigured: false
            });
        }

        res.json({
            isConfigured: user.meetBotConfig.isConfigured
        });
    } catch (err) {
        console.error('[Bot Setup] Get status error:', err);
        res.status(500).json({ error: 'Failed to fetch bot setup status' });
    }
});

// Test bot credentials (optional - for future implementation)
app.post('/api/bot/test', verifyToken, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        console.log('[Bot Test] Testing credentials...');

        // Note: Actual Google login testing would require a headless browser
        // For now, just validate format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        res.json({
            success: true,
            message: 'Credentials format is valid. Full test will occur during meeting join.',
            warning: 'Make sure 2FA is disabled and "Less secure app access" is enabled for the bot account.'
        });
    } catch (err) {
        console.error('[Bot Test] Error:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to test credentials'
        });
    }
});

// Delete bot credentials
app.delete('/api/bot/setup', verifyToken, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                meetBotConfig: {
                    email: '',
                    password: '',
                    isConfigured: false
                }
            },
            { new: true }
        );

        res.json({
            success: true,
            message: 'Bot credentials removed successfully'
        });
    } catch (err) {
        console.error('[Bot Setup] Delete error:', err);
        res.status(500).json({ error: 'Failed to remove bot credentials' });
    }
});

// ===== MS TEAMS BOT SETUP ENDPOINTS =====

// Launch browser for user to setup Microsoft account
app.post('/api/bot/teams/setup/start', verifyToken, async (req, res) => {
    try {
        const userId = req.user._id.toString();
        const profilePath = path.join(__dirname, '../browser-profiles/teams', userId);

        // Create profile directory if it doesn't exist
        if (!require('fs').existsSync(profilePath)) {
            require('fs').mkdirSync(profilePath, { recursive: true });
        }

        console.log('[Teams Bot Setup] Launching browser for setup:', userId);

        // Launch browser with user data dir to save session
        const browser = await puppeteer.launch({
            headless: false,
            userDataDir: profilePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--start-maximized',
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ],
            ignoreDefaultArgs: ['--enable-automation'],
        });

        const pages = await browser.pages();
        const page = pages[0] || await browser.newPage();

        // Set additional properties to avoid detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // Navigate to Microsoft login
        await page.goto('https://login.microsoftonline.com/', { waitUntil: 'domcontentloaded' });

        console.log('[Teams Bot Setup] Browser opened - waiting for user to login');

        // Monitor when browser closes
        browser.on('disconnected', async () => {
            console.log('[Teams Bot Setup] Browser closed - saving profile');

            // Mark as configured
            await User.findByIdAndUpdate(userId, {
                teamsBotConfig: {
                    browserProfilePath: profilePath,
                    isConfigured: true
                }
            });

            console.log('[Teams Bot Setup] Profile saved for user:', userId);
        });

        res.json({
            success: true,
            message: 'Browser launched. Please log into your Microsoft account and close the browser when done.'
        });

    } catch (err) {
        console.error('[Teams Bot Setup] Launch error:', err);
        res.status(500).json({ error: 'Failed to launch setup browser' });
    }
});

// Get Teams bot setup status
app.get('/api/bot/teams/setup', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user.teamsBotConfig || !user.teamsBotConfig.isConfigured) {
            return res.json({
                isConfigured: false
            });
        }

        res.json({
            isConfigured: user.teamsBotConfig.isConfigured
        });
    } catch (err) {
        console.error('[Teams Bot Setup] Get status error:', err);
        res.status(500).json({ error: 'Failed to fetch Teams bot setup status' });
    }
});

// Delete Teams bot credentials
app.delete('/api/bot/teams/setup', verifyToken, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                teamsBotConfig: {
                    browserProfilePath: '',
                    isConfigured: false
                }
            },
            { new: true }
        );

        res.json({
            success: true,
            message: 'Teams bot credentials removed successfully'
        });
    } catch (err) {
        console.error('[Teams Bot Setup] Delete error:', err);
        res.status(500).json({ error: 'Failed to remove Teams bot credentials' });
    }
});


// Routes

// 1. Join Meeting
app.post('/api/join', optionalAuth, async (req, res) => {
    const { link, meetingName, botName } = req.body;
    if (!link) return res.status(400).json({ error: 'Link is required' });

    try {
        const zoomMeetingId = zoomService.extractMeetingId(link);
        const userId = req.user?._id || null;  // Get userId if authenticated
        const userEmail = req.user?.email || null;  // Get userEmail if authenticated

        // Detect platform from meeting link
        let platform = 'unknown';
        if (link.includes('zoom.us')) platform = 'zoom';
        else if (link.includes('meet.google.com')) platform = 'google-meet';
        else if (link.includes('teams.microsoft.com') || link.includes('teams.live.com')) platform = 'teams';

        // Auto-generate meeting name if not provided
        let finalMeetingName = meetingName || 'Meeting';
        if (!meetingName || meetingName.trim() === '') {
            // Count existing meetings to generate sequential names
            const count = await Meeting.countDocuments();
            finalMeetingName = `AI Meeting Bot ${count + 1}`;
        }

        console.log('[Server] Creating new meeting:', { link, zoomMeetingId, platform, userId, userEmail, meetingName: finalMeetingName, botName });

        const newMeeting = new Meeting({
            meetingLink: link,
            zoomMeetingId: zoomMeetingId || '',
            platform: platform,
            status: 'joining',
            userId: userId,
            userEmail: userEmail,
            meetingName: finalMeetingName,
            botName: botName || 'AI Bot',
        });
        await newMeeting.save();

        console.log('[Server] Meeting saved to database:', newMeeting._id.toString());

        emitStatus(newMeeting._id.toString(), 'joining', { message: 'Bot is starting...' });

        runBot(link, newMeeting._id, userId, newMeeting.botName).then(({ browser }) => {
            console.log(`[Server] Bot started for meeting ${newMeeting._id}`);

            // Only attach event listener if browser is not null
            if (browser) {
                emitStatus(newMeeting._id.toString(), 'in-meeting', { message: 'Bot joined the meeting' });

                browser.on('disconnected', async () => {
                    console.log(`[Server] Browser closed for meeting ${newMeeting._id}`);
                    await Meeting.findByIdAndUpdate(newMeeting._id, { status: 'completed' });
                    emitStatus(newMeeting._id.toString(), 'completed', { message: 'Meeting ended' });
                });
            } else {
                console.log(`[Server] Bot failed to start - browser is null`);
                emitStatus(newMeeting._id.toString(), 'failed', { message: 'Failed to join meeting' });
            }

        }).catch(async (err) => {
            console.error('Bot Failed:', err);
            await Meeting.findByIdAndUpdate(newMeeting._id, { status: 'failed' });
            emitStatus(newMeeting._id.toString(), 'failed', { message: err.message });
        });

        res.json({ success: true, message: 'Bot is joining...', meetingId: newMeeting._id, zoomMeetingId });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// 2. Get Meetings (All meetings for dashboard)
app.get('/api/meetings', optionalAuth, async (req, res) => {
    try {
        const query = req.user ? { userId: req.user._id } : { userId: null };
        // Show all meetings (active and completed)
        const meetings = await Meeting.find(query).sort({ createdAt: -1 });
        res.json(meetings);
    } catch (err) {
        console.error('Get meetings error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// 2.1 Get Archive Meetings (Past meetings - completed/failed)
app.get('/api/meetings/archive', optionalAuth, async (req, res) => {
    try {
        const query = req.user ? { userId: req.user._id } : { userId: null };
        // Only show completed or failed meetings
        query.status = { $in: ['completed', 'failed'] };
        const meetings = await Meeting.find(query).sort({ createdAt: -1 });
        res.json(meetings);
    } catch (err) {
        console.error('Get archive meetings error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// 2.2 Get Shared Meetings (Collaboration endpoint - must be before :id route)
app.get('/api/meetings/shared', optionalAuth, dashboardController.getSharedMeetings);

// 2.2 Update Meeting Name
app.put('/api/meetings/:id/name', optionalAuth, async (req, res) => {
    try {
        const { meetingName } = req.body;

        if (!meetingName || !meetingName.trim()) {
            return res.status(400).json({ error: 'Meeting name is required' });
        }

        const meeting = await Meeting.findByIdAndUpdate(
            req.params.id,
            { meetingName: meetingName.trim() },
            { new: true }
        );

        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        console.log('[Server] Updated meeting name:', meeting._id, 'to:', meetingName.trim());
        res.json({ success: true, meeting });
    } catch (err) {
        console.error('Update meeting name error:', err);
        res.status(500).json({ error: 'Failed to update meeting name' });
    }
});

// 2.3 Save Transcript Data (from live transcription)
app.put('/api/meetings/:id/save-transcript', optionalAuth, async (req, res) => {
    try {
        const meetingId = req.params.id;
        const { 
            liveTranscriptFull, 
            liveTranscriptSentences,
            speakerSegments, 
            totalSpeakers,
            transcription 
        } = req.body;

        console.log('[Server] Saving transcript for meeting:', meetingId);

        const updateData = {
            liveTranscriptUpdatedAt: new Date()
        };

        // Update fields if provided
        if (liveTranscriptFull !== undefined) updateData.liveTranscriptFull = liveTranscriptFull;
        if (liveTranscriptSentences !== undefined) updateData.liveTranscriptSentences = liveTranscriptSentences;
        if (speakerSegments !== undefined) updateData.speakerSegments = speakerSegments;
        if (totalSpeakers !== undefined) updateData.totalSpeakers = totalSpeakers;
        if (transcription !== undefined) updateData.transcription = transcription;

        const meeting = await Meeting.findByIdAndUpdate(
            meetingId,
            updateData,
            { new: true }
        );

        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        console.log('[Server] Transcript saved successfully:', meetingId);
        
        // Emit update to connected clients
        global.io.emit('meetingUpdate', { 
            meetingId: meetingId.toString(), 
            status: 'transcript-saved',
            message: 'Transcript saved to database' 
        });

        res.json({ 
            success: true, 
            message: 'Transcript saved successfully',
            meeting 
        });
    } catch (err) {
        console.error('[Server] Save transcript error:', err);
        res.status(500).json({ error: 'Failed to save transcript' });
    }
});

// 2.4 Save Tasks Data (from task extraction)
app.put('/api/meetings/:id/save-tasks', optionalAuth, async (req, res) => {
    try {
        const meetingId = req.params.id;
        const { extractedTasks } = req.body;

        console.log('[Server] Saving tasks for meeting:', meetingId);

        if (!extractedTasks || !Array.isArray(extractedTasks)) {
            return res.status(400).json({ error: 'Invalid tasks data' });
        }

        const meeting = await Meeting.findByIdAndUpdate(
            meetingId,
            { 
                extractedTasks: extractedTasks,
                tasksUpdatedAt: new Date()
            },
            { new: true }
        );

        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        console.log('[Server] Tasks saved successfully:', meetingId, '-', extractedTasks.length, 'tasks');
        
        // Emit update to connected clients
        global.io.emit('meetingUpdate', { 
            meetingId: meetingId.toString(), 
            status: 'tasks-saved',
            message: `${extractedTasks.length} tasks saved to database` 
        });

        res.json({ 
            success: true, 
            message: `${extractedTasks.length} tasks saved successfully`,
            meeting 
        });
    } catch (err) {
        console.error('[Server] Save tasks error:', err);
        res.status(500).json({ error: 'Failed to save tasks' });
    }
});

// 3. Update Meeting
app.patch('/api/meetings/:id', async (req, res) => {
    try {
        const { transcription, status } = req.body;
        const updateData = {};
        if (transcription) updateData.transcription = transcription;
        if (status) updateData.status = status;

        const meeting = await Meeting.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        res.json(meeting);
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// Get single meeting by ID
app.get('/api/meetings/:id', optionalAuth, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        res.json(meeting);
    } catch (err) {
        console.error('Get meeting error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// 4. Stop Bot
app.post('/api/meetings/:id/stop', async (req, res) => {
    try {
        const meetingId = req.params.id;
        const stopped = await stopBot(meetingId);

        const meeting = await Meeting.findByIdAndUpdate(
            meetingId,
            { status: 'completed' },
            { new: true }
        );

        emitStatus(meetingId, 'completed', { message: 'Bot stopped' });
        res.json({ success: stopped, meeting });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// 4.5. Upload Recording
app.post('/api/meetings/upload', optionalAuth, upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const userId = req.user ? req.user._id : null;
        const filePath = req.file.path;
        const fileName = req.file.filename;
        const fileExt = path.extname(fileName).toLowerCase();

        // Create meeting record
        const meeting = new Meeting({
            userId,
            meetingLink: 'uploaded-recording',
            platform: 'upload',
            status: 'processing',
            audioPath: `recordings/${fileName}`,
            title: req.body.title || `Uploaded Recording - ${new Date().toLocaleString()}`,
            createdAt: new Date()
        });

        await meeting.save();
        const meetingId = meeting._id.toString();

        // Send immediate response with meetingId
        res.json({
            success: true,
            meetingId: meetingId,
            message: 'File uploaded successfully. Processing transcription...'
        });

        // Process transcription in background
        (async () => {
            try {
                emitStatus(meetingId, 'processing', { message: 'Extracting audio...' });

                let audioFilePath = filePath;

                // If video file, extract audio using ffmpeg
                const videoExts = ['.mp4', '.webm', '.mov', '.avi'];
                if (videoExts.includes(fileExt)) {
                    const ffmpeg = require('fluent-ffmpeg');
                    const audioPath = filePath.replace(fileExt, '.wav');

                    await new Promise((resolve, reject) => {
                        ffmpeg(filePath)
                            .toFormat('wav')
                            .audioFrequency(16000)
                            .audioChannels(1)
                            .on('end', () => resolve())
                            .on('error', (err) => reject(err))
                            .save(audioPath);
                    });

                    audioFilePath = audioPath;

                    // Update meeting with new audio path
                    await Meeting.findByIdAndUpdate(meetingId, {
                        audioPath: `recordings/${path.basename(audioPath)}`
                    });
                }

                emitStatus(meetingId, 'processing', { message: 'Transcribing audio...' });

                // Transcribe with Deepgram and get speaker diarization with Assembly AI
                const transcriptionResult = await transcriptionService.transcribeAudio(
                    audioFilePath,
                    (status, message) => {
                        console.log(`[Upload Transcription] ${status}: ${message}`);
                        emitStatus(meetingId, 'processing', { message });
                    },
                    true, // Enable speaker diarization
                    { mode: 'post-meeting' } // Use post-meeting mode (Deepgram + Assembly AI)
                );

                // Update meeting with results
                await Meeting.findByIdAndUpdate(meetingId, {
                    transcription: transcriptionResult.transcript,
                    speakerSegments: transcriptionResult.speakerSegments || [],
                    speakerStats: transcriptionResult.speakerStats || {},
                    totalSpeakers: transcriptionResult.totalSpeakers || 0,
                    status: 'completed'
                });

                emitStatus(meetingId, 'completed', {
                    message: 'Transcription completed successfully',
                    transcription: transcriptionResult.transcript,
                    speakerSegments: transcriptionResult.speakerSegments,
                    speakerStats: transcriptionResult.speakerStats,
                    totalSpeakers: transcriptionResult.totalSpeakers
                });

            } catch (error) {
                console.error('[Upload] Processing error:', error);
                await Meeting.findByIdAndUpdate(meetingId, {
                    status: 'failed',
                    error: error.message
                });
                emitStatus(meetingId, 'failed', { message: error.message });
            }
        })();

    } catch (err) {
        console.error('[Upload] Error:', err);
        res.status(500).json({ error: 'Server Error' });
    }
});

// 5. Dashboard Analysis
app.post('/api/meetings/:id/analyze', optionalAuth, dashboardController.generateDashboard);
app.get('/api/meetings/:id/analysis', optionalAuth, dashboardController.getDashboard);
app.post('/api/meetings/:id/ask', optionalAuth, dashboardController.askQuestion);

// Collaboration endpoints for specific meeting
app.post('/api/meetings/:id/collaborators', optionalAuth, dashboardController.addCollaborator);
app.delete('/api/meetings/:id/collaborators', optionalAuth, dashboardController.removeCollaborator);

// Export dashboard to email (Outlook)
app.post('/api/meetings/:id/export-email', optionalAuth, dashboardController.exportDashboardToEmail);

// Update speaker name
app.put('/api/meetings/:id/speaker-name', optionalAuth, dashboardController.updateSpeakerName);

// Download dashboard as PDF
app.get('/api/meetings/:id/download-pdf', optionalAuth, dashboardController.downloadDashboardPDF);

// AI Search through meeting transcripts
app.post('/api/meetings/ai-search', optionalAuth, async (req, res) => {
    try {
        const { query, meetings } = req.body;

        if (!query || !meetings || meetings.length === 0) {
            return res.status(400).json({ success: false, error: 'Query and meetings are required' });
        }

        // Filter out meetings without transcripts
        const meetingsWithTranscripts = meetings.filter(m => m.transcript && m.transcript.trim());

        if (meetingsWithTranscripts.length === 0) {
            return res.json({ success: true, relevantMeetingIds: [], message: 'No meetings with transcripts found' });
        }

        // Prepare context for Gemini
        const meetingsContext = meetingsWithTranscripts.map(m => 
            `Meeting ID: ${m.id}\nMeeting Name: ${m.name}\nDate: ${new Date(m.date).toLocaleDateString()}\nTranscript: ${m.transcript.substring(0, 3000)}`
        ).join('\n\n---\n\n');

        const prompt = `You are an AI assistant helping to search through meeting transcripts.

User Query: "${query}"

Below are the available meetings with their transcripts:

${meetingsContext}

Based on the user's query, identify which meetings are most relevant. Consider:
- Direct mentions of the topics, tasks, or keywords
- Context and related discussions
- Action items and decisions related to the query

Return ONLY a JSON array of meeting IDs that are relevant to the query, ordered by relevance (most relevant first).
If no meetings are relevant, return an empty array.

Format: ["meetingId1", "meetingId2", ...]

Do not include any explanation, just the JSON array.`;

        // Call Groq AI
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            max_tokens: 500,
            top_p: 0.8
        });

        const responseText = completion.choices[0]?.message?.content?.trim() || '[]';

        // Parse the JSON response
        let relevantMeetingIds = [];
        try {
            // Remove markdown code blocks if present
            const cleanedResponse = responseText.replace(/```json\n?|\n?```/g, '').trim();
            relevantMeetingIds = JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.error('Failed to parse AI response:', responseText);
            // Fallback: try to extract meeting IDs from the response
            const idMatches = responseText.match(/[a-f0-9]{24}/g);
            if (idMatches) {
                relevantMeetingIds = [...new Set(idMatches)];
            }
        }

        res.json({ 
            success: true, 
            relevantMeetingIds,
            totalSearched: meetingsWithTranscripts.length
        });

    } catch (error) {
        console.error('AI search error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to perform AI search',
            details: error.message 
        });
    }
});


// 5. Delete Meeting
app.delete('/api/meetings/:id', async (req, res) => {
    try {
        const meeting = await Meeting.findByIdAndDelete(req.params.id);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        if (meeting.audioPath) {
            const filePath = path.join(__dirname, '..', meeting.audioPath);
            try {
                require('fs').unlinkSync(filePath);
            } catch (e) { }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Server Error' });
    }
});

// ===== SCHEDULED MEETINGS ROUTES =====

// Create scheduled meeting
app.post('/api/scheduled-meetings', optionalAuth, async (req, res) => {
    try {
        const { meetingType, meetingLink, scheduledTime, title } = req.body;

        if (!meetingType || !meetingLink || !scheduledTime) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const scheduledMeeting = new ScheduledMeeting({
            meetingType,
            meetingLink,
            scheduledTime: new Date(scheduledTime),
            title: title || 'Scheduled Meeting',
            userId: req.user?._id,
            userEmail: req.user?.email,
        });

        await scheduledMeeting.save();
        res.json({ success: true, meeting: scheduledMeeting });
    } catch (err) {
        console.error('Create scheduled meeting error:', err);
        res.status(500).json({ error: 'Failed to create scheduled meeting' });
    }
});

// Get all scheduled meetings
app.get('/api/scheduled-meetings', optionalAuth, async (req, res) => {
    try {
        const query = req.user ? { userId: req.user._id } : { userId: null };
        const scheduledMeetings = await ScheduledMeeting.find(query).sort({ scheduledTime: 1 });
        res.json({ success: true, meetings: scheduledMeetings });
    } catch (err) {
        console.error('Get scheduled meetings error:', err);
        res.status(500).json({ error: 'Failed to fetch scheduled meetings' });
    }
});

// Delete scheduled meeting
app.delete('/api/scheduled-meetings/:id', optionalAuth, async (req, res) => {
    try {
        const meeting = await ScheduledMeeting.findByIdAndDelete(req.params.id);
        if (!meeting) {
            return res.status(404).json({ error: 'Scheduled meeting not found' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Delete scheduled meeting error:', err);
        res.status(500).json({ error: 'Failed to delete scheduled meeting' });
    }
});

// Update scheduled meeting status
app.patch('/api/scheduled-meetings/:id', optionalAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const meeting = await ScheduledMeeting.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!meeting) {
            return res.status(404).json({ error: 'Scheduled meeting not found' });
        }
        res.json({ success: true, meeting });
    } catch (err) {
        console.error('Update scheduled meeting error:', err);
        res.status(500).json({ error: 'Failed to update scheduled meeting' });
    }
});

// 5. Trigger scheduled meeting manually (for testing)
app.post('/api/scheduled-meetings/:id/trigger', optionalAuth, async (req, res) => {
    try {
        const result = await meetingSchedulerService.triggerScheduledMeeting(req.params.id);
        res.json(result);
    } catch (err) {
        console.error('Trigger scheduled meeting error:', err);
        res.status(500).json({ error: err.message || 'Failed to trigger meeting' });
    }
});

// 6. Get scheduler status
app.get('/api/scheduler/status', (req, res) => {
    const status = meetingSchedulerService.getSchedulerStatus();
    res.json(status);
});

// 6.5. Cleanup expired scheduled meetings manually
app.post('/api/scheduler/cleanup', optionalAuth, async (req, res) => {
    try {
        const deletedCount = await meetingSchedulerService.cleanupExpiredMeetings();
        res.json({ 
            success: true, 
            message: `Cleaned up ${deletedCount} expired meeting(s)`,
            deletedCount 
        });
    } catch (err) {
        console.error('Cleanup error:', err);
        res.status(500).json({ error: 'Failed to cleanup expired meetings' });
    }
});

// 7. Generate scheduled meeting with Gemini AI
app.post('/api/scheduled-meetings/gemini/generate', optionalAuth, async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Gemini API key not configured' });
        }

        // Define schema for meeting generation
        const meetingSchema = {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                meetingType: { type: Type.STRING }, // zoom, meet, teams
                meetingLink: { type: Type.STRING },
                scheduledTime: { type: Type.STRING }, // ISO format
                description: { type: Type.STRING }
            },
            required: ['title', 'meetingType', 'scheduledTime']
        };

        // Create prompt for Gemini
        const systemPrompt = `You are an AI assistant that helps users create scheduled meetings. 
Based on the user's request, generate a meeting schedule with the following details:
- title: A clear, professional meeting title
- meetingType: One of "zoom", "meet", or "teams" (default to "zoom" if not specified)
- meetingLink: Generate a placeholder link based on the meeting type (e.g., "https://zoom.us/j/PLACEHOLDER" for Zoom, "https://meet.google.com/PLACEHOLDER" for Meet, "https://teams.microsoft.com/l/meetup-join/PLACEHOLDER" for Teams)
- scheduledTime: Convert the user's time request to ISO 8601 format. If only time is mentioned, assume today's date. If relative time like "in 2 hours" or "tomorrow at 3pm", calculate from now: ${new Date().toISOString()}
- description: A brief description of what the meeting is about

User Request: ${prompt}

IMPORTANT: 
- For scheduledTime, ensure it's a valid ISO 8601 datetime string
- If user mentions "in X hours/minutes", add that to the current time
- If user mentions "tomorrow" or specific dates, calculate correctly
- Use 24-hour format for times`;

        const response = await geminiAI.models.generateContent({
            model: 'gemini-flash-latest',
            contents: systemPrompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: meetingSchema
            }
        });

        const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text || response.text?.() || '{}';
        const meetingData = JSON.parse(rawText);

        // Validate the generated data
        if (!meetingData.title || !meetingData.scheduledTime) {
            return res.status(400).json({ error: 'Failed to generate valid meeting data' });
        }

        res.json({ 
            success: true, 
            meeting: meetingData,
            message: 'Meeting schedule generated successfully'
        });

    } catch (err) {
        console.error('Gemini generation error:', err);
        res.status(500).json({ 
            error: 'Failed to generate meeting schedule',
            details: err.message 
        });
    }
});

// 8. Test email reminder (for testing purposes)
app.post('/api/scheduler/test-reminder', optionalAuth, async (req, res) => {
    try {
        const { meetingId } = req.body;
        
        if (!meetingId) {
            return res.status(400).json({ error: 'Meeting ID is required' });
        }
        
        const meeting = await ScheduledMeeting.findById(meetingId);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }
        
        const { sendMeetingReminder } = require('./services/emailService');
        const result = await sendMeetingReminder(meeting);
        
        if (result.success) {
            res.json({ success: true, message: 'Test reminder email sent successfully', messageId: result.messageId });
        } else {
            res.status(500).json({ error: 'Failed to send test email', details: result.error });
        }
    } catch (err) {
        console.error('Test reminder error:', err);
        res.status(500).json({ error: 'Failed to send test reminder' });
    }
});

// 9. Manually trigger reminder check (for testing)
app.post('/api/scheduler/send-reminders', optionalAuth, async (req, res) => {
    try {
        await meetingSchedulerService.sendTomorrowMeetingReminders();
        res.json({ success: true, message: 'Reminder check triggered successfully' });
    } catch (err) {
        console.error('Send reminders error:', err);
        res.status(500).json({ error: 'Failed to trigger reminder check' });
    }
});

// 7. Get active bots
app.get('/api/bots/active', (req, res) => {
    const activeIds = Array.from(activeBots.keys());
    res.json({ activeBots: activeIds, count: activeIds.length });
});

// 7. Fetch Recording from Zoom API
app.post('/api/meetings/:id/fetch-recording', async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        if (!meeting.zoomMeetingId) {
            return res.status(400).json({ error: 'No Zoom meeting ID' });
        }

        console.log(`[Server] Fetching recording for Zoom meeting ${meeting.zoomMeetingId}...`);
        emitStatus(meeting._id.toString(), 'fetching-recording', { message: 'Fetching from Zoom...' });

        const { audioPath, transcript } = await zoomService.fetchRecordingsForMeeting(
            meeting.zoomMeetingId,
            meeting._id.toString()
        );

        const updateData = {};
        if (audioPath) updateData.audioPath = audioPath;
        if (transcript) updateData.transcription = transcript;

        const updatedMeeting = await Meeting.findByIdAndUpdate(
            meeting._id,
            updateData,
            { new: true }
        );

        emitStatus(meeting._id.toString(), 'completed', { message: 'Recording fetched!', audioPath });

        res.json({ success: true, audioPath, hasTranscript: !!transcript, meeting: updatedMeeting });

    } catch (err) {
        console.error('[Server] Fetch recording error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 8. List Zoom recordings
app.get('/api/zoom/recordings', async (req, res) => {
    try {
        const recordings = await zoomService.listRecordings();
        res.json({ recordings });
    } catch (err) {
        console.error('[Server] List recordings error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 9. Test Zoom API
app.get('/api/zoom/test', async (req, res) => {
    try {
        const token = await zoomService.getAccessToken();
        res.json({ success: true, message: 'Zoom API connection successful', tokenPreview: token.substring(0, 20) + '...' });
    } catch (err) {
        console.error('[Server] Zoom test error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 10. Get Service Info (Transcription & Speaker Diarization)
app.get('/api/services/info', (req, res) => {
    try {
        const info = transcriptionService.getServiceInfo();
        res.json(info);
    } catch (err) {
        console.error('[Server] Service info error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// 11. Transcribe Meeting Audio
app.post('/api/meetings/:id/transcribe', async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        if (!meeting.audioPath) {
            return res.status(400).json({ error: 'No audio recording available' });
        }

        const audioFullPath = path.join(__dirname, '..', meeting.audioPath);
        if (!require('fs').existsSync(audioFullPath)) {
            return res.status(404).json({ error: 'Audio file not found' });
        }

        // Check if already transcribed
        if (meeting.transcription && meeting.transcription.length > 0) {
            return res.json({
                success: true,
                transcription: meeting.transcription,
                cached: true
            });
        }

        console.log(`[Server] Starting transcription for meeting ${req.params.id}...`);
        emitStatus(meeting._id.toString(), 'transcribing', { message: 'Starting transcription...' });

        // Progress callback
        const onProgress = (status, message) => {
            console.log(`[Transcription] ${status}: ${message}`);
            emitStatus(meeting._id.toString(), 'transcribing', {
                transcriptionStatus: status,
                message
            });
        };

        // Run POST-MEETING transcription (Deepgram + Assembly AI)
        const transcriptionResult = await transcriptionService.transcribeAudio(
            audioFullPath,
            onProgress,
            true,  // Enable speaker diarization
            { mode: 'post-meeting' }  // Use Deepgram + Assembly AI
        );

        // Handle both old (string) and new (object) return formats
        const transcription = typeof transcriptionResult === 'string'
            ? transcriptionResult
            : transcriptionResult.transcript;

        const speakerSegments = transcriptionResult.speakerSegments || [];
        const speakerStats = transcriptionResult.speakerStats || {};
        const totalSpeakers = transcriptionResult.totalSpeakers || 0;

        // Save to database
        const updatedMeeting = await Meeting.findByIdAndUpdate(
            meeting._id,
            {
                transcription,
                speakerSegments,
                speakerStats,
                totalSpeakers
            },
            { new: true }
        );

        emitStatus(meeting._id.toString(), 'completed', {
            message: 'Transcription complete!',
            transcription,
            totalSpeakers
        });

        console.log(`[Server] ✅ Transcription saved for meeting ${req.params.id}`);
        console.log(`[Server] Speakers: ${totalSpeakers}, Segments: ${speakerSegments.length}`);

        res.json({
            success: true,
            transcription,
            speakerSegments,
            speakerStats,
            totalSpeakers,
            meeting: updatedMeeting
        });

    } catch (err) {
        console.error('[Server] Transcription error:', err.message);
        emitStatus(req.params.id, 'error', { message: `Transcription failed: ${err.message}` });
        res.status(500).json({ error: err.message });
    }
});

// 12. Extract Tasks from Transcript
app.post('/api/meetings/:id/extract-tasks', optionalAuth, async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        // Verify ownership if user is authenticated
        if (req.user && meeting.userId && meeting.userId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!meeting.transcription || meeting.transcription.length === 0) {
            return res.status(400).json({ error: 'No transcription available' });
        }

        console.log(`[Server] Extracting tasks for meeting ${req.params.id}...`);

        // Extract tasks using OpenAI
        const tasks = await taskExtractionService.extractTasksFromTranscript(meeting.transcription);

        // Save tasks to meeting with timestamp (auto-save)
        const updatedMeeting = await Meeting.findByIdAndUpdate(
            req.params.id,
            { 
                extractedTasks: tasks,
                tasksUpdatedAt: new Date() // Auto-save timestamp
            },
            { new: true }
        );

        console.log(`[Server] ✅ Successfully extracted and auto-saved ${tasks.length} tasks`);
        
        // Emit update to connected clients
        global.io.emit('meetingUpdate', { 
            meetingId: req.params.id.toString(), 
            status: 'tasks-saved',
            message: `${tasks.length} tasks extracted and saved automatically` 
        });

        res.json({
            success: true,
            tasks,
            count: tasks.length,
            meeting: updatedMeeting
        });

    } catch (err) {
        console.error('[Server] Task extraction error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Test endpoint to create a sample meeting with transcript
app.get('/api/analytics/dashboard', optionalAuth, async (req, res) => {
    try {
        const query = req.user ? { userId: req.user._id } : { userId: null };
        console.log('[Server] Dashboard analytics query:', query);

        // Get all meetings for this user
        const allMeetings = await Meeting.find(query);
        console.log('[Server] Found', allMeetings.length, 'total meetings');

        // Calculate stats
        const completedMeetings = allMeetings.filter(m => m.status === 'completed');
        const activeMeetings = allMeetings.filter(m => m.status && ['recording', 'in-meeting'].includes(m.status));

        // Calculate total bot time (in minutes)
        let totalBotMinutes = 0;
        completedMeetings.forEach(meeting => {
            try {
                if (meeting.createdAt && meeting.completedAt) {
                    const diffMs = new Date(meeting.completedAt) - new Date(meeting.createdAt);
                    const diffMinutes = Math.floor(diffMs / (1000 * 60));
                    totalBotMinutes += Math.min(diffMinutes, 480); // Cap at 8 hours
                }
            } catch (timeErr) {
                console.error('[Server] Error calculating time for meeting:', timeErr.message);
            }
        });

        // Count action items
        let actionItemsCount = 0;
        let totalWords = 0;
        let meetingsWithTranscripts = 0;

        allMeetings.forEach(meeting => {
            // Count extracted tasks
            if (meeting.extractedTasks && Array.isArray(meeting.extractedTasks)) {
                actionItemsCount += meeting.extractedTasks.length;
            }

            // Calculate total words from transcripts
            if (meeting.transcription && meeting.transcription.length > 0) {
                meetingsWithTranscripts++;
                const words = meeting.transcription.trim().split(/\s+/).length;
                totalWords += words;
            }
        });

        // Count unique speakers
        const allSpeakers = new Set();
        allMeetings.forEach(meeting => {
            if (meeting.speakerStats && Array.isArray(meeting.speakerStats)) {
                meeting.speakerStats.forEach(speaker => {
                    allSpeakers.add(speaker.speaker);
                });
            }
        });

        // Meeting platform breakdown
        const platformStats = {
            zoom: allMeetings.filter(m => m.zoomMeetingId).length,
            googleMeet: allMeetings.filter(m => m.meetingLink && m.meetingLink.includes('meet.google.com')).length,
            other: allMeetings.filter(m => !m.zoomMeetingId && (!m.meetingLink || !m.meetingLink.includes('meet.google.com'))).length
        };

        // Calculate week-over-week changes
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(thisWeekStart.getDate() - 7);

        // Current week meetings
        const thisWeekMeetings = allMeetings.filter(m => {
            const meetDate = new Date(m.createdAt);
            return meetDate >= thisWeekStart && meetDate < today;
        });

        // Last week meetings
        const lastWeekMeetings = allMeetings.filter(m => {
            const meetDate = new Date(m.createdAt);
            return meetDate >= lastWeekStart && meetDate < thisWeekStart;
        });

        // Calculate this week's stats
        let thisWeekWords = 0;
        let thisWeekMeetings_count = thisWeekMeetings.length;
        let thisWeekActionItems = 0;
        let thisWeekSpeakers = new Set();

        thisWeekMeetings.forEach(m => {
            if (m.transcription && m.transcription.length > 0) {
                const words = m.transcription.trim().split(/\s+/).length;
                thisWeekWords += words;
            }
            if (m.extractedTasks && Array.isArray(m.extractedTasks)) {
                thisWeekActionItems += m.extractedTasks.length;
            }
            if (m.speakerStats && Array.isArray(m.speakerStats)) {
                m.speakerStats.forEach(s => thisWeekSpeakers.add(s.speaker));
            }
        });

        // Calculate last week's stats
        let lastWeekWords = 0;
        let lastWeekMeetings_count = lastWeekMeetings.length;
        let lastWeekActionItems = 0;
        let lastWeekSpeakers = new Set();

        lastWeekMeetings.forEach(m => {
            if (m.transcription && m.transcription.length > 0) {
                const words = m.transcription.trim().split(/\s+/).length;
                lastWeekWords += words;
            }
            if (m.extractedTasks && Array.isArray(m.extractedTasks)) {
                lastWeekActionItems += m.extractedTasks.length;
            }
            if (m.speakerStats && Array.isArray(m.speakerStats)) {
                m.speakerStats.forEach(s => lastWeekSpeakers.add(s.speaker));
            }
        });

        // Calculate percentage changes
        const calculatePercentageChange = (current, previous) => {
            if (previous === 0) {
                return current > 0 ? 100 : 0;
            }
            return Math.round(((current - previous) / previous) * 100);
        };

        const wordsChange = calculatePercentageChange(thisWeekWords, lastWeekWords);
        const meetingsChange = calculatePercentageChange(thisWeekMeetings_count, lastWeekMeetings_count);
        const itemsChange = calculatePercentageChange(thisWeekActionItems, lastWeekActionItems);
        const speakersChange = calculatePercentageChange(thisWeekSpeakers.size, lastWeekSpeakers.size);

        const hours = Math.floor(totalBotMinutes / 60);
        const minutes = totalBotMinutes % 60;

        res.json({
            success: true,
            stats: {
                totalBotTime: `${hours}h ${minutes}m`,
                totalBotMinutes: totalBotMinutes,
                totalWords: totalWords,
                totalWordsFormatted: totalWords > 1000 ? `${(totalWords / 1000).toFixed(1)}K words` : `${totalWords} words`,
                wordsChange: wordsChange,
                meetingsWithTranscripts: meetingsWithTranscripts,
                meetingsRecorded: completedMeetings.length,
                meetingsChange: meetingsChange,
                activeMeetings: activeMeetings.length,
                actionItems: actionItemsCount,
                itemsChange: itemsChange,
                uniqueSpeakers: allSpeakers.size,
                speakersChange: speakersChange,
                totalMeetings: allMeetings.length
            },
            platformStats,
            meetings: {
                total: allMeetings.length,
                completed: completedMeetings.length,
                active: activeMeetings.length,
                failed: allMeetings.filter(m => m.status === 'failed').length
            }
        });

    } catch (err) {
        console.error('[Server] Analytics dashboard error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Get detailed analytics with trends
app.get('/api/analytics/detailed', optionalAuth, async (req, res) => {
    try {
        const query = req.user ? { userId: req.user._id } : { userId: null };
        console.log('[Server] Fetching detailed analytics with query:', query);

        const allMeetings = await Meeting.find(query).sort({ createdAt: -1 });
        console.log('[Server] Found', allMeetings.length, 'meetings');

        // Get recent 10 meetings
        const recentMeetings = allMeetings.slice(0, 10).map(m => {
            try {
                return {
                    _id: m._id,
                    meetingLink: m.meetingLink || 'Unknown',
                    status: m.status || 'unknown',
                    createdAt: m.createdAt,
                    completedAt: m.completedAt,
                    transcription: m.transcription ? m.transcription.substring(0, 100) : null,
                    extractedTasks: (m.extractedTasks && Array.isArray(m.extractedTasks)) ? m.extractedTasks.length : 0,
                    speakerCount: (m.speakerStats && Array.isArray(m.speakerStats)) ? m.speakerStats.length : 0
                };
            } catch (mapErr) {
                console.error('[Server] Error mapping meeting:', mapErr.message, m._id);
                return {
                    _id: m._id,
                    meetingLink: 'Error',
                    status: m.status || 'unknown',
                    createdAt: m.createdAt,
                    completedAt: m.completedAt,
                    transcription: null,
                    extractedTasks: 0,
                    speakerCount: 0
                };
            }
        });

        // Get active/live meetings
        const activeMeetings = allMeetings.filter(m =>
            m.status && ['recording', 'in-meeting', 'starting', 'joining'].includes(m.status)
        ).map(m => ({
            _id: m._id,
            meetingLink: m.meetingLink || 'Unknown',
            status: m.status,
            createdAt: m.createdAt,
            userEmail: m.userEmail || 'unknown@example.com'
        }));

        // Get meetings by day (last 7 days)
        const last7Days = {};
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            last7Days[dateStr] = 0;
        }

        allMeetings.forEach(meeting => {
            try {
                if (meeting.createdAt) {
                    const dateStr = new Date(meeting.createdAt).toISOString().split('T')[0];
                    if (last7Days[dateStr] !== undefined) {
                        last7Days[dateStr]++;
                    }
                }
            } catch (dateErr) {
                console.error('[Server] Error processing meeting date:', dateErr.message);
            }
        });

        // Get speaker frequency
        const speakerFreq = {};
        allMeetings.forEach(meeting => {
            if (meeting.speakerStats && Array.isArray(meeting.speakerStats)) {
                meeting.speakerStats.forEach(speaker => {
                    if (speaker && speaker.speaker) {
                        speakerFreq[speaker.speaker] = (speakerFreq[speaker.speaker] || 0) + 1;
                    }
                });
            }
        });

        const speakerFrequency = Object.entries(speakerFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        console.log('[Server] Detailed analytics prepared successfully');

        res.json({
            success: true,
            recentMeetings,
            activeMeetings,
            meetingsTrend: last7Days,
            speakerFrequency
        });

    } catch (err) {
        console.error('[Server] Detailed analytics error:', err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});

// Get tasks analytics
app.get('/api/analytics/tasks', optionalAuth, async (req, res) => {
    try {
        const query = req.user ? { userId: req.user._id } : { userId: null };
        const allMeetings = await Meeting.find(query);

        const allTasks = [];
        const priorityStats = { high: 0, medium: 0, low: 0 };
        const categoryStats = {};

        allMeetings.forEach(meeting => {
            if (meeting.extractedTasks && Array.isArray(meeting.extractedTasks)) {
                meeting.extractedTasks.forEach(task => {
                    try {
                        allTasks.push({
                            task: task.task || 'Unknown task',
                            assignee: task.assignee || 'Unassigned',
                            deadline: task.deadline || 'No deadline',
                            priority: task.priority || 'medium',
                            category: task.category || 'other',
                            meetingId: meeting._id,
                            meetingDate: meeting.createdAt
                        });

                        const priority = (task.priority || 'medium').toLowerCase();
                        if (priority in priorityStats) {
                            priorityStats[priority]++;
                        } else {
                            priorityStats['medium']++;
                        }

                        const category = task.category || 'other';
                        categoryStats[category] = (categoryStats[category] || 0) + 1;
                    } catch (taskErr) {
                        console.error('[Server] Error processing task:', taskErr.message);
                    }
                });
            }
        });

        res.json({
            success: true,
            totalTasks: allTasks.length,
            tasks: allTasks.slice(0, 20), // Return first 20 tasks
            priorityStats,
            categoryStats
        });

    } catch (err) {
        console.error('[Server] Tasks analytics error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// Test endpoint to create a sample meeting with transcript
app.post('/api/test/create-sample-meeting', optionalAuth, async (req, res) => {
    try {
        const userId = req.user?._id || null;
        const userEmail = req.user?.email || 'test@example.com';

        const sampleTranscript = `Meeting Summary - Project Alpha Review

John: Good morning everyone. Let's start with the project updates. Sarah, can you give us a status on the frontend development?

Sarah: Sure! The new dashboard is almost complete. I've finished the UI components, but we still need to integrate the API endpoints. I'm targeting to complete that by Friday this week.

John: Great. Mike, what about the backend API?

Mike: The API is ready and deployed to staging. However, we found some performance issues with the database queries. I'll need to optimize those. I think we should also implement caching to improve response times.

John: Okay, that's important. Can you prioritize the optimization? We need this resolved before the client demo next Tuesday.

Mike: Absolutely. I'll have it done by Monday.

John: Perfect. Now, let's discuss the documentation. Lisa, have you started working on the user guide?

Lisa: Yes, I've outlined the main sections. But I need Sarah to review the UI screenshots before I can finalize it. Also, we need to decide on the deployment strategy for the documentation site.

Sarah: I can review the screenshots tomorrow. Just send them over.

John: Good. For deployment, let's go with GitHub Pages. It's simple and free. Mike, can you help Lisa set that up?

Mike: Sure, I'll help with that.

John: Excellent. One more thing - we need to schedule a follow-up meeting with the client to show them the progress. Emily, can you coordinate that?

Emily: Of course. I'll send out a meeting invite for next Wednesday. Should I invite the whole team or just the leads?

John: Just the leads for now - you, me, Sarah, and Mike. We don't want to overwhelm them.

Emily: Got it. I'll also prepare a demo script to make sure we cover all the key features.

John: That would be great. One last decision - the client asked about mobile support. After discussion, we've decided to postpone mobile development to Phase 2. We need to focus on getting the web version perfect first.

Sarah: That makes sense. I'll update the roadmap accordingly.

John: Alright, let's wrap up. To summarize our action items: Sarah completes API integration by Friday, Mike optimizes database by Monday, Lisa finalizes documentation with Sarah's review, Mike helps set up GitHub Pages, Emily schedules client meeting for next Wednesday, and Sarah updates the project roadmap. Any questions?

Mike: No questions from me.

Sarah: All clear!

Lisa: Sounds good.

Emily: I'm good.

John: Great! Thanks everyone. Let's make this a successful sprint.`;

        // Create sample meeting
        const meeting = new Meeting({
            meetingLink: 'https://zoom.us/j/test-meeting-12345',
            zoomMeetingId: 'test-12345',
            meetingUrl: 'Test Meeting - Project Alpha Review',
            status: 'completed',
            transcription: sampleTranscript,
            audioPath: '/recordings/sample-meeting.mp3',
            userId: userId,
            userEmail: userEmail,
            createdAt: new Date(),
            completedAt: new Date()
        });

        await meeting.save();
        console.log('[Server] Sample meeting created:', meeting._id);

        res.json({
            success: true,
            message: 'Sample meeting created successfully',
            meeting: {
                _id: meeting._id,
                meetingLink: meeting.meetingLink,
                status: meeting.status,
                hasTranscription: true,
                transcriptPreview: sampleTranscript.substring(0, 200) + '...'
            }
        });

    } catch (err) {
        console.error('[Server] Error creating sample meeting:', err.message);
        res.status(500).json({ error: err.message });
    }
});
// Translation Route
// Translation Route
app.post('/api/meetings/:id/translate', async (req, res) => {
    try {
        const { id } = req.params;
        const { language, target } = req.body; // 'Hindi', 'Gujarati', 'English', target: 'summary' (default) or 'timeline'

        const meeting = await Meeting.findById(id);
        if (!meeting) {
            return res.status(404).json({ error: 'Meeting not found' });
        }

        const targetType = target || 'summary'; // Default to summary if not specified (or logic below)

        // Case 1: Translate Summary
        if (targetType === 'summary') {
            const summaryText = meeting.analysis?.summary || meeting.summary || '';
            const translatedSummary = await translationService.translateText(summaryText, language);
            return res.json({ success: true, summary: translatedSummary });
        }

        // Case 2: Translate Timeline (Deprecated/Advanced)
        else if (targetType === 'timeline') {
            let timelineToTranslate = [];
            if (meeting.analysis && meeting.analysis.transcriptTimeline) {
                timelineToTranslate = meeting.analysis.transcriptTimeline;
            }

            if (timelineToTranslate.length > 0) {
                const translatedTimeline = await Promise.all(timelineToTranslate.map(async (segment) => {
                    return {
                        ...segment,
                        text: await translationService.translateText(segment.text, language)
                    };
                }));
                return res.json({ success: true, timeline: translatedTimeline });
            } else {
                return res.json({ success: false, error: 'No timeline to translate' });
            }
        }

        else {
            return res.status(400).json({ error: 'Invalid translation target' });
        }

    } catch (err) {
        console.error('Translation error:', err);
        res.status(500).json({ error: 'Translation failed' });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Start the automatic meeting scheduler
    console.log('[Server] Starting automatic meeting scheduler...');
    meetingSchedulerService.startScheduler();
    console.log('[Server] ✅ Meeting scheduler is now active');
});
