-- ─────────────────────────────────────────────────────────────────────────────
-- Wapaci — Additional Migrations
-- Run AFTER schema.sql in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Billing ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  store_id                  UUID REFERENCES stores(id) ON DELETE SET NULL,
  plan_name                 TEXT DEFAULT 'trial',
  status                    TEXT DEFAULT 'trialing' CHECK (status IN ('trialing','active','cancelled','past_due','expired')),
  billing_provider          TEXT DEFAULT 'razorpay',
  razorpay_customer_id      TEXT,
  razorpay_subscription_id  TEXT,
  razorpay_plan_id          TEXT,
  amount_paise              INTEGER DEFAULT 0,
  messages_limit            INTEGER DEFAULT 500,
  messages_used             INTEGER DEFAULT 0,
  current_period_start      TIMESTAMPTZ,
  current_period_end        TIMESTAMPTZ,
  next_billing_date         TIMESTAMPTZ,
  cancelled_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_own" ON billing FOR ALL USING (user_id = auth.uid());

-- ─── Razorpay Plans cache ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS razorpay_plans (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT NOT NULL UNIQUE,
  plan_id   TEXT NOT NULL,
  amount    INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── WhatsApp Accounts ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  store_id             UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_id          TEXT,
  waba_id              TEXT,
  phone_number_id      TEXT,
  display_phone_number TEXT,
  access_token         TEXT,
  token_expires_at     TIMESTAMPTZ,
  status               TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected','connected','error')),
  provider             TEXT DEFAULT 'meta' CHECK (provider IN ('meta','interakt','gupshup','mock')),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE whatsapp_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_accounts_own" ON whatsapp_accounts FOR ALL USING (user_id = auth.uid());

-- ─── Template Library ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  body          TEXT NOT NULL,
  category      TEXT DEFAULT 'custom' CHECK (category IN ('abandoned_cart','cod_verification','order_confirmation','shipping_update','win_back','review_request','post_purchase','welcome','campaign','custom')),
  variables     TEXT[] DEFAULT '{}',
  is_builtin    BOOLEAN DEFAULT false,
  is_favorite   BOOLEAN DEFAULT false,
  is_archived   BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_own" ON templates FOR ALL USING (user_id = auth.uid());

-- ─── Inbound Messages ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inbound_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE,
  waba_id         TEXT,
  from_phone      TEXT NOT NULL,
  to_phone        TEXT,
  message_id      TEXT,
  message_type    TEXT DEFAULT 'text',
  body            TEXT,
  status          TEXT DEFAULT 'received',
  raw_payload     JSONB DEFAULT '{}',
  received_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE inbound_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inbound_own" ON inbound_messages FOR ALL USING (
  store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())
);

-- ─── RPC: increment_messages_used ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_messages_used(p_user_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO billing (user_id, messages_used, messages_limit, updated_at)
  VALUES (p_user_id, 1, 500, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    messages_used = COALESCE(billing.messages_used, 0) + 1,
    updated_at = NOW();
END;
$$;

-- ─── RPC: get_messages_remaining ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_messages_remaining(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_limit INTEGER;
  v_used  INTEGER;
BEGIN
  SELECT COALESCE(messages_limit, 500), COALESCE(messages_used, 0)
  INTO v_limit, v_used
  FROM billing
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN RETURN 500; END IF;
  RETURN GREATEST(0, v_limit - v_used);
END;
$$;

-- ─── Update analytics to include per-type counts ──────────────────────────────

ALTER TABLE analytics_daily
  ADD COLUMN IF NOT EXISTS messages_read         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS messages_failed        INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orders_confirmed       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_updates_sent  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_requests_sent   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS upsells_sent           INTEGER DEFAULT 0;

-- ─── Update increment_analytics to handle new fields ─────────────────────────

CREATE OR REPLACE FUNCTION increment_analytics(p_store_id UUID, p_date DATE, p_field TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO analytics_daily (store_id, date)
  VALUES (p_store_id, p_date)
  ON CONFLICT (store_id, date) DO NOTHING;

  EXECUTE format('UPDATE analytics_daily SET %I = COALESCE(%I, 0) + 1 WHERE store_id = $1 AND date = $2', p_field, p_field)
  USING p_store_id, p_date;
END;
$$;

-- ─── Service role policies for cron/webhooks ──────────────────────────────────
-- These allow the service role (used by cron and webhook handlers) to read/write
-- without hitting RLS. The service_role key bypasses RLS automatically in Supabase,
-- so no explicit policy is needed — this comment documents the intent.

-- ─── Update team_members to support more roles ────────────────────────────────

ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_role_check;

ALTER TABLE team_members
  ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('owner','admin','manager','support','member'));

-- ─── Store: add platform, connected_at, product_count columns ────────────────

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS platform      TEXT DEFAULT 'shopify' CHECK (platform IN ('shopify','woocommerce','magento','custom')),
  ADD COLUMN IF NOT EXISTS store_domain  TEXT,
  ADD COLUMN IF NOT EXISTS connected_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS product_count INTEGER DEFAULT 0;

-- ─── One-time cleanup: deactivate orphaned mock stores ───────────────────────
-- If a user has both a mock store (shopify_domain IS NULL) and a real Shopify
-- store (shopify_domain IS NOT NULL), deactivate the mock store so UI queries
-- return the correct connected store.

WITH shopify_users AS (
  SELECT DISTINCT user_id FROM stores
  WHERE shopify_domain IS NOT NULL AND is_active = true
)
UPDATE stores
SET is_active = false, updated_at = NOW()
WHERE is_active = true
  AND shopify_domain IS NULL
  AND user_id IN (SELECT user_id FROM shopify_users);

-- ─── WhatsApp accounts: UNIQUE constraint on user_id ─────────────────────────
-- Required for upsert with onConflict: 'user_id' in the Meta OAuth callback.
-- Without this the upsert silently inserts duplicates instead of updating.

ALTER TABLE whatsapp_accounts
  ADD CONSTRAINT IF NOT EXISTS whatsapp_accounts_user_id_unique UNIQUE (user_id);

-- ─── WhatsApp accounts: token_type column ─────────────────────────────────────
-- Tracks whether this merchant's send token is a 60-day user access token
-- (default from Embedded Signup) or a permanent System User access token.
-- system_user_token = META_SYSTEM_USER_ACCESS_TOKEN env var was set and the
-- platform System User was successfully assigned to the merchant's WABA.

ALTER TABLE whatsapp_accounts
  ADD COLUMN IF NOT EXISTS token_type TEXT DEFAULT 'user_token'
    CHECK (token_type IN ('user_token', 'system_user_token'));

-- ─── Support Tickets ──────────────────────────────────────────────────────────
-- User-submitted help / support queries accessible in the admin panel.

CREATE TABLE IF NOT EXISTS support_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email  TEXT NOT NULL,
  subject     TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general'
                CHECK (category IN ('general','billing','whatsapp','campaigns','shopify','bug','other')),
  message     TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low','normal','high','urgent')),
  status      TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','resolved','closed')),
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can read/insert their own tickets only
CREATE POLICY "support_tickets_own_read"   ON support_tickets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "support_tickets_own_insert" ON support_tickets FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx  ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx   ON support_tickets(status);
CREATE INDEX IF NOT EXISTS support_tickets_created_idx  ON support_tickets(created_at DESC);

-- ─── Campaigns: add read_count + revenue_attributed columns ──────────────────
-- Queried in dashboard/analytics pages but missing from original schema.

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS read_count        INTEGER     DEFAULT 0;
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS revenue_attributed DECIMAL(12,2) DEFAULT 0;

-- ─── Team members: add invited_by column ─────────────────────────────────────
-- team/invite API inserts invited_by; must exist in the table.

ALTER TABLE team_members
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id);

-- Fix role constraint to include manager and support roles used by the invite API
ALTER TABLE team_members
  DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE team_members
  ADD CONSTRAINT team_members_role_check
    CHECK (role IN ('owner','admin','manager','support','member'));

-- ─── Cancellation feedback table ─────────────────────────────────────────────
-- billing/cancel API writes churn feedback here (best-effort).

CREATE TABLE IF NOT EXISTS cancellation_feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason     TEXT NOT NULL,
  detail     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cancellation_feedback ENABLE ROW LEVEL SECURITY;
-- Only the service role writes here; no user-facing reads needed
CREATE POLICY "cancel_feedback_insert" ON cancellation_feedback FOR INSERT WITH CHECK (user_id = auth.uid());
