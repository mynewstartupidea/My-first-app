import { encrypt, decrypt } from '@/lib/encryption'
import { createServiceClient } from '@/lib/supabase/server'

const SHOPIFY_API_VERSION = '2026-07'

// Scopes Phase 1-4 actually sync (customers/orders/products/inventory/
// locations/fulfillments/returns/discounts/abandoned checkouts). Dropped
// read_markets/read_translations/read_metaobjects/read_content/
// read_online_store_navigation from the originally requested list — nothing
// planned needs them, and asking for scopes with no justification just makes
// the merchant's custom-app grant screen more confusing.
export const KNOWN_SCOPES = [
  'read_customers',
  'read_orders',
  'read_all_orders',
  'read_products',
  'read_inventory',
  'read_locations',
  'read_fulfillments',
  'read_returns',
  'read_discounts',
  'read_customer_events',
] as const

// Only what Phase 1 (customer sync) needs. Grows as later phases ship.
export const REQUIRED_SCOPES: string[] = ['read_customers']

export type ShopifyErrorCode =
  | 'INVALID_SHOP_DOMAIN'
  | 'INVALID_CREDENTIALS'
  | 'SHOP_NOT_PERMITTED'
  | 'MISSING_SCOPE'
  | 'TOKEN_REQUEST_FAILED'
  | 'SHOPIFY_API_ERROR'

export class ShopifyConnectionError extends Error {
  code: ShopifyErrorCode
  constructor(code: ShopifyErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

interface TokenResponse {
  access_token: string
  scope: string
  expires_in: number
}

// POST https://{shop}/admin/oauth/access_token with grant_type=client_credentials.
// This is Shopify's client-credentials grant for custom apps created via the
// dev dashboard — distinct from both the legacy manually-generated custom-app
// token and public-app OAuth (lib/shopify.ts). The token expires (~24h); the
// client id/secret don't, so callers just request a fresh token whenever
// needed rather than persisting any long-lived refresh token.
export async function requestAccessToken(
  shop: string,
  clientId: string,
  clientSecret: string,
): Promise<TokenResponse> {
  let res: Response
  try {
    res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
  } catch (err) {
    throw new ShopifyConnectionError('TOKEN_REQUEST_FAILED', `Could not reach Shopify: ${String(err)}`)
  }

  if (res.status === 401) {
    throw new ShopifyConnectionError('INVALID_CREDENTIALS', 'Shopify rejected the client id/secret for this shop.')
  }
  if (res.status === 403) {
    throw new ShopifyConnectionError('SHOP_NOT_PERMITTED', 'This shop did not permit the app to request a token.')
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ShopifyConnectionError('TOKEN_REQUEST_FAILED', `Shopify returned ${res.status}: ${body}`)
  }

  const data = await res.json() as TokenResponse
  if (!data.access_token) {
    throw new ShopifyConnectionError('TOKEN_REQUEST_FAILED', 'Shopify did not return an access token.')
  }
  return data
}

export function validateMissingScopes(grantedScope: string): { granted: string[]; missing: string[] } {
  const granted = grantedScope.split(',').map(s => s.trim()).filter(Boolean)
  const grantedSet = new Set(granted)
  const missing = KNOWN_SCOPES.filter(s => !grantedSet.has(s))
  return { granted, missing }
}

export async function testGraphQLConnection(shop: string, token: string): Promise<{ name: string; email?: string; currency?: string }> {
  let res: Response
  try {
    res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ shop { name email currencyCode } }' }),
    })
  } catch (err) {
    throw new ShopifyConnectionError('SHOPIFY_API_ERROR', `GraphQL request failed: ${String(err)}`)
  }
  if (!res.ok) {
    throw new ShopifyConnectionError('SHOPIFY_API_ERROR', `Shopify GraphQL returned ${res.status}`)
  }
  const { data, errors } = await res.json() as {
    data?: { shop?: { name: string; email?: string; currencyCode?: string } }
    errors?: unknown[]
  }
  if (errors?.length || !data?.shop?.name) {
    throw new ShopifyConnectionError('SHOPIFY_API_ERROR', 'Shopify GraphQL connection test failed.')
  }
  return { name: data.shop.name, email: data.shop.email, currency: data.shop.currencyCode }
}

interface CustomAppStoreRow {
  id: string
  shopify_domain: string | null
  shopify_client_id: string | null
  shopify_client_secret_enc: string | null
  shopify_access_token_enc: string | null
  shopify_token_expires_at: string | null
}

const EXPIRY_SAFETY_MARGIN_MS = 5 * 60 * 1000 // refresh 5 min before actual expiry

// Returns a usable access token for a custom_app store row, transparently
// requesting + persisting a fresh one if the stored token is missing/expired.
// Every route that calls Shopify on behalf of a custom_app store should go
// through this instead of reading shopify_access_token_enc directly.
export async function getValidAccessToken(store: CustomAppStoreRow): Promise<string> {
  if (!store.shopify_domain || !store.shopify_client_id || !store.shopify_client_secret_enc) {
    throw new ShopifyConnectionError('INVALID_CREDENTIALS', 'This store has no Shopify custom-app credentials saved.')
  }

  const expiresAt = store.shopify_token_expires_at ? new Date(store.shopify_token_expires_at).getTime() : 0
  const stillValid = store.shopify_access_token_enc && expiresAt - Date.now() > EXPIRY_SAFETY_MARGIN_MS
  if (stillValid) return decrypt(store.shopify_access_token_enc!)

  const clientSecret = decrypt(store.shopify_client_secret_enc)
  const token = await requestAccessToken(store.shopify_domain, store.shopify_client_id, clientSecret)

  const service = createServiceClient()
  const { error: persistErr } = await service.from('stores').update({
    shopify_access_token_enc: encrypt(token.access_token),
    shopify_token_expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', store.id)
  // The freshly-minted token is still valid and gets returned either way —
  // only the DB cache write is what might have failed, previously silently.
  // If it did, the next call for this store won't see the refresh and will
  // request yet another token from Shopify instead of reusing this one;
  // harmless to correctness (still gets a working token every time) but
  // worth a log line instead of being invisible, since repeated redundant
  // client-credential requests are otherwise indistinguishable from normal
  // scheduled refreshes.
  if (persistErr) console.error('[getValidAccessToken] failed to persist refreshed token:', persistErr.message, 'store:', store.id)

  return token.access_token
}
