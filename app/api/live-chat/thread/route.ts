import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { pickPreferredStore } from '@/lib/store-selection'

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

  const [msgsRes, inboundRes, custRes] = await Promise.all([
    service.from('messages').select('*').eq('store_id', store.id)
      .eq('customer_phone', phone).order('created_at', { ascending: true }),
    service.from('inbound_messages').select('*').eq('store_id', store.id)
      .eq('from_phone', phone).order('received_at', { ascending: true }),
    service.from('customers').select('*').eq('store_id', store.id)
      .eq('phone', phone).maybeSingle(),
  ])

  const out = (msgsRes.data ?? []).map(m => ({
    id: m.id, text: m.message, type: m.type, status: m.status,
    direction: 'out' as const, created_at: m.created_at,
  }))
  const inb = (inboundRes.data ?? []).map(m => ({
    id: m.id, text: m.body ?? `[${m.message_type ?? 'message'}]`, type: m.message_type ?? 'text',
    status: 'received', direction: 'in' as const, created_at: m.received_at,
  }))
  const messages = [...out, ...inb].sort((a, b) => a.created_at.localeCompare(b.created_at))

  return NextResponse.json({ messages, customer: custRes.data ?? null })
}
