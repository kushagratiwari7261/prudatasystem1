const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const db = require('./db');

const migrateReviews = async () => {
    try {
        console.log('Running reviews migration...');
        
        // Ensure "reviews" doesn't exist to prevent errors, but we won't drop other tables
        await db.query(`DROP TABLE IF EXISTS reviews CASCADE;`);

        await db.query(`
        CREATE TABLE reviews (
            id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rating      INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
            comment     TEXT,
            status      VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            updated_at  TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(product_id, user_id)
        );
        `);
        console.log('✅ Reviews table created');

        await db.query(`CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);`);
        console.log('✅ Review indexes created');

        await db.query(`
        CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        `);

        await db.query(`DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews;`);
        await db.query(`CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();`);

        await db.query(`
        CREATE OR REPLACE FUNCTION update_product_rating() RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
                UPDATE products 
                SET rating_avg = (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) FROM reviews WHERE product_id = NEW.product_id AND status = 'approved'),
                    rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = NEW.product_id AND status = 'approved')
                WHERE id = NEW.product_id;
                RETURN NEW;
            ELSIF TG_OP = 'DELETE' THEN
                UPDATE products 
                SET rating_avg = (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) FROM reviews WHERE product_id = OLD.product_id AND status = 'approved'),
                    rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = OLD.product_id AND status = 'approved')
                WHERE id = OLD.product_id;
                RETURN OLD;
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        `);

        await db.query(`DROP TRIGGER IF EXISTS trg_update_product_rating ON reviews;`);
        await db.query(`CREATE TRIGGER trg_update_product_rating AFTER INSERT OR UPDATE OR DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION update_product_rating();`);
        
        console.log('✅ Review triggers applied');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        console.error(err);
        process.exit(1);
    }
};

migrateReviews();
