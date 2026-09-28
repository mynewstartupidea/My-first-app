import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendStoreWhatsAppText } from '@/lib/send-store-message'

// Sends a freeform WhatsApp reply from Live Chat. Previously the reply box
// called /api/whatsapp/test, which is a fixed "send yourself the hello_world
// template" endpoint for Settings — it silently ignored whatever the rep had
// actually typed and sent that canned template instead. This is its own,
// correct endpoint: it sends the real message text.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { phone?: string; message?: string }
  const phone   = (body.phone ?? '').trim()
  const message = (body.message ?? '').trim()
  if (!phone || !message) return NextResponse.json({ error: 'phone and message are required' }, { status: 400 })

  const { data: store } = await supabase
    .from('stores').select('id').eq('user_id', user.id).eq('is_active', true)
    .order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()
  if (!store) return NextResponse.json({ error: 'No store connected' }, { status: 400 })

  const service = createServiceClient()
  const result = await sendStoreWhatsAppText(service, {
    storeId: store.id, userId: user.id, phone, message, type: 'manual_reply',
  })

  return NextResponse.json(result, { status: result.success ? 200 : 502 })
}
