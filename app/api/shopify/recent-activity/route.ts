import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

// GET /api/shopify/recent-activity — recent abandoned checkouts + orders for
// the connected store, for the read-only preview on the Integrations page.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: store } = await service
    .from('stores')
    .select('id')
    .eq('user_id', ownerId)
    .eq('is_active', true)
    .not('shopify_domain', 'is', null)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!store) return NextResponse.json({ checkouts: [], orders: [] })

  const [{ data: checkouts }, { data: orders }] = await Promise.all([
    service
      .from('shopify_abandoned_checkouts')
      .select('id, email, phone, total_price, currency, recovery_url, abandoned_at, completed_at')
      .eq('store_id', store.id)
      .is('completed_at', null)
      .order('abandoned_at', { ascending: false })
      .limit(10),
    service
      .from('shopify_orders')
      .select('id, order_number, email, phone, total_price, currency, financial_status, fulfillment_status, shopify_created_at')
      .eq('store_id', store.id)
      .order('shopify_created_at', { ascending: false })
      .limit(10),
  ])

  return NextResponse.json({ checkouts: checkouts ?? [], orders: orders ?? [] })
}
