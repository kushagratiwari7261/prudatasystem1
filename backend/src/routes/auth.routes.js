const router = require('express').Router();
const { authLimiter } = require('../middleware/rateLimiter');
const { protect } = require('../middleware/auth');
const {
    register,
    login,
    verifyEmail,
    refreshToken,
    forgotPassword,
    resetPassword,
    logout,
    updateProfile,
    getAllUsers
} = require('../controllers/auth.controller');
const passport = require('passport');
require('../config/passport');

// Existing routes
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.get('/verify-email/:token', verifyEmail);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', protect, logout);
router.put('/profile', protect, updateProfile);

// Admin route
const { restrictTo } = require('../middleware/auth');
router.get('/users', protect, restrictTo('admin'), getAllUsers);

// Google OAuth — Initiate
// state param carries redirect destination
router.get('/google',
    (req, res, next) => {
        const state = req.query.state || '/shop';
        passport.authenticate('google', {
            scope: ['profile', 'email'],
            session: false,
            state
        })(req, res, next);
    }
);

// Google OAuth — Callback
router.get('/google/callback',
    passport.authenticate('google', {
        session: false,
        failureRedirect:
            `${process.env.FRONTEND_URL}/login?error=google_failed`
    }),
    (req, res) => {
        const { accessToken, refreshToken, user } = req.user;
        const redirectTo = req.query.state || '/shop';

        const params = new URLSearchParams({
            accessToken,
            refreshToken,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar_url || '',
            redirect: redirectTo
        });

        // ✅ FIX: Use localhost for browser redirects in development
        const frontendUrl = process.env.NODE_ENV === 'production'
            ? process.env.FRONTEND_URL
            : 'http://localhost:3005'; // Force localhost for development

        console.log(`🔄 Redirecting to: ${frontendUrl}/auth/callback?${params}`);

        res.redirect(`${frontendUrl}/auth/callback?${params}`);
    }
);

module.exports = router;