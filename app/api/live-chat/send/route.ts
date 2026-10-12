import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendStoreWhatsAppText } from '@/lib/send-store-message'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { resolveStoreFast } from '@/lib/store-selection'

// Sends a freeform WhatsApp reply from Live Chat. Previously the reply box
// called /api/whatsapp/test, which is a fixed "send yourself the hello_world
// template" endpoint for Settings — it silently ignored whatever the rep had
// actually typed and sent that canned template instead. This is its own,
// correct endpoint: it sends the real message text.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { phone?: string; message?: string; storeId?: string }
  const phone   = (body.phone ?? '').trim()
  const message = (body.message ?? '').trim()
  if (!phone || !message) return NextResponse.json({ error: 'phone and message are required' }, { status: 400 })

  const service = createServiceClient()
  // stores' RLS is USING (auth.uid() = user_id) with no team-member carve-out
  // — the raw user.id lookup this used to do always found zero rows for any
  // teammate, so only the org owner could actually send a reply from here;
  // everyone else saw "No store connected" despite WhatsApp being fully
  // connected for the org. resolveStoreFast still falls back to the same
  // full pickPreferredStore selection every other Live Chat/Contacts route
  // uses when no (or an invalid) storeId hint is given, so this can't pick a
  // different store than the one the thread list/detail views are scoped to
  // (which would make a sent reply "vanish" from the conversation) — the
  // hint just skips the extra round trip on the hot path of every send,
  // since the client already knows its own storeId by the time it sends.
  const ownerId = await resolveOwnerUserId(service, user.id)
  const store = await resolveStoreFast(service, ownerId, body.storeId ?? null)
  if (!store) return NextResponse.json({ error: 'No store connected' }, { status: 400 })

  const result = await sendStoreWhatsAppText(service, {
    storeId: store.id, userId: ownerId, phone, message, type: 'manual_reply',
  })

  return NextResponse.json(result, { status: result.success ? 200 : 502 })
}
