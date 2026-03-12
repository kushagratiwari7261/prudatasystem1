const { Server } = require('socket.io');
const logger = require('../utils/logger');

let io;

const init = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.CORS_ORIGINS,
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
        }
    });

    io.on('connection', (socket) => {
        logger.info(`Socket connected: ${socket.id}`);

        socket.on('subscribe_order', (data) => {
            if (data && data.orderId) {
                socket.join(`order:${data.orderId}`);
                logger.info(`Socket ${socket.id} joined room order:${data.orderId}`);
            }
        });

        socket.on('disconnect', () => {
            logger.info(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io is not initialized');
    }
    return io;
};

const emitOrderUpdate = (orderId, payload) => {
    if (io) {
        io.to(`order:${orderId}`).emit('order_update', payload);
    }
};

module.exports = {
    init,
    getIO,
    emitOrderUpdate
};
