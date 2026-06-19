// Send a test WhatsApp message to a specific phone number.
// Used from Settings → WhatsApp tab.

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body  = await request.json().catch(() => ({})) as { phone?: string; message?: string }
  const rawPhone = (body.phone ?? '').replace(/\s/g, '')
  if (!rawPhone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const phone = normalizePhone(rawPhone)

  const { data: store } = await supabase
    .from('stores')
    .select('id, whatsapp_bsp, whatsapp_api_key, shop_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // Try merchant's own connected WhatsApp account first
  let merchantToken: string | undefined
  let merchantPhoneNumberId: string | undefined
  const service = createServiceClient()
  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('phone_number_id, access_token')
    .eq('user_id', user.id)
    .maybeSingle()
  if (wa?.phone_number_id) {
    merchantPhoneNumberId = wa.phone_number_id
    merchantToken         = wa.access_token ?? store?.whatsapp_api_key ?? undefined
  }

  // Resolve final credentials: merchant > platform env vars
  const token   = merchantToken         ?? process.env.META_ACCESS_TOKEN
  const phoneId = merchantPhoneNumberId ?? process.env.META_PHONE_NUMBER_ID

  if (!token || !phoneId) {
    return NextResponse.json({
      success: false,
      error:   'No WhatsApp credentials available. Connect your WhatsApp account first, or contact support.',
    })
  }

  // Always send hello_world template for tests — free-form text requires
  // an active 24h conversation window which may not exist.
  const metaRes = await fetch(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to:                phone,
      type:              'template',
      template: { name: 'hello_world', language: { code: 'en_US' } },
    }),
  })

  const metaData = await metaRes.json() as {
    messages?: { id: string }[]
    error?:    { message: string; code?: number; error_data?: { details: string } }
  }

  const messageId = metaData.messages?.[0]?.id
  const success   = metaRes.ok && !!messageId

  const errorMsg = success ? undefined :
    metaData.error?.code === 131030 ? 'Your number is not whitelisted as a test recipient in Meta App Dashboard → WhatsApp → API Setup → Test recipients' :
    metaData.error?.code === 131026 ? `${phone} is not registered on WhatsApp` :
    metaData.error?.code === 190     ? 'Access token expired — regenerate in Meta App Dashboard' :
    metaData.error?.error_data?.details ?? metaData.error?.message ?? `Meta error (HTTP ${metaRes.status})`

  if (success && store) {
    await supabase.from('messages').insert({
      store_id:       store.id,
      customer_phone: phone,
      customer_name:  'Test',
      type:           'test',
      message:        'hello_world template',
      status:         'sent',
      bsp_message_id: messageId,
      metadata:       { test: true, template: 'hello_world' },
    }).then(() => null)
  }

  return NextResponse.json({
    success,
    messageId: messageId ?? null,
    error:     errorMsg,
    phone,
    via: merchantPhoneNumberId ? 'merchant_account' : 'platform_credentials',
  })
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (phone.startsWith('+')) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`
  return `+${digits}`
}
