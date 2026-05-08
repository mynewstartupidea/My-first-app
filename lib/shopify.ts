const SHOPIFY_API_VERSION = '2024-10'

export function getShopifyOAuthUrl(shop: string, state: string): string {
  const apiKey   = process.env.SHOPIFY_API_KEY!
  const scopes   = process.env.SHOPIFY_SCOPES!
  const redirect = `${process.env.NEXT_PUBLIC_APP_URL}/api/shopify/callback`

  return `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirect)}&state=${state}`
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
    { topic: 'orders/updated',    address: `${appUrl}/api/shopify/webhooks` },
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
  const crypto = require('crypto')
  const secret = process.env.SHOPIFY_API_SECRET!
  const hash   = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64')
  return hash === hmacHeader
}
