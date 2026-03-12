const Joi = require('joi');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');

const validate = async (req, res, next) => {
    try {
        const schema = Joi.object({
            code: Joi.string().required(),
            cart_total: Joi.number().positive().required(),
            items: Joi.array().items(Joi.object({
                product_id: Joi.string().uuid().required()
            }).unknown(true)).optional()
        });
        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        const { rows } = await db.query(
            `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND is_active = true`,
            [value.code]
        );
        if (rows.length === 0) return next(new AppError('Invalid coupon', 400));
        const coupon = rows[0];

        // Check expiry
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            return next(new AppError('Coupon expired', 400));
        }
        // Check max uses
        if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
            return next(new AppError('Coupon usage limit reached', 400));
        }
        // Check min order
        if (coupon.min_order_amount && value.cart_total < parseFloat(coupon.min_order_amount)) {
            return next(new AppError(`Minimum order amount is ₹${coupon.min_order_amount}`, 400));
        }

        // Check first purchase only
        if (coupon.is_first_purchase_only) {
            const hasOrders = await db.query(
                `SELECT id FROM orders WHERE user_id = $1 AND status != 'cancelled' LIMIT 1`,
                [req.user.id]
            );
            if (hasOrders.rows.length > 0) {
                return next(new AppError('This coupon is reserved for first-time purchases only', 400));
            }
        }

        // Check specific product constraint
        if (coupon.applicable_product_id) {
            if (!value.items || value.items.length === 0) {
                return next(new AppError('Cart items required for product-specific coupon validation', 400));
            }
            const hasProduct = value.items.some(i => i.product_id === coupon.applicable_product_id);
            if (!hasProduct) {
                return next(new AppError('This coupon is only valid for specific products not currently in your cart', 400));
            }
        }

        // Calculate discount
        let discount_amount = 0;
        if (coupon.type === 'flat') {
            discount_amount = parseFloat(coupon.value);
        } else if (coupon.type === 'percent') {
            discount_amount = value.cart_total * parseFloat(coupon.value) / 100;
        } else if (coupon.type === 'free_shipping') {
            discount_amount = 0;
        }
        discount_amount = Math.min(discount_amount, value.cart_total);
        discount_amount = Math.round(discount_amount * 100) / 100;

        sendSuccess(res, {
            code: coupon.code,
            type: coupon.type,
            value: parseFloat(coupon.value),
            discount_amount
        }, 'Coupon valid');
    } catch (err) {
        next(err);
    }
};

const getAll = async (req, res, next) => {
    try {
        const { rows } = await db.query(
            `SELECT c.*, c.expires_at < NOW() as is_expired,
                    p.title as product_title, p.images[1] as product_image
             FROM coupons c
             LEFT JOIN products p ON c.applicable_product_id = p.id
             ORDER BY c.created_at DESC`
        );
        sendSuccess(res, rows);
    } catch (err) {
        next(err);
    }
};

const create = async (req, res, next) => {
    try {
        console.log("==== INCOMING COUPON CREATE PAYLOAD ====");
        console.log(req.body);
        const schema = Joi.object({
            code: Joi.string().uppercase().min(3).max(20).required(),
            type: Joi.string().valid('flat', 'percent', 'free_shipping').required(),
            value: Joi.number().positive().required(),
            min_order_amount: Joi.number().min(0).default(0),
            max_uses: Joi.number().integer().optional(),
            max_uses_per_user: Joi.number().integer().default(1),
            expires_at: Joi.date().optional(),
            is_active: Joi.boolean().default(true),
            applicable_product_id: Joi.string().uuid().optional().allow(null, ''),
            is_first_purchase_only: Joi.boolean().default(false)
        });
        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // Check unique code
        const existing = await db.query(
            'SELECT id FROM coupons WHERE UPPER(code) = UPPER($1)',
            [value.code]
        );
        if (existing.rows.length > 0) {
            return next(new AppError('Coupon code already exists', 400));
        }

        if (value.type === 'percent' && value.value > 100) {
            return next(new AppError('Percent discount cannot exceed 100', 400));
        }

        const { rows } = await db.query(
            `INSERT INTO coupons (code, type, value, min_order_amount, max_uses, max_uses_per_user, expires_at, is_active, applicable_product_id, is_first_purchase_only)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
            [value.code, value.type, value.value, value.min_order_amount,
            value.max_uses || null, value.max_uses_per_user,
            value.expires_at || null, value.is_active, 
            value.applicable_product_id || null, value.is_first_purchase_only]
        );

        sendSuccess(res, rows[0], 'Coupon created', 201);
    } catch (err) {
        next(err);
    }
};

const update = async (req, res, next) => {
    try {
        const { id } = req.params;

        const existing = await db.query('SELECT * FROM coupons WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return next(new AppError('Coupon not found', 404));
        }

        // Build dynamic update
        const fields = [];
        const values = [];
        let paramIndex = 1;

        const allowedFields = ['code', 'type', 'value', 'min_order_amount', 'max_uses',
            'max_uses_per_user', 'expires_at', 'is_active', 'applicable_product_id', 'is_first_purchase_only'];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                fields.push(`${field} = $${paramIndex}`);
                values.push(req.body[field]);
                paramIndex++;
            }
        }

        if (fields.length === 0) {
            return next(new AppError('No fields to update', 400));
        }

        values.push(id);
        const { rows } = await db.query(
            `UPDATE coupons SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        );

        sendSuccess(res, rows[0], 'Coupon updated');
    } catch (err) {
        next(err);
    }
};

const remove = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            'UPDATE coupons SET is_active = false WHERE id = $1 RETURNING *',
            [id]
        );
        if (result.rows.length === 0) {
            return next(new AppError('Coupon not found', 404));
        }
        sendSuccess(res, null, 'Coupon deactivated');
    } catch (err) {
        next(err);
    }
};

module.exports = { validate, getAll, create, update, remove };
