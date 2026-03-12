-- =============================================
-- ZENWAIR — Database Optimization Script
-- Performance indexes + UUID defaults
-- Wrapped in exception handlers for safety
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- All operations wrapped in DO blocks with exception handling
-- so script completes even without table ownership
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'users', 'orders', 'order_items', 'order_status_history',
    'payments', 'addresses', 'coupons', 'products',
    'product_variants', 'inventory'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN id SET DEFAULT uuid_generate_v4()', tbl);
      RAISE NOTICE 'Set UUID default for %', tbl;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped ALTER on %: %', tbl, SQLERRM;
    END;
  END LOOP;
END $$;

-- Create indexes (wrapped in DO block for permission safety)
DO $$
BEGIN
  -- orders table
  BEGIN CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;

  -- order_items table
  BEGIN CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;

  -- order_status_history table
  BEGIN CREATE INDEX IF NOT EXISTS idx_osh_order_id ON order_status_history(order_id); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_osh_created_at ON order_status_history(created_at DESC); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;

  -- payments table
  BEGIN CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON payments(razorpay_payment_id); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;

  -- users table
  BEGIN CREATE INDEX IF NOT EXISTS idx_users_email ON users(email); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_users_role ON users(role); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;

  -- products table
  BEGIN CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;

  -- inventory table
  BEGIN CREATE INDEX IF NOT EXISTS idx_inventory_variant_id ON inventory(variant_id); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;

  -- addresses table
  BEGIN CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;

  -- coupons table
  BEGIN CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(UPPER(code)); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active, expires_at); EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;

  -- Partial indexes
  BEGIN CREATE INDEX IF NOT EXISTS idx_active_products ON products(id) WHERE is_active = true; EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_pending_orders ON orders(created_at DESC) WHERE status = 'pending'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;
  BEGIN CREATE INDEX IF NOT EXISTS idx_unpaid_payments ON payments(order_id) WHERE status = 'pending'; EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM; END;

  RAISE NOTICE 'Index creation completed';
END $$;

-- ANALYZE (best effort)
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY['users','orders','order_items','payments','order_status_history','products','inventory'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ANALYZE %I', tbl);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped ANALYZE on %: %', tbl, SQLERRM;
    END;
  END LOOP;
END $$;
