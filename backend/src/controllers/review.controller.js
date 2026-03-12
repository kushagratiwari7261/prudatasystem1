const db = require('../config/db');

exports.addReview = async (req, res) => {
    try {
        const { product_id, rating, comment } = req.body;
        const user_id = req.user.id;

        // Validation
        if (!product_id || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Valid product ID and rating (1-5) are required.' });
        }

        // 1. Check if user is eligible (has a 'delivered' order containing this product)
        const checkOrderQuery = `
            SELECT o.id 
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            WHERE o.user_id = $1 AND o.status = 'delivered' AND oi.product_id = $2
            LIMIT 1
        `;
        const orderResult = await db.query(checkOrderQuery, [user_id, product_id]);

        if (orderResult.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'You can only review products that have been delivered to you.' });
        }

        // 2. Insert or Update review
        const insertQuery = `
            INSERT INTO reviews (product_id, user_id, rating, comment, status)
            VALUES ($1, $2, $3, $4, 'approved')
            ON CONFLICT (product_id, user_id) 
            DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
            RETURNING *;
        `;
        const result = await db.query(insertQuery, [product_id, user_id, rating, comment]);

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error adding review:', error);
        res.status(500).json({ success: false, message: 'Server error adding review', error: error.message });
    }
};

exports.getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const query = `
            SELECT r.id, r.product_id, r.rating, r.comment, r.created_at, u.name as user_name
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.product_id = $1 AND r.status = 'approved'
            ORDER BY r.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const result = await db.query(query, [productId, limit, offset]);

        const countQuery = `SELECT COUNT(*) FROM reviews WHERE product_id = $1 AND status = 'approved'`;
        const countResult = await db.query(countQuery, [productId]);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
    }
};

exports.getAdminReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const query = `
            SELECT r.*, u.name as user_name, u.email as user_email
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.product_id = $1
            ORDER BY r.created_at DESC
        `;
        const result = await db.query(query, [productId]);
        
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Error fetching admin reviews:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reviews for admin' });
    }
};

exports.deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM reviews WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Review not found' });
        }
        res.json({ success: true, message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ success: false, message: 'Failed to delete review' });
    }
};
