import crypto from 'crypto'
const SHOPIFY_API_VERSION = '2024-10'
const SHOPIFY_APP_URL = 'https://app.wapaci.com'

// Reject any shop that isn't a valid *.myshopify.com domain
export function validateShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop)
}

// HMAC-sign the OAuth state so the callback can detect tampering
export function signOAuthState(data: object): string {
  const secret = process.env.SHOPIFY_API_SECRET ?? ''
  const payload = JSON.stringify(data)
  const hmac    = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return Buffer.from(JSON.stringify({ payload, hmac })).toString('base64url')
}

// Returns parsed state data or null if signature is missing / invalid
export function verifyOAuthState(state: string): Record<string, string> | null {
  try {
    const { payload, hmac } = JSON.parse(Buffer.from(state, 'base64url').toString()) as { payload: string; hmac: string }
    const secret   = process.env.SHOPIFY_API_SECRET ?? ''
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(hmac,     'hex')
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    return JSON.parse(payload) as Record<string, string>
  } catch {
    return null
  }
}

// Verify Shopify's HMAC on the OAuth callback query string
export function verifyShopifyOAuthCallback(searchParams: URLSearchParams): boolean {
  const secret = process.env.SHOPIFY_API_SECRET
  if (!secret) return false
  const hmac = searchParams.get('hmac')
  if (!hmac) return false
  const parts: string[] = []
  searchParams.forEach((value, key) => {
    if (key !== 'hmac' && key !== 'signature') parts.push(`${key}=${value}`)
  })
  parts.sort()
  const expected = crypto.createHmac('sha256', secret).update(parts.join('&')).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(hmac,     'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function getShopifyOAuthUrl(shop: string, state: string): string {
  const apiKey   = process.env.SHOPIFY_API_KEY
  const scopes   = process.env.SHOPIFY_SCOPES
  const redirect = getShopifyRedirectUri()

  if (!apiKey || !scopes) {
    throw new Error('Shopify app is not configured')
  }

  const params = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirect,
    state,
  })

  return `https://${shop}/admin/oauth/authorize?${params.toString()}`
}

export function getShopifyRedirectUri(): string {
  return `${SHOPIFY_APP_URL}/api/shopify/callback`
}

export function getShopifyAppUrl(): string {
  return SHOPIFY_APP_URL
}

export async function exchangeCodeForToken(shop: string, code: string): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  })
  if (!res.ok) throw new Error(`Failed to exchange code for token: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.access_token
}

export async function getShopDetails(shop: string, token: string): Promise<{ name: string; email?: string; currency?: string }> {
  // Try GraphQL first (Shopify's current recommended API)
  try {
    const gqlRes = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '{ shop { name email currencyCode } }' }),
    })
    if (gqlRes.ok) {
      const { data } = await gqlRes.json() as { data?: { shop?: { name: string; email: string; currencyCode: string } } }
      if (data?.shop?.name) {
        return { name: data.shop.name, email: data.shop.email, currency: data.shop.currencyCode }
      }
    }
  } catch { /* fall through */ }

  // Fall back to REST
  try {
    const restRes = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
      headers: { 'X-Shopify-Access-Token': token },
    })
    if (restRes.ok) {
      const { shop: details } = await restRes.json() as { shop: { name: string; email?: string; currency?: string } }
      if (details?.name) return details
    }
  } catch { /* fall through */ }

  // Last resort: derive name from the shop domain so the connection still succeeds
  const derived = shop.replace('.myshopify.com', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return { name: derived, currency: 'INR' }
}

export async function registerWebhooks(shop: string, token: string, appUrl: string) {
  const webhooks = [
    { topic: 'checkouts/create',  address: `${appUrl}/api/shopify/webhooks` },
    { topic: 'checkouts/update',  address: `${appUrl}/api/shopify/webhooks` },
    { topic: 'orders/create',     address: `${appUrl}/api/shopify/webhooks` },
    { topic: 'orders/fulfilled',  address: `${appUrl}/api/shopify/webhooks` },
    { topic: 'orders/updated',    address: `${appUrl}/api/shopify/webhooks` },
    { topic: 'app/uninstalled',   address: `${appUrl}/api/shopify/webhooks` },
  ]

  for (const webhook of webhooks) {
    await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ webhook }),
    })
  }
}

export function verifyShopifyWebhook(body: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_API_SECRET
  if (!secret) return false
  const hash = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64')
  const a = Buffer.from(hash)
  const b = Buffer.from(hmacHeader)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
