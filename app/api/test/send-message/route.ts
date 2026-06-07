import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { renderTemplate } from '@/lib/utils'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const automationType = body.automation_type as string
  if (!automationType) return NextResponse.json({ error: 'automation_type required' }, { status: 400 })

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!store) return NextResponse.json({ error: 'No store connected' }, { status: 400 })

  const { data: auto } = await supabase
    .from('automations')
    .select('*')
    .eq('store_id', store.id)
    .eq('type', automationType)
    .maybeSingle()

  if (!auto) return NextResponse.json({ error: 'Automation not found' }, { status: 404 })

  const testPhone = '+911234567890'
  const testName  = 'Test Customer'

  await supabase.from('customers').upsert(
    { store_id: store.id, phone: testPhone, name: testName, whatsapp_opt_in: true },
    { onConflict: 'store_id,phone', ignoreDuplicates: false }
  )

  const testVars: Record<string, string> = {
    name:           testName,
    shop_name:      store.shop_name ?? 'My Store',
    cart_url:       'https://example.com/cart/test',
    order_number:   'TEST-001',
    amount:         '1,299',
    order_url:      'https://example.com/orders/test',
    tracking_url:   'https://example.com/track/test',
    discount_code:  'SAVE10',
    discount_value: String(auto.discount_value ?? 10),
  }

  const message = renderTemplate(auto.template, testVars)

  const result = await sendWhatsAppMessage({
    to:     testPhone,
    message,
    bsp:    store.whatsapp_bsp ?? 'mock',
    apiKey: store.whatsapp_api_key ?? undefined,
  })

  const { data: msg } = await supabase.from('messages').insert({
    store_id:       store.id,
    customer_phone: testPhone,
    customer_name:  testName,
    type:           automationType,
    message,
    status:         result.success ? 'sent' : 'failed',
    bsp_message_id: result.messageId ?? null,
    metadata:       { test: true },
  }).select('id').single()

  const today = new Date().toISOString().split('T')[0]
  const { error: rpcErr } = await supabase.rpc('increment_analytics', {
    p_store_id: store.id,
    p_date:     today,
    p_field:    'messages_sent',
  })
  if (rpcErr) {
    await supabase.from('analytics_daily').upsert(
      { store_id: store.id, date: today, messages_sent: 1 },
      { onConflict: 'store_id,date' }
    )
  }

  // Track usage in billing (increment messages_used)
  if (result.success) {
    const service = createServiceClient()
    await service.rpc('increment_messages_used', { p_user_id: user.id }).then(null, () => null)
  }

  return NextResponse.json({
    success:    result.success,
    message_id: msg?.id,
    phone:      testPhone,
    preview:    message.slice(0, 120),
    bsp:        store.whatsapp_bsp ?? 'mock',
    error:      result.error,
  })
}
