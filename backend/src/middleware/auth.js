const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate JWT token
const generateToken = (user) => {
    return jwt.sign(
        { 
            id: user._id, 
            email: user.email,
            name: user.name 
        },
        process.env.JWT_SECRET,
        { expiresIn: '30d' } // Token valid for 30 days
    );
};

// Verify JWT token middleware
const verifyToken = async (req, res, next) => {
    try {
        // Get token from Authorization header or cookie
        const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id);
            if (user) {
                req.user = user;
            }
        }
    } catch (error) {
        // Silently fail - optional auth
    }
    next();
};

module.exports = { generateToken, verifyToken, optionalAuth };
