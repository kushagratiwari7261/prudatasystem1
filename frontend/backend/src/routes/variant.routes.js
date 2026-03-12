const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../config/db');
const { protect, restrictTo } = require('../middleware/auth');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');

router.use(protect);
router.use(restrictTo('admin'));

// GET /api/v1/variants/product/:productId — List variants for product
router.get('/product/:productId', async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { rows } = await db.query(`
            SELECT pv.*, 
                   i.quantity, i.reserved, 
                   (i.quantity - COALESCE(i.reserved, 0)) as available,
                   i.low_stock_threshold
            FROM product_variants pv
            LEFT JOIN inventory i ON i.variant_id = pv.id
            WHERE pv.product_id = $1
            ORDER BY pv.size, pv.color
        `, [productId]);
        sendSuccess(res, { variants: rows });
    } catch (err) {
        next(err);
    }
});

// POST /api/v1/variants — Create variant + inventory
router.post('/', async (req, res, next) => {
    try {
        const schema = Joi.object({
            product_id: Joi.string().uuid().required(),
            sku: Joi.string().required(),
            size: Joi.string().optional().allow(''),
            color: Joi.string().optional().allow(''),
            color_hex: Joi.string().optional().allow(''),
            price_adjustment: Joi.number().default(0),
            quantity: Joi.number().integer().min(0).default(0),
            low_stock_threshold: Joi.number().integer().min(0).default(10)
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // Check product exists
        const productCheck = await db.query('SELECT id FROM products WHERE id = $1', [value.product_id]);
        if (productCheck.rows.length === 0) return next(new AppError('Product not found', 404));

        // Check SKU unique
        const skuCheck = await db.query('SELECT id FROM product_variants WHERE sku = $1', [value.sku]);
        if (skuCheck.rows.length > 0) return next(new AppError('SKU already exists', 409));

        // Insert variant
        const variantResult = await db.query(`
            INSERT INTO product_variants (product_id, sku, size, color, color_hex, price_adjustment)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [value.product_id, value.sku, value.size || null, value.color || null, value.color_hex || null, value.price_adjustment]);

        const variant = variantResult.rows[0];

        // Create inventory entry
        await db.query(`
            INSERT INTO inventory (variant_id, quantity, reserved, low_stock_threshold)
            VALUES ($1, $2, 0, $3)
        `, [variant.id, value.quantity, value.low_stock_threshold]);

        sendSuccess(res, { variant }, 'Variant created', 201);
    } catch (err) {
        next(err);
    }
});

// PUT /api/v1/variants/:id — Update variant + inventory
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const schema = Joi.object({
            size: Joi.string().optional().allow(''),
            color: Joi.string().optional().allow(''),
            color_hex: Joi.string().optional().allow(''),
            price_adjustment: Joi.number().optional(),
            is_active: Joi.boolean().optional(),
            quantity: Joi.number().integer().min(0).optional(),
            low_stock_threshold: Joi.number().integer().min(0).optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // Check variant exists
        const check = await db.query('SELECT id FROM product_variants WHERE id = $1', [id]);
        if (check.rows.length === 0) return next(new AppError('Variant not found', 404));

        // Update variant fields
        const variantFields = {};
        if (value.size !== undefined) variantFields.size = value.size;
        if (value.color !== undefined) variantFields.color = value.color;
        if (value.color_hex !== undefined) variantFields.color_hex = value.color_hex;
        if (value.price_adjustment !== undefined) variantFields.price_adjustment = value.price_adjustment;
        if (value.is_active !== undefined) variantFields.is_active = value.is_active;

        if (Object.keys(variantFields).length > 0) {
            const keys = Object.keys(variantFields);
            const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
            const values = Object.values(variantFields);
            await db.query(
                `UPDATE product_variants SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
                [...values, id]
            );
        }

        // Update inventory
        if (value.quantity !== undefined || value.low_stock_threshold !== undefined) {
            const invCheck = await db.query('SELECT id FROM inventory WHERE variant_id = $1', [id]);
            if (invCheck.rows.length > 0) {
                const invUpdates = [];
                const invValues = [];
                let idx = 1;
                if (value.quantity !== undefined) {
                    invUpdates.push(`quantity = $${idx++}`);
                    invValues.push(value.quantity);
                }
                if (value.low_stock_threshold !== undefined) {
                    invUpdates.push(`low_stock_threshold = $${idx++}`);
                    invValues.push(value.low_stock_threshold);
                }
                invValues.push(id);
                await db.query(
                    `UPDATE inventory SET ${invUpdates.join(', ')}, updated_at = NOW() WHERE variant_id = $${idx}`,
                    invValues
                );
            } else {
                await db.query(
                    `INSERT INTO inventory (variant_id, quantity, reserved, low_stock_threshold) VALUES ($1, $2, 0, $3)`,
                    [id, value.quantity || 0, value.low_stock_threshold || 10]
                );
            }
        }

        const updated = await db.query(`
            SELECT pv.*, i.quantity, i.reserved, 
                   (i.quantity - COALESCE(i.reserved, 0)) as available
            FROM product_variants pv
            LEFT JOIN inventory i ON i.variant_id = pv.id
            WHERE pv.id = $1
        `, [id]);

        sendSuccess(res, { variant: updated.rows[0] }, 'Variant updated');
    } catch (err) {
        next(err);
    }
});

// DELETE /api/v1/variants/:id
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const check = await db.query('SELECT id FROM product_variants WHERE id = $1', [id]);
        if (check.rows.length === 0) return next(new AppError('Variant not found', 404));

        await db.query('DELETE FROM inventory WHERE variant_id = $1', [id]);
        await db.query('DELETE FROM product_variants WHERE id = $1', [id]);

        sendSuccess(res, null, 'Variant deleted');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
