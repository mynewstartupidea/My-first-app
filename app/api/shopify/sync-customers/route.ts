import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { syncShopifyCustomers } from '@/lib/shopify'
import { getValidAccessToken, ShopifyConnectionError } from '@/lib/shopify-custom-app'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolved to the org owner — stores is keyed by the owner's user_id, a
  // teammate querying by their own id found nothing.
  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: store } = await service
    .from('stores')
    .select('id, shopify_domain, shopify_access_token, shopify_connection_type, shopify_client_id, shopify_client_secret_enc, shopify_access_token_enc, shopify_token_expires_at')
    .eq('user_id', ownerId)
    .eq('is_active', true)
    .not('shopify_domain', 'is', null)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!store) {
    return NextResponse.json({ error: 'No Shopify store connected' }, { status: 400 })
  }

  try {
    const token = store.shopify_connection_type === 'custom_app'
      ? await getValidAccessToken(store)
      : store.shopify_access_token

    if (!token) {
      return NextResponse.json({ error: 'No Shopify store connected' }, { status: 400 })
    }

    // Sync up to 2 500 customers (10 pages × 250) on manual trigger
    const result = await syncShopifyCustomers(
      store.shopify_domain,
      token,
      store.id,
      service,
      10,
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof ShopifyConnectionError ? err.message : String(err)
    console.error('[sync-customers] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
