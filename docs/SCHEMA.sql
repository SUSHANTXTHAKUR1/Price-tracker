-- =========================================================================
-- SUPABASE DATABASE SCHEMA & POLICIES
-- Mock Storefront - Product Search & Scheduled Price Tracker
-- =========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TRACKED PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS tracked_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    selected_option TEXT NOT NULL,
    selected_option_label TEXT NOT NULL,
    target_url TEXT NOT NULL,
    category TEXT,
    brand TEXT,
    sku TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_scraped_at TIMESTAMPTZ,
    last_price NUMERIC,
    last_stock INTEGER,
    last_status TEXT DEFAULT 'pending', -- 'pending', 'success', 'retried', 'failed'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_product_id, selected_option)
);

-- 2. PRICE & STOCK HISTORY TABLE
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracked_product_id UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
    store_product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    selected_option TEXT NOT NULL,
    price NUMERIC NOT NULL,
    mrp NUMERIC,
    stock INTEGER NOT NULL,
    currency TEXT DEFAULT 'INR',
    rating NUMERIC,
    seller TEXT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SCRAPE ATTEMPTS & AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS scrape_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tracked_product_id UUID REFERENCES tracked_products(id) ON DELETE SET NULL,
    store_product_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    selected_option TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(), -- ISO 8601 UTC
    price NUMERIC,                       -- Left NULL on failed attempts per spec
    stock INTEGER,                       -- Left NULL on failed attempts per spec
    outcome TEXT NOT NULL,               -- 'success', 'retried', 'failed'
    attempt_count INTEGER DEFAULT 1,
    duration_ms INTEGER,
    http_status INTEGER,
    error_message TEXT,
    scraper_type TEXT DEFAULT 'http_engine' -- 'http_engine' or 'playwright_headed'
);

-- INDEXES FOR FAST QUERYING AND SORTING
CREATE INDEX IF NOT EXISTS idx_tracked_products_active ON tracked_products(is_active);
CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(tracked_product_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_timestamp ON scrape_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_product ON scrape_logs(tracked_product_id, timestamp DESC);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Allows API access via Anon key or Service Role key
-- =========================================================================
ALTER TABLE tracked_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access on tracked_products" ON tracked_products;
CREATE POLICY "Public access on tracked_products" ON tracked_products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access on price_history" ON price_history;
CREATE POLICY "Public access on price_history" ON price_history FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access on scrape_logs" ON scrape_logs;
CREATE POLICY "Public access on scrape_logs" ON scrape_logs FOR ALL USING (true) WITH CHECK (true);

-- TRIGGER FOR UPDATING `updated_at` ON tracked_products
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_tracked_products_updated_at ON tracked_products;
CREATE TRIGGER set_tracked_products_updated_at
BEFORE UPDATE ON tracked_products
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();
