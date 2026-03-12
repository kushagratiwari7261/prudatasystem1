const formatMessage = (level, message, data = {}) => {
    const timestamp = new Date().toISOString();
    let logString = `[${level}] ${timestamp} ${message}`;

    if (Object.keys(data).length > 0) {
        const safeData = { ...data };
        const piiFields = ['email', 'phone', 'password', 'password_hash', 'token', 'refresh_token', 'otp'];

        for (const field of piiFields) {
            if (safeData[field] !== undefined) {
                delete safeData[field];
            }
        }

        logString += ` ${JSON.stringify(safeData)}`;
    }

    return logString;
};

const info = (message, data = {}) => {
    console.log(formatMessage('INFO', message, data));
};

const warn = (message, data = {}) => {
    console.warn(formatMessage('WARN', message, data));
};

const error = (message, data = {}) => {
    console.error(formatMessage('ERROR', message, data));
};

const debug = (message, data = {}) => {
    if (process.env.NODE_ENV !== 'production') {
        console.debug(formatMessage('DEBUG', message, data));
    }
};

module.exports = { info, warn, error, debug };
