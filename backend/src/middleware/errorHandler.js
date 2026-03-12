const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    let statusCode = 500;
    let message = 'Something went wrong';
    let success = false;

    // CASE 1: Joi ValidationError
    if (err.isJoi === true || err.name === 'ValidationError') {
        statusCode = 400;
        message = err.details ? err.details.map(d => d.message).join(', ') : err.message;
    }
    // CASE 2: PostgreSQL unique violation
    else if (err.code === '23505') {
        statusCode = 409;
        message = 'A record with this value already exists';
    }
    // CASE 3: PostgreSQL foreign key violation
    else if (err.code === '23503') {
        statusCode = 400;
        message = 'Referenced record does not exist';
    }
    // CASE 4: JWT invalid signature
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid token. Please log in again.';
    }
    // CASE 5: JWT expired
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Your token has expired. Please log in again.';
    }
    // CASE 6: AppError
    else if (err.isOperational) {
        statusCode = err.statusCode;
        message = err.message;
    }
    // CASE 7: Unknown error
    else {
        logger.error(err.message || 'Unknown error', { stack: err.stack });
        if (process.env.NODE_ENV === 'development') {
            return res.status(500).json({
                success: false,
                message: err.message,
                stack: err.stack
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Something went wrong'
            });
        }
    }

    // Always log errors before responding
    logger.error(message, { error: err.message, stack: err.stack, name: err.name, code: err.code });

    return res.status(statusCode).json({
        success,
        message
    });
};

module.exports = errorHandler;
