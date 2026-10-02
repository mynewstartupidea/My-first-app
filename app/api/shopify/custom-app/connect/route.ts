import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getUserRole } from '@/lib/get-user-role'
import { pickPreferredStore } from '@/lib/store-selection'
import { validateShopDomain, syncShopifyCustomers } from '@/lib/shopify'
import { encrypt } from '@/lib/encryption'
import {
  requestAccessToken,
  validateMissingScopes,
  testGraphQLConnection,
  REQUIRED_SCOPES,
  ShopifyConnectionError,
} from '@/lib/shopify-custom-app'

// POST /api/shopify/custom-app/connect — connects a merchant's own
// Shopify custom app (created via their dev dashboard) using the client
// credentials grant, instead of the public-app OAuth flow in
// app/api/shopify/callback/route.ts (kept intact, untouched, dormant).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false, error: 'UNAUTHORIZED' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json(
      { connected: false, error: 'FORBIDDEN', message: 'Only the account owner or an admin can connect a store.' },
      { status: 403 },
    )
  }

  const body = await request.json().catch(() => ({})) as {
    shop?: string
    clientId?: string
    clientSecret?: string
  }

  let shop = (body.shop ?? '').trim().toLowerCase()
  const clientId = (body.clientId ?? '').trim()
  const clientSecret = (body.clientSecret ?? '').trim()

  if (!shop.includes('.myshopify.com') && shop) shop = `${shop}.myshopify.com`

  if (!shop || !clientId || !clientSecret) {
    return NextResponse.json(
      { connected: false, error: 'INVALID_SHOP_DOMAIN', message: 'Shop domain, client id and client secret are all required.' },
      { status: 400 },
    )
  }
  if (!validateShopDomain(shop)) {
    return NextResponse.json(
      { connected: false, error: 'INVALID_SHOP_DOMAIN', message: `"${shop}" is not a valid *.myshopify.com domain.` },
      { status: 400 },
    )
  }

  try {
    // 1. Exchange client credentials for an access token
    const tokenData = await requestAccessToken(shop, clientId, clientSecret)

    // 2. Validate granted scopes — missing ones are informational unless a
    // scope this phase actually depends on (read_customers) is absent.
    const { granted, missing } = validateMissingScopes(tokenData.scope)
    const missingRequired = REQUIRED_SCOPES.filter(s => !granted.includes(s))
    if (missingRequired.length > 0) {
      return NextResponse.json({
        connected: false,
        error: 'MISSING_SCOPE',
        message: `This custom app is missing required scope(s): ${missingRequired.join(', ')}.`,
        missing_scopes: missingRequired,
      }, { status: 400 })
    }

    // 3. Confirm the token actually works against the Admin GraphQL API
    const shopDetails = await testGraphQLConnection(shop, tokenData.access_token)

    // 4. Save — owner/admin-resolved, service client (same pattern as every
    // other settings route; team members connecting on behalf of the org
    // write to the org owner's store row, not their own).
    const service = createServiceClient()
    const ownerId = await resolveOwnerUserId(service, user.id)
    const now = new Date().toISOString()

    const payload = {
      shopify_domain: shop,
      shopify_connection_type: 'custom_app',
      shopify_client_id: clientId,
      shopify_client_secret_enc: encrypt(clientSecret),
      shopify_access_token_enc: encrypt(tokenData.access_token),
      shopify_token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      shopify_granted_scopes: granted,
      shop_name: shopDetails.name,
      shop_email: shopDetails.email ?? null,
      currency: shopDetails.currency ?? 'INR',
      platform: 'shopify',
      is_active: true,
      connected_at: now,
      updated_at: now,
    }

    const { data: existingStores } = await service
      .from('stores')
      .select('id, shopify_domain, connected_at, updated_at, created_at')
      .eq('user_id', ownerId)
      .eq('is_active', true)
      .order('connected_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(10)
    const existing = pickPreferredStore(existingStores)

    let storeId: string
    if (existing) {
      const { data, error } = await service.from('stores').update(payload).eq('id', existing.id).select('id').single()
      if (error || !data) throw new ShopifyConnectionError('SHOPIFY_API_ERROR', error?.message ?? 'Could not save store.')
      storeId = data.id
    } else {
      const { data, error } = await service.from('stores').insert({ user_id: ownerId, ...payload }).select('id').single()
      if (error || !data) throw new ShopifyConnectionError('SHOPIFY_API_ERROR', error?.message ?? 'Could not save store.')
      storeId = data.id
    }

    // 5. Kick off initial customer sync — fire-and-forget, same pattern as
    // the OAuth callback route.
    syncShopifyCustomers(shop, tokenData.access_token, storeId, service, 4).catch(e =>
      console.error('[shopify/custom-app/connect] customer sync error:', e)
    )

    return NextResponse.json({
      connected: true,
      shop,
      granted_scopes: granted,
      missing_scopes: missing,
      initial_sync_status: 'started',
    })
  } catch (err) {
    if (err instanceof ShopifyConnectionError) {
      return NextResponse.json({ connected: false, error: err.code, message: err.message }, { status: 400 })
    }
    console.error('[shopify/custom-app/connect] unexpected error:', err)
    return NextResponse.json(
      { connected: false, error: 'SHOPIFY_API_ERROR', message: 'Something went wrong connecting to Shopify.' },
      { status: 500 },
    )
  }
}
