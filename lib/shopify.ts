import crypto from 'crypto'
import { getAppUrl } from '@/lib/get-app-url'

const SHOPIFY_API_VERSION = '2025-01'

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
  searchParams.forEach((value, key) => { if (key !== 'hmac') parts.push(`${key}=${value}`) })
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
  return `${getAppUrl()}/api/shopify/callback`
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
  if (!res.ok) throw new Error('Failed to exchange code for token')
  const data = await res.json()
  return data.access_token
}

export async function getShopDetails(shop: string, token: string) {
  const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
    headers: { 'X-Shopify-Access-Token': token },
  })
  if (!res.ok) throw new Error('Failed to fetch shop details')
  const { shop: details } = await res.json()
  return details
}

export async function registerWebhooks(shop: string, token: string, appUrl: string) {
  const webhooks = [
    { topic: 'checkouts/create',  address: `${appUrl}/api/shopify/webhooks` },
    { topic: 'checkouts/update',  address: `${appUrl}/api/shopify/webhooks` },
    { topic: 'orders/create',     address: `${appUrl}/api/shopify/webhooks` },
    { topic: 'orders/fulfilled',  address: `${appUrl}/api/shopify/webhooks` },
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
