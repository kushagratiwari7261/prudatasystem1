const db = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const { paginate, paginationMeta } = require('../utils/pagination');
const logger = require('../utils/logger');
const Joi = require('joi');
const { esClient, esAvailable } = require('../config/elasticsearch');

const getAll = async (req, res, next) => {
    try {
        const {
            category, brand, min_price, max_price, rating, tags, featured, sort, page = 1, limit = 10
        } = req.query;

        let whereClause = 'p.is_active = true';
        const values = [];
        let paramCount = 1;

        if (category) {
            whereClause += ` AND c.slug = $${paramCount++}`;
            values.push(category);
        }
        if (brand) {
            whereClause += ` AND b.slug = $${paramCount++}`;
            values.push(brand);
        }
        if (min_price) {
            whereClause += ` AND (p.discount_price >= $${paramCount} OR (p.discount_price IS NULL AND p.base_price >= $${paramCount}))`;
            values.push(min_price);
            paramCount++;
        }
        if (max_price) {
            whereClause += ` AND (p.discount_price <= $${paramCount} OR (p.discount_price IS NULL AND p.base_price <= $${paramCount}))`;
            values.push(max_price);
            paramCount++;
        }
        if (rating) {
            whereClause += ` AND p.rating_avg >= $${paramCount++}`;
            values.push(rating);
        }
        if (tags) {
            const tagArray = tags.split(',');
            whereClause += ` AND p.tags && $${paramCount++}`;
            values.push(tagArray);
        }
        if (featured) {
            whereClause += ` AND p.is_featured = $${paramCount++}`;
            values.push(featured === 'true');
        }

        let orderBy = 'p.created_at DESC';
        if (sort === 'price_asc') orderBy = 'p.discount_price ASC NULLS LAST, p.base_price ASC';
        else if (sort === 'price_desc') orderBy = 'p.discount_price DESC NULLS LAST, p.base_price DESC';
        else if (sort === 'newest') orderBy = 'p.created_at DESC';
        else if (sort === 'popular') orderBy = 'p.rating_avg DESC, p.rating_count DESC';
        else if (sort === 'discount') orderBy = '(p.base_price - COALESCE(p.discount_price, p.base_price)) DESC';

        const countQuery = `
      SELECT COUNT(*) FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE ${whereClause}
    `;
        const countResult = await db.query(countQuery, values);
        const total = parseInt(countResult.rows[0].count, 10);

        const { limit: lmt, offset } = paginate(page, limit);

        const dataQuery = `
      SELECT p.id, p.title, p.slug, p.base_price,
             p.discount_price, p.images, p.rating_avg,
             p.rating_count, p.is_featured, p.created_at,
             c.name as category_name, c.slug as category_slug,
             b.name as brand_name,
             (SELECT COUNT(*) FROM product_variants pv 
              WHERE pv.product_id = p.id 
              AND pv.is_active = true) as variant_count
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;
        values.push(lmt, offset);
        const { rows } = await db.query(dataQuery, values);

        sendSuccess(res, {
            products: rows,
            pagination: paginationMeta(total, page, lmt)
        });
    } catch (err) {
        next(err);
    }
};

const getBySlug = async (req, res, next) => {
    try {
        const { slug } = req.params;

        const { rows } = await db.query(`
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             b.name as brand_name, b.slug as brand_slug
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN brands b ON b.id = p.brand_id
      WHERE p.slug=$1 AND p.is_active=true
    `, [slug]);

        if (rows.length === 0) {
            return next(new AppError('Product not found', 404));
        }
        const product = rows[0];

        const variantsQuery = await db.query(`
      SELECT pv.*, i.quantity, i.reserved, (i.quantity - i.reserved) as available
      FROM product_variants pv
      LEFT JOIN inventory i ON i.variant_id = pv.id
      WHERE pv.product_id=$1 AND pv.is_active=true
      ORDER BY pv.size, pv.color
    `, [product.id]);
        const variants = variantsQuery.rows;

        // reviews array might not exist, but let's query the table (if it doesn't we will get an error). Assuming reviews table exists.
        // Spec says: SELECT COUNT(*) as total... FROM reviews WHERE product_id=$1 AND status='approved'
        let reviews_summary = { total: 0, avg: 0, five_star: 0, four_star: 0, three_star: 0, two_star: 0, one_star: 0 };
        try {
            const reviewsQuery = await db.query(`
        SELECT COUNT(*) as total, AVG(rating) as avg,
        COUNT(CASE WHEN rating=5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating=4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating=3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating=2 THEN 1 END) as two_star,
        COUNT(CASE WHEN rating=1 THEN 1 END) as one_star
        FROM reviews
        WHERE product_id=$1 AND status='approved'
      `, [product.id]);

            const rs = reviewsQuery.rows[0];
            if (rs) {
                reviews_summary = {
                    total: parseInt(rs.total || 0, 10),
                    avg: rs.avg ? parseFloat(rs.avg) : 0,
                    five_star: parseInt(rs.five_star || 0, 10),
                    four_star: parseInt(rs.four_star || 0, 10),
                    three_star: parseInt(rs.three_star || 0, 10),
                    two_star: parseInt(rs.two_star || 0, 10),
                    one_star: parseInt(rs.one_star || 0, 10)
                };
            }
        } catch (e) {
            // ignore if reviews table does not exist
        }

        sendSuccess(res, { product: { ...product, variants, reviews_summary } });
    } catch (err) {
        next(err);
    }
};

const getRelated = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { rows } = await db.query(`
      SELECT p.id, p.title, p.slug, p.base_price,
             p.discount_price, p.images, p.rating_avg
      FROM products p
      WHERE p.category_id = (SELECT category_id FROM products WHERE id=$1)
      AND p.id != $1 AND p.is_active = true
      ORDER BY p.rating_avg DESC
      LIMIT 8
    `, [id]);

        sendSuccess(res, { products: rows });
    } catch (err) {
        next(err);
    }
};

const create = async (req, res, next) => {
    try {
        const schema = Joi.object({
            title: Joi.string().min(3).max(255).required(),
            slug: Joi.string().lowercase().pattern(/^[a-z0-9-]+$/).message('Slug can only contain lowercase letters, numbers, and hyphens').required(),
            description: Joi.string().optional(),
            category_id: Joi.string().uuid().required(),
            brand_id: Joi.string().uuid().optional(),
            base_price: Joi.number().positive().required(),
            discount_price: Joi.number().positive().optional(),
            images: Joi.array().items(Joi.string()).optional().default([]),
            tags: Joi.array().items(Joi.string()).optional().default([]),
            is_featured: Joi.boolean().optional().default(false)
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        const checkSlug = await db.query('SELECT id FROM products WHERE slug=$1', [value.slug]);
        if (checkSlug.rows.length > 0) return next(new AppError('Slug already exists', 409));

        const checkCat = await db.query('SELECT id, name FROM categories WHERE id=$1 AND is_active=true', [value.category_id]);
        if (checkCat.rows.length === 0) return next(new AppError('Category not found or inactive', 400));
        const category_name = checkCat.rows[0].name;

        let brand_name = null;
        if (value.brand_id) {
            const checkBrand = await db.query('SELECT id, name FROM brands WHERE id=$1 AND is_active=true', [value.brand_id]);
            if (checkBrand.rows.length === 0) return next(new AppError('Brand not found or inactive', 400));
            brand_name = checkBrand.rows[0].name;
        }

        // FIX: Convert to PostgreSQL array format for create
        const imagesArray = value.images && value.images.length > 0
            ? '{' + value.images.map(img => `"${img}"`).join(',') + '}'
            : '{}';

        const tagsArray = value.tags && value.tags.length > 0
            ? '{' + value.tags.map(tag => `"${tag}"`).join(',') + '}'
            : '{}';

        const { rows } = await db.query(`
      INSERT INTO products (title, slug, description, category_id, brand_id, base_price, discount_price, images, tags, is_featured, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `, [value.title, value.slug, value.description, value.category_id, value.brand_id, value.base_price, value.discount_price, imagesArray, tagsArray, value.is_featured]);

        const product = rows[0];

        try {
            if (esAvailable) {
                await esClient.index({
                    index: 'products',
                    id: product.id,
                    document: {
                        id: product.id,
                        title: product.title,
                        slug: product.slug,
                        description: product.description,
                        category: category_name,
                        brand: brand_name,
                        base_price: product.base_price,
                        discount_price: product.discount_price,
                        tags: product.tags,
                        rating_avg: 0,
                        is_active: true
                    }
                });
            }
        } catch (esError) {
            logger.error('Elasticsearch exact indexing failed: ' + esError.message);
        }

        sendSuccess(res, { product }, 'Product created', 201);
    } catch (err) {
        next(err);
    }
};

const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const schema = Joi.object({
            title: Joi.string().min(3).max(255).optional(),
            slug: Joi.string().lowercase().pattern(/^[a-z0-9-]+$/).message('Slug can only contain lowercase letters, numbers, and hyphens').optional(),
            description: Joi.string().optional(),
            category_id: Joi.string().uuid().optional(),
            brand_id: Joi.string().uuid().optional(),
            base_price: Joi.number().positive().optional(),
            discount_price: Joi.number().positive().optional(),
            images: Joi.array().items(Joi.string()).optional(),
            tags: Joi.array().items(Joi.string()).optional(),
            is_featured: Joi.boolean().optional()
        });

        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        const checkExists = await db.query('SELECT id, category_id, brand_id FROM products WHERE id=$1', [id]);
        if (checkExists.rows.length === 0) return next(new AppError('Product not found', 404));

        if (value.slug) {
            const checkSlug = await db.query('SELECT id FROM products WHERE slug=$1 AND id!=$2', [value.slug, id]);
            if (checkSlug.rows.length > 0) return next(new AppError('Slug already exists', 409));
        }

        // FIX: Convert array to PostgreSQL array format properly
        if (value.images && Array.isArray(value.images)) {
            // Convert to PostgreSQL array literal format: {url1,url2,url3}
            value.images = '{' + value.images.map(img => `"${img}"`).join(',') + '}';
        }

        // FIX: Handle tags array similarly
        if (value.tags && Array.isArray(value.tags)) {
            value.tags = '{' + value.tags.map(tag => `"${tag}"`).join(',') + '}';
        }

        const keys = Object.keys(value);
        if (keys.length === 0) {
            const existingProduct = await db.query('SELECT * FROM products WHERE id=$1', [id]);
            return sendSuccess(res, { product: existingProduct.rows[0] }, 'Product updated');
        }

        const setFields = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const values = Object.values(value);

        const { rows } = await db.query(`
      UPDATE products SET ${setFields}, updated_at=NOW() WHERE id=$${keys.length + 1} RETURNING *
    `, [...values, id]);

        const product = rows[0];

        try {
            if (esAvailable) {
                let category_name = null;
                let brand_name = null;
                const catRes = await db.query('SELECT name FROM categories WHERE id=$1', [product.category_id]);
                if (catRes.rows.length) category_name = catRes.rows[0].name;

                if (product.brand_id) {
                    const brandRes = await db.query('SELECT name FROM brands WHERE id=$1', [product.brand_id]);
                    if (brandRes.rows.length) brand_name = brandRes.rows[0].name;
                }

                await esClient.index({
                    index: 'products',
                    id: product.id,
                    document: {
                        id: product.id,
                        title: product.title,
                        slug: product.slug,
                        description: product.description,
                        category: category_name,
                        brand: brand_name,
                        base_price: product.base_price,
                        discount_price: product.discount_price,
                        tags: product.tags,
                        rating_avg: product.rating_avg,
                        is_active: product.is_active
                    }
                });
            }
        } catch (esError) {
            logger.error('Elasticsearch check exact update failed: ' + esError.message);
        }

        sendSuccess(res, { product }, 'Product updated');
    } catch (err) {
        next(err);
    }
};

const remove = async (req, res, next) => {
    try {
        const { id } = req.params;
        const checkExists = await db.query('SELECT id FROM products WHERE id=$1', [id]);
        if (checkExists.rows.length === 0) return next(new AppError('Product not found', 404));

        await db.query('UPDATE products SET is_active=false, updated_at=NOW() WHERE id=$1', [id]);

        try {
            if (esAvailable) {
                await esClient.delete({ index: 'products', id });
            }
        } catch (esError) {
            logger.error('Elasticsearch exact delete failed: ' + esError.message);
        }

        sendSuccess(res, null, 'Product deleted');
    } catch (err) {
        next(err);
    }
};

const uploadImages = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return next(new AppError('No images provided', 400));
        }

        const uploads = req.files.map(file => ({
            url: `/uploads/products/${file.filename}`,
            filename: file.filename,
            originalName: file.originalname,
            size: file.size
        }));

        sendSuccess(res, { images: uploads }, 'Images uploaded successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAll, getBySlug, getRelated, create, update, remove, uploadImages
};