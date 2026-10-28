import { createHash } from 'crypto'
import { normalizeIndianPhone } from '@/lib/utils'
import { FB_PIXEL_ID } from '@/lib/meta-pixel-id'

const FB_API_VERSION = 'v21.0'

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

interface CapiEventInput {
  eventName: string
  eventId?: string
  eventSourceUrl: string
  email?: string | null
  phone?: string | null
  fbp?: string | null
  fbc?: string | null
  clientIp?: string | null
  userAgent?: string | null
  value?: number
  currency?: string
}

// Server-side Meta Conversions API — this is the actual lever for lead
// quality, not a one-off "report this lead" ping. Firing 'Lead' at
// submission (deduped against the client pixel's fbq('track','Lead') via
// matching eventId) and a later 'Subscribe' event only for leads that
// actually pay teaches Meta's delivery algorithm what a *good* conversion
// looks like for this ad account, so it stops spending budget on people who
// behave like the ones that never convert.
//
// Requires META_CAPI_ACCESS_TOKEN (Events Manager → pixel → Settings →
// Conversions API → Generate access token) — not yet set in this project's
// env anywhere. Deliberately fails soft: a missing token or a Graph API
// error here must never block a real lead from being saved or a real
// subscription from being created.
export async function sendMetaCapiEvent(input: CapiEventInput): Promise<void> {
  const token = process.env.META_CAPI_ACCESS_TOKEN
  if (!token) {
    console.warn('[meta-capi] META_CAPI_ACCESS_TOKEN not set — skipping', input.eventName)
    return
  }

  const userData: Record<string, unknown> = {}
  if (input.email) userData.em = [sha256(input.email)]
  const tenDigit = input.phone ? normalizeIndianPhone(input.phone) : null
  if (tenDigit) userData.ph = [sha256(`91${tenDigit}`)]
  if (input.fbp) userData.fbp = input.fbp
  if (input.fbc) userData.fbc = input.fbc
  if (input.clientIp) userData.client_ip_address = input.clientIp
  if (input.userAgent) userData.client_user_agent = input.userAgent

  const customData: Record<string, unknown> = {}
  if (input.value !== undefined) customData.value = input.value
  if (input.currency) customData.currency = input.currency

  const event: Record<string, unknown> = {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: input.eventSourceUrl,
    user_data: userData,
  }
  if (input.eventId) event.event_id = input.eventId
  if (Object.keys(customData).length) event.custom_data = customData

  try {
    const res = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${FB_PIXEL_ID}/events?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event] }),
    })
    if (!res.ok) console.error('[meta-capi] event failed:', input.eventName, await res.text())
  } catch (err) {
    console.error('[meta-capi] event threw:', input.eventName, err)
  }
}
