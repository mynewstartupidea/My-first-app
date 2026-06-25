-- ─────────────────────────────────────────
-- Wapaci  –  Supabase Schema
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  owner_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan       TEXT DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orgs_own" ON organizations FOR ALL USING (owner_id = auth.uid());

-- Team members
CREATE TABLE IF NOT EXISTS team_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','active')),
  invited_at      TIMESTAMPTZ DEFAULT NOW(),
  joined_at       TIMESTAMPTZ
);
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_org_own" ON team_members FOR ALL USING (
  organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid())
  OR user_id = auth.uid()
);

-- Stores
CREATE TABLE IF NOT EXISTS stores (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id      UUID REFERENCES organizations(id),
  shopify_domain       TEXT UNIQUE,
  shopify_access_token TEXT,
  shop_name           TEXT,
  shop_email          TEXT,
  currency            TEXT DEFAULT 'INR',
  whatsapp_number     TEXT,
  whatsapp_bsp        TEXT DEFAULT 'mock',
  whatsapp_api_key    TEXT,
  is_active           BOOLEAN DEFAULT true,
  plan                TEXT DEFAULT 'starter',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Automations
CREATE TABLE IF NOT EXISTS automations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('abandoned_cart','cod_verification','order_confirmation','shipping_update','post_purchase_upsell','win_back','review_request','repeat_purchase')),
  is_enabled       BOOLEAN DEFAULT false,
  delay_minutes    INTEGER DEFAULT 30,
  template         TEXT NOT NULL,
  discount_enabled BOOLEAN DEFAULT false,
  discount_value   INTEGER DEFAULT 10,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, type)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  shopify_customer_id  TEXT,
  name                 TEXT,
  phone                TEXT NOT NULL,
  email                TEXT,
  whatsapp_opt_in      BOOLEAN DEFAULT true,
  total_orders         INTEGER DEFAULT 0,
  total_spent          DECIMAL(12,2) DEFAULT 0,
  last_order_at        TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, phone)
);

-- Scheduled automation jobs
CREATE TABLE IF NOT EXISTS automation_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id         UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  automation_id    UUID REFERENCES automations(id) ON DELETE SET NULL,
  type             TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,
  customer_name    TEXT,
  message          TEXT NOT NULL,
  context          JSONB DEFAULT '{}',
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','cancelled')),
  scheduled_at     TIMESTAMPTZ NOT NULL,
  sent_at          TIMESTAMPTZ,
  error_message    TEXT,
  retry_count      INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Message delivery log
CREATE TABLE IF NOT EXISTS messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  job_id              UUID REFERENCES automation_jobs(id) ON DELETE SET NULL,
  customer_phone      TEXT NOT NULL,
  customer_name       TEXT,
  type                TEXT NOT NULL,
  message             TEXT NOT NULL,
  status              TEXT DEFAULT 'sent',
  bsp_message_id      TEXT,
  revenue_attributed  DECIMAL(12,2) DEFAULT 0,
  metadata            JSONB DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (extra signup fields)
CREATE TABLE IF NOT EXISTS user_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT,
  company_name TEXT,
  phone        TEXT,
  team_size    TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON user_profiles FOR ALL USING (id = auth.uid());

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  message         TEXT NOT NULL DEFAULT '',
  audience        TEXT NOT NULL DEFAULT 'opted_in' CHECK (audience IN ('all','opted_in','inactive_30','inactive_60','inactive_90','vip','repeat_buyers','first_time')),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','running','completed','failed')),
  scheduled_at    TIMESTAMPTZ,
  sent_count      INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Daily analytics
CREATE TABLE IF NOT EXISTS analytics_daily (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  date              DATE NOT NULL,
  messages_sent     INTEGER DEFAULT 0,
  messages_delivered INTEGER DEFAULT 0,
  carts_recovered   INTEGER DEFAULT 0,
  revenue_recovered DECIMAL(12,2) DEFAULT 0,
  cod_verified      INTEGER DEFAULT 0,
  cod_cancelled     INTEGER DEFAULT 0,
  UNIQUE(store_id, date)
);

-- ─── Row Level Security ───────────────────

ALTER TABLE stores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_jobs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily  ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stores_own"      ON stores           FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "automations_own" ON automations      FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "customers_own"   ON customers        FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "jobs_own"        ON automation_jobs  FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "messages_own"    ON messages         FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "analytics_own"   ON analytics_daily  FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "campaigns_own"   ON campaigns        FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Service role bypass for cron/webhooks (no RLS needed when using service_role key)

-- ─── Default automations helper function ───
CREATE OR REPLACE FUNCTION create_default_automations(p_store_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO automations (store_id, type, is_enabled, delay_minutes, template) VALUES
  (
    p_store_id, 'abandoned_cart', false, 30,
    'Hi {{name}}! 👋 You left something in your cart at {{shop_name}}. Your items are waiting for you! Complete your purchase here: {{cart_url}}{{#discount}} Use code {{discount_code}} for {{discount_value}}% off!{{/discount}}'
  ),
  (
    p_store_id, 'cod_verification', false, 5,
    'Hi {{name}}! Your order #{{order_number}} for ₹{{amount}} has been placed at {{shop_name}}. Please reply YES to confirm your COD order or NO to cancel. Thank you!'
  ),
  (
    p_store_id, 'order_confirmation', false, 0,
    'Hi {{name}}! 🎉 Your order #{{order_number}} is confirmed at {{shop_name}}. We will notify you once it ships. Track your order: {{order_url}}'
  ),
  (
    p_store_id, 'shipping_update', false, 0,
    'Hi {{name}}! 📦 Your order #{{order_number}} from {{shop_name}} has been shipped! Track it here: {{tracking_url}}'
  )
  ON CONFLICT (store_id, type) DO NOTHING;
END;
$$;

-- Increment analytics helper (called by cron)
CREATE OR REPLACE FUNCTION increment_analytics(p_store_id UUID, p_date DATE, p_field TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO analytics_daily (store_id, date)
  VALUES (p_store_id, p_date)
  ON CONFLICT (store_id, date) DO NOTHING;

  EXECUTE format('UPDATE analytics_daily SET %I = %I + 1 WHERE store_id = $1 AND date = $2', p_field, p_field)
  USING p_store_id, p_date;
END;
$$;
