import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { pickPreferredStore } from '@/lib/store-selection'

// Backs the Automations page — previously loaded (and saved) via direct
// client-side queries against stores/whatsapp_accounts/automations, all
// blocked by RLS (USING auth.uid() = user_id, no team-member carve-out)
// for anyone but the store owner, even though manager/admin roles are
// explicitly meant to manage automations (see lib/user-role.ts).

async function resolveContext(userId: string) {
  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, userId)
  const [{ data: stores }, { data: wa }] = await Promise.all([
    service.from('stores').select('id, shopify_domain, connected_at, updated_at, created_at')
      .eq('user_id', ownerId).eq('is_active', true)
      .order('connected_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(10),
    service.from('whatsapp_accounts').select('id').eq('user_id', ownerId).eq('status', 'connected').maybeSingle(),
  ])
  const store = pickPreferredStore(stores)
  return { service, ownerId, store, whatsappConnected: !!wa }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { service, store, whatsappConnected } = await resolveContext(user.id)
  if (!store) return NextResponse.json({ hasStore: false, whatsappConnected, storeId: null, automations: [] })

  const { data } = await service.from('automations').select('*').eq('store_id', store.id)
  return NextResponse.json({ hasStore: true, whatsappConnected, storeId: store.id, automations: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as Record<string, unknown> & { type?: string }
  if (!body.type) return NextResponse.json({ error: 'type is required' }, { status: 400 })

  const { service, store } = await resolveContext(user.id)
  if (!store) return NextResponse.json({ error: 'No active store' }, { status: 400 })

  const { data: existing } = await service
    .from('automations').select('id').eq('store_id', store.id).eq('type', body.type).maybeSingle()

  const { error } = existing
    ? await service.from('automations').update(body).eq('id', existing.id)
    : await service.from('automations').insert({ ...body, store_id: store.id, template: body.template ?? '' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
