import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendStoreWhatsAppText } from '@/lib/send-store-message'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { pickPreferredStore } from '@/lib/store-selection'

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

  const service = createServiceClient()
  // stores' RLS is USING (auth.uid() = user_id) with no team-member carve-out
  // — the raw user.id lookup this used to do always found zero rows for any
  // teammate, so only the org owner could actually send a reply from here;
  // everyone else saw "No store connected" despite WhatsApp being fully
  // connected for the org. Also switched to the same pickPreferredStore
  // selection every other Live Chat/Contacts route uses, so this can't pick
  // a different store than the one the thread list/detail views are scoped
  // to (which would make a sent reply "vanish" from the conversation).
  const ownerId = await resolveOwnerUserId(service, user.id)
  const { data: stores } = await service
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at')
    .eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(stores)
  if (!store) return NextResponse.json({ error: 'No store connected' }, { status: 400 })

  const result = await sendStoreWhatsAppText(service, {
    storeId: store.id, userId: ownerId, phone, message, type: 'manual_reply',
  })

  return NextResponse.json(result, { status: result.success ? 200 : 502 })
}
