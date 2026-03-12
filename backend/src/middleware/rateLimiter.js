const rateLimit = require('express-rate-limit');

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Global limiter - very permissive in development
const globalLimiter = rateLimit({
    windowMs: isDevelopment ? 60 * 1000 : 15 * 60 * 1000, // 1 min in dev, 15 min in prod
    max: isDevelopment ? 1000 : 100, // 1000 requests in dev, 100 in prod
    message: {
        success: false,
        message: isDevelopment
            ? 'Rate limited (dev mode)'
            : 'Too many requests, try again in 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health';
    }
});

// Auth limiter - prevents brute force attacks
const authLimiter = rateLimit({
    windowMs: isDevelopment ? 60 * 1000 : 60 * 1000, // 1 minute window
    max: isDevelopment ? 50 : 5, // 50 attempts in dev, 5 in prod
    message: {
        success: false,
        message: isDevelopment
            ? 'Too many auth attempts (dev mode)'
            : 'Too many attempts, try again in 1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isDevelopment // Skip auth limiting in dev if desired
});

// API limiter for specific endpoints if needed
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: isDevelopment ? 200 : 30, // 200 in dev, 30 in prod
    message: {
        success: false,
        message: 'Too many API requests, please slow down'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    globalLimiter,
    authLimiter,
    apiLimiter
};