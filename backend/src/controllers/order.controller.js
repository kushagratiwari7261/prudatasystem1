const Joi = require('joi');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const { paginate, paginationMeta } = require('../utils/pagination');
const logger = require('../utils/logger');

let io;
const setIO = (ioInstance) => { io = ioInstance; };

const getMyOrders = async (req, res, next) => {
    try {
        const { page, limit, offset } = paginate(req.query);

        const countResult = await db.query(
            'SELECT COUNT(*) as total FROM orders WHERE user_id = $1',
            [req.user.id]
        );
        const total = parseInt(countResult.rows[0].total);

        const { rows } = await db.query(
            `SELECT o.id, o.status, o.total_amount, o.items_total, 
              o.discount_amount, o.shipping_charge, o.coupon_code,
              o.payment_method, o.payment_status, o.created_at,
              COUNT(oi.id) as item_count,
              json_agg(
                  json_build_object(
                      'product_name', COALESCE(oi.product_snapshot->>'title', 'Product'),
                      'image_url', oi.product_snapshot->>'image',
                      'size', oi.product_snapshot->>'size',
                      'color', oi.product_snapshot->>'color',
                      'price', oi.price,
                      'quantity', oi.quantity
                  )
              ) as items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
            [req.user.id, limit, offset]
        );

        sendSuccess(res, {
            orders: rows,
            pagination: paginationMeta(total, page, limit)
        });
    } catch (err) {
        next(err);
    }
};

const getOrderById = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Admin can see any order, user can only see their own
        let orderQuery;
        let orderParams;
        if (req.user.role === 'admin') {
            orderQuery = 'SELECT o.* FROM orders o WHERE o.id = $1';
            orderParams = [id];
        } else {
            orderQuery = 'SELECT o.* FROM orders o WHERE o.id = $1 AND o.user_id = $2';
            orderParams = [id, req.user.id];
        }

        const orderResult = await db.query(orderQuery, orderParams);
        if (orderResult.rows.length === 0) {
            return next(new AppError('Order not found', 404));
        }
        const order = orderResult.rows[0];

        // Parse address snapshot
        if (order.address_snapshot) {
            try {
                order.address = typeof order.address_snapshot === 'string'
                    ? JSON.parse(order.address_snapshot)
                    : order.address_snapshot;
            } catch {
                order.address = null;
            }
        }

        // Get items with user reviews if applicable
        const itemsResult = await db.query(
            'SELECT * FROM order_items WHERE order_id = $1',
            [id]
        );
        
        const productIds = itemsResult.rows.map(item => item.product_id);
        let userReviews = [];
        
        if (req.user.role !== 'admin' && productIds.length > 0) {
            const reviewResult = await db.query(
                'SELECT * FROM reviews WHERE user_id = $1 AND product_id = ANY($2)',
                [req.user.id, productIds]
            );
            userReviews = reviewResult.rows;
        }

        const items = itemsResult.rows.map(item => {
            let snapshot = {};
            try {
                snapshot = typeof item.product_snapshot === 'string'
                    ? JSON.parse(item.product_snapshot)
                    : (item.product_snapshot || {});
            } catch { /* ignore */ }
            
            return {
                ...item,
                product_name: snapshot.title || 'Product',
                image_url: snapshot.image || null,
                size: snapshot.size || null,
                color: snapshot.color || null,
                subtotal: parseFloat(item.price) * parseInt(item.quantity),
                user_review: userReviews.find(r => r.product_id === item.product_id) || null
            };
        });

        // Get status history
        const historyResult = await db.query(
            `SELECT osh.status, osh.note, osh.location, osh.created_at,
              u.name as updated_by
       FROM order_status_history osh
       LEFT JOIN users u ON u.id = osh.changed_by
       WHERE osh.order_id = $1
       ORDER BY osh.created_at ASC`,
            [id]
        );

        // Get payment
        const paymentResult = await db.query(
            'SELECT * FROM payments WHERE order_id = $1',
            [id]
        );

        sendSuccess(res, {
            ...order,
            items,
            status_history: historyResult.rows,
            payment: paymentResult.rows[0] || null
        });
    } catch (err) {
        next(err);
    }
};

const cancelOrder = async (req, res, next) => {
    try {
        const { id } = req.params;

        const orderResult = await db.query(
            'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
            [id, req.user.id]
        );
        if (orderResult.rows.length === 0) {
            return next(new AppError('Order not found', 404));
        }
        const order = orderResult.rows[0];

        if (!['pending', 'confirmed'].includes(order.status)) {
            return next(new AppError('Cannot cancel at this stage', 400));
        }

        await db.query(
            `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
            [id]
        );

        // Release reserved stock
        await db.query(
            `UPDATE inventory i
       SET reserved = reserved - oi.quantity
       FROM order_items oi
       WHERE oi.order_id = $1 AND i.variant_id = oi.variant_id`,
            [id]
        );

        await db.query(
            `INSERT INTO order_status_history (order_id, status, note, changed_by)
       VALUES ($1, 'cancelled', 'Cancelled by customer', $2)`,
            [id, req.user.id]
        );

        if (io) {
            io.to(`order:${id}`).emit('order_update', { status: 'cancelled' });
        }

        sendSuccess(res, null, 'Order cancelled');
    } catch (err) {
        next(err);
    }
};

const updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const schema = Joi.object({
            status: Joi.string().valid(
                'confirmed', 'processing', 'packed', 'shipped',
                'out_for_delivery', 'delivered', 'cancelled', 'refunded'
            ).required(),
            note: Joi.string().optional().allow(''),
            location: Joi.string().optional().allow('')
        });
        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
        if (orderResult.rows.length === 0) {
            return next(new AppError('Order not found', 404));
        }
        const order = orderResult.rows[0];

        // Validate status transition
        const statusOrder = [
            'pending', 'confirmed', 'processing', 'packed',
            'shipped', 'out_for_delivery', 'delivered'
        ];
        const currentIndex = statusOrder.indexOf(order.status);
        const newIndex = statusOrder.indexOf(value.status);

        if (newIndex !== -1 && currentIndex !== -1 && newIndex < currentIndex
            && !['cancelled', 'refunded'].includes(value.status)) {
            return next(new AppError('Invalid status transition', 400));
        }

        await db.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
            [value.status, id]
        );

        await db.query(
            `INSERT INTO order_status_history (order_id, status, note, location, changed_by)
       VALUES ($1, $2, $3, $4, $5)`,
            [id, value.status, value.note || null, value.location || null, req.user.id]
        );

        // If delivered + COD, mark payment as paid
        if (value.status === 'delivered') {
            await db.query(
                `UPDATE orders SET payment_status = 'paid' WHERE id = $1 AND payment_method = 'cod'`,
                [id]
            );
        }

        // Emit Socket.io event
        if (io) {
            io.to(`order:${id}`).emit('order_update', {
                status: value.status,
                note: value.note || '',
                location: value.location || '',
                timestamp: new Date().toISOString()
            });
        }

        sendSuccess(res, { order_id: id, status: value.status }, 'Order status updated');
    } catch (err) {
        next(err);
    }
};

const getAllOrders = async (req, res, next) => {
    try {
        const { page, limit, offset } = paginate(req.query);
        const statusFilter = req.query.status;

        let whereClause = '';
        const queryParams = [];
        let paramIndex = 1;

        if (statusFilter) {
            whereClause = `WHERE o.status = $${paramIndex}`;
            queryParams.push(statusFilter);
            paramIndex++;
        }

        const countResult = await db.query(
            `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
            queryParams
        );
        const total = parseInt(countResult.rows[0].total);

        const { rows } = await db.query(
            `SELECT o.id, o.status, o.total_amount, o.items_total, 
              o.discount_amount, o.shipping_charge, o.coupon_code,
              o.payment_method, o.payment_status, o.created_at,
              u.name as user_name, u.email as user_email,
              COUNT(oi.id) as item_count
       FROM orders o
       JOIN users u ON u.id = o.user_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       ${whereClause}
       GROUP BY o.id, u.name, u.email
       ORDER BY o.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...queryParams, limit, offset]
        );

        sendSuccess(res, {
            orders: rows,
            pagination: paginationMeta(total, page, limit)
        });
    } catch (err) {
        next(err);
    }
};

const getAdminStats = async (req, res, next) => {
    try {
        const statsResult = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM orders) as total_orders,
                (SELECT COUNT(*) FROM orders WHERE status = 'pending') as pending_orders,
                (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid') as revenue,
                (SELECT COUNT(*) FROM users WHERE role = 'customer') as total_customers
        `);

        sendSuccess(res, {
            stats: statsResult.rows[0] || { total_orders: 0, pending_orders: 0, revenue: 0, total_customers: 0 }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * Delete order (Admin only)
 * @route DELETE /api/v1/orders/:id
 * @access Private/Admin
 */
const deleteOrder = async (req, res, next) => {
    try {
        const { id } = req.params;

        console.log(`Attempting to delete order: ${id}`); // Debug log

        // Check if order exists and get related info including payment status
        const { rows: existingOrder } = await db.query(
            `SELECT o.*, 
              o.payment_status,
              o.status as order_status,
              (SELECT COUNT(*) FROM payments WHERE order_id = o.id) as payment_count,
              (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count,
              (SELECT COUNT(*) FROM order_status_history WHERE order_id = o.id) as history_count
             FROM orders o 
             WHERE o.id = $1`,
            [id]
        );

        if (existingOrder.length === 0) {
            console.log(`Order ${id} not found`);
            return next(new AppError('Order not found', 404));
        }

        const order = existingOrder[0];
        console.log('Order found:', {
            id: order.id,
            status: order.order_status,
            payment_status: order.payment_status,
            payment_count: order.payment_count,
            items_count: order.items_count,
            history_count: order.history_count
        });

        // ✅ FIXED: Allow deletion of cancelled orders regardless of payment status
        // Only block delivered orders
        if (order.order_status === 'delivered') {
            return next(new AppError('Cannot delete delivered orders - they are protected for record keeping', 400));
        }

        // Allow deletion of cancelled orders even if they have payment records
        // For non-cancelled orders, check payment status
        if (order.order_status !== 'cancelled' && order.order_status !== 'refunded') {
            if (order.payment_status === 'paid') {
                return next(new AppError('Cannot delete orders with paid payment status - please process a refund first', 400));
            }

            // Check if order has any non-deletable related records (except failed ones)
            if (order.payment_count > 0 && order.payment_status !== 'failed' && order.payment_status !== 'refunded') {
                return next(new AppError('Cannot delete order with active payment records', 400));
            }
        }

        // Start a transaction to delete related records in correct order using a dedicated client
        const client = await db.getClient();
        await client.query('BEGIN');
        console.log('Transaction started');

        try {
            // 1. First delete from payments
            if (order.payment_count > 0) {
                console.log('Deleting from payments...');
                const paymentDeleteResult = await client.query(
                    'DELETE FROM payments WHERE order_id = $1 RETURNING id',
                    [id]
                );
                console.log(`Deleted ${paymentDeleteResult.rowCount} payments`);
            }

            // 2. Delete from order_items
            if (order.items_count > 0) {
                console.log('Deleting from order_items...');
                const itemDeleteResult = await client.query(
                    'DELETE FROM order_items WHERE order_id = $1 RETURNING id',
                    [id]
                );
                console.log(`Deleted ${itemDeleteResult.rowCount} order items`);
            }

            // 3. Delete from order_status_history
            if (order.history_count > 0) {
                console.log('Deleting from order_status_history...');
                const historyDeleteResult = await client.query(
                    'DELETE FROM order_status_history WHERE order_id = $1 RETURNING id',
                    [id]
                );
                console.log(`Deleted ${historyDeleteResult.rowCount} status history records`);
            }

            // order_coupons table does not exist in schema, so we skip it to prevent 25P02 transaction abort errors.

            // 5. Finally delete the order
            console.log('Deleting from orders...');
            const orderDeleteResult = await client.query(
                'DELETE FROM orders WHERE id = $1 RETURNING id',
                [id]
            );
            console.log(`Deleted order: ${orderDeleteResult.rows[0]?.id}`);

            await client.query('COMMIT');
            client.release();
            console.log('Transaction committed successfully');

            // Emit Socket.io event for real-time updates
            if (io) {
                io.emit('order_deleted', { order_id: id });
                console.log('Socket.io event emitted');
            }

            logger.info(`Order ${id} deleted by admin ${req.user.id}`);
            sendSuccess(res, null, 'Order deleted successfully');

        } catch (err) {
            await client.query('ROLLBACK');
            client.release();
            console.error('Error during transaction, rolled back:', err);

            // Handle specific database errors
            if (err.code === '23503') { // Foreign key violation
                const detail = err.detail || '';
                if (detail.includes('payments')) {
                    return next(new AppError('Cannot delete order because it has payment records that cannot be removed. Please process refund first.', 400));
                }
                return next(new AppError('Cannot delete order due to related records', 400));
            }
            throw err;
        }

    } catch (error) {
        console.error('Delete order error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            detail: error.detail
        });

        logger.error('Delete order error:', error);

        // Handle specific database errors
        if (error.code === '23503') { // Foreign key violation
            return next(new AppError('Cannot delete order because it has related records', 400));
        }
        if (error.code === '42P01') { // Undefined table
            return next(new AppError('Database schema error', 500));
        }

        next(new AppError('Failed to delete order: ' + error.message, 500));
    }
};

module.exports = {
    getMyOrders,
    getOrderById,
    cancelOrder,
    updateOrderStatus,
    getAllOrders,
    getAdminStats,
    deleteOrder,
    setIO
};