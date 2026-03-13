const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

exports.toggleWishlist = async (req, res) => {
    try {
        const { product_id } = req.body;
        const user_id = req.user.id;

        if (!product_id) {
            return sendError(res, 'Product ID is required.', 400);
        }

        // Check if already in wishlist
        const checkQuery = 'SELECT id FROM wishlists WHERE user_id = $1 AND product_id = $2';
        const checkResult = await db.query(checkQuery, [user_id, product_id]);

        if (checkResult.rows.length > 0) {
            // Remove from wishlist
            await db.query('DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2', [user_id, product_id]);
            return sendSuccess(res, { action: 'removed' }, 'Product removed from wishlist');
        } else {
            // Add to wishlist
            await db.query('INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2)', [user_id, product_id]);
            return sendSuccess(res, { action: 'added' }, 'Product added to wishlist', 201);
        }
    } catch (error) {
        console.error('Error toggling wishlist:', error);
        return sendError(res, 'Server error toggling wishlist', 500);
    }
};

exports.getWishlist = async (req, res) => {
    try {
        const user_id = req.user.id;

        const query = `
            SELECT w.id as wishlist_id, p.*, b.name as brand_name, c.name as category_name
            FROM wishlists w
            JOIN products p ON w.product_id = p.id
            LEFT JOIN brands b ON p.brand_id = b.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE w.user_id = $1
            ORDER BY w.created_at DESC
        `;
        const result = await db.query(query, [user_id]);

        // For each product, get its first variant for price/stock info
        const productsWithVariants = await Promise.all(result.rows.map(async (product) => {
            const variantQuery = `
                SELECT pv.*, i.quantity as stock
                FROM product_variants pv
                LEFT JOIN inventory i ON pv.id = i.variant_id
                WHERE pv.product_id = $1 AND pv.is_active = true
                LIMIT 1
            `;
            const variantResult = await db.query(variantQuery, [product.id]);
            return {
                ...product,
                variants: variantResult.rows
            };
        }));

        return sendSuccess(res, productsWithVariants, 'Wishlist fetched successfully');
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        return sendError(res, 'Failed to fetch wishlist', 500);
    }
};
