const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const axios = require('axios');
const User = require('../models/User');

const strategy = new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback'
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
                user = await User.create({
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    name: profile.displayName,
                    picture: profile.photos[0]?.value
                });
            }

            return done(null, user);
        } catch (error) {
            return done(error, null);
        }
    });

// Override the internal OAuth2 token exchange to use axios instead of the
// buggy 'oauth' library v0.10.2 HTTP client (causes TLS socket errors on Node.js 22)
const originalGetOAuthAccessToken = strategy._oauth2.getOAuthAccessToken.bind(strategy._oauth2);
strategy._oauth2.getOAuthAccessToken = function (code, params, callback) {
    const tokenUrl = this._getAccessTokenUrl();
    const postData = {
        code,
        client_id: this._clientId,
        client_secret: this._clientSecret,
        redirect_uri: params.redirect_uri,
        grant_type: params.grant_type || 'authorization_code'
    };

    console.log('[OAuth] Exchanging code for token via axios...');

    axios.post(tokenUrl, new URLSearchParams(postData).toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        timeout: 15000
    })
        .then(response => {
            const data = response.data;
            const accessToken = data.access_token;
            const refreshToken = data.refresh_token;
            console.log('[OAuth] Token exchange successful');
            callback(null, accessToken, refreshToken, data);
        })
        .catch(err => {
            console.error('[OAuth] Token exchange error:', err.response?.data || err.message);
            callback({
                statusCode: err.response?.status,
                data: err.response?.data || err.message
            });
        });
};

passport.use(strategy);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
