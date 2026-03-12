const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

const loadEnv = () => {
    // Load standard .env
    const envPath = path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
        const envConfig = dotenv.parse(fs.readFileSync(envPath));
        for (const k in envConfig) {
            if (!process.env[k]) process.env[k] = envConfig[k];
        }
    }

    // Override with .env.local if present
    const localEnvPath = path.resolve(__dirname, '../../.env.local');
    if (fs.existsSync(localEnvPath)) {
        const localEnvConfig = dotenv.parse(fs.readFileSync(localEnvPath));
        for (const k in localEnvConfig) {
            process.env[k] = localEnvConfig[k];
        }
    }
};

loadEnv();
