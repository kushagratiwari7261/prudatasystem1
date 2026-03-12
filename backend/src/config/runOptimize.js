const db = require('./db');
const fs = require('fs');
const path = require('path');

const runOptimize = async () => {
    try {
        const sql = fs.readFileSync(
            path.join(__dirname, 'optimize.sql'), 'utf8'
        );
        await db.query(sql);
        console.log('✅ Database optimized successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Optimization failed:', err.message);
        process.exit(1);
    }
};

runOptimize();
