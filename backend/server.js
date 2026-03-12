require('./src/config/env');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const passport = require('passport');
require('./src/config/passport');
const http = require('http');
const { init: initSocket, getIO } = require('./src/services/socket.service');

const db = require('./src/config/db');
const redis = require('./src/config/redis');

const AppError = require('./src/utils/AppError');
const errorHandler = require('./src/middleware/errorHandler');
const { globalLimiter } = require('./src/middleware/rateLimiter');

// Route imports
const authRoutes = require('./src/routes/auth.routes');
const adminConfigRoutes = require('./src/routes/adminConfig.routes');
const categoryRoutes = require('./src/routes/category.routes');
const brandRoutes = require('./src/routes/brand.routes');
const productRoutes = require('./src/routes/product.routes');
const inventoryRoutes = require('./src/routes/inventory.routes');
const cartRoutes = require('./src/routes/cart.routes');
const addressRoutes = require('./src/routes/address.routes');
const couponRoutes = require('./src/routes/coupon.routes');
const paymentRoutes = require('./src/routes/payment.routes');
const orderRoutes = require('./src/routes/order.routes');
const uploadRoutes = require('./src/routes/upload.routes');
const variantRoutes = require('./src/routes/variant.routes');
const reviewRoutes = require('./src/routes/review.routes');

// Controllers that need Socket.io
const paymentController = require('./src/controllers/payment.controller');
const orderController = require('./src/controllers/order.controller');

const app = express();
const server = http.createServer(app);

// Serve uploaded images as static files
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const io = initSocket(server);

// Pass Socket.io instance to controllers
paymentController.setIO(io);
orderController.setIO(io);

// Middleware
app.use(helmet());

// CORS — allow both customer frontend (3000) and admin panel (3001) and Docker frontends
const corsOptions = {
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3005',
        'http://frontend:3005',
        'http://admin:3001'
    ],
    credentials: true
};
app.use(cors(corsOptions));

app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Raw body for Razorpay webhooks (must come before express.json)
app.use(
    '/api/v1/payments/webhook',
    express.raw({ type: 'application/json' })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session + Passport for Google OAuth
app.use(session({
    secret: process.env.SESSION_SECRET || 'zenwair_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));
app.use(passport.initialize());
app.use(passport.session());

app.use(globalLimiter);

// ==============================================================
// HEALTH CHECK ENDPOINTS
// ==============================================================

// Docker health check endpoint (simple)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        services: {
            redis: redis.available ? 'connected' : 'disconnected',
            server: 'running'
        }
    });
});

// Detailed health check endpoint
app.get('/api/health', async (req, res) => {
    const health = {
        status: 'ok',
        db: 'disconnected',
        redis: 'disconnected',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    };

    try {
        await db.query('SELECT NOW()');
        health.db = 'connected';
    } catch (error) {
        health.status = 'error';
        health.db = 'error';
        console.error('DB Health Check Failed:', error.message);
    }

    try {
        if (redis.available && redis.client) {
            const pong = await redis.client.ping();
            if (pong === 'PONG') {
                health.redis = 'connected';
            } else {
                health.status = 'error';
                health.redis = 'unexpected_response';
            }
        } else {
            health.redis = 'unavailable';
        }
    } catch (error) {
        health.status = 'error';
        health.redis = 'error';
        console.error('Redis Health Check Failed:', error.message);
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
});

// Mount routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/adminConfig', adminConfigRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/brands', brandRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/upload', uploadRoutes);
app.use('/api/v1/variants', variantRoutes);
app.use('/api/v1/reviews', reviewRoutes);

// 404 handler
app.all('*', (req, res, next) => {
    next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// Error handler
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        // Check Redis availability (non-blocking)
        if (redis.available && redis.client) {
            try {
                await redis.client.ping();
                console.log('✅ Redis validation successful on startup.');
            } catch {
                console.warn('⚠️  Redis ping failed — caching disabled.');
            }
        } else {
            console.warn('⚠️  Redis not available — caching and job queue disabled.');
        }

        server.listen(PORT, () => {
            console.log(`=========================================`);
            console.log(`🚀 Zenwair Backend running in ${process.env.NODE_ENV || 'development'} mode`);
            console.log(`📡 URL: http://localhost:${PORT}`);
            console.log(`=========================================`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();