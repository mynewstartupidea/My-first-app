import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'vaibhavsin9574395@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden', debug: { logged_in_as: user?.email ?? 'not logged in' } }, { status: 403 })
  }

  const service = createServiceClient()

  // ── Fetch ALL auth users (not just those with a profile row) ─────────────
  const authUsers: {
    id: string; email: string; created_at: string; email_confirmed_at: string | null
    meta_phone: string | null; meta_full_name: string | null; meta_company: string | null
    meta_utm_source: string | null; meta_utm_medium: string | null; meta_utm_campaign: string | null
    meta_utm_term: string | null; meta_utm_content: string | null
  }[] = []
  let page = 1
  while (true) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) {
      return NextResponse.json({
        error:  'auth.admin.listUsers failed',
        detail: error.message,
        hint:   'SUPABASE_SERVICE_ROLE_KEY may be missing or wrong in Vercel env vars',
        users:  [],
        stats:  null,
      }, { status: 500 })
    }
    if (!data?.users?.length) break
    for (const u of data.users) {
      const meta = (u.user_metadata ?? {}) as Record<string, string>
      authUsers.push({
        id:                 u.id,
        email:              u.email ?? '',
        created_at:         u.created_at,
        email_confirmed_at: u.email_confirmed_at ?? null,
        meta_phone:         meta.phone        ?? null,
        meta_full_name:     meta.full_name    ?? null,
        meta_company:       meta.company_name ?? null,
        // Only ever set for someone who signed up through /signup (the
        // landing-page-conversion path below has its own, more reliable
        // source instead) — captured from whatever UTM query string was on
        // the link they clicked (app/signup/page.tsx's getUtmParams() call).
        meta_utm_source:    meta.utm_source   ?? null,
        meta_utm_medium:    meta.utm_medium   ?? null,
        meta_utm_campaign:  meta.utm_campaign ?? null,
        meta_utm_term:      meta.utm_term     ?? null,
        meta_utm_content:   meta.utm_content  ?? null,
      })
    }
    if (data.users.length < 1000) break
    page++
  }

  // ── Supporting tables ─────────────────────────────────────────────────────
  const [
    { data: profiles },
    { data: stores },
    { data: automations },
    { data: messages },
    { data: billingRows },
    { count: orgCount },
    { data: convertedLeads },
  ] = await Promise.all([
    service.from('user_profiles').select('*'),
    service.from('stores').select('id,user_id,shopify_domain,shop_name,plan,is_active,created_at,whatsapp_bsp,whatsapp_number'),
    service.from('automations').select('store_id,is_enabled'),
    service.from('messages').select('store_id,created_at').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    service.from('billing').select('user_id,plan_name,status,billing_provider,amount_paise,messages_used,messages_limit,next_billing_date,cancelled_at,shopify_subscription_id'),
    service.from('organizations').select('id', { count: 'exact', head: true }),
    // Richer and more reliable than the auth user_metadata UTM fields above
    // for anyone who came through /lp/leads or /lp/ecommerce — captured
    // server-side at lead-submission time (app/api/landing/subscribe), not
    // dependent on what made it into the auth signup call.
    service.from('landing_leads').select('converted_user_id,source,utm_source,utm_medium,utm_campaign,utm_term,utm_content').not('converted_user_id', 'is', null),
  ])

  // ── Lookups ───────────────────────────────────────────────────────────────
  type ProfileRow  = { id: string; full_name: string | null; company_name: string | null; phone: string | null; team_size: string | null; email: string | null }
  type StoreRow    = { id: string; user_id: string; shopify_domain: string | null; shop_name: string | null; plan: string | null; is_active: boolean; created_at: string; whatsapp_bsp: string | null; whatsapp_number: string | null }
  type BillingRow  = { user_id: string; plan_name: string | null; status: string | null; billing_provider: string | null; amount_paise: number; messages_used: number; messages_limit: number; next_billing_date: string | null; cancelled_at: string | null; shopify_subscription_id: string | null }

  const profileById: Record<string, ProfileRow>  = {}
  for (const p of (profiles ?? []) as ProfileRow[]) profileById[p.id] = p

  const storeByUser: Record<string, StoreRow> = {}
  for (const s of (stores ?? []) as StoreRow[]) { if (s.user_id) storeByUser[s.user_id] = s }

  const billingByUser: Record<string, BillingRow> = {}
  for (const b of (billingRows ?? []) as BillingRow[]) { if (b.user_id) billingByUser[b.user_id] = b }

  type LeadAttribution = { source: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null; utm_term: string | null; utm_content: string | null }
  const leadAttrByUser: Record<string, LeadAttribution> = {}
  for (const l of (convertedLeads ?? []) as (LeadAttribution & { converted_user_id: string })[]) {
    leadAttrByUser[l.converted_user_id] = l
  }

  const autoCountByStore: Record<string, number> = {}
  for (const a of automations ?? []) if (a.is_enabled) autoCountByStore[a.store_id] = (autoCountByStore[a.store_id] ?? 0) + 1

  const msgCountByStore: Record<string, number> = {}
  for (const m of messages ?? []) msgCountByStore[m.store_id] = (msgCountByStore[m.store_id] ?? 0) + 1

  // ── Merge every auth user ─────────────────────────────────────────────────
  const users = authUsers.map(au => {
    const p       = profileById[au.id]
    const store   = storeByUser[au.id]
    const billing = billingByUser[au.id]
    // Prefer the landing_leads attribution (richer, server-captured at the
    // moment they submitted the lead form) over what made it into the
    // signup's own user_metadata; fall back to "direct" only when NEITHER
    // path captured anything — no UTM on the link they used, and they
    // didn't come through a landing page's payment form at all.
    const leadAttr = leadAttrByUser[au.id]
    const attribution = leadAttr ? {
      source:       leadAttr.source,
      utm_source:   leadAttr.utm_source,
      utm_medium:   leadAttr.utm_medium,
      utm_campaign: leadAttr.utm_campaign,
      utm_term:     leadAttr.utm_term,
      utm_content:  leadAttr.utm_content,
    } : (au.meta_utm_source || au.meta_utm_medium || au.meta_utm_campaign || au.meta_utm_content) ? {
      source:       'homepage',
      utm_source:   au.meta_utm_source,
      utm_medium:   au.meta_utm_medium,
      utm_campaign: au.meta_utm_campaign,
      utm_term:     au.meta_utm_term,
      utm_content:  au.meta_utm_content,
    } : {
      source: 'direct', utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null,
    }
    return {
      ...attribution,
      id:                    au.id,
      email:                 au.email,
      email_confirmed:       !!au.email_confirmed_at,
      signed_up_at:          au.created_at,
      full_name:             p?.full_name    ?? au.meta_full_name ?? null,
      company_name:          p?.company_name ?? au.meta_company   ?? null,
      phone:                 p?.phone        ?? au.meta_phone     ?? null,
      team_size:             p?.team_size ?? null,
      store_domain:          store?.shopify_domain ?? null,
      store_name:            store?.shop_name ?? null,
      store_active:          store?.is_active ?? false,
      whatsapp_bsp:          store?.whatsapp_bsp ?? null,
      whatsapp_number:       store?.whatsapp_number ?? null,
      active_automations:    store ? (autoCountByStore[store.id] ?? 0) : 0,
      messages_30d:          store ? (msgCountByStore[store.id] ?? 0) : 0,
      billing_plan:          billing?.plan_name ?? null,
      billing_status:        billing?.status ?? null,
      billing_provider:      billing?.billing_provider ?? null,
      billing_amount:        billing?.amount_paise ?? 0,
      messages_used:         billing?.messages_used ?? 0,
      messages_limit:        billing?.messages_limit ?? 0,
      has_subscription:         billing?.status === 'active' || billing?.status === 'trialing',
      shopify_subscription_id:  billing?.shopify_subscription_id ?? null,
      next_billing_date:        billing?.next_billing_date ?? null,
      cancelled_at:             billing?.cancelled_at ?? null,
    }
  }).sort((a, b) => new Date(b.signed_up_at).getTime() - new Date(a.signed_up_at).getTime())

  // ── Stats ─────────────────────────────────────────────────────────────────
  // Shopify App Store subscriptions are genuinely billed in USD (Shopify's
  // own Billing API, see lib/shopify-billing.ts — these prices are its
  // actual source of truth, not a guess); the homepage/landing-page flow
  // bills in INR via Razorpay (billing.amount_paise, real paise from the
  // actual charge). These used to be summed into one "mrr_inr" number with
  // no conversion — $29 (Shopify) + ₹7,999 (Razorpay) became "36,028" with
  // no unit, displayed with a single $ sign that was wrong for most of it.
  // Kept as two honest, separate totals instead of one blended, meaningless
  // number — there is no single correct exchange rate to collapse them
  // into on the fly, and silently picking one would just trade one wrong
  // number for a different wrong number.
  const SHOPIFY_PLAN_USD: Record<string, number> = { starter: 29, growth: 49, scale: 99, enterprise: 299 }
  const weekAgo    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const activeSubs = (billingRows ?? []).filter((b: { status: string | null }) => b.status === 'active' || b.status === 'trialing')
  const mrrInr = activeSubs
    .filter((b: { billing_provider: string | null }) => b.billing_provider !== 'shopify')
    .reduce((s: number, b: { amount_paise: number }) => s + (b.amount_paise ?? 0) / 100, 0)
  const mrrUsd = activeSubs
    .filter((b: { billing_provider: string | null }) => b.billing_provider === 'shopify')
    .reduce((s: number, b: { plan_name: string | null }) => s + (SHOPIFY_PLAN_USD[b.plan_name ?? ''] ?? 0), 0)

  const stats = {
    total_signups:        users.length,
    new_this_week:        users.filter(u => u.signed_up_at > weekAgo).length,
    email_confirmed:      users.filter(u => u.email_confirmed).length,
    stores_connected:     users.filter(u => u.store_domain).length,
    total_messages_30d:   users.reduce((a, u) => a + u.messages_30d, 0),
    active_subscriptions: activeSubs.length,
    mrr_inr:              mrrInr,
    mrr_usd:              mrrUsd,
    organizations:        orgCount ?? 0,
  }

  return NextResponse.json({ users, stats })
}
