const db = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const logger = require('../utils/logger');
const Joi = require('joi');

const getAll = async (req, res, next) => {
    try {
        const { rows } = await db.query(`
      SELECT id, name, slug, parent_id, image_url, sort_order, is_active
      FROM categories
      WHERE is_active = true
      ORDER BY sort_order ASC, name ASC
    `);

        // Build tree structure
        const categoryMap = {};
        rows.forEach(cat => {
            categoryMap[cat.id] = { ...cat, children: [] };
        });

        const tree = [];
        rows.forEach(cat => {
            if (cat.parent_id) {
                if (categoryMap[cat.parent_id]) {
                    categoryMap[cat.parent_id].children.push(categoryMap[cat.id]);
                }
            } else {
                tree.push(categoryMap[cat.id]);
            }
        });

        sendSuccess(res, { categories: tree });
    } catch (err) {
        next(err);
    }
};

const getOne = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { rows } = await db.query(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = true
      WHERE c.slug = $1 AND c.is_active = true
      GROUP BY c.id
    `, [slug]);

        if (rows.length === 0) {
            return next(new AppError('Category not found', 404));
        }

        sendSuccess(res, { category: rows[0] });
    } catch (err) {
        next(err);
    }
};

const create = async (req, res, next) => {
    try {
        const schema = Joi.object({
            name: Joi.string().min(2).max(100).required(),
            slug: Joi.string().lowercase().pattern(/^[a-z0-9-]+$/).required(),
            parent_id: Joi.string().uuid().optional(),
            image_url: Joi.string().uri().optional(),
            sort_order: Joi.number().integer().optional().default(0)
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // Check slug unique
        const checkSlug = await db.query('SELECT id FROM categories WHERE slug = $1', [value.slug]);
        if (checkSlug.rows.length > 0) {
            return next(new AppError('Slug already exists', 409));
        }

        const { rows } = await db.query(`
      INSERT INTO categories (name, slug, parent_id, image_url, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [value.name, value.slug, value.parent_id, value.image_url, value.sort_order]);

        sendSuccess(res, { category: rows[0] }, 'Category created', 201);
    } catch (err) {
        next(err);
    }
};

const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const schema = Joi.object({
            name: Joi.string().min(2).max(100).optional(),
            slug: Joi.string().lowercase().pattern(/^[a-z0-9-]+$/).optional(),
            parent_id: Joi.string().uuid().optional(),
            image_url: Joi.string().uri().optional(),
            sort_order: Joi.number().integer().optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        const checkExists = await db.query('SELECT id FROM categories WHERE id=$1', [id]);
        if (checkExists.rows.length === 0) {
            return next(new AppError('Category not found', 404));
        }

        if (value.slug) {
            const checkSlug = await db.query('SELECT id FROM categories WHERE slug = $1 AND id != $2', [value.slug, id]);
            if (checkSlug.rows.length > 0) {
                return next(new AppError('Slug already exists', 409));
            }
        }

        const keys = Object.keys(value);
        if (keys.length === 0) {
            return sendSuccess(res, { category: checkExists.rows[0] }, 'Category updated');
        }

        const setFields = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = Object.values(value);

        const { rows } = await db.query(`
      UPDATE categories SET ${setFields} WHERE id = $${keys.length + 1} RETURNING *
    `, [...values, id]);

        sendSuccess(res, { category: rows[0] }, 'Category updated');
    } catch (err) {
        next(err);
    }
};

const remove = async (req, res, next) => {
    try {
        const { id } = req.params;

        const checkExists = await db.query('SELECT id FROM categories WHERE id=$1', [id]);
        if (checkExists.rows.length === 0) {
            return next(new AppError('Category not found', 404));
        }

        const productCount = await db.query('SELECT COUNT(*) FROM products WHERE category_id=$1 AND is_active=true', [id]);
        if (parseInt(productCount.rows[0].count, 10) > 0) {
            return next(new AppError('Cannot delete category with active products', 400));
        }

        await db.query('UPDATE categories SET is_active=false WHERE id=$1', [id]);
        sendSuccess(res, null, 'Category deleted');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAll,
    getOne,
    create,
    update,
    remove
};
