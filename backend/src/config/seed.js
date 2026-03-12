const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const db = require('./db');

const seed = async () => {
    console.log('Starting data seeding...');

    try {
        // 1. Categories (6 rows)
        console.log('Seeding categories...');
        const categories = [
            { name: 'Men', slug: 'men' },
            { name: 'Women', slug: 'women' },
            { name: 'Kids', slug: 'kids' },
            { name: 'Footwear', slug: 'footwear' },
            { name: 'Accessories', slug: 'accessories' },
            { name: 'Sports', slug: 'sports' }
        ];
        const categoryIds = [];
        for (const cat of categories) {
            const res = await db.query(
                'INSERT INTO categories (name, slug, is_active) VALUES ($1, $2, true) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id',
                [cat.name, cat.slug]
            );
            categoryIds.push(res.rows[0].id);
        }

        // 2. Brands (4 rows)
        console.log('Seeding brands...');
        const brands = [
            { name: 'Zenwair Originals', slug: 'zenwair-originals' },
            { name: 'Urban Threads', slug: 'urban-threads' },
            { name: 'Desi Drip', slug: 'desi-drip' },
            { name: 'Peak Athletics', slug: 'peak-athletics' }
        ];
        const brandIds = [];
        for (const brand of brands) {
            const res = await db.query(
                'INSERT INTO brands (name, slug, is_active) VALUES ($1, $2, true) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id',
                [brand.name, brand.slug]
            );
            brandIds.push(res.rows[0].id);
        }

        // 3. Admin User (1 row)
        console.log('Seeding admin user...');
        const adminEmail = 'admin@zenwair.com';
        const passwordHash = await bcrypt.hash('Admin@1234', 12);

        const userRes = await db.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
        if (userRes.rows.length === 0) {
            await db.query(
                'INSERT INTO users (name, email, password_hash, role, is_email_verified) VALUES ($1, $2, $3, $4, $5)',
                ['Zenwair Admin', adminEmail, passwordHash, 'admin', true]
            );
        } else {
            await db.query(
                'UPDATE users SET password_hash = $1, is_email_verified = true, is_active = true, role = $2 WHERE email = $3',
                [passwordHash, 'admin', adminEmail]
            );
        }

        // 4. Sample Products (3 rows)
        console.log('Seeding products...');
        const products = [
            { title: 'Classic Cotton T-Shirt', slug: 'classic-cotton-tshirt', price: 999.00, discount: 799.00, catId: categoryIds[0], brandId: brandIds[0] }, // Men
            { title: 'Floral Summer Dress', slug: 'floral-summer-dress', price: 1999.00, discount: 1499.00, catId: categoryIds[1], brandId: brandIds[1] }, // Women
            { title: 'Kids Denim Jacket', slug: 'kids-denim-jacket', price: 1499.00, discount: 1299.00, catId: categoryIds[2], brandId: brandIds[2] } // Kids
        ];

        const productIds = [];
        for (const prod of products) {
            const res = await db.query(
                `INSERT INTO products (title, slug, base_price, discount_price, category_id, brand_id, is_active, is_featured) 
         VALUES ($1, $2, $3, $4, $5, $6, true, true) 
         ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title 
         RETURNING id`,
                [prod.title, prod.slug, prod.price, prod.discount, prod.catId, prod.brandId]
            );
            productIds.push(res.rows[0].id);
        }

        // 5. Product Variants & 6. Inventory
        console.log('Seeding variants and inventory...');
        for (let i = 0; i < products.length; i++) {
            const prodId = productIds[i];
            const sizes = ['S', 'M'];

            for (let j = 0; j < sizes.length; j++) {
                const sku = `ZW-00${i + 1}-${sizes[j]}`;
                const variantRes = await db.query(
                    `INSERT INTO product_variants (product_id, sku, size, color, is_active)
                 VALUES ($1, $2, $3, $4, true)
                 ON CONFLICT (sku) DO UPDATE SET size = EXCLUDED.size
                 RETURNING id`,
                    [prodId, sku, sizes[j], 'Black']
                );

                const variantId = variantRes.rows[0].id;

                // Checking if inventory exists before insert to prevent duplicate rows over multiple runs
                const invExists = await db.query('SELECT id FROM inventory WHERE variant_id = $1', [variantId]);
                if (invExists.rows.length === 0) {
                    await db.query(
                        'INSERT INTO inventory (variant_id, quantity, reserved) VALUES ($1, $2, $3)',
                        [variantId, 50, 0]
                    );
                } else {
                    await db.query('UPDATE inventory SET quantity = 50 WHERE variant_id = $1', [variantId]);
                }
            }
        }

        console.log('✅ Seeding completed successfully.');

    } catch (error) {
        console.error('❌ Seeding failed:', error.message || error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
};

// Execute if run directly
if (require.main === module) {
    seed();
}

module.exports = seed;
