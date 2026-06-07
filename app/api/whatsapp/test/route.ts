// Send a test WhatsApp message to a specific phone number.
// Used from Settings → WhatsApp tab.

import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { phone?: string; message?: string }
  const phone   = (body.phone ?? '').replace(/\s/g, '')
  const message = body.message ?? 'Hello from Wapaci! 👋 Your WhatsApp integration is working correctly.'

  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const { data: store } = await supabase
    .from('stores')
    .select('id, whatsapp_bsp, whatsapp_api_key, shop_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // Look up Meta phone_number_id if using meta BSP
  let phoneNumberId: string | undefined
  if (store?.whatsapp_bsp === 'meta') {
    const service = createServiceClient()
    const { data: wa } = await service
      .from('whatsapp_accounts')
      .select('phone_number_id')
      .eq('user_id', user.id)
      .maybeSingle()
    phoneNumberId = wa?.phone_number_id ?? undefined
  }

  const result = await sendWhatsAppMessage({
    to:            phone,
    message,
    bsp:           store?.whatsapp_bsp ?? 'mock',
    apiKey:        store?.whatsapp_api_key ?? undefined,
    phoneNumberId,
  })

  if (result.success && store) {
    await supabase.from('messages').insert({
      store_id:       store.id,
      customer_phone: phone,
      customer_name:  'Test',
      type:           'test',
      message,
      status:         'sent',
      bsp_message_id: result.messageId ?? null,
      metadata:       { test: true },
    })
  }

  return NextResponse.json({
    success:  result.success,
    messageId: result.messageId,
    error:    result.error,
    bsp:      store?.whatsapp_bsp ?? 'mock',
  })
}
