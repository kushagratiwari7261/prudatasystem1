const db = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const Joi = require('joi');

const getProductInventory = async (req, res, next) => {
    try {
        const { productId } = req.params;
        const { rows } = await db.query(`
      SELECT pv.id, pv.sku, pv.size, pv.color,
             i.quantity, i.reserved,
             (i.quantity - i.reserved) as available,
             i.low_stock_threshold,
             CASE WHEN (i.quantity - i.reserved) <= i.low_stock_threshold THEN true ELSE false END as is_low_stock
      FROM product_variants pv
      LEFT JOIN inventory i ON i.variant_id = pv.id
      WHERE pv.product_id = $1 AND pv.is_active = true
      ORDER BY pv.size, pv.color
    `, [productId]);

        sendSuccess(res, { inventory: rows });
    } catch (err) {
        next(err);
    }
};

const adjustStock = async (req, res, next) => {
    try {
        const { variantId } = req.params;
        const schema = Joi.object({
            quantity: Joi.number().integer().required(),
            reason: Joi.string().required(),
            type: Joi.string().valid('in', 'out', 'adjusted', 'reserved', 'released').required()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        const checkInv = await db.query(`
      SELECT i.*, pv.sku FROM inventory i
      JOIN product_variants pv ON pv.id = i.variant_id
      WHERE i.variant_id = $1
    `, [variantId]);

        if (checkInv.rows.length === 0) return next(new AppError('Variant inventory not found', 404));

        const current = checkInv.rows[0];
        const newQty = current.quantity + value.quantity;

        if (newQty < 0) return next(new AppError('Stock cannot go below zero', 400));

        const updatedInv = await db.query(`
      UPDATE inventory SET quantity=$1, updated_at=NOW() WHERE variant_id=$2 RETURNING *
    `, [newQty, variantId]);

        await db.query(`
      INSERT INTO stock_movements (variant_id, type, quantity, reason, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [variantId, value.type, value.quantity, value.reason]);

        sendSuccess(res, { inventory: updatedInv.rows[0] }, 'Stock adjusted successfully');
    } catch (err) {
        next(err);
    }
};

const getLowStock = async (req, res, next) => {
    try {
        const { rows } = await db.query(`
      SELECT pv.id, pv.sku, pv.size, pv.color,
             p.title as product_title, p.id as product_id,
             i.quantity, i.reserved,
             (i.quantity - i.reserved) as available,
             i.low_stock_threshold
      FROM inventory i
      JOIN product_variants pv ON pv.id = i.variant_id
      JOIN products p ON p.id = pv.product_id
      WHERE (i.quantity - i.reserved) <= i.low_stock_threshold
      AND p.is_active = true AND pv.is_active = true
      ORDER BY available ASC
    `);

        sendSuccess(res, { items: rows, count: rows.length });
    } catch (err) {
        next(err);
    }
};

const createVariantWithInventory = async (req, res, next) => {
    try {
        const { productId } = req.params;
        const schema = Joi.object({
            sku: Joi.string().required(),
            size: Joi.string().optional().allow(null, ''),
            color: Joi.string().optional().allow(null, ''),
            material: Joi.string().optional().allow(null, ''),
            price_adjustment: Joi.number().default(0),
            initial_stock: Joi.number().integer().min(0).required(),
            low_stock_threshold: Joi.number().integer().default(5)
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        const checkProd = await db.query('SELECT id FROM products WHERE id=$1 AND is_active=true', [productId]);
        if (checkProd.rows.length === 0) return next(new AppError('Product not found or inactive', 404));

        const checkSku = await db.query('SELECT id FROM product_variants WHERE sku=$1', [value.sku]);
        if (checkSku.rows.length > 0) return next(new AppError('SKU already exists', 409));

        const pv = await db.query(`
      INSERT INTO product_variants (product_id, sku, size, color, material, price_adjustment, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `, [productId, value.sku, value.size || null, value.color || null, value.material || null, value.price_adjustment]);

        const variantId = pv.rows[0].id;

        const inv = await db.query(`
      INSERT INTO inventory (variant_id, quantity, low_stock_threshold, updated_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `, [variantId, value.initial_stock, value.low_stock_threshold]);

        await db.query(`
      INSERT INTO stock_movements (variant_id, type, quantity, reason, created_at)
      VALUES ($1, 'in', $2, 'Initial stock', NOW())
    `, [variantId, value.initial_stock]);

        sendSuccess(res, { variant: pv.rows[0], inventory: inv.rows[0] }, 'Variant created', 201);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getProductInventory, adjustStock, getLowStock, createVariantWithInventory
};
