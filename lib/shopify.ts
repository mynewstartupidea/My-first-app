import crypto from 'crypto'
const SHOPIFY_API_VERSION = '2026-07'

// Normalise a raw phone string to E.164 using the customer's country code.
// Returns empty string for unparseable numbers rather than silently skipping them
// (the caller can decide to skip or log).
function customerToE164(raw: string, countryCode = ''): string {
  if (!raw) return ''
  if (raw.startsWith('+')) return `+${raw.replace(/\D/g, '')}`
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length > 10) return `+${digits}`
  if (digits.length === 10) {
    if (countryCode === 'US' || countryCode === 'CA') return `+1${digits}`
    if (countryCode === 'GB') return `+44${digits}`
    if (countryCode === 'AU') return `+61${digits}`
    if (countryCode === 'AE') return `+971${digits}`
    return `+91${digits}` // default: India
  }
  return ''
}
const SHOPIFY_APP_URL = 'https://app.wapaci.com'

// Reject any shop that isn't a valid *.myshopify.com domain
export function validateShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop)
}

// HMAC-sign the OAuth state so the callback can detect tampering
// ts field prevents replay attacks — states older than 10 minutes are rejected
export function signOAuthState(data: object): string {
  const secret = process.env.SHOPIFY_API_SECRET ?? ''
  const payload = JSON.stringify({ ...data, ts: Date.now() })
  const hmac    = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  return Buffer.from(JSON.stringify({ payload, hmac })).toString('base64url')
}

const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes

// Returns parsed state data or null if signature is missing / invalid / expired
export function verifyOAuthState(state: string): Record<string, string> | null {
  try {
    const { payload, hmac } = JSON.parse(Buffer.from(state, 'base64url').toString()) as { payload: string; hmac: string }
    const secret   = process.env.SHOPIFY_API_SECRET ?? ''
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(hmac,     'hex')
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    const parsed = JSON.parse(payload) as Record<string, string> & { ts?: number }
    // Reject states older than 10 minutes (replay protection)
    if (parsed.ts && Date.now() - Number(parsed.ts) > OAUTH_STATE_MAX_AGE_MS) return null
    return parsed
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
  const TOPICS = [
    'checkouts/create',
    'checkouts/update',
    'orders/create',
    'orders/fulfilled',
    'orders/updated',
    'app/uninstalled',
    'app_subscriptions/update',
    // Mandatory Shopify GDPR compliance webhooks — required for app review
    'customers/data_request',
    'customers/redact',
    'shop/redact',
  ]
  const address = `${appUrl}/api/shopify/webhooks`

  // Fetch existing webhooks to avoid registering duplicates
  const listRes = await fetch(
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json?limit=250`,
    { headers: { 'X-Shopify-Access-Token': token } }
  )
  const existingTopics = new Set<string>()
  if (listRes.ok) {
    const { webhooks: existing } = await listRes.json() as { webhooks: { topic: string; address: string }[] }
    for (const w of existing ?? []) {
      if (w.address === address) existingTopics.add(w.topic)
    }
  }

  for (const topic of TOPICS) {
    if (existingTopics.has(topic)) continue
    await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook: { topic, address } }),
    })
  }
}

interface ShopifyCustomer {
  id: number
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  orders_count?: number
  total_spent?: string
  default_address?: { country_code?: string }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncShopifyCustomers(
  shop: string,
  token: string,
  storeId: string,
  supabase: any,
  maxPages = 4,
): Promise<{ synced: number; skipped: number }> {
  const headers = { 'X-Shopify-Access-Token': token }
  let synced = 0
  let skipped = 0
  let nextUrl: string | null =
    `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/customers.json` +
    `?limit=250&fields=id,first_name,last_name,email,phone,orders_count,total_spent,default_address`
  let page = 0

  while (nextUrl && page < maxPages) {
    const currentUrl = nextUrl
    const shopRes = await fetch(currentUrl, { headers })
    if (!shopRes.ok) {
      console.error(`[syncShopifyCustomers] Shopify returned ${shopRes.status}`)
      break
    }

    const { customers } = await shopRes.json() as { customers: ShopifyCustomer[] }

    const toUpsert: Record<string, unknown>[] = []
    for (const c of customers) {
      const countryCode = String(c.default_address?.country_code ?? '').toUpperCase()
      const phone = customerToE164(c.phone ?? '', countryCode)
      if (!phone) { skipped++; continue }
      toUpsert.push({
        store_id:            storeId,
        phone,
        shopify_customer_id: String(c.id),
        name:                [c.first_name, c.last_name].filter(Boolean).join(' ') || null,
        email:               c.email ?? null,
        whatsapp_opt_in:     true,
        total_orders:        c.orders_count ?? 0,
        total_spent:         parseFloat(c.total_spent ?? '0'),
      })
    }

    if (toUpsert.length > 0) {
      const { error } = await supabase
        .from('customers')
        .upsert(toUpsert, { onConflict: 'store_id,phone', ignoreDuplicates: true })
      if (error) console.error('[syncShopifyCustomers] upsert error:', error.message)
      else synced += toUpsert.length
    }

    // Follow Shopify's Link header for pagination
    const linkHeader: string = shopRes.headers.get('link') ?? ''
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
    nextUrl = nextMatch ? nextMatch[1] : null
    page++
  }

  console.log(`[syncShopifyCustomers] shop=${shop} synced=${synced} skipped=${skipped} pages=${page}`)
  return { synced, skipped }
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
