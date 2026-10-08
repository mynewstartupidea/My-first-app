import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { pickPreferredStore } from '@/lib/store-selection'
import { normalizePhone } from '@/lib/whatsapp'

// Backs the Live Chat thread list — previously loaded via direct client-side
// queries against stores/messages/inbound_messages, all blocked by RLS
// (USING auth.uid() = user_id, no team-member carve-out) for anyone but the
// store owner, so a teammate always saw "No conversations" regardless of
// the org's real chat history.

interface Thread {
  phone: string; name: string | null; lastMsg: string; lastTime: string
  count: number; status: string; unread: boolean; type: string; tag: string | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: stores } = await service
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at')
    .eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(stores)
  if (!store) return NextResponse.json({ storeId: null, threads: [] })

  const [{ data: msgs }, { data: inbound }, { data: tagRows }] = await Promise.all([
    service.from('messages')
      .select('id,customer_phone,customer_name,message,type,status,created_at,revenue_attributed')
      .eq('store_id', store.id).order('created_at', { ascending: false }).limit(1000),
    service.from('inbound_messages')
      .select('id,from_phone,body,message_type,status,received_at')
      .eq('store_id', store.id).order('received_at', { ascending: false }).limit(1000),
    service.from('leads').select('phone, lead_status').eq('user_id', ownerId).not('lead_status', 'is', null),
  ])

  // Outbound (automation_jobs → messages.customer_phone) and inbound
  // (webhook → inbound_messages.from_phone) store phone numbers in
  // different formats — outbound keeps whatever raw format the lead was
  // entered in (e.g. "9695447829"), while Meta's webhook always sends its
  // own format (e.g. "919695447829"). Grouping by the raw string split the
  // same real contact into two separate threads the moment they ever
  // replied. Normalizing both to the same E.164 form before using them as
  // the map key (and as the thread's own canonical `phone`) merges them.
  const map = new Map<string, Thread>()
  for (const m of msgs ?? []) {
    const phone = normalizePhone(m.customer_phone)
    const ex = map.get(phone)
    if (!ex) {
      map.set(phone, {
        phone, name: m.customer_name,
        lastMsg: m.message, lastTime: m.created_at,
        count: 1, status: m.status, unread: m.status === 'sent',
        type: m.type, tag: null,
      })
    } else {
      ex.count++
      // Messages are scanned newest-first, so the thread's name would
      // otherwise permanently lock onto whichever message happened to be
      // most recent — a manual reply, AI reply, or lead-qualifying message
      // never carries customer_name, so the moment one of those became the
      // latest outbound message it nulled out a name an earlier automated
      // message (e.g. the lead-ad greeting) had correctly set. Keep any
      // non-null name seen, regardless of which message it came from.
      if (!ex.name && m.customer_name) ex.name = m.customer_name
      if (m.created_at > ex.lastTime) {
        ex.lastMsg = m.message; ex.lastTime = m.created_at
        ex.status = m.status; ex.type = m.type
      }
    }
  }
  for (const m of inbound ?? []) {
    const phone = normalizePhone(m.from_phone)
    const ex = map.get(phone)
    const body = m.body ?? `[${m.message_type ?? 'message'}]`
    if (!ex) {
      map.set(phone, {
        phone, name: null,
        lastMsg: body, lastTime: m.received_at,
        count: 1, status: 'received', unread: true,
        type: m.message_type ?? 'text', tag: null,
      })
    } else {
      ex.count++
      if (m.received_at > ex.lastTime) {
        ex.lastMsg = body; ex.lastTime = m.received_at
        ex.status = 'received'; ex.type = m.message_type ?? 'text'
        ex.unread = true
      }
    }
  }

  const tagByPhone = new Map((tagRows ?? []).map(r => [normalizePhone(r.phone), r.lead_status as string]))
  const threads = Array.from(map.values())
    .map(t => ({ ...t, tag: tagByPhone.get(t.phone) ?? null }))
    .sort((a, b) => b.lastTime.localeCompare(a.lastTime))

  return NextResponse.json({ storeId: store.id, threads })
}
