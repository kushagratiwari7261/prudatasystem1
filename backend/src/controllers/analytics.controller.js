const db = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get daily revenue for the last 7 days
 * @route GET /api/v1/analytics/sales-trend
 * @access Private/Admin
 */
exports.getSalesTrend = async (req, res) => {
    try {
        // Daily revenue for last 7 days
        const query = `
            WITH RECURSIVE last_7_days AS (
                SELECT CURRENT_DATE - INTERVAL '6 days' as day
                UNION ALL
                SELECT day + INTERVAL '1 day'
                FROM last_7_days
                WHERE day < CURRENT_DATE
            )
            SELECT 
                d.day::date as date,
                COALESCE(SUM(o.total_amount), 0) as revenue,
                COUNT(o.id) as orders
            FROM last_7_days d
            LEFT JOIN orders o ON DATE(o.created_at) = d.day AND o.payment_status = 'paid'
            GROUP BY d.day
            ORDER BY d.day ASC;
        `;
        const result = await db.query(query);
        sendSuccess(res, result.rows);
    } catch (error) {
        console.error('Error fetching sales trend:', error);
        sendError(res, 'Failed to fetch sales trend', 500);
    }
};

/**
 * Get top 5 selling products
 * @route GET /api/v1/analytics/top-products
 * @access Private/Admin
 */
exports.getTopProducts = async (req, res) => {
    try {
        const query = `
            SELECT 
                p.id,
                p.title as name,
                SUM(oi.quantity) as total_sold,
                SUM(oi.quantity * oi.price) as total_revenue
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            JOIN orders o ON oi.order_id = o.id
            WHERE o.payment_status = 'paid'
            GROUP BY p.id, p.title
            ORDER BY total_sold DESC
            LIMIT 5;
        `;
        const result = await db.query(query);
        sendSuccess(res, result.rows);
    } catch (error) {
        console.error('Error fetching top products:', error);
        sendError(res, 'Failed to fetch top products', 500);
    }
};
