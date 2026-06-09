// Centralized WhatsApp provider layer.
// Supports: mock | meta | interakt | gupshup
// Architecture allows future providers without code duplication.

interface SendMessageParams {
  to: string
  message: string
  bsp?: string
  apiKey?: string
  phoneNumberId?: string
}

interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function sendWhatsAppMessage(params: SendMessageParams): Promise<SendResult> {
  const bsp = params.bsp ?? process.env.WHATSAPP_BSP ?? 'mock'

  if (bsp === 'mock') {
    console.log(`[WhatsApp MOCK] → ${params.to}: ${params.message.slice(0, 80)}…`)
    return { success: true, messageId: `mock_${Date.now()}` }
  }

  if (bsp === 'meta') return sendViaMeta(params)
  if (bsp === 'interakt') return sendViaInterakt(params)
  if (bsp === 'gupshup') return sendViaGupshup(params)

  return { success: false, error: `Unknown BSP: ${bsp}` }
}

// ─── Meta WhatsApp Cloud API ──────────────────────────────────────────────────

async function sendViaMeta({ to, message, apiKey, phoneNumberId }: SendMessageParams): Promise<SendResult> {
  const token   = apiKey       ?? process.env.META_ACCESS_TOKEN
  const phoneId = phoneNumberId ?? process.env.META_PHONE_NUMBER_ID

  if (!token || !phoneId) {
    return { success: false, error: 'Missing META_ACCESS_TOKEN or META_PHONE_NUMBER_ID' }
  }

  const phone = normalizePhone(to)

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type:    'individual',
          to:                phone,
          type:              'text',
          text:              { preview_url: false, body: message },
        }),
      }
    )

    const data = await res.json() as { messages?: { id: string }[]; error?: { message: string; code?: number; error_data?: { details: string } } }
    if (res.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id }
    }
    const code = data.error?.code
    const humanError =
      code === 131026 ? `${phone} is not registered on WhatsApp` :
      code === 131047 ? 'Customer needs to message you first (24hr session expired)' :
      code === 130429 ? 'WhatsApp rate limit reached — will retry' :
      code === 131021 ? `Invalid phone number format: ${phone}` :
      code === 131000 ? 'WhatsApp service error — will retry' :
      data.error?.message ?? `Meta API error (code ${code ?? 'unknown'})`
    return { success: false, error: humanError }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ─── Interakt ─────────────────────────────────────────────────────────────────

async function sendViaInterakt({ to, message, apiKey }: SendMessageParams): Promise<SendResult> {
  const key = apiKey ?? process.env.WHATSAPP_API_KEY
  if (!key) return { success: false, error: 'Missing Interakt API key' }

  const phone = to.replace(/\D/g, '')
  const body = {
    countryCode: '+91',
    phoneNumber: phone.replace(/^91/, ''),
    type: 'Text',
    template: { name: 'custom', languageCode: 'en', bodyValues: [message] },
    data: { message },
  }

  try {
    const res = await fetch('https://api.interakt.ai/v1/public/message/', {
      method: 'POST',
      headers: { Authorization: `Basic ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json() as { id?: string; message?: string }
    if (res.ok) return { success: true, messageId: data.id }
    return { success: false, error: data.message ?? 'Interakt error' }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ─── Gupshup ─────────────────────────────────────────────────────────────────

async function sendViaGupshup({ to, message, apiKey, phoneNumberId }: SendMessageParams): Promise<SendResult> {
  const key     = apiKey       ?? process.env.WHATSAPP_API_KEY
  const phoneId = phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!key || !phoneId) return { success: false, error: 'Missing Gupshup credentials' }

  const phone = to.replace(/\D/g, '')
  const params = new URLSearchParams({
    channel:     'whatsapp',
    source:      phoneId,
    destination: phone,
    message:     JSON.stringify({ type: 'text', text: message }),
    'src.name':  'Wapaci',
  })

  try {
    const res = await fetch(`https://api.gupshup.io/sm/api/v1/msg?${params}`, {
      method: 'POST',
      headers: { apikey: key },
    })
    const data = await res.json() as { messageId?: string; message?: string }
    if (res.ok) return { success: true, messageId: data.messageId }
    return { success: false, error: data.message ?? 'Gupshup error' }
  } catch (e) {
    return { success: false, error: String(e) }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Returns E.164 format with + prefix required by Meta API.
// Handles Indian numbers (10-digit or 91-prefixed), international numbers,
// and numbers already in E.164 format.
function normalizePhone(phone: string): string {
  const trimmed = phone.trim()
  const digits  = trimmed.replace(/\D/g, '')

  // Already has + → trust the caller's country code
  if (trimmed.startsWith('+')) return `+${digits}`

  // 10-digit Indian mobile (no country code)
  if (digits.length === 10 && !digits.startsWith('0')) return `+91${digits}`

  // 12-digit with 91 prefix (Indian with country code, no +)
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`

  // Anything else: assume the caller supplied the full country code
  return `+${digits}`
}

// ─── Meta Embedded Signup — token exchange ────────────────────────────────────

export interface MetaWABAInfo {
  wabaId: string
  phoneNumberId: string
  displayPhoneNumber: string
  businessId: string
  accessToken: string
}

// Assign Wapaci's platform System User to a merchant's WABA.
// Requires META_SYSTEM_USER_ID env var (numeric ID from Meta Business Manager).
// Uses the merchant's short-lived user token to authorize the assignment.
// On success, Wapaci's System User token can be used to send on behalf of this WABA permanently.
export async function assignSystemUserToWABA(wabaId: string, userToken: string): Promise<boolean> {
  const systemUserId = process.env.META_SYSTEM_USER_ID
  if (!systemUserId) return false

  try {
    // Meta Graph API requires access_token as a query param for this endpoint —
    // it does NOT parse it from the JSON body.
    const url = new URL(`https://graph.facebook.com/v20.0/${wabaId}/assigned_users`)
    url.searchParams.set('access_token', userToken)

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user:  systemUserId,
        // MANAGE + DEVELOP + MESSAGING covers: full WABA management, testing, and message sending
        tasks: ['MANAGE', 'DEVELOP', 'MESSAGING'],
      }),
    })
    const data = await res.json() as { success?: boolean; error?: { message: string } }
    if (!res.ok) {
      console.error('[Meta] assignSystemUser failed:', data.error?.message)
      return false
    }
    return data.success === true
  } catch (e) {
    console.error('[Meta] assignSystemUser exception:', e)
    return false
  }
}

// Subscribe the Wapaci app to receive webhook events (delivery receipts, inbound messages)
// for a specific merchant WABA. Must be called once per merchant during Embedded Signup.
export async function subscribeWABAWebhooks(wabaId: string, token: string): Promise<boolean> {
  try {
    // No body required for basic subscription — uses app's registered webhook URL.
    const res = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json() as { success?: boolean; error?: { message: string } }
    if (!res.ok) {
      console.error('[Meta] subscribeWebhooks failed:', data.error?.message)
      return false
    }
    return data.success === true
  } catch (e) {
    console.error('[Meta] subscribeWebhooks exception:', e)
    return false
  }
}

// ─── Typed result for exchangeMetaCode ───────────────────────────────────────

export type MetaExchangeResult =
  | { ok: true;  info: MetaWABAInfo }
  | { ok: false; error: string; step: 'config' | 'token_exchange' | 'business_lookup' | 'waba_lookup' | 'phone_lookup' }

// Exchange an OAuth/Embedded-Signup code for a WABA + phone number.
// redirectUri: include for redirect-based OAuth; omit for FB JS SDK popup flow.
export async function exchangeMetaCode(code: string, redirectUri?: string): Promise<MetaExchangeResult> {
  const appId     = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    console.error('[Meta] META_APP_ID or META_APP_SECRET not set')
    return { ok: false, error: 'META_APP_ID or META_APP_SECRET not configured', step: 'config' }
  }

  // ── Step 1: exchange code for user access token ───────────────────────────
  const tokenParams = new URLSearchParams({ client_id: appId, client_secret: appSecret, code })
  if (redirectUri) tokenParams.set('redirect_uri', redirectUri)

  const tokenRes  = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${tokenParams}`)
  const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string; code?: number; type?: string } }

  console.log('[Meta] token exchange status:', tokenRes.status, tokenData.error ?? 'OK')

  if (!tokenData.access_token) {
    const msg = tokenData.error?.message ?? 'Unknown error'
    console.error('[Meta] token exchange failed:', tokenData.error)
    return { ok: false, error: `OAuth token exchange failed: ${msg}`, step: 'token_exchange' }
  }

  const userToken = tokenData.access_token

  // ── Step 2: get business portfolios ──────────────────────────────────────
  const bizRes  = await fetch(`https://graph.facebook.com/v20.0/me/businesses?fields=id,name&access_token=${userToken}`)
  const bizData = await bizRes.json() as { data?: { id: string; name: string }[]; error?: { message: string } }

  console.log('[Meta] /me/businesses status:', bizRes.status, `count=${bizData.data?.length ?? 0}`, bizData.error ?? '')

  if (!bizData.data?.length) {
    const msg = bizData.error?.message
      ? `Graph API error: ${bizData.error.message}`
      : 'No Business Portfolio found on this Facebook account. Create one at business.facebook.com first.'
    return { ok: false, error: msg, step: 'business_lookup' }
  }

  // ── Step 3: find WABA across all business portfolios ─────────────────────
  for (const biz of bizData.data) {
    // Use whatsapp_business_accounts (correct for Embedded Signup + standard)
    const wabaRes  = await fetch(
      `https://graph.facebook.com/v20.0/${biz.id}/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number}&access_token=${userToken}`
    )
    const wabaData = await wabaRes.json() as {
      data?: { id: string; name: string; phone_numbers?: { data?: { id: string; display_phone_number: string }[] } }[]
      error?: { message: string }
    }

    console.log(`[Meta] business ${biz.id} (${biz.name}) whatsapp_business_accounts:`, wabaRes.status, `count=${wabaData.data?.length ?? 0}`, wabaData.error ?? '')

    if (!wabaData.data?.length) continue

    const waba  = wabaData.data[0]
    const phone = waba.phone_numbers?.data?.[0]

    console.log(`[Meta] WABA ${waba.id} phone_numbers count=${waba.phone_numbers?.data?.length ?? 0}`)

    if (!phone) {
      // Found WABA but no phone — log and continue looking
      console.warn(`[Meta] WABA ${waba.id} has no phone numbers`)
      continue
    }

    console.log(`[Meta] resolved → bizId=${biz.id} wabaId=${waba.id} phoneId=${phone.id} number=${phone.display_phone_number}`)

    return {
      ok: true,
      info: {
        wabaId:             waba.id,
        phoneNumberId:      phone.id,
        displayPhoneNumber: phone.display_phone_number,
        businessId:         biz.id,
        accessToken:        userToken,
      },
    }
  }

  // Went through all businesses and found WABAs but no phone numbers
  const anyWaba = await (async () => {
    for (const biz of bizData.data ?? []) {
      const r = await fetch(`https://graph.facebook.com/v20.0/${biz.id}/whatsapp_business_accounts?access_token=${userToken}`)
      const d = await r.json() as { data?: unknown[] }
      if (d.data?.length) return true
    }
    return false
  })()

  if (anyWaba) {
    return { ok: false, error: 'WhatsApp Business Account found but no phone number is registered. Add a phone number in Meta Business Manager → WhatsApp → Phone Numbers.', step: 'phone_lookup' }
  }

  return { ok: false, error: 'No WhatsApp Business Account found. Complete WhatsApp setup in Meta Business Manager → WhatsApp Manager.', step: 'waba_lookup' }
}
