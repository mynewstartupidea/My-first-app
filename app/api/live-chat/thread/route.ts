import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { pickPreferredStore } from '@/lib/store-selection'
import { getUserRole } from '@/lib/get-user-role'
import { normalizePhone, last10Digits } from '@/lib/whatsapp'
import { friendlyInboundBody } from '@/lib/inbound-message-label'

// GET /api/live-chat/thread?phone=+91xxx — full message history + customer
// record for one conversation. See app/api/live-chat/threads/route.ts for
// why this needed to move off direct client-side queries.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')
  if (!phone) return NextResponse.json({ error: 'phone is required' }, { status: 400 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: stores } = await service
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at')
    .eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(stores)
  if (!store) return NextResponse.json({ messages: [], customer: null })

  // Matched by normalized phone, not an exact DB-level string filter —
  // outbound (messages.customer_phone) and inbound (inbound_messages.
  // from_phone) store numbers in different raw formats depending on where
  // they originated (see threads/route.ts), so an exact .eq() against
  // whichever format `phone` happens to be in silently drops the other
  // side's history. Filtering by customer_phone_last10/from_phone_last10
  // (generated columns, see supabase/migrations.sql) narrows the fetch to
  // just this conversation at the DB level — this used to fetch and
  // normalizePhone-filter the store's ENTIRE message history on every
  // single conversation open, getting slower the more a merchant used the
  // product, completely independent of how big any one conversation
  // actually was. normalizePhone is kept below as a defense-in-depth
  // final check, not the primary filter anymore.
  const target = normalizePhone(phone)
  const target10 = last10Digits(phone)
  const [msgsRes, inboundRes, custRes] = await Promise.all([
    service.from('messages').select('*').eq('store_id', store.id).eq('customer_phone_last10', target10).order('created_at', { ascending: true }),
    service.from('inbound_messages').select('*').eq('store_id', store.id).eq('from_phone_last10', target10).order('received_at', { ascending: true }),
    service.from('customers').select('*').eq('store_id', store.id)
      .eq('phone', phone).maybeSingle(),
  ])

  const out = (msgsRes.data ?? [])
    .filter(m => normalizePhone(m.customer_phone) === target)
    .map(m => {
      const deliveryError = (m.metadata as Record<string, unknown> | null)?.delivery_error as
        { code?: number; title?: string; details?: string | null } | undefined
      return {
        id: m.id, text: m.message, type: m.type, status: m.status,
        direction: 'out' as const, created_at: m.created_at,
        // Meta's own reason this specific message failed to deliver (set by
        // the status-update webhook, only present when status is 'failed')
        // — without this a failed send was just an unexplained X icon.
        errorDetail: deliveryError ? (deliveryError.details || deliveryError.title || null) : null,
      }
    })
  const inb = (inboundRes.data ?? [])
    .filter(m => normalizePhone(m.from_phone) === target)
    .map(m => ({
      id: m.id, text: friendlyInboundBody(m.message_type, m.body ?? `[${m.message_type ?? 'message'}]`), type: m.message_type ?? 'text',
      status: 'received', direction: 'in' as const, created_at: m.received_at,
      errorDetail: null as string | null,
    }))
  const messages = [...out, ...inb].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return NextResponse.json({ messages, customer: custRes.data ?? null })
}

// DELETE /api/live-chat/thread?phone=+91xxx — permanently erases the message
// history with this contact (both outbound `messages` and inbound
// `inbound_messages` rows for the org's store). Irreversible — the client
// confirms before calling this.
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Owner/admin only — this is a permanent, irreversible delete of a
  // customer's entire WhatsApp history, so it's the same tier as billing or
  // removing a teammate, not something every role with Live Chat access
  // (support, member) should be able to do with one misclick.
  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')
  if (!phone) return NextResponse.json({ error: 'phone is required' }, { status: 400 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: stores } = await service
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at')
    .eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(stores)
  if (!store) return NextResponse.json({ error: 'No store found' }, { status: 404 })

  // Same normalized-match reasoning as the GET handler above — an exact
  // .eq() here would only ever delete whichever raw format `phone` happens
  // to be in, silently leaving the other side's rows (and the conversation
  // still showing up) behind. Narrowed via the same generated last10 columns
  // instead of fetching every row the store has ever sent/received.
  const target = normalizePhone(phone)
  const target10 = last10Digits(phone)
  const [{ data: outRows }, { data: inRows }] = await Promise.all([
    service.from('messages').select('id, customer_phone').eq('store_id', store.id).eq('customer_phone_last10', target10),
    service.from('inbound_messages').select('id, from_phone').eq('store_id', store.id).eq('from_phone_last10', target10),
  ])
  const outIds = (outRows ?? []).filter(m => normalizePhone(m.customer_phone) === target).map(m => m.id)
  const inIds  = (inRows ?? []).filter(m => normalizePhone(m.from_phone) === target).map(m => m.id)

  const [outRes, inRes] = await Promise.all([
    outIds.length ? service.from('messages').delete().in('id', outIds) : Promise.resolve({ error: null }),
    inIds.length  ? service.from('inbound_messages').delete().in('id', inIds)  : Promise.resolve({ error: null }),
  ])
  if (outRes.error || inRes.error) {
    console.error('[live-chat/thread] delete failed:', outRes.error?.message, inRes.error?.message)
    return NextResponse.json({ error: "Couldn't delete this conversation — please try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
