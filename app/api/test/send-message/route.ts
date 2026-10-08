import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { renderTemplate } from '@/lib/utils'
import { getUserRole } from '@/lib/get-user-role'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { pickPreferredStore } from '@/lib/store-selection'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Owner/admin only — this sends a real WhatsApp message against the org's
  // connected number and increments its paid message usage, same tier as
  // every other WhatsApp-sending action. Also resolves to the org owner's
  // store: stores' RLS is USING (auth.uid() = user_id) with no team-member
  // carve-out, so querying by the caller's own id (the previous version)
  // always returned "No store connected" for any invited teammate even
  // though the org had one.
  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can send a test message.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const automationType = body.automation_type as string
  if (!automationType) return NextResponse.json({ error: 'automation_type required' }, { status: 400 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: storeRows } = await service
    .from('stores').select('*').eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(storeRows)

  if (!store) return NextResponse.json({ error: 'No store connected' }, { status: 400 })

  const { data: auto } = await service
    .from('automations')
    .select('*')
    .eq('store_id', store.id)
    .eq('type', automationType)
    .maybeSingle()

  if (!auto) return NextResponse.json({ error: 'Automation not found' }, { status: 404 })

  const testPhone = '+911234567890'
  const testName  = 'Test Customer'

  await service.from('customers').upsert(
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

  // Gate BEFORE sending, not after — this used to call the legacy
  // unconditional `increment_messages_used` only once a send already
  // succeeded, with nothing checking the limit first. A merchant already at
  // or over their plan's message cap could keep firing test sends
  // indefinitely, each one a real WhatsApp send that just kept pushing
  // messages_used further past the limit. try_increment_messages_used
  // (supabase/migrations.sql) is the same atomic check-and-increment gate
  // the cron/campaign send paths already use.
  const { data: quotaOk } = await service.rpc('try_increment_messages_used', { p_user_id: ownerId })
  if (!quotaOk) {
    return NextResponse.json({ error: 'Monthly message limit reached. Upgrade your plan to send more messages.' }, { status: 403 })
  }

  const result = await sendWhatsAppMessage({
    to:     testPhone,
    message,
    bsp:    store.whatsapp_bsp ?? 'mock',
    apiKey: store.whatsapp_api_key ?? undefined,
  })
  if (!result.success) {
    await service.rpc('decrement_messages_used', { p_user_id: ownerId }).then(() => null, () => null)
  }

  const { data: msg } = await service.from('messages').insert({
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
  const { error: rpcErr } = await service.rpc('increment_analytics', {
    p_store_id: store.id,
    p_date:     today,
    p_field:    'messages_sent',
  })
  if (rpcErr) {
    await service.from('analytics_daily').upsert(
      { store_id: store.id, date: today, messages_sent: 1 },
      { onConflict: 'store_id,date' }
    )
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
