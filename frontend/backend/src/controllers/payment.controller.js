const Joi = require('joi');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const { sendSuccess } = require('../utils/response');
const paymentService = require('../services/payment.service');
const cartService = require('../services/cart.service');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');

let io;
const setIO = (ioInstance) => { io = ioInstance; };

const createOrder = async (req, res, next) => {
    try {
        const schema = Joi.object({
            address_id: Joi.string().uuid().required(),
            payment_method: Joi.string().valid('razorpay', 'cod').required(),
            coupon_code: Joi.string().optional()
        });
        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // Get cart
        const cart = await cartService.getCart(req.user.id);
        if (cart.items.length === 0) {
            return next(new AppError('Cart is empty', 400));
        }

        // Verify address ownership
        const addrResult = await db.query(
            'SELECT * FROM addresses WHERE id = $1 AND user_id = $2',
            [value.address_id, req.user.id]
        );
        if (addrResult.rows.length === 0) {
            return next(new AppError('Address not found', 404));
        }
        const address = addrResult.rows[0];

        // Verify stock for all items
        for (const item of cart.items) {
            const stockResult = await db.query(
                `SELECT COALESCE(quantity - reserved, 0) as available
         FROM inventory WHERE variant_id = $1`,
                [item.variant_id]
            );
            if (stockResult.rows.length === 0 || stockResult.rows[0].available < item.quantity) {
                return next(new AppError(`${item.product_title} is out of stock`, 400));
            }
        }

        // Calculate totals
        const totals = cartService.calculateTotals(cart);

        // Validate coupon if present
        let coupon_code = cart.coupon?.code || value.coupon_code || null;
        if (coupon_code) {
            const couponResult = await db.query(
                `SELECT * FROM coupons WHERE UPPER(code) = UPPER($1) AND is_active = true`,
                [coupon_code]
            );
            if (couponResult.rows.length === 0) {
                coupon_code = null;
            } else {
                const coupon = couponResult.rows[0];
                if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
                    coupon_code = null;
                }
                if (coupon.max_uses && coupon.uses_count >= coupon.max_uses) {
                    coupon_code = null;
                }
            }
        }

        const address_snapshot = JSON.stringify(address);

        // Start transaction
        await db.query('BEGIN');

        try {
            // Insert order
            const orderResult = await db.query(
                `INSERT INTO orders (user_id, status, address_snapshot, items_total, discount_amount,
         shipping_charge, tax_amount, total_amount, coupon_code, payment_method, payment_status)
         VALUES ($1, 'pending', $2, $3, $4, $5, 0, $6, $7, $8, 'pending')
         RETURNING *`,
                [req.user.id, address_snapshot, totals.items_total, totals.discount_amount,
                totals.shipping_charge, totals.final_total, coupon_code, value.payment_method]
            );
            const order = orderResult.rows[0];

            // Insert order items
            for (const item of cart.items) {
                const product_snapshot = JSON.stringify({
                    title: item.product_title,
                    sku: item.sku,
                    size: item.size,
                    color: item.color,
                    image: item.image,
                    final_price: item.final_price
                });

                await db.query(
                    `INSERT INTO order_items (order_id, product_id, variant_id, product_snapshot, quantity, price)
             VALUES ($1, $2, $3, $4, $5, $6)`,
                    [order.id, item.product_id, item.variant_id, product_snapshot, item.quantity, item.final_price]
                );
            }

            // Reserve stock
            for (const item of cart.items) {
                await db.query(
                    `UPDATE inventory SET reserved = reserved + $1 WHERE variant_id = $2`,
                    [item.quantity, item.variant_id]
                );
            }

            // Status history
            await db.query(
                `INSERT INTO order_status_history (order_id, status, note, changed_by)
           VALUES ($1, 'pending', 'Order placed', $2)`,
                [order.id, req.user.id]
            );

            // Update coupon uses
            if (coupon_code) {
                await db.query(
                    'UPDATE coupons SET uses_count = uses_count + 1 WHERE UPPER(code) = UPPER($1)',
                    [coupon_code]
                );
            }

            await db.query('COMMIT');

            // Payment handling
            if (value.payment_method === 'razorpay') {
                const razorpayOrder = await paymentService.createRazorpayOrder(totals.final_total, order.id);

                await db.query(
                    `INSERT INTO payments (order_id, razorpay_order_id, amount, currency, status)
             VALUES ($1, $2, $3, 'INR', 'pending')`,
                    [order.id, razorpayOrder.id, totals.final_total]
                );

                sendSuccess(res, {
                    order_id: order.id,
                    razorpay_order_id: razorpayOrder.id,
                    amount: razorpayOrder.amount,
                    currency: razorpayOrder.currency,
                    key: process.env.RAZORPAY_KEY_ID
                }, 'Order created');
            } else {
                // COD
                await db.query(
                    `INSERT INTO payments (order_id, amount, status, method)
             VALUES ($1, $2, 'pending', 'cod')`,
                    [order.id, totals.final_total]
                );

                await db.query(
                    `UPDATE orders SET status = 'confirmed', updated_at = NOW() WHERE id = $1`,
                    [order.id]
                );

                await db.query(
                    `INSERT INTO order_status_history (order_id, status, note, changed_by)
             VALUES ($1, 'confirmed', 'COD order confirmed', $2)`,
                    [order.id, req.user.id]
                );

                await cartService.clearCart(req.user.id);

                // Send email (fire and forget)
                const userResult = await db.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
                if (userResult.rows.length > 0) {
                    emailService.sendOrderConfirmationEmail(userResult.rows[0].email, {
                        orderId: order.id,
                        items: cart.items.map(i => ({ title: i.product_title, quantity: i.quantity, price: i.final_price })),
                        total: totals.final_total,
                        paymentMethod: 'cod'
                    }).catch(err => logger.error('Email send failed:', err.message));
                }

                sendSuccess(res, { order_id: order.id }, 'Order placed successfully');
            }
        } catch (err) {
            await db.query('ROLLBACK');
            throw err;
        }
    } catch (err) {
        next(err);
    }
};

const cancelPayment = async (req, res, next) => {
    try {
        const schema = Joi.object({
            order_id: Joi.string().uuid().required()
        });
        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // Start transaction with dedicated client
        const client = await db.getClient();
        await client.query('BEGIN');

        try {
            // Find order
            const orderResult = await client.query(
                'SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE',
                [value.order_id, req.user.id]
            );
            
            if (orderResult.rows.length === 0) {
                await client.query('ROLLBACK');
                client.release();
                // Return success anyway to avoid frontend errors on retry
                return sendSuccess(res, null, 'Order already handled');
            }
            
            const order = orderResult.rows[0];

            // Only cancel if it's pending/confirmed
            if (!['pending', 'confirmed'].includes(order.status)) {
                await client.query('ROLLBACK');
                client.release();
                return sendSuccess(res, null, 'Order already processed');
            }

            // Update order
            await client.query(
                `UPDATE orders SET status = 'cancelled', payment_status = 'failed', 
                 cancel_reason = 'Payment cancelled due to exit', updated_at = NOW() 
                 WHERE id = $1`,
                [value.order_id]
            );

            // Update payment record
            await client.query(
                `UPDATE payments SET status = 'failed', error_description = 'Payment cancelled due to exit', 
                 updated_at = NOW() WHERE order_id = $1`,
                [value.order_id]
            );

            // Release reserved stock
            const orderItems = await client.query(
                'SELECT variant_id, quantity FROM order_items WHERE order_id = $1',
                [value.order_id]
            );
            
            for (const item of orderItems.rows) {
                await client.query(
                    'UPDATE inventory SET reserved = reserved - $1 WHERE variant_id = $2',
                    [item.quantity, item.variant_id]
                );
            }

            // Status history
            await client.query(
                `INSERT INTO order_status_history (order_id, status, note, changed_by)
                 VALUES ($1, 'cancelled', 'Payment cancelled due to exit', $2)`,
                [value.order_id, req.user.id]
            );

            await client.query('COMMIT');
            client.release();

            // Emit Socket.io event
            if (io) {
                io.to(`order:${value.order_id}`).emit('order_update', { status: 'cancelled' });
            }

            sendSuccess(res, { order_id: value.order_id }, 'Payment cancelled successfully');
        } catch (err) {
            await client.query('ROLLBACK');
            client.release();
            throw err;
        }
    } catch (err) {
        next(err);
    }
};

const verifyPayment = async (req, res, next) => {
    try {
        const schema = Joi.object({
            razorpay_order_id: Joi.string().required(),
            razorpay_payment_id: Joi.string().required(),
            razorpay_signature: Joi.string().required(),
            order_id: Joi.string().uuid().required()
        });
        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        // Verify signature
        const isValid = paymentService.verifySignature(
            value.razorpay_order_id,
            value.razorpay_payment_id,
            value.razorpay_signature
        );
        if (!isValid) return next(new AppError('Payment verification failed', 400));

        // Start transaction
        await db.query('BEGIN');

        try {
            // Find payment record
            const paymentResult = await db.query(
                'SELECT * FROM payments WHERE razorpay_order_id = $1',
                [value.razorpay_order_id]
            );
            if (paymentResult.rows.length === 0) {
                await db.query('ROLLBACK');
                return next(new AppError('Payment record not found', 404));
            }
            const payment = paymentResult.rows[0];

            // Fetch payment details from Razorpay
            const rzpPayment = await paymentService.fetchPayment(value.razorpay_payment_id);

            // Update payment record
            await db.query(
                `UPDATE payments SET razorpay_payment_id = $1, razorpay_signature = $2,
           status = 'captured', method = $3, updated_at = NOW()
           WHERE id = $4`,
                [value.razorpay_payment_id, value.razorpay_signature, rzpPayment.method, payment.id]
            );

            // Update order
            await db.query(
                `UPDATE orders SET status = 'confirmed', payment_status = 'paid', updated_at = NOW()
           WHERE id = $1`,
                [value.order_id]
            );

            // Deduct reserved stock — make permanent
            const orderItems = await db.query(
                'SELECT variant_id, quantity FROM order_items WHERE order_id = $1',
                [value.order_id]
            );
            for (const item of orderItems.rows) {
                await db.query(
                    `UPDATE inventory SET quantity = quantity - $1, reserved = reserved - $1
             WHERE variant_id = $2`,
                    [item.quantity, item.variant_id]
                );
            }

            // Status history
            await db.query(
                `INSERT INTO order_status_history (order_id, status, note, changed_by)
           VALUES ($1, 'confirmed', 'Payment received', $2)`,
                [value.order_id, req.user.id]
            );

            // Clear cart
            await cartService.clearCart(req.user.id);

            await db.query('COMMIT');

            // Send confirmation email (fire and forget)
            const userResult = await db.query(
                `SELECT u.email, o.total_amount FROM users u
           JOIN orders o ON o.user_id = u.id
           WHERE u.id = $1 AND o.id = $2`,
                [req.user.id, value.order_id]
            );
            if (userResult.rows.length > 0) {
                emailService.sendOrderConfirmationEmail(userResult.rows[0].email, {
                    orderId: value.order_id,
                    items: orderItems.rows.map(i => ({ title: 'Product', quantity: i.quantity, price: 0 })),
                    total: userResult.rows[0].total_amount,
                    paymentMethod: 'razorpay'
                }).catch(err => logger.error('Email send failed:', err.message));
            }

            // Emit Socket.io event
            if (io) {
                io.to(`order:${value.order_id}`).emit('order_update', { status: 'confirmed' });
            }

            sendSuccess(res, { order_id: value.order_id }, 'Payment verified');
        } catch (err) {
            await db.query('ROLLBACK');
            throw err;
        }
    } catch (err) {
        next(err);
    }
};

const refund = async (req, res, next) => {
    try {
        const schema = Joi.object({
            order_id: Joi.string().uuid().required(),
            reason: Joi.string().required()
        });
        const { error, value } = schema.validate(req.body);
        if (error) return next(new AppError(error.details[0].message, 400));

        const result = await db.query(
            `SELECT o.*, p.razorpay_payment_id, p.amount as paid_amount, p.id as payment_id
       FROM orders o
       JOIN payments p ON p.order_id = o.id
       WHERE o.id = $1`,
            [value.order_id]
        );
        if (result.rows.length === 0) {
            return next(new AppError('Order not found', 404));
        }
        const order = result.rows[0];

        if (!['confirmed', 'processing', 'packed'].includes(order.status)) {
            return next(new AppError('Cannot refund at this stage', 400));
        }

        if (!order.razorpay_payment_id) {
            return next(new AppError('No online payment found for refund', 400));
        }

        const refundResult = await paymentService.initiateRefund(
            order.razorpay_payment_id, order.paid_amount
        );

        await db.query('BEGIN');

        try {
            await db.query(
                `UPDATE payments SET status = 'refunded', refund_id = $1, refund_amount = $2,
           updated_at = NOW() WHERE id = $3`,
                [refundResult.id, order.paid_amount, order.payment_id]
            );

            await db.query(
                `UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = NOW()
           WHERE id = $1`,
                [value.order_id]
            );

            // Release reserved stock
            const orderItems = await db.query(
                'SELECT variant_id, quantity FROM order_items WHERE order_id = $1',
                [value.order_id]
            );
            for (const item of orderItems.rows) {
                await db.query(
                    'UPDATE inventory SET reserved = reserved - $1 WHERE variant_id = $2',
                    [item.quantity, item.variant_id]
                );
            }

            await db.query(
                `INSERT INTO order_status_history (order_id, status, note, changed_by)
           VALUES ($1, 'refunded', $2, $3)`,
                [value.order_id, value.reason, req.user.id]
            );

            await db.query('COMMIT');
        } catch (err) {
            await db.query('ROLLBACK');
            throw err;
        }

        sendSuccess(res, null, 'Refund initiated');
    } catch (err) {
        next(err);
    }
};

module.exports = { createOrder, verifyPayment, refund, cancelPayment, setIO };