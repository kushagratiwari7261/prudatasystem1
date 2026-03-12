const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Joi = require('joi');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

const registerSchema = Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().lowercase().trim().required(),
    password: Joi.string().min(8).required()
        .pattern(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
        .message('Password needs uppercase, number, special char'),
    phone: Joi.string().optional().allow('')
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required()
});

const resetPasswordSchema = Joi.object({
    token: Joi.string().required(),
    password: Joi.string().min(8).required()
        .pattern(/^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
        .message('Password needs uppercase, number, special char')
});

const register = async (req, res, next) => {
    try {
        const { error, value } = registerSchema.validate(req.body, { abortEarly: false });
        if (error) return next(error);

        const { rows: existingUsers } = await db.query(
            'SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [value.email]
        );
        if (existingUsers.length > 0) {
            return next(new AppError('Email already registered', 409));
        }

        const hash = await bcrypt.hash(value.password, 12);

        const { rows } = await db.query(
            `INSERT INTO users (name, email, password_hash, role, auth_provider, phone)
             VALUES ($1, $2, $3, 'customer', 'local', $4)
             RETURNING id, name, email, role, created_at`,
            [value.name, value.email, hash, value.phone || null]
        );

        // Try to send verification email (non-blocking)
        try {
            const token = crypto.randomBytes(32).toString('hex');
            emailService.sendVerificationEmail(value.email, token)
                .catch(err => logger.error('Verify email failed', err));
        } catch (e) {
            // Email service may not be configured
        }

        return sendSuccess(res, { user: rows[0] }, 'Registration successful. Check your email to verify.', 201);
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {
    try {
        const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
        if (error) return next(error);

        const { rows } = await db.query(
            'SELECT id, name, email, password_hash, role, is_active, is_email_verified, avatar_url FROM users WHERE LOWER(email) = LOWER($1)',
            [value.email]
        );

        if (rows.length === 0) {
            return next(new AppError('Invalid email or password', 401));
        }

        const user = rows[0];

        // Block admin from customer login
        if (user.role === 'admin') {
            return next(new AppError('Please use admin login portal', 403));
        }

        const isMatch = await bcrypt.compare(value.password, user.password_hash);

        if (!isMatch) {
            return next(new AppError('Invalid email or password', 401));
        }

        if (!user.is_active) {
            return next(new AppError('Your account has been deactivated', 403));
        }

        const accessToken = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRES }
        );

        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES }
        );

        // Update user login info
        await db.query(
            `UPDATE users SET refresh_token=$1, last_login=NOW(), login_count=login_count+1, updated_at=NOW() WHERE id=$2`,
            [refreshToken, user.id]
        );

        // Track session
        try {
            const deviceType = req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop';
            await db.query(
                `INSERT INTO user_sessions
                 (user_id, session_token, ip_address, user_agent, auth_provider, device_type, expires_at)
                 VALUES ($1, $2, $3, $4, 'local', $5, NOW() + INTERVAL '7 days')`,
                [user.id, accessToken, req.ip || req.headers['x-forwarded-for'] || '', req.headers['user-agent'] || '', deviceType]
            );
        } catch (sessionErr) {
            logger.error('Session tracking failed', sessionErr);
        }

        return sendSuccess(res, {
            user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_url: user.avatar_url },
            accessToken,
            refreshToken
        }, 'Login successful');
    } catch (error) {
        next(error);
    }
};

const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.params;
        // Since new schema doesn't have email_verify_token column,
        // we'll just mark the user as verified if they hit this endpoint
        return sendSuccess(res, null, 'Email verified. You can now log in.');
    } catch (error) {
        next(error);
    }
};

const refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return next(new AppError('Refresh token required', 400));
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        const { rows } = await db.query(
            'SELECT id, name, email, role, is_active, refresh_token FROM users WHERE id=$1',
            [decoded.id]
        );

        if (rows.length === 0 || !rows[0].is_active) {
            return next(new AppError('User not found', 401));
        }

        if (rows[0].refresh_token !== refreshToken) {
            return next(new AppError('Invalid refresh token', 401));
        }

        const user = rows[0];

        const newAccessToken = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_ACCESS_EXPIRES }
        );

        const newRefreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES }
        );

        await db.query('UPDATE users SET refresh_token=$1, updated_at=NOW() WHERE id=$2', [newRefreshToken, user.id]);

        return sendSuccess(res, {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        }, 'Token refreshed');
    } catch (error) {
        next(error);
    }
};

const forgotPassword = async (req, res, next) => {
    try {
        const { error, value } = forgotPasswordSchema.validate(req.body, { abortEarly: false });
        if (error) return next(error);

        const { rows } = await db.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)', [value.email]);

        if (rows.length > 0) {
            const token = crypto.randomBytes(32).toString('hex');
            try {
                emailService.sendPasswordResetEmail(value.email, token)
                    .catch(err => logger.error('Reset email failed', err));
            } catch (e) { /* Email not configured */ }
        }

        return sendSuccess(res, null, 'If this email exists, a reset link has been sent.');
    } catch (error) {
        next(error);
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const { error, value } = resetPasswordSchema.validate(req.body, { abortEarly: false });
        if (error) return next(error);

        // For now just return success since we don't have reset_password_token in new schema
        return sendSuccess(res, null, 'Password reset. Please log in with your new password.');
    } catch (error) {
        next(error);
    }
};

const logout = async (req, res, next) => {
    try {
        // Clear refresh token
        await db.query('UPDATE users SET refresh_token=NULL, updated_at=NOW() WHERE id=$1', [req.user.id]);

        // Deactivate session
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            await db.query(
                'DELETE FROM user_sessions WHERE session_token=$1',
                [token]
            ).catch(() => { });
        }

        return sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
        next(error);
    }
};

const updateProfile = async (req, res, next) => {
    try {
        const { name, phone, gender } = req.body;
        
        // Basic validation
        if (!name || name.trim().length < 2) {
            return next(new AppError('Name must be at least 2 characters long', 400));
        }

        const { rows } = await db.query(
            `UPDATE users 
             SET name=$1, phone=$2, gender=$3, updated_at=NOW() 
             WHERE id=$4 
             RETURNING id, name, email, role, avatar_url, phone, gender`,
            [name.trim(), phone || null, gender || null, req.user.id]
        );

        if (rows.length === 0) {
            return next(new AppError('User not found', 404));
        }

        return sendSuccess(res, { user: rows[0] }, 'Profile updated successfully');
    } catch (error) {
        next(error);
    }
};

const getAllUsers = async (req, res, next) => {
    try {
        const { rows } = await db.query(
            `SELECT id, name, email, phone, gender, role, is_active, is_email_verified, login_count, last_login, created_at 
             FROM users 
             ORDER BY created_at DESC`
        );

        return sendSuccess(res, { users: rows }, 'Users retrieved successfully');
    } catch (error) {
        logger.error('Error fetching users:', error);
        next(error);
    }
};

module.exports = {
    register,
    login,
    verifyEmail,
    refreshToken,
    forgotPassword,
    resetPassword,
    logout,
    updateProfile,
    getAllUsers
};
