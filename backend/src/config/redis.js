require('./env');
const Redis = require('ioredis');

let redisClient = null;
let redisAvailable = false;

function createRedisClient() {
    // DEBUG: Show where the URL is coming from
    console.log('🔍 DEBUG: process.env.REDIS_URL =', process.env.REDIS_URL);
    console.log('🔍 DEBUG: process.env =', Object.keys(process.env).filter(k => k.includes('REDIS')).reduce((obj, k) => {
        obj[k] = process.env[k];
        return obj;
    }, {}));

    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`🔌 Attempting to connect to Redis at: ${REDIS_URL}`);

    const client = new Redis(REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
            console.log(`🔄 Redis retry attempt ${times}`);
            return Math.min(times * 100, 3000);
        },
        reconnectOnError: (err) => {
            console.log(`🔄 Redis reconnect on error: ${err}`);
            return true;
        },
        connectTimeout: 10000,
        commandTimeout: 5000,
    });

    client.on('error', (err) => {
        console.warn('⚠️ Redis error:', err.message);
    });

    client.on('connect', () => {
        console.log('✅ Redis client connected');
    });

    client.on('ready', () => {
        redisAvailable = true;
        console.log('✅ Redis is ready to use');
    });

    client.on('close', () => {
        console.log('🔌 Redis connection closed');
    });

    return client;
}

// Try to connect once at startup
async function initRedis() {
    const client = createRedisClient();
    try {
        await client.connect();
        redisClient = client;
        redisAvailable = true;
        console.log('✅ Redis initialized successfully');
    } catch (err) {
        console.warn('⚠️ Redis not available — caching and job queue disabled.');
        console.warn('Error details:', err.message);
        redisAvailable = false;
        try { client.disconnect(false); } catch { }
    }
}

// Initialize with a slight delay to ensure network is ready
setTimeout(() => {
    initRedis().catch(() => { });
}, 2000);

module.exports = {
    get client() { return redisClient; },
    get available() { return redisAvailable; },
};