/**
 * Returns the canonical app URL for auth redirects.
 * Uses NEXT_PUBLIC_APP_URL env var in production (set in Vercel).
 * Falls back to window.location.origin so local dev still works.
 */
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return 'https://app.wapaci.com'
}
