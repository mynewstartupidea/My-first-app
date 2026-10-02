// Shopify's REST Admin API enforces a per-shop bucket (roughly 2 req/s,
// burst 40) and returns 429 with a Retry-After header when exceeded. Every
// custom-app store has its own token/bucket, so one merchant's sync never
// competes with another's — but a single store's own paginated sync (orders,
// products) can still trip its own limit on a fast loop. This wrapper backs
// off and retries instead of letting a sync job fail outright on a 429.
const MAX_RETRIES = 3

export async function fetchShopify(url: string, init: RequestInit): Promise<Response> {
  let lastRes: Response | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, init)
    if (res.status !== 429) return res
    lastRes = res
    const retryAfter = Number(res.headers.get('Retry-After')) || 1
    await new Promise(r => setTimeout(r, retryAfter * 1000))
  }
  return lastRes!
}
