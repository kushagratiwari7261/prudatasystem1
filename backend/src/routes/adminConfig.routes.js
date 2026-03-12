const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const db = require('../config/db');
const { protect, restrictTo } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');

const adminLoginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

// POST /api/v1/adminConfig/login
router.post('/login', async (req, res, next) => {
    try {
        const { error, value } = adminLoginSchema.validate(req.body, { abortEarly: false });
        if (error) return next(error);

        // Only find admin users
        const { rows } = await db.query(
            `SELECT id, name, email, password_hash, role, is_active, avatar_url
             FROM users
             WHERE LOWER(email) = LOWER($1) AND role = 'admin' AND is_active = true`,
            [value.email]
        );

        if (rows.length === 0) {
            return next(new AppError('Invalid credentials', 401));
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(value.password, user.password_hash);

        if (!isMatch) {
            return next(new AppError('Invalid credentials', 401));
        }

        // Generate tokens
        const accessToken = jwt.sign(
            { id: user.id, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        // Update user
        await db.query(
            `UPDATE users SET refresh_token=$1, last_login=NOW(), login_count=login_count+1 WHERE id=$2`,
            [refreshToken, user.id]
        );

        // Track session
        try {
            await db.query(
                `INSERT INTO user_sessions
                 (user_id, session_token, ip_address, user_agent, device_type, auth_provider, expires_at)
                 VALUES ($1, $2, $3, $4, 'admin', 'local', NOW() + INTERVAL '1 day')`,
                [user.id, accessToken, req.ip || req.headers['x-forwarded-for'] || '', req.headers['user-agent'] || '']
            );
        } catch (e) {
            console.error('Admin session tracking failed:', e.message);
        }

        return sendSuccess(res, {
            accessToken,
            refreshToken,
            admin: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar_url: user.avatar_url
            }
        }, 'Admin login successful');
    } catch (error) {
        next(error);
    }
});

// POST /api/v1/adminConfig/logout
router.post('/logout', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        // Delete session
        if (token) {
            await db.query('DELETE FROM user_sessions WHERE session_token = $1', [token]).catch(() => { });
        }

        // Clear refresh token
        await db.query('UPDATE users SET refresh_token = NULL WHERE id = $1', [req.user.id]);

        return sendSuccess(res, null, 'Logged out successfully');
    } catch (error) {
        next(error);
    }
});

// GET /api/v1/adminConfig/me
router.get('/me', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const { rows } = await db.query(
            'SELECT id, name, email, role, avatar_url, last_login, login_count, created_at FROM users WHERE id = $1',
            [req.user.id]
        );

        if (rows.length === 0) {
            return next(new AppError('Admin not found', 404));
        }

        return sendSuccess(res, { admin: rows[0] });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
