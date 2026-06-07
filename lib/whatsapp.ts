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

    const data = await res.json() as { messages?: { id: string }[]; error?: { message: string } }
    if (res.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id }
    }
    return { success: false, error: data.error?.message ?? 'Meta API error' }
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

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Ensure E.164 format with country code
  if (digits.startsWith('91') && digits.length === 12) return digits
  if (digits.length === 10) return `91${digits}`
  return digits
}

// ─── Meta Embedded Signup — token exchange ────────────────────────────────────

export interface MetaWABAInfo {
  wabaId: string
  phoneNumberId: string
  displayPhoneNumber: string
  businessId: string
  accessToken: string
}

export async function exchangeMetaCode(code: string): Promise<MetaWABAInfo | null> {
  const appId     = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) return null

  try {
    // Exchange code for user access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&code=${code}`
    )
    const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string } }
    if (!tokenData.access_token) return null

    const userToken = tokenData.access_token

    // Get WABAs (WhatsApp Business Accounts)
    const wabaRes = await fetch(
      `https://graph.facebook.com/v20.0/me/businesses?fields=owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number}}&access_token=${userToken}`
    )
    const wabaData = await wabaRes.json() as {
      data?: {
        owned_whatsapp_business_accounts?: {
          data?: {
            id: string
            name: string
            phone_numbers?: { data?: { id: string; display_phone_number: string }[] }
          }[]
        }
        id: string
      }[]
    }

    const business = wabaData.data?.[0]
    const waba     = business?.owned_whatsapp_business_accounts?.data?.[0]
    const phone    = waba?.phone_numbers?.data?.[0]

    if (!business || !waba || !phone) return null

    return {
      wabaId:             waba.id,
      phoneNumberId:      phone.id,
      displayPhoneNumber: phone.display_phone_number,
      businessId:         business.id,
      accessToken:        userToken,
    }
  } catch {
    return null
  }
}
