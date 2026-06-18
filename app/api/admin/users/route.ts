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
  const authUsers: { id: string; email: string; created_at: string; email_confirmed_at: string | null }[] = []
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
      authUsers.push({
        id:                 u.id,
        email:              u.email ?? '',
        created_at:         u.created_at,
        email_confirmed_at: u.email_confirmed_at ?? null,
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
  ] = await Promise.all([
    service.from('user_profiles').select('*'),
    service.from('stores').select('id,user_id,shopify_domain,shop_name,plan,is_active,created_at,whatsapp_bsp,whatsapp_number'),
    service.from('automations').select('store_id,is_enabled'),
    service.from('messages').select('store_id,created_at').gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    service.from('billing').select('user_id,plan_name,status,amount_paise,messages_used,messages_limit,razorpay_subscription_id,next_billing_date,cancelled_at'),
    service.from('organizations').select('id', { count: 'exact', head: true }),
  ])

  // ── Lookups ───────────────────────────────────────────────────────────────
  type ProfileRow  = { id: string; full_name: string | null; company_name: string | null; phone: string | null; team_size: string | null; email: string | null }
  type StoreRow    = { id: string; user_id: string; shopify_domain: string | null; shop_name: string | null; plan: string | null; is_active: boolean; created_at: string; whatsapp_bsp: string | null; whatsapp_number: string | null }
  type BillingRow  = { user_id: string; plan_name: string | null; status: string | null; amount_paise: number; messages_used: number; messages_limit: number; razorpay_subscription_id: string | null; next_billing_date: string | null; cancelled_at: string | null }

  const profileById: Record<string, ProfileRow>  = {}
  for (const p of (profiles ?? []) as ProfileRow[]) profileById[p.id] = p

  const storeByUser: Record<string, StoreRow> = {}
  for (const s of (stores ?? []) as StoreRow[]) { if (s.user_id) storeByUser[s.user_id] = s }

  const billingByUser: Record<string, BillingRow> = {}
  for (const b of (billingRows ?? []) as BillingRow[]) { if (b.user_id) billingByUser[b.user_id] = b }

  const autoCountByStore: Record<string, number> = {}
  for (const a of automations ?? []) if (a.is_enabled) autoCountByStore[a.store_id] = (autoCountByStore[a.store_id] ?? 0) + 1

  const msgCountByStore: Record<string, number> = {}
  for (const m of messages ?? []) msgCountByStore[m.store_id] = (msgCountByStore[m.store_id] ?? 0) + 1

  // ── Merge every auth user ─────────────────────────────────────────────────
  const users = authUsers.map(au => {
    const p       = profileById[au.id]
    const store   = storeByUser[au.id]
    const billing = billingByUser[au.id]
    return {
      id:                    au.id,
      email:                 au.email,
      email_confirmed:       !!au.email_confirmed_at,
      signed_up_at:          au.created_at,
      full_name:             p?.full_name  ?? null,
      company_name:          p?.company_name ?? null,
      phone:                 p?.phone ?? null,
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
      billing_amount:        billing?.amount_paise ?? 0,
      messages_used:         billing?.messages_used ?? 0,
      messages_limit:        billing?.messages_limit ?? 0,
      has_subscription:      !!(billing?.razorpay_subscription_id),
      razorpay_sub_id:       billing?.razorpay_subscription_id ?? null,
      next_billing_date:     billing?.next_billing_date ?? null,
      cancelled_at:          billing?.cancelled_at ?? null,
    }
  }).sort((a, b) => new Date(b.signed_up_at).getTime() - new Date(a.signed_up_at).getTime())

  // ── Stats ─────────────────────────────────────────────────────────────────
  const weekAgo      = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const activeSubs   = (billingRows ?? []).filter((b: { status: string | null }) => b.status === 'active')
  const mrr          = activeSubs.reduce((s: number, b: { amount_paise: number }) => s + (b.amount_paise ?? 0), 0) / 100

  const stats = {
    total_signups:        users.length,
    new_this_week:        users.filter(u => u.signed_up_at > weekAgo).length,
    email_confirmed:      users.filter(u => u.email_confirmed).length,
    stores_connected:     users.filter(u => u.store_domain).length,
    total_messages_30d:   users.reduce((a, u) => a + u.messages_30d, 0),
    active_subscriptions: activeSubs.length,
    mrr_inr:              mrr,
    organizations:        orgCount ?? 0,
  }

  return NextResponse.json({ users, stats })
}
