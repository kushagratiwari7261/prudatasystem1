-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- DROP ALL EXISTING TABLES (clean slate)
-- ============================================================
DROP TABLE IF EXISTS order_status_history CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS addresses CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Also drop old tables that may exist
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS wishlists CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS payment_refunds CASCADE;

-- ============================================================
-- USERS TABLE (optimized)
-- ============================================================
CREATE TABLE users (
  id               UUID PRIMARY KEY
                   DEFAULT uuid_generate_v4(),
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(255) NOT NULL UNIQUE,
  password_hash    VARCHAR(255),
  role             VARCHAR(20) NOT NULL DEFAULT 'customer'
                   CHECK (role IN ('customer','admin')),
  is_email_verified BOOLEAN DEFAULT false,
  is_active        BOOLEAN DEFAULT true,
  avatar_url       TEXT,
  phone            VARCHAR(20),
  google_id        VARCHAR(100),
  auth_provider    VARCHAR(20) DEFAULT 'local'
                   CHECK (auth_provider IN
                   ('local','google')),
  gender           VARCHAR(20),
  refresh_token    TEXT,
  last_login       TIMESTAMPTZ,
  login_count      INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER SESSIONS TABLE
-- ============================================================
CREATE TABLE user_sessions (
  id            UUID PRIMARY KEY
                DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL
                REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  device_type   VARCHAR(20),
  auth_provider VARCHAR(20) DEFAULT 'local',
  is_active     BOOLEAN DEFAULT true,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES TABLE
-- ============================================================
CREATE TABLE categories (
  id          UUID PRIMARY KEY
              DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  image_url   TEXT,
  parent_id   UUID REFERENCES categories(id)
              ON DELETE SET NULL,
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BRANDS TABLE
-- ============================================================
CREATE TABLE brands (
  id          UUID PRIMARY KEY
              DEFAULT uuid_generate_v4(),
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  logo_url    TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS TABLE
-- ============================================================
CREATE TABLE products (
  id              UUID PRIMARY KEY
                  DEFAULT uuid_generate_v4(),
  title           VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) NOT NULL UNIQUE,
  description     TEXT,
  category_id     UUID REFERENCES categories(id)
                  ON DELETE SET NULL,
  brand_id        UUID REFERENCES brands(id)
                  ON DELETE SET NULL,
  base_price      DECIMAL(10,2) NOT NULL,
  discount_price  DECIMAL(10,2),
  tax_percent     DECIMAL(5,2) DEFAULT 0,
  sku_prefix      VARCHAR(20),
  tags            TEXT[] DEFAULT '{}',
  images          TEXT[] DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  is_featured     BOOLEAN DEFAULT false,
  rating_avg      DECIMAL(3,2) DEFAULT 0,
  rating_count    INT DEFAULT 0,
  total_sold      INT DEFAULT 0,
  meta_title      VARCHAR(255),
  meta_description TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCT VARIANTS TABLE
-- ============================================================
CREATE TABLE product_variants (
  id               UUID PRIMARY KEY
                   DEFAULT uuid_generate_v4(),
  product_id       UUID NOT NULL
                   REFERENCES products(id)
                   ON DELETE CASCADE,
  sku              VARCHAR(100) NOT NULL UNIQUE,
  size             VARCHAR(20),
  color            VARCHAR(50),
  color_hex        VARCHAR(7),
  price_adjustment DECIMAL(10,2) DEFAULT 0,
  images           TEXT[] DEFAULT '{}',
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVENTORY TABLE
-- ============================================================
CREATE TABLE inventory (
  id          UUID PRIMARY KEY
              DEFAULT uuid_generate_v4(),
  variant_id  UUID NOT NULL UNIQUE
              REFERENCES product_variants(id)
              ON DELETE CASCADE,
  quantity    INT NOT NULL DEFAULT 0,
  reserved    INT NOT NULL DEFAULT 0,
  low_stock_threshold INT DEFAULT 10,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_qty CHECK (quantity >= 0),
  CONSTRAINT chk_reserved CHECK (reserved >= 0),
  CONSTRAINT chk_reserved_lte_qty
    CHECK (reserved <= quantity)
);

-- ============================================================
-- ADDRESSES TABLE (optimized)
-- ============================================================
CREATE TABLE addresses (
  id          UUID PRIMARY KEY
              DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL
              REFERENCES users(id)
              ON DELETE CASCADE,
  label       VARCHAR(50) DEFAULT 'Home'
              CHECK (label IN
              ('Home','Work','Other')),
  full_name   VARCHAR(100) NOT NULL,
  phone       VARCHAR(20) NOT NULL,
  line1       VARCHAR(255) NOT NULL,
  line2       VARCHAR(255),
  landmark    VARCHAR(255),
  city        VARCHAR(100) NOT NULL,
  state       VARCHAR(100) NOT NULL,
  pincode     VARCHAR(10) NOT NULL,
  country     VARCHAR(50) DEFAULT 'India',
  is_default  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COUPONS TABLE
-- ============================================================
CREATE TABLE coupons (
  id                  UUID PRIMARY KEY
                      DEFAULT uuid_generate_v4(),
  code                VARCHAR(50) NOT NULL UNIQUE,
  description         TEXT,
  type                VARCHAR(20) NOT NULL
                      CHECK (type IN
                      ('flat','percent',
                       'free_shipping')),
  value               DECIMAL(10,2) NOT NULL,
  min_order_amount    DECIMAL(10,2) DEFAULT 0,
  max_discount_amount DECIMAL(10,2),
  max_uses            INT,
  uses_count          INT DEFAULT 0,
  max_uses_per_user   INT DEFAULT 1,
  applicable_product_id UUID REFERENCES products(id),
  is_first_purchase_only BOOLEAN DEFAULT false,
  is_active           BOOLEAN DEFAULT true,
  starts_at           TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDERS TABLE
-- ============================================================
CREATE TABLE orders (
  id               UUID PRIMARY KEY
                   DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL
                   REFERENCES users(id),
  status           VARCHAR(30) NOT NULL
                   DEFAULT 'pending'
                   CHECK (status IN (
                   'pending','confirmed',
                   'processing','packed',
                   'shipped','out_for_delivery',
                   'delivered','cancelled',
                   'refunded')),
  address_snapshot JSONB NOT NULL,
  items_total      DECIMAL(10,2) NOT NULL,
  discount_amount  DECIMAL(10,2) DEFAULT 0,
  shipping_charge  DECIMAL(10,2) DEFAULT 0,
  tax_amount       DECIMAL(10,2) DEFAULT 0,
  total_amount     DECIMAL(10,2) NOT NULL,
  coupon_code      VARCHAR(50),
  payment_method   VARCHAR(20) NOT NULL
                   CHECK (payment_method IN
                   ('razorpay','cod')),
  payment_status   VARCHAR(20) DEFAULT 'pending'
                   CHECK (payment_status IN (
                   'pending','paid',
                   'failed','refunded')),
  notes            TEXT,
  cancel_reason    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDER ITEMS TABLE
-- ============================================================
CREATE TABLE order_items (
  id               UUID PRIMARY KEY
                   DEFAULT uuid_generate_v4(),
  order_id         UUID NOT NULL
                   REFERENCES orders(id)
                   ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id),
  variant_id       UUID REFERENCES
                   product_variants(id),
  product_snapshot JSONB NOT NULL,
  quantity         INT NOT NULL,
  price            DECIMAL(10,2) NOT NULL,
  CONSTRAINT chk_qty_positive
    CHECK (quantity > 0)
);

-- ============================================================
-- ORDER STATUS HISTORY TABLE
-- ============================================================
CREATE TABLE order_status_history (
  id         UUID PRIMARY KEY
             DEFAULT uuid_generate_v4(),
  order_id   UUID NOT NULL
             REFERENCES orders(id)
             ON DELETE CASCADE,
  status     VARCHAR(30) NOT NULL,
  note       TEXT,
  location   VARCHAR(255),
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS TABLE
-- ============================================================
CREATE TABLE payments (
  id                   UUID PRIMARY KEY
                       DEFAULT uuid_generate_v4(),
  order_id             UUID NOT NULL
                       REFERENCES orders(id),
  razorpay_order_id    VARCHAR(100),
  razorpay_payment_id  VARCHAR(100),
  razorpay_signature   VARCHAR(500),
  amount               DECIMAL(10,2) NOT NULL,
  currency             VARCHAR(10) DEFAULT 'INR',
  status               VARCHAR(20) DEFAULT 'pending'
                       CHECK (status IN (
                       'pending','captured',
                       'failed','refunded')),
  method               VARCHAR(50),
  error_code           VARCHAR(100),
  error_description    TEXT,
  refund_id            VARCHAR(100),
  refund_amount        DECIMAL(10,2),
  refunded_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REVIEWS TABLE
-- ============================================================
CREATE TABLE reviews (
  id          UUID PRIMARY KEY
              DEFAULT uuid_generate_v4(),
  product_id  UUID NOT NULL
              REFERENCES products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL
              REFERENCES users(id) ON DELETE CASCADE,
  rating      INT NOT NULL
              CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  status      VARCHAR(20) DEFAULT 'approved'
              CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, user_id) -- A user can only review a product once
);

-- ============================================================
-- ALL INDEXES FOR SPEED
-- ============================================================

-- users
CREATE UNIQUE INDEX idx_users_email
  ON users(LOWER(email));
CREATE INDEX idx_users_role
  ON users(role);
CREATE INDEX idx_users_google_id
  ON users(google_id)
  WHERE google_id IS NOT NULL;
CREATE INDEX idx_users_active
  ON users(is_active, role);

-- user_sessions
CREATE INDEX idx_sessions_user_id
  ON user_sessions(user_id);
CREATE INDEX idx_sessions_token
  ON user_sessions(session_token);
CREATE INDEX idx_sessions_active
  ON user_sessions(is_active, expires_at);

-- categories
CREATE INDEX idx_categories_slug
  ON categories(slug);
CREATE INDEX idx_categories_parent
  ON categories(parent_id);

-- products
CREATE INDEX idx_products_slug
  ON products(slug);
CREATE INDEX idx_products_category
  ON products(category_id);
CREATE INDEX idx_products_brand
  ON products(brand_id);
CREATE INDEX idx_products_active_featured
  ON products(is_active, is_featured);
CREATE INDEX idx_products_price
  ON products(discount_price)
  WHERE is_active = true;
CREATE INDEX idx_products_search
  ON products
  USING gin(to_tsvector('english',
  title || ' ' || COALESCE(description,'')));

-- product_variants
CREATE INDEX idx_variants_product
  ON product_variants(product_id);
CREATE INDEX idx_variants_sku
  ON product_variants(sku);

-- inventory
CREATE INDEX idx_inventory_variant
  ON inventory(variant_id);
CREATE INDEX idx_inventory_low_stock
  ON inventory(quantity)
  WHERE quantity <= low_stock_threshold;

-- addresses
CREATE INDEX idx_addresses_user
  ON addresses(user_id);
CREATE INDEX idx_addresses_default
  ON addresses(user_id, is_default)
  WHERE is_default = true;

-- coupons
CREATE UNIQUE INDEX idx_coupons_code
  ON coupons(UPPER(code));
CREATE INDEX idx_coupons_active
  ON coupons(is_active, expires_at);

-- orders
CREATE INDEX idx_orders_user
  ON orders(user_id);
CREATE INDEX idx_orders_status
  ON orders(status);
CREATE INDEX idx_orders_payment_status
  ON orders(payment_status);
CREATE INDEX idx_orders_created
  ON orders(created_at DESC);
CREATE INDEX idx_orders_user_status
  ON orders(user_id, status);

-- order_items
CREATE INDEX idx_order_items_order
  ON order_items(order_id);
CREATE INDEX idx_order_items_variant
  ON order_items(variant_id);

-- order_status_history
CREATE INDEX idx_osh_order
  ON order_status_history(order_id);
CREATE INDEX idx_osh_created
  ON order_status_history(created_at DESC);

-- payments
CREATE INDEX idx_payments_order
  ON payments(order_id);
CREATE UNIQUE INDEX idx_payments_rzp_order
  ON payments(razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX idx_payments_rzp_payment
  ON payments(razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX idx_payments_status
  ON payments(status);

-- reviews
CREATE INDEX idx_reviews_product
  ON reviews(product_id);
CREATE INDEX idx_reviews_user
  ON reviews(user_id);
CREATE INDEX idx_reviews_status
  ON reviews(status);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Admin user (placeholder hash - will be overwritten by migrate.js)
INSERT INTO users (
  id, name, email, password_hash,
  role, is_email_verified, is_active, auth_provider
) VALUES (
  uuid_generate_v4(),
  'Zenwair Admin',
  'admin@zenwair.com',
  '$2b$12$placeholder',
  'admin', true, true, 'local'
) ON CONFLICT (email) DO NOTHING;

-- Categories
INSERT INTO categories
  (id, name, slug, sort_order, is_active)
VALUES
  (uuid_generate_v4(),'Men','men',1,true),
  (uuid_generate_v4(),'Women','women',2,true),
  (uuid_generate_v4(),'Kids','kids',3,true),
  (uuid_generate_v4(),'Footwear','footwear',4,true),
  (uuid_generate_v4(),'Sports','sports',5,true),
  (uuid_generate_v4(),'Accessories','accessories',6,true)
ON CONFLICT (slug) DO NOTHING;

-- Brands
INSERT INTO brands
  (id, name, slug, is_active)
VALUES
  (uuid_generate_v4(),'Zenwair Originals','zenwair-originals',true),
  (uuid_generate_v4(),'Urban Threads','urban-threads',true),
  (uuid_generate_v4(),'Desi Drip','desi-drip',true),
  (uuid_generate_v4(),'Peak Athletics','peak-athletics',true)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_inventory_updated_at ON inventory;
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_reviews_updated_at ON reviews;
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Function to auto-update rating_avg and rating_count on products table
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
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

DROP TRIGGER IF EXISTS trg_update_product_rating ON reviews;
CREATE TRIGGER trg_update_product_rating 
AFTER INSERT OR UPDATE OR DELETE ON reviews 
FOR EACH ROW EXECUTE FUNCTION update_product_rating();

-- GRANT privileges
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO zenwair_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO zenwair_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO zenwair_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO zenwair_user;