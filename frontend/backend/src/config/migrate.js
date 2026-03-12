const fs = require('fs');
const path = require('path');
const db = require('./db');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const migrate = async () => {
    try {
        console.log('Running migration...');
        const sql = fs.readFileSync(
            path.join(__dirname, 'schema.sql'), 'utf8'
        );
        await db.query(sql);
        console.log('✅ Schema migrated successfully');

        // Seed admin
        const bcrypt = require('bcrypt');
        const hash = await bcrypt.hash('Admin@1234', 12);
        await db.query(`
      INSERT INTO users
      (name, email, password_hash, role,
       is_email_verified, is_active, auth_provider)
      VALUES ($1,$2,$3,'admin',true,true,'local')
      ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash
    `, ['Zenwair Admin', 'admin@zenwair.com', hash]);
        console.log('✅ Admin user seeded');
        console.log('   Email: admin@zenwair.com');
        console.log('   Password: Admin@1234');

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        console.error(err);
        process.exit(1);
    }
};

migrate();
