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

-- ─── Leads: multi-source ──────────────────────────────────────────────────────
-- Every lead was implicitly Facebook-shaped (facebook_lead_id, page_id, form_id
-- as its identity). Adds a generic source so walk-ins, referrals, channel
-- partners, and landing-page submissions (already possible via
-- /api/leads/ingest but never tagged) can coexist with Facebook Lead Ads leads.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'facebook_lead_ad'
    CHECK (source IN ('facebook_lead_ad', 'landing_page', 'walk_in', 'referral', 'channel_partner', 'manual', 'other'));

-- Backfill: anything without a facebook_lead_id was already only reachable via
-- the generic ingest endpoint, which today only ever produces landing-page leads.
UPDATE leads SET source = 'landing_page' WHERE facebook_lead_id IS NULL AND source = 'facebook_lead_ad';

-- ─── AI Knowledge Base + WhatsApp auto-reply ─────────────────────────────────
-- Free-text business context (services, pricing, policies, FAQs) fed to the AI
-- as its only source of truth when auto-replying to inbound WhatsApp messages.
-- ai_reply_enabled is the on/off switch surfaced on the Live Chat page; the API
-- route refuses to turn it on until this knowledge base actually has content,
-- so the AI is never replying with nothing to ground itself on.

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS ai_reply_enabled BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL UNIQUE,
  content    TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_kb_own" ON ai_knowledge_base FOR ALL USING (
  store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())
);

-- ─── Landing page lead capture + Razorpay subscription ───────────────────────
-- Public marketing pages (app/lp/*) submit here before any payment happens —
-- so the row exists to call/follow up on even if the customer never completes
-- checkout. No RLS policies on purpose: the public submit route and the admin
-- read route both use the service-role client (bypasses RLS), and there is no
-- "owning user" yet since these are pre-signup prospects — RLS enabled with
-- zero policies default-denies the anon/authenticated roles outright.

CREATE TABLE IF NOT EXISTS landing_leads (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL,
  company_name              TEXT,
  phone                     TEXT NOT NULL,
  email                     TEXT NOT NULL,
  source                    TEXT DEFAULT 'lp_leads',
  razorpay_customer_id      TEXT,
  razorpay_subscription_id  TEXT,
  payment_status            TEXT NOT NULL DEFAULT 'pending'
                              CHECK (payment_status IN ('pending', 'authenticated', 'active', 'failed', 'cancelled')),
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE landing_leads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS landing_leads_created_idx ON landing_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS landing_leads_subscription_idx ON landing_leads(razorpay_subscription_id) WHERE razorpay_subscription_id IS NOT NULL;

-- Caches Plan IDs created via Razorpay's API (table already existed, unused
-- until now) so a redeploy or cold start doesn't create a duplicate Plan in
-- the Razorpay dashboard every time — lib/razorpay.ts looks here first.

-- ─── Billing: fix a silently-failing upgrade/downgrade flow ───────────────────
-- app/api/billing/razorpay/create/route.ts was upserting status='pending' on
-- every plan change — 'pending' was never in this CHECK constraint, so that
-- upsert has been failing on every single upgrade/downgrade attempt (confirmed
-- live against production: a probe upsert with status='pending' threw
-- "violates check constraint billing_status_check", and zero existing rows
-- have ever had status='pending'). The Razorpay subscription itself got
-- created either way, but the billing row never recorded it, so the webhook
-- had nothing to match against when payment later completed.
--
-- Also adds separate "pending change" columns so a plan change can be
-- recorded BEFORE the new Razorpay subscription is actually paid for,
-- without touching the still-valid currently-active subscription — the old
-- code cancelled the old subscription and overwrote plan_name/messages_limit
-- immediately on creating the new (unpaid) one, so abandoning the Razorpay
-- checkout popup left the account with no working subscription at all.
ALTER TABLE billing DROP CONSTRAINT IF EXISTS billing_status_check;
ALTER TABLE billing ADD CONSTRAINT billing_status_check
  CHECK (status IN ('trialing','active','cancelled','past_due','expired','pending'));

ALTER TABLE billing
  ADD COLUMN IF NOT EXISTS pending_razorpay_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS pending_plan_name                 TEXT,
  ADD COLUMN IF NOT EXISTS pending_messages_limit             INTEGER,
  ADD COLUMN IF NOT EXISTS previous_razorpay_subscription_id TEXT;

-- ─── Meta webhook: close the dedupe race, not just the sequential-retry case ──
-- app/api/meta/webhook/route.ts already checked "does a row with this
-- message_id exist?" before inserting, which handles Meta's sequential
-- webhook retries fine, but not two deliveries landing concurrently — both
-- can pass that SELECT before either INSERT commits, double-processing one
-- customer message through the qualifying flow and the AI auto-reply. A real
-- unique constraint + upsert(...ignoreDuplicates) makes the check atomic.
-- A plain UNIQUE constraint (not a partial index) is deliberate here: Postgres
-- treats every NULL as distinct under standard UNIQUE, so rows with no
-- message_id (some coexistence/history inbound rows) still coexist freely —
-- and PostgREST's upsert(onConflict: 'message_id') needs a plain constraint
-- to infer as its arbiter; a partial index needs a matching WHERE clause it
-- doesn't send.
ALTER TABLE inbound_messages
  DROP CONSTRAINT IF EXISTS inbound_messages_message_id_key;
ALTER TABLE inbound_messages
  ADD CONSTRAINT inbound_messages_message_id_key UNIQUE (message_id);

-- ─── Shopify: merchant custom-app connection (client credentials grant) ──────
-- Shopify's public-app review kept rejecting the OAuth-based app (that flow,
-- lib/shopify.ts + app/api/shopify/callback, is left fully intact and
-- dormant). The replacement: each merchant creates their OWN custom app via
-- Shopify's dev dashboard (no App Store review needed) and gives Wapaci
-- shop domain + client id + client secret. Wapaci exchanges those for an
-- access token via Shopify's client-credentials grant (POST
-- /admin/oauth/access_token, grant_type=client_credentials) — see
-- lib/shopify-custom-app.ts. shopify_connection_type is how every route
-- tells the two flows apart; legacy rows default to 'oauth_app' and keep
-- using the existing plaintext shopify_access_token column untouched.
-- Client secret and access token are encrypted at rest (lib/encryption.ts,
-- AES-256-GCM) — the first encrypted-at-rest columns in this schema; nothing
-- else is retrofitted.
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS shopify_connection_type TEXT DEFAULT 'oauth_app'
    CHECK (shopify_connection_type IN ('oauth_app','custom_app')),
  ADD COLUMN IF NOT EXISTS shopify_client_id         TEXT,
  ADD COLUMN IF NOT EXISTS shopify_client_secret_enc  TEXT,
  ADD COLUMN IF NOT EXISTS shopify_access_token_enc   TEXT,
  ADD COLUMN IF NOT EXISTS shopify_token_expires_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shopify_granted_scopes     TEXT[];

-- ─── Shopify: data mirror tables (orders/products/inventory/locations/      ──
-- ─── abandoned checkouts/returns/discounts) + background sync job queue ────
-- Phase 2-4 of the custom-app connection work above. Every resource table
-- follows the same shape as `customers.shopify_customer_id`: a
-- UNIQUE(store_id, shopify_*_id) so sync writes are plain upserts, safe to
-- re-run, and never create duplicates on retry.
--
-- shopify_sync_jobs is the background-sync queue — same optimistic-lock
-- claiming pattern as `automation_jobs` (status='pending' -> conditional
-- UPDATE to 'processing'), polled by app/api/cron/shopify-sync. Each cron
-- tick processes ONE PAGE per job (not a whole resource) so a single
-- invocation can never run past Vercel's 60s function ceiling regardless of
-- how large a store's order history is — a job just re-queues itself with
-- its next page cursor until done. This is deliberately REST-pagination
-- based, not Shopify's GraphQL Bulk Operations API — simpler to operate and
-- sufficient at the page-per-tick cadence; revisit only if a merchant's
-- historical backfill is too large to finish in a reasonable number of
-- cron ticks.

CREATE TABLE IF NOT EXISTS shopify_locations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  shopify_location_id TEXT NOT NULL,
  name                TEXT,
  address1            TEXT,
  city                TEXT,
  province            TEXT,
  country             TEXT,
  active              BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, shopify_location_id)
);

CREATE TABLE IF NOT EXISTS shopify_products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  shopify_product_id  TEXT NOT NULL,
  title               TEXT,
  vendor              TEXT,
  product_type        TEXT,
  status              TEXT,
  tags                TEXT,
  image_url           TEXT,
  shopify_created_at  TIMESTAMPTZ,
  shopify_updated_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, shopify_product_id)
);

CREATE TABLE IF NOT EXISTS shopify_product_variants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  product_id           UUID REFERENCES shopify_products(id) ON DELETE CASCADE NOT NULL,
  shopify_variant_id   TEXT NOT NULL,
  shopify_product_id   TEXT NOT NULL,
  title                TEXT,
  sku                  TEXT,
  price                NUMERIC,
  compare_at_price     NUMERIC,
  inventory_item_id    TEXT,
  inventory_quantity   INTEGER,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, shopify_variant_id)
);

CREATE TABLE IF NOT EXISTS shopify_orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  customer_id          UUID REFERENCES customers(id) ON DELETE SET NULL,
  shopify_order_id     TEXT NOT NULL,
  order_number         TEXT,
  email                TEXT,
  phone                TEXT,
  currency             TEXT,
  total_price          NUMERIC,
  subtotal_price       NUMERIC,
  total_tax            NUMERIC,
  total_discounts      NUMERIC,
  total_refunded       NUMERIC DEFAULT 0,
  financial_status     TEXT,
  fulfillment_status   TEXT,
  tracking_number      TEXT,
  tracking_url         TEXT,
  cancelled_at         TIMESTAMPTZ,
  tags                 TEXT,
  note                 TEXT,
  shopify_created_at   TIMESTAMPTZ,
  shopify_updated_at   TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, shopify_order_id)
);

CREATE TABLE IF NOT EXISTS shopify_order_line_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID REFERENCES shopify_orders(id) ON DELETE CASCADE NOT NULL,
  shopify_line_item_id  TEXT NOT NULL,
  shopify_product_id    TEXT,
  shopify_variant_id    TEXT,
  title                 TEXT,
  variant_title         TEXT,
  sku                   TEXT,
  quantity              INTEGER,
  price                 NUMERIC,
  UNIQUE (order_id, shopify_line_item_id)
);

CREATE TABLE IF NOT EXISTS shopify_inventory_levels (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  inventory_item_id    TEXT NOT NULL,
  shopify_location_id  TEXT NOT NULL,
  available            INTEGER,
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, inventory_item_id, shopify_location_id)
);

CREATE TABLE IF NOT EXISTS shopify_abandoned_checkouts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  customer_id          UUID REFERENCES customers(id) ON DELETE SET NULL,
  shopify_checkout_id  TEXT NOT NULL,
  email                TEXT,
  phone                TEXT,
  total_price          NUMERIC,
  currency             TEXT,
  recovery_url         TEXT,
  line_items           JSONB DEFAULT '[]'::jsonb,
  abandoned_at         TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, shopify_checkout_id)
);

CREATE TABLE IF NOT EXISTS shopify_returns (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  order_id             UUID REFERENCES shopify_orders(id) ON DELETE SET NULL,
  shopify_return_id    TEXT NOT NULL,
  status               TEXT,
  total_quantity       INTEGER,
  requested_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, shopify_return_id)
);

CREATE TABLE IF NOT EXISTS shopify_discounts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id             UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  shopify_discount_id  TEXT NOT NULL,
  title                TEXT,
  code                 TEXT,
  discount_type        TEXT,
  value                TEXT,
  status               TEXT,
  starts_at            TIMESTAMPTZ,
  ends_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, shopify_discount_id)
);

CREATE TABLE IF NOT EXISTS shopify_sync_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  resource        TEXT NOT NULL CHECK (resource IN (
                     'orders','products','inventory','locations',
                     'abandoned_checkouts','discounts','returns'
                   )),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  page_info       TEXT,
  attempts        INTEGER DEFAULT 0,
  records_synced  INTEGER DEFAULT 0,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS shopify_sync_jobs_claim_idx ON shopify_sync_jobs(status, created_at);

ALTER TABLE shopify_locations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_product_variants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_order_line_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_inventory_levels     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_abandoned_checkouts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_returns              ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_discounts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_sync_jobs            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shopify_locations_own" ON shopify_locations FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "shopify_products_own" ON shopify_products FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "shopify_product_variants_own" ON shopify_product_variants FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "shopify_orders_own" ON shopify_orders FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "shopify_order_line_items_own" ON shopify_order_line_items FOR ALL
  USING (order_id IN (SELECT id FROM shopify_orders WHERE store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())));
CREATE POLICY "shopify_inventory_levels_own" ON shopify_inventory_levels FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "shopify_abandoned_checkouts_own" ON shopify_abandoned_checkouts FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "shopify_returns_own" ON shopify_returns FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "shopify_discounts_own" ON shopify_discounts FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "shopify_sync_jobs_own" ON shopify_sync_jobs FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- ─── increment_customer_order_stats: atomic customer stats update ────────────
-- handleOrderCreate (app/api/shopify/webhooks) used to read total_orders/
-- total_spent, add to them in application code, then write the result back
-- — classic read-then-write race: two orders for the same customer landing
-- within the same window can both read the same baseline and one write
-- clobbers the other, silently losing an order from that customer's count.
-- At low volume this is rare; at 10k orders/day it becomes a real,
-- occasionally-occurring data-correctness bug. A single INSERT ... ON
-- CONFLICT DO UPDATE is atomic at the row level, so this can't happen.
CREATE OR REPLACE FUNCTION increment_customer_order_stats(
  p_store_id    UUID,
  p_phone       TEXT,
  p_name        TEXT,
  p_email       TEXT,
  p_order_value NUMERIC
)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
  v_id UUID;
BEGIN
  -- whatsapp_opt_in = true in the DO UPDATE SET (removed below) used to
  -- unconditionally re-opt-in every existing customer on their next order,
  -- silently undoing an explicit opt-out that app/api/cron/campaign-send
  -- sets when WhatsApp reports a number as invalid/unregistered -- wasting
  -- a future send attempt (and quota) on a number already known to be dead.
  -- It only belongs in the INSERT branch now, for a genuinely new customer.
  INSERT INTO customers (store_id, phone, name, email, whatsapp_opt_in, total_orders, total_spent, last_order_at)
  VALUES (p_store_id, p_phone, p_name, NULLIF(p_email, ''), true, 1, p_order_value, NOW())
  ON CONFLICT (store_id, phone) DO UPDATE SET
    total_orders    = customers.total_orders + 1,
    total_spent     = customers.total_spent + p_order_value,
    last_order_at   = NOW(),
    name            = COALESCE(customers.name, EXCLUDED.name),
    email           = COALESCE(customers.email, EXCLUDED.email)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ─── Campaign sending: recipient queue, replaces the old one-shot loop ───────
-- app/api/campaigns/send used to fetch up to 1000 matching customers and
-- send to all of them sequentially inside one request — anything beyond
-- 1000 silently never got messaged, and because the message/opt-in log was
-- only written in one batch AFTER the whole loop finished, a timeout partway
-- through (easy to hit well under 1000 recipients at real WhatsApp API
-- latency) meant messages that were actually sent (and billed) had zero
-- record of ever happening. campaign_recipients snapshots the full audience
-- (no cap) when a campaign launches; app/api/cron/campaign-send processes
-- it in batches, writing each result immediately, so a timeout or restart
-- loses at most the in-flight message, not the whole campaign's history.
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id    UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  customer_id    UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  phone          TEXT NOT NULL,
  name           TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','skipped')),
  error_message  TEXT,
  bsp_message_id TEXT,
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (campaign_id, customer_id)
);
CREATE INDEX IF NOT EXISTS campaign_recipients_pending_idx ON campaign_recipients(campaign_id, status);

ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "campaign_recipients_own" ON campaign_recipients FOR ALL
  USING (campaign_id IN (
    SELECT id FROM campaigns WHERE store_id IN (SELECT id FROM stores WHERE user_id = auth.uid())
  ));

-- ─── try_increment_messages_used: atomic quota-checked increment ────────────
-- Two independent crons (app/api/cron/route.ts for automations,
-- app/api/cron/campaign-send for campaigns) can run in overlapping windows
-- for the SAME owner. Both used to separately call get_messages_remaining
-- once per invocation, cache it in local memory, and decrement that local
-- copy as they sent -- classic check-then-act race: if both read "10
-- remaining" before either persists anything, both can send up to 10
-- messages each, 20 total against a 10-message quota. This does the
-- check and the increment as one atomic, row-locked operation, so a second
-- concurrent caller for the same owner genuinely waits for the first's
-- write instead of working off a stale read. Returns false (and does NOT
-- increment) once the limit is reached.
CREATE OR REPLACE FUNCTION try_increment_messages_used(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_rows INTEGER;
BEGIN
  INSERT INTO billing (user_id, messages_used, messages_limit, updated_at)
  VALUES (p_user_id, 0, 500, NOW())
  ON CONFLICT (user_id) DO NOTHING;

  -- Row lock held until this transaction (the RPC call) commits — a second
  -- concurrent call for the same user_id blocks here until the first's
  -- UPDATE below is visible, eliminating the read/write race entirely.
  PERFORM 1 FROM billing WHERE user_id = p_user_id FOR UPDATE;

  UPDATE billing
  SET messages_used = COALESCE(messages_used, 0) + 1, updated_at = NOW()
  WHERE user_id = p_user_id AND COALESCE(messages_used, 0) < COALESCE(messages_limit, 500);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- ─── campaign_recipients: attempts column for retryable-error backoff ───────
-- WhatsApp rate-limit/service errors (lib/whatsapp.ts's own error messages
-- literally say "— will retry") were being marked 'failed' permanently with
-- no actual retry anywhere — a campaign hitting Meta's throughput limit
-- partway through just silently dropped the rest of that batch forever.
ALTER TABLE campaign_recipients
  ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0;

-- ─── decrement_messages_used: best-effort refund for try_increment_messages_used ──
-- campaign-send spends a quota unit atomically before attempting a send
-- (so the check-and-spend itself can't race); if the send then fails, this
-- refunds that unit rather than charging quota for a message that was
-- never actually delivered. Floored at 0 — never goes negative.
CREATE OR REPLACE FUNCTION decrement_messages_used(p_user_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE billing
  SET messages_used = GREATEST(0, COALESCE(messages_used, 0) - 1), updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;

-- ─── automation_jobs: updated_at for stuck-'processing' reclaim ─────────────
-- This table had no updated_at at all (only created_at/scheduled_at/
-- sent_at), so there was no way to tell "when was this job claimed into
-- processing" -- needed to reclaim a job orphaned by a hard-killed
-- function (same gap already fixed for shopify_sync_jobs). scheduled_at
-- can't substitute: it's set once at insert time and doesn't change when
-- a job is claimed, so filtering on it would misfire on jobs that were
-- simply scheduled a while ago but are still genuinely in progress.
ALTER TABLE automation_jobs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ─── advance_round_robin_position: atomic read-and-advance for lead assignment ──
-- lib/facebook-sync.ts used to read organizations.rr_current_pos once at the
-- start of a sync run, advance it in local app-code variables across every
-- batch of leads processed, and write the final value back once at the very
-- end -- classic read-then-write race: two syncs for the same org running
-- concurrently (a manual "Sync now" click landing alongside the scheduled
-- cron, for example) both read the same starting position and could assign
-- two different new leads to the same rep instead of rotating, with
-- whichever final write lands last silently discarding the other run's
-- progress. This does the read-and-advance as one atomic, row-locked
-- operation and returns the position to start assigning THIS batch from.
CREATE OR REPLACE FUNCTION advance_round_robin_position(p_org_id UUID, p_count INTEGER, p_member_count INTEGER)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_start_pos INTEGER;
BEGIN
  IF p_member_count <= 0 THEN RETURN 0; END IF;

  -- Row lock held until this transaction commits — a second concurrent call
  -- for the same org_id blocks here until the first's UPDATE is visible.
  SELECT COALESCE(rr_current_pos, 0) INTO v_start_pos FROM organizations WHERE id = p_org_id FOR UPDATE;

  UPDATE organizations
  SET rr_current_pos = (v_start_pos + p_count) % p_member_count
  WHERE id = p_org_id;

  RETURN v_start_pos % p_member_count;
END;
$$;
