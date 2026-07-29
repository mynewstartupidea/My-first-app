import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { syncShopifyCustomers } from '@/lib/shopify'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: store } = await service
    .from('stores')
    .select('id, shopify_domain, shopify_access_token')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .not('shopify_domain', 'is', null)
    .not('shopify_access_token', 'is', null)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!store) {
    return NextResponse.json({ error: 'No Shopify store connected' }, { status: 400 })
  }

  try {
    // Sync up to 2 500 customers (10 pages × 250) on manual trigger
    const result = await syncShopifyCustomers(
      store.shopify_domain,
      store.shopify_access_token,
      store.id,
      service,
      10,
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[sync-customers] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
