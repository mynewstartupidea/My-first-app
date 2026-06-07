import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'vaibhavsingh9574395@gmail.com'

export async function GET() {
  // Verify the caller is the admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use service client to bypass RLS
  const service = createServiceClient()

  // Get all user profiles
  const { data: profiles } = await service
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // Get all stores (to show which users connected a store)
  const { data: stores } = await service
    .from('stores')
    .select('user_id, shopify_domain, shop_name, plan, is_active, created_at, whatsapp_bsp')

  // Get automation counts per store
  const { data: automations } = await service
    .from('automations')
    .select('store_id, is_enabled')

  // Get message counts per store (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: messages } = await service
    .from('messages')
    .select('store_id, created_at')
    .gte('created_at', thirtyDaysAgo)

  // Billing / subscription data
  const { data: billingRows } = await service
    .from('billing')
    .select('user_id, plan_name, status, amount_paise, messages_used, messages_limit, razorpay_subscription_id')

  // Organizations count
  const { count: orgCount } = await service
    .from('organizations')
    .select('id', { count: 'exact', head: true })

  type StoreRow = { user_id: string; shopify_domain: string; shop_name: string | null; plan: string | null; is_active: boolean; created_at: string; whatsapp_bsp: string | null }
  type BillingRow = { user_id: string; plan_name: string; status: string; amount_paise: number; messages_used: number; messages_limit: number; razorpay_subscription_id: string | null }

  // Build a lookup: user_id → store
  const storeByUser: Record<string, StoreRow> = {}
  for (const s of (stores ?? []) as StoreRow[]) {
    if (s.user_id) storeByUser[s.user_id] = s
  }

  // Build a lookup: user_id → billing
  const billingByUser: Record<string, BillingRow> = {}
  for (const b of (billingRows ?? []) as BillingRow[]) {
    if (b.user_id) billingByUser[b.user_id] = b
  }

  // Build store_id → automation count
  const autoCountByStore: Record<string, number> = {}
  for (const a of automations ?? []) {
    if (a.is_enabled) autoCountByStore[a.store_id] = (autoCountByStore[a.store_id] ?? 0) + 1
  }

  // Build store_id → message count (30d)
  const msgCountByStore: Record<string, number> = {}
  for (const m of messages ?? []) {
    msgCountByStore[m.store_id] = (msgCountByStore[m.store_id] ?? 0) + 1
  }

  // Merge into user rows
  const users = (profiles ?? []).map(p => {
    const store   = storeByUser[p.id]
    const billing = billingByUser[p.id]
    return {
      id:             p.id,
      full_name:      p.full_name,
      company_name:   p.company_name,
      phone:          p.phone,
      team_size:      p.team_size,
      email:          p.email,
      signed_up_at:   p.created_at,
      store_domain:   store?.shopify_domain ?? null,
      store_name:     store?.shop_name ?? null,
      store_plan:     store?.plan ?? null,
      store_active:   store?.is_active ?? false,
      store_connected_at: store?.created_at ?? null,
      whatsapp_bsp:   store?.whatsapp_bsp ?? null,
      active_automations: store ? (autoCountByStore[store.user_id] ?? 0) : 0,
      messages_30d:   store ? (msgCountByStore[store.user_id] ?? 0) : 0,
      billing_plan:   billing?.plan_name ?? null,
      billing_status: billing?.status ?? null,
      billing_amount: billing?.amount_paise ?? 0,
      has_subscription: !!(billing?.razorpay_subscription_id),
    }
  })

  // Summary stats
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const activeBilling = (billingRows ?? []).filter((b: { status: string }) => b.status === 'active')
  const mrr = activeBilling.reduce((sum: number, b: { amount_paise: number }) => sum + (b.amount_paise ?? 0), 0)
  const stats = {
    total_signups:       users.length,
    new_this_week:       users.filter(u => u.signed_up_at > weekAgo).length,
    stores_connected:    users.filter(u => u.store_domain).length,
    total_messages_30d:  Object.values(msgCountByStore).reduce((a, b) => a + b, 0),
    active_subscriptions: activeBilling.length,
    mrr_paise:           mrr,
    mrr_inr:             mrr / 100,
    organizations:       orgCount ?? 0,
  }

  return NextResponse.json({ users, stats })
}
