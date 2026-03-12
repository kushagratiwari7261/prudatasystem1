const db = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const logger = require('../utils/logger');
const Joi = require('joi');

const getAll = async (req, res, next) => {
    try {
        const { rows } = await db.query(`
      SELECT id, name, slug, logo_url
      FROM brands WHERE is_active=true
      ORDER BY name ASC
    `);
        sendSuccess(res, { brands: rows });
    } catch (err) {
        next(err);
    }
};

const getOne = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { rows } = await db.query(`
      SELECT * FROM brands WHERE slug=$1 AND is_active=true
    `, [slug]);

        if (rows.length === 0) {
            return next(new AppError('Brand not found', 404));
        }
        sendSuccess(res, { brand: rows[0] });
    } catch (err) {
        next(err);
    }
};

const create = async (req, res, next) => {
    try {
        const schema = Joi.object({
            name: Joi.string().min(2).max(100).required(),
            slug: Joi.string().lowercase().pattern(/^[a-z0-9-]+$/).required(),
            logo_url: Joi.string().uri().optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        const checkSlug = await db.query('SELECT id FROM brands WHERE slug = $1', [value.slug]);
        if (checkSlug.rows.length > 0) {
            return next(new AppError('Slug already exists', 409));
        }

        const { rows } = await db.query(`
      INSERT INTO brands (name, slug, logo_url)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [value.name, value.slug, value.logo_url]);

        sendSuccess(res, { brand: rows[0] }, 'Brand created', 201);
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
            logo_url: Joi.string().uri().optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        const checkExists = await db.query('SELECT id FROM brands WHERE id=$1', [id]);
        if (checkExists.rows.length === 0) {
            return next(new AppError('Brand not found', 404));
        }

        if (value.slug) {
            const checkSlug = await db.query('SELECT id FROM brands WHERE slug = $1 AND id != $2', [value.slug, id]);
            if (checkSlug.rows.length > 0) {
                return next(new AppError('Slug already exists', 409));
            }
        }

        const keys = Object.keys(value);
        if (keys.length === 0) {
            return sendSuccess(res, { brand: checkExists.rows[0] }, 'Brand updated');
        }

        const setFields = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
        const values = Object.values(value);

        const { rows } = await db.query(`
      UPDATE brands SET ${setFields} WHERE id = $${keys.length + 1} RETURNING *
    `, [...values, id]);

        sendSuccess(res, { brand: rows[0] }, 'Brand updated');
    } catch (err) {
        next(err);
    }
};

const remove = async (req, res, next) => {
    try {
        const { id } = req.params;

        const checkExists = await db.query('SELECT id FROM brands WHERE id=$1', [id]);
        if (checkExists.rows.length === 0) {
            return next(new AppError('Brand not found', 404));
        }

        const productCount = await db.query('SELECT COUNT(*) FROM products WHERE brand_id=$1 AND is_active=true', [id]);
        if (parseInt(productCount.rows[0].count, 10) > 0) {
            return next(new AppError('Cannot delete brand with active products', 400));
        }

        await db.query('UPDATE brands SET is_active=false WHERE id=$1', [id]);
        sendSuccess(res, null, 'Brand deleted');
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
