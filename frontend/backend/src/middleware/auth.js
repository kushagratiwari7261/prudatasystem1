const jwt = require('jsonwebtoken');
const db = require('../config/db');
const AppError = require('../utils/AppError');

const protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return next(new AppError('Not authenticated', 401));
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from db
        const { rows } = await db.query(
            'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
            [decoded.id]
        );

        if (rows.length === 0) {
            return next(new AppError('User no longer exists', 401));
        }

        const user = rows[0];

        if (!user.is_active) {
            return next(new AppError('Account is deactivated', 401));
        }

        req.user = user;
        next();
    } catch (error) {
        // Let errorHandler specifically catch JsonWebTokenError / TokenExpiredError
        next(error);
    }
};

// NEW: Optional authentication - doesn't throw error if no token
const optionalAuth = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            // No token, continue as guest
            return next();
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from db
        const { rows } = await db.query(
            'SELECT id, name, email, role, is_active FROM users WHERE id = $1',
            [decoded.id]
        );

        if (rows.length > 0 && rows[0].is_active) {
            req.user = rows[0];
        }

        // Continue even if user not found or inactive
        next();
    } catch (error) {
        // Token invalid or expired - still continue as guest
        next();
    }
};

const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError('Not authenticated', 401));
        }
        if (!roles.includes(req.user.role)) {
            return next(new AppError('You do not have permission', 403));
        }
        next();
    };
};

module.exports = { protect, optionalAuth, restrictTo };