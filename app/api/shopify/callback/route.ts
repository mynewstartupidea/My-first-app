import { NextResponse } from 'next/server'
import { exchangeCodeForToken, getShopDetails, getShopifyAppUrl, registerWebhooks, verifyShopifyOAuthCallback, verifyOAuthState } from '@/lib/shopify'
import { createServiceClient } from '@/lib/supabase/server'

function redirectWithStatus(origin: string, returnTo: string, status: string) {
  const baseUrl = returnTo.startsWith('/') ? `${origin}${returnTo}` : `${origin}/dashboard/integrations`
  const dest = new URL(baseUrl)
  dest.searchParams.set('shopify', status)
  return NextResponse.redirect(dest.toString())
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const shop  = searchParams.get('shop')
  const state = searchParams.get('state')

  console.log(`[Shopify OAuth] callback — shop: ${shop}`)

  if (!code || !shop || !state) {
    console.error('[Shopify OAuth] missing code/shop/state params')
    return redirectWithStatus(origin, '/dashboard/integrations', 'invalid_callback')
  }

  // Verify Shopify's HMAC signature on the callback parameters
  if (!verifyShopifyOAuthCallback(searchParams)) {
    console.error('[Shopify OAuth] HMAC verification failed — possible forgery')
    return redirectWithStatus(origin, '/dashboard/integrations', 'invalid_hmac')
  }

  let userId: string
  let returnTo = '/dashboard/integrations'
  const decoded = verifyOAuthState(state)
  if (!decoded) {
    console.error('[Shopify OAuth] invalid or tampered state param')
    return redirectWithStatus(origin, '/dashboard/integrations', 'invalid_state')
  }
  userId  = decoded.userId
  if (decoded.returnTo) returnTo = decoded.returnTo

  try {
    // 1. Exchange code for access token
    let accessToken: string
    try {
      accessToken = await exchangeCodeForToken(shop, code)
    } catch (err) {
      console.error('[Shopify OAuth] token exchange failed:', err)
      return redirectWithStatus(origin, returnTo, 'token_failed')
    }
    console.log('[Shopify OAuth] token exchange: OK')

    // 2. Fetch shop details
    let shopDetails: { name: string; email?: string; currency?: string }
    try {
      shopDetails = await getShopDetails(shop, accessToken) as {
        name: string; email?: string; currency?: string
      }
    } catch (err) {
      console.error('[Shopify OAuth] shop details failed:', err)
      return redirectWithStatus(origin, returnTo, 'shop_failed')
    }
    console.log(`[Shopify OAuth] shop name: ${shopDetails.name}`)

    // 3. Register webhooks
    const appUrl = getShopifyAppUrl()
    await registerWebhooks(shop, accessToken, appUrl)
    console.log('[Shopify OAuth] webhooks registered')

    const supabase = createServiceClient()
    const now = new Date().toISOString()

    const shopifyPayload = {
      shopify_domain:       shop,
      shopify_access_token: accessToken,
      shop_name:            shopDetails.name,
      shop_email:           shopDetails.email ?? null,
      currency:             shopDetails.currency ?? 'INR',
      platform:             'shopify',
      is_active:            true,
      connected_at:         now,
      updated_at:           now,
    }

    // 4. Find where to persist — update existing store, never create a duplicate.
    //    Priority: same shop domain (reconnect) → any active store (upgrade mock) → insert fresh.
    let storeId: string

    const { data: byDomain } = await supabase
      .from('stores')
      .select('id')
      .eq('user_id', userId)
      .eq('shopify_domain', shop)
      .maybeSingle()

    if (byDomain) {
      const { data, error } = await supabase
        .from('stores').update(shopifyPayload).eq('id', byDomain.id).select('id').single()
      if (error) {
        console.error('[Shopify OAuth] store update failed:', error)
        return redirectWithStatus(origin, returnTo, 'store_failed')
      }
      storeId = data.id
      console.log('[Shopify OAuth] updated existing store (same domain):', storeId)
    } else {
      const { data: rows } = await supabase
        .from('stores').select('id').eq('user_id', userId).eq('is_active', true)
        .order('created_at', { ascending: true }).limit(1)
      const existing = rows?.[0]

      if (existing) {
        const { data, error } = await supabase
          .from('stores').update(shopifyPayload).eq('id', existing.id).select('id').single()
        if (error) {
          console.error('[Shopify OAuth] store upgrade failed:', error)
          return redirectWithStatus(origin, returnTo, 'store_failed')
        }
        storeId = data.id
        console.log('[Shopify OAuth] upgraded existing mock store:', storeId)
      } else {
        const { data, error } = await supabase
          .from('stores').insert({ user_id: userId, ...shopifyPayload }).select('id').single()
        if (error) {
          console.error('[Shopify OAuth] store insert failed:', error)
          return redirectWithStatus(origin, returnTo, 'store_failed')
        }
        storeId = data.id
        console.log('[Shopify OAuth] created new store:', storeId)
      }
    }

    // 5. Deactivate any duplicate stores for this user (e.g. orphaned mock stores)
    //    Keeps exactly one active store — the Shopify one we just saved.
    await supabase
      .from('stores')
      .update({ is_active: false, updated_at: now })
      .eq('user_id', userId)
      .eq('is_active', true)
      .neq('id', storeId)
    console.log('[Shopify OAuth] duplicate stores deactivated')

    // 6. Ensure default automations exist
    await supabase.rpc('create_default_automations', { p_store_id: storeId })

    // 6. Redirect with success flag
    const baseUrl = returnTo.startsWith('/') ? `${origin}${returnTo}` : `${origin}/dashboard/integrations`
    const dest = new URL(baseUrl)
    dest.searchParams.set('shopify', 'connected')
    console.log('[Shopify OAuth] redirect →', dest.toString())
    return NextResponse.redirect(dest.toString())
  } catch (err) {
    console.error('[Shopify OAuth] error:', err)
    return redirectWithStatus(origin, returnTo, 'oauth_failed')
  }
}
