const Joi = require('joi');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');

const addressSchema = Joi.object({
    label: Joi.string().valid('Home', 'Work', 'Other').default('Home'),
    full_name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(/^[6-9]\d{9}$/).required().messages({
        'string.pattern.base': 'Phone must be a valid 10-digit Indian mobile number starting with 6-9'
    }),
    line1: Joi.string().min(5).max(255).required(),
    line2: Joi.string().allow('', null).optional(),
    landmark: Joi.string().allow('', null).optional(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    pincode: Joi.string().pattern(/^\d{6}$/).required().messages({
        'string.pattern.base': 'Pincode must be a 6-digit number'
    }),
    country: Joi.string().default('India'),
    is_default: Joi.boolean().default(false)
});

const getAll = async (req, res, next) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM addresses WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
            [req.user.id]
        );
        sendSuccess(res, { addresses: rows });
    } catch (err) {
        next(err);
    }
};

const create = async (req, res, next) => {
    try {
        const { error, value } = addressSchema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // Check max addresses limit (5)
        const countResult = await db.query(
            'SELECT COUNT(*) as count FROM addresses WHERE user_id = $1',
            [req.user.id]
        );
        if (parseInt(countResult.rows[0].count) >= 5) {
            return next(new AppError('Maximum 5 addresses allowed', 400));
        }

        // If this is the first address or set as default, unset others
        const isFirst = parseInt(countResult.rows[0].count) === 0;
        if (value.is_default || isFirst) {
            await db.query(
                'UPDATE addresses SET is_default = false WHERE user_id = $1',
                [req.user.id]
            );
            value.is_default = true;
        }

        const { rows } = await db.query(
            `INSERT INTO addresses 
             (user_id, label, full_name, phone, line1, line2, landmark, city, state, pincode, country, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [
                req.user.id,
                value.label,
                value.full_name,
                value.phone,
                value.line1,
                value.line2 || '',
                value.landmark || '',
                value.city,
                value.state,
                value.pincode,
                value.country,
                value.is_default
            ]
        );

        sendSuccess(res, { address: rows[0] }, 'Address created successfully', 201);
    } catch (err) {
        next(err);
    }
};

const update = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const existing = await db.query(
            'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        if (existing.rows.length === 0) {
            return next(new AppError('Address not found', 404));
        }

        const { error, value } = addressSchema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // If setting as default, unset others first
        if (value.is_default) {
            await db.query(
                'UPDATE addresses SET is_default = false WHERE user_id = $1',
                [req.user.id]
            );
        }

        const { rows } = await db.query(
            `UPDATE addresses SET 
             label = $1, 
             full_name = $2, 
             phone = $3, 
             line1 = $4, 
             line2 = $5,
             landmark = $6,
             city = $7, 
             state = $8, 
             pincode = $9, 
             country = $10, 
             is_default = $11,
             updated_at = NOW()
             WHERE id = $12 AND user_id = $13 
             RETURNING *`,
            [
                value.label,
                value.full_name,
                value.phone,
                value.line1,
                value.line2 || '',
                value.landmark || '',
                value.city,
                value.state,
                value.pincode,
                value.country,
                value.is_default,
                id,
                req.user.id
            ]
        );

        sendSuccess(res, { address: rows[0] }, 'Address updated successfully');
    } catch (err) {
        next(err);
    }
};

const remove = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const existing = await db.query(
            'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        if (existing.rows.length === 0) {
            return next(new AppError('Address not found', 404));
        }

        const wasDefault = existing.rows[0].is_default;

        // Delete the address
        await db.query('DELETE FROM addresses WHERE id = $1', [id]);

        // If deleted address was default, set the newest remaining as default
        if (wasDefault) {
            await db.query(
                `UPDATE addresses SET is_default = true 
                 WHERE id = (
                     SELECT id FROM addresses 
                     WHERE user_id = $1 
                     ORDER BY created_at DESC 
                     LIMIT 1
                 )`,
                [req.user.id]
            );
        }

        sendSuccess(res, null, 'Address deleted successfully');
    } catch (err) {
        next(err);
    }
};

const setDefault = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const existing = await db.query(
            'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        if (existing.rows.length === 0) {
            return next(new AppError('Address not found', 404));
        }

        // Unset all other defaults
        await db.query(
            'UPDATE addresses SET is_default = false WHERE user_id = $1',
            [req.user.id]
        );

        // Set this address as default
        await db.query(
            'UPDATE addresses SET is_default = true WHERE id = $1',
            [id]
        );

        sendSuccess(res, null, 'Default address updated successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAll,
    create,
    update,
    remove,
    setDefault
};