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

-- ─── Expand automations type check constraint ────────────────────────────────
-- Original constraint only had 4 types. UI has 8: post_purchase_upsell,
-- win_back, review_request, repeat_purchase were added but not in live DB.

ALTER TABLE automations DROP CONSTRAINT IF EXISTS automations_type_check;
ALTER TABLE automations ADD CONSTRAINT automations_type_check
  CHECK (type IN ('abandoned_cart','cod_verification','order_confirmation','shipping_update',
                  'post_purchase_upsell','win_back','review_request','repeat_purchase'));

-- ─── Expand campaigns audience check constraint ───────────────────────────────
-- Add vip, repeat_buyers, first_time audience values that were missing from the
-- original CHECK constraint but are used by the campaign builder UI.

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_audience_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_audience_check
  CHECK (audience IN ('all','opted_in','inactive_30','inactive_60','inactive_90','vip','repeat_buyers','first_time'));

-- ─── Shopify Billing ─────────────────────────────────────────────────────────
-- Add shopify_subscription_id to billing table for Shopify App Store billing.

ALTER TABLE billing ADD COLUMN IF NOT EXISTS shopify_subscription_id TEXT;

-- Register app_subscriptions/update as a valid webhook topic
-- (no schema change needed — topic is stored in the webhook registration call)

-- ─── increment_analytics_by: atomic revenue/count increment by arbitrary amount ──
-- Used by the orders/create webhook to attribute revenue atomically without
-- the read-then-write race condition in the original upsert pattern.

CREATE OR REPLACE FUNCTION increment_analytics_by(
  p_store_id UUID,
  p_date     DATE,
  p_field    TEXT,
  p_amount   NUMERIC
)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO analytics_daily (store_id, date)
  VALUES (p_store_id, p_date)
  ON CONFLICT (store_id, date) DO NOTHING;

  EXECUTE format(
    'UPDATE analytics_daily SET %I = COALESCE(%I, 0) + $3 WHERE store_id = $1 AND date = $2',
    p_field, p_field
  )
  USING p_store_id, p_date, p_amount;
END;
$$;

-- ─── WhatsApp account health columns ─────────────────────────────────────────
-- Added by sidebar health badge + webhook handler for phone_number_quality_update.

ALTER TABLE whatsapp_accounts
  ADD COLUMN IF NOT EXISTS quality_rating        TEXT DEFAULT 'GREEN',
  ADD COLUMN IF NOT EXISTS messaging_limit_tier  TEXT DEFAULT 'TIER_1K',
  ADD COLUMN IF NOT EXISTS account_mode          TEXT DEFAULT 'LIVE';

-- ─── Missed call follow-up automation setting ─────────────────────────────────
-- Added by Automations page MissedCallCard toggle.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS missed_call_followup_enabled BOOLEAN DEFAULT false;

-- ─── Lead distribution settings ───────────────────────────────────────────────
-- Stored on organizations. mode controls how new leads are assigned to team.
-- distribution_members: ordered JSON array [{ user_id, weight }] for rr/weighted.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS lead_distribution_mode TEXT DEFAULT 'manual'
    CHECK (lead_distribution_mode IN ('manual','open_pool','round_robin','weighted')),
  ADD COLUMN IF NOT EXISTS rr_current_pos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distribution_members JSONB DEFAULT '[]'::jsonb;

-- ─── Ad source attribution on leads ──────────────────────────────────────────
-- Facebook Lead Ads returns ad/adset/campaign info per lead — store for attribution.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS ad_name       TEXT,
  ADD COLUMN IF NOT EXISTS adset_name    TEXT,
  ADD COLUMN IF NOT EXISTS campaign_name TEXT;

-- ─── API key for landing page lead ingest ────────────────────────────────────
-- Stores a random key per workspace used to authenticate POST /api/leads/ingest.
-- Generated on first visit to the Developer page; rotatable by the user.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS stores_api_key_idx ON stores(api_key) WHERE api_key IS NOT NULL;

-- ─── Qualifying chatbot flow ──────────────────────────────────────────────────
-- Ordered follow-up questions asked automatically once a lead first replies on
-- WhatsApp (replying opens the 24h session window, so these send as freeform
-- text — no approved template needed). Configured per lead-ad form.

ALTER TABLE lead_form_automations
  ADD COLUMN IF NOT EXISTS qualifying_questions JSONB DEFAULT '[]'::jsonb;

-- One row per lead, tracking how far through the question list they've gotten.
CREATE TABLE IF NOT EXISTS lead_qualifying_progress (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id        UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL UNIQUE,
  store_id       UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  phone          TEXT NOT NULL,
  question_index INTEGER DEFAULT 0,
  answers        JSONB DEFAULT '[]'::jsonb,
  status         TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE lead_qualifying_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qualifying_progress_own" ON lead_qualifying_progress FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS lead_qualifying_progress_store_phone_idx
  ON lead_qualifying_progress(store_id, phone, status);

-- ─── WhatsApp Coexistence ───────────────────────────────────────────────────
-- connection_mode distinguishes a normal Cloud-API-only number from one that
-- stays active in the merchant's WhatsApp Business mobile app while also
-- connected here (Coexistence). Drives which webhook fields/UI apply.

ALTER TABLE whatsapp_accounts
  ADD COLUMN IF NOT EXISTS connection_mode TEXT DEFAULT 'cloud_api'
    CHECK (connection_mode IN ('cloud_api', 'coexistence'));

-- Meta requires "session logging" for Coexistence: the Embedded Signup popup
-- posts window.postMessage events (FINISH/CANCEL/ERROR) independently of the
-- FB.login() callback, and they can arrive out of order or not at all if the
-- callback fires first. Logging both sides here lets us debug a failed signup
-- without asking the merchant to reproduce it.
CREATE TABLE IF NOT EXISTS meta_signup_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type   TEXT NOT NULL,   -- e.g. FINISH, FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING, CANCEL, ERROR
  session_id   TEXT,
  data         JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE meta_signup_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_signup_events_own" ON meta_signup_events FOR ALL USING (user_id = auth.uid());

-- ─── Facebook Lead Ads: page selection ───────────────────────────────────────
-- The classic OAuth dialog used for Facebook Page connect has no native page
-- picker (unlike the config_id-based flow used for WhatsApp) — it just grants
-- access to every Page the user administers. Previously every returned page
-- was auto-connected and auto-subscribed to lead sync with no way to choose.
-- Newly discovered pages now land as 'pending' until the merchant picks which
-- ones to actually activate; existing connections default to 'active' so
-- nothing already working is disrupted by this migration.

ALTER TABLE facebook_connections
  ADD COLUMN IF NOT EXISTS selection_status TEXT DEFAULT 'active'
    CHECK (selection_status IN ('pending', 'active'));

-- ─── Leads: scope facebook_lead_id uniqueness per account ────────────────────
-- facebook_lead_id was unique GLOBALLY across the whole table, not scoped to
-- user_id. When two different Wapaci accounts both had access to the same
-- real Facebook Page (e.g. shared ad-agency access, or — as found here — two
-- of the same person's own test accounts), the second account's Lead Ads
-- sync silently wrote zero rows: ON CONFLICT DO NOTHING treated every lead as
-- already existing, because Postgres saw a row with that facebook_lead_id
-- under the OTHER account. The UI still reported "N leads synced" the whole
-- time, since that count came from Facebook's API response, not from what
-- actually got written to this account's rows. Affects every ingestion path:
-- manual sync, the real-time webhook, CSV import, form-automation activation,
-- and the sync cron — all shared the same single-column constraint.

DO $$
DECLARE
  c_name TEXT;
BEGIN
  SELECT tc.constraint_name INTO c_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.table_name = ccu.table_name
  WHERE tc.table_name = 'leads'
    AND tc.constraint_type = 'UNIQUE'
    AND ccu.column_name = 'facebook_lead_id'
  GROUP BY tc.constraint_name
  HAVING COUNT(*) = 1
  LIMIT 1;

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE leads DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS leads_user_facebook_lead_id_idx ON leads (user_id, facebook_lead_id);
