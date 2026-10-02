import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getShopDetails } from '@/lib/shopify'
import { getValidAccessToken, ShopifyConnectionError } from '@/lib/shopify-custom-app'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolved to the org owner — this table is keyed by the owner's user_id,
  // and the RLS-bound client used to query by the caller's own id, finding
  // nothing for any non-owner teammate.
  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: rows } = await service
    .from('stores')
    .select('shopify_domain, shopify_access_token, shopify_connection_type, shopify_client_id, shopify_client_secret_enc, shopify_access_token_enc, shopify_token_expires_at, id, shop_name')
    .eq('user_id', ownerId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)

  const store = rows?.[0]

  if (!store?.shopify_domain) {
    return NextResponse.json({ connected: false, error: 'No Shopify store connected' })
  }

  try {
    const token = store.shopify_connection_type === 'custom_app'
      ? await getValidAccessToken(store)
      : store.shopify_access_token

    if (!token) {
      return NextResponse.json({ connected: false, error: 'No Shopify store connected' })
    }

    const details = await getShopDetails(store.shopify_domain, token) as {
      name: string; plan_name?: string; email?: string; myshopify_domain?: string
    }
    return NextResponse.json({
      connected:   true,
      shop_name:   details.name,
      shop_domain: store.shopify_domain,
      plan:        details.plan_name ?? null,
    })
  } catch (err) {
    const message = err instanceof ShopifyConnectionError ? err.message : String(err)
    console.error('[Shopify test-connection] error:', message)
    return NextResponse.json({
      connected: false,
      error: 'Could not reach Shopify — token may be invalid or store may have been uninstalled',
    })
  }
}
