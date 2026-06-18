const PRODUCTION_URL = 'https://app.wapaci.com'

/**
 * Returns the canonical app URL for auth redirects.
 * Priority: NEXT_PUBLIC_APP_URL env var (if not localhost) → production URL.
 * Never returns localhost — confirmation emails must point to a
 * publicly reachable URL so the link works from any email client.
 */
export function getAppUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (env && !env.includes('localhost')) return env
  return PRODUCTION_URL
}
