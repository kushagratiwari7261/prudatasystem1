const logger = require('../utils/logger');

const connection = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    enableOfflineQueue: false,
    lazyConnect: true,
};

let shippingQueue = null;
let worker = null;

const addShippingJob = async (jobName, data, opts = {}) => {
    if (!shippingQueue) {
        logger.warn('Redis not available — shipping job skipped:', jobName);
        return null;
    }
    const defaultOpts = { attempts: 3, backoff: { type: 'exponential', delay: 5000 } };
    return shippingQueue.add(jobName, data, { ...defaultOpts, ...opts });
};

// Only initialise BullMQ if Redis is reachable
async function initShippingQueue() {
    // First, test Redis connectivity with a lightweight probe
    // This prevents BullMQ from creating workers that spam errors
    const Redis = require('ioredis');
    const testClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
        reconnectOnError: () => false,
        connectTimeout: 3000,
    });

    // Attach error handler BEFORE connect to prevent unhandled error events
    testClient.on('error', () => { });

    try {
        await testClient.connect();
        await testClient.ping();
        await testClient.quit();
    } catch {
        try { testClient.disconnect(false); } catch { }
        logger.warn('⚠️  Redis unavailable — shipping queue disabled. Start Redis to enable background jobs.');
        return;
    }

    // Redis is reachable — safe to create BullMQ instances
    try {
        const { Queue, Worker } = require('bullmq');
        const shiprocketService = require('../services/shiprocket.service');
        const socketService = require('../services/socket.service');
        const emailService = require('../services/email.service');
        const pool = require('../config/db');

        shippingQueue = new Queue('shipping', { connection });

        worker = new Worker('shipping', async (job) => {
            const { name, data } = job;

            if (name === 'create_shipment') {
                const { orderId, orderData } = data;
                try {
                    const srOrder = await shiprocketService.createShiprocketOrder(orderData);
                    const shiprocketOrderId = srOrder.order_id;
                    const shipmentId = srOrder.shipment_id;

                    const awbRes = await shiprocketService.assignAWB(shipmentId, 1);
                    const awbCode = awbRes.response?.data?.awb_code || '';

                    const labelRes = await shiprocketService.generateLabel(shipmentId);
                    const labelUrl = labelRes.label_url || '';

                    await pool.query(
                        `INSERT INTO shipments (order_id, shiprocket_order_id, shiprocket_shipment_id, awb_code, label_url, current_status)
                         VALUES ($1, $2, $3, $4, $5, 'processing')`,
                        [orderId, shiprocketOrderId, shipmentId, awbCode, labelUrl]
                    );

                    await pool.query(`UPDATE orders SET status = 'processing' WHERE id = $1`, [orderId]);
                    await pool.query(
                        `INSERT INTO order_status_history (order_id, status, note) VALUES ($1, 'processing', 'Shipment created and AWB assigned')`,
                        [orderId]
                    );

                    socketService.emitOrderUpdate(orderId, { status: 'processing', awb_code: awbCode });

                    const result = await pool.query('SELECT u.email FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = $1', [orderId]);
                    if (result.rows.length > 0) {
                        await emailService.sendShippingDispatchEmail(result.rows[0].email, {
                            orderId, awbCode,
                            courierName: 'Generic Courier',
                            trackingUrl: srOrder.tracking_url || '',
                            estimatedDelivery: srOrder.estimated_delivery || ''
                        });
                    }
                } catch (err) {
                    logger.error(`Error in create_shipment job: ${err.message}`);
                    throw err;
                }
            } else if (name === 'cancel_shipment') {
                const { orderId, shiprocketOrderId } = data;
                try {
                    await shiprocketService.cancelShiprocketOrder([shiprocketOrderId]);

                    await pool.query(`UPDATE shipments SET current_status = 'cancelled' WHERE order_id = $1`, [orderId]);
                    await pool.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [orderId]);
                    await pool.query(
                        `INSERT INTO order_status_history (order_id, status, note) VALUES ($1, 'cancelled', 'Shipment cancelled')`,
                        [orderId]
                    );

                    const orderItems = await pool.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [orderId]);
                    for (const item of orderItems.rows) {
                        if (item.variant_id) {
                            await pool.query('UPDATE inventory SET quantity = quantity + $1 WHERE variant_id = $2', [item.quantity, item.variant_id]);
                            await pool.query(
                                'INSERT INTO stock_movements (variant_id, type, quantity, reason, reference_id) VALUES ($1, $2, $3, $4, $5)',
                                [item.variant_id, 'in', item.quantity, 'order_cancellation', orderId]
                            );
                        }
                    }

                    socketService.emitOrderUpdate(orderId, { status: 'cancelled' });
                } catch (err) {
                    logger.error(`Error in cancel_shipment job: ${err.message}`);
                    throw err;
                }
            }
        }, { connection });

        worker.on('error', (err) => {
            logger.error(`Worker error: ${err.message || err}`);
        });

        worker.on('failed', (job, err) => {
            if (job) logger.error(`Job ${job.name} failed: ${err.message}`);
        });

        await shippingQueue.waitUntilReady();
        logger.info('✅ BullMQ shipping queue ready');
    } catch (err) {
        logger.warn(`⚠️  BullMQ init failed — shipping queue disabled. (${err.message})`);
        // Clean up to stop retry spam
        if (worker) { try { await worker.close(); } catch { } }
        if (shippingQueue) { try { await shippingQueue.close(); } catch { } }
        shippingQueue = null;
        worker = null;
    }
}

// Initialise but don't block server startup
initShippingQueue().catch(() => { });

module.exports = { addShippingJob };
