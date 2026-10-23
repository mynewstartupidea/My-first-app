import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { pickPreferredStore } from '@/lib/store-selection'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolved to the org owner, via the service client — stores/customers RLS
  // is USING (auth.uid() = user_id) with no team-member carve-out, so a
  // teammate querying with the regular client got zero rows either way.
  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: stores } = await service
    .from('stores')
    .select('id, shop_name, shopify_domain, connected_at, updated_at, created_at')
    .eq('user_id', ownerId)
    .eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)

  const store = pickPreferredStore(stores)
  console.log(`[contacts/list] user=${user.id} owner=${ownerId} stores_found=${stores?.length ?? 0} using_store=${store?.id ?? 'none'}`)

  if (!store) {
    return NextResponse.json({ contacts: [], store: null, debug: 'no_active_store' })
  }

  const { data: contacts, error } = await service
    .from('customers')
    .select('*')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[contacts/list] query error:', error.message)
    return NextResponse.json({ error: "Couldn't load your contacts right now. Please refresh the page." }, { status: 500 })
  }

  // The list above is intentionally capped at 500 for display/search — but
  // the page's "Total contacts"/"Opted in"/"Opted out" stat chips used to be
  // derived from that same capped array, so a store with more than 500
  // customers (the Dashboard's own "Reachable on WhatsApp" KPI does a real,
  // unbounded count) silently showed a wrong, truncated total with no
  // indication anything was cut off. These are real counts, independent of
  // the 500-row cap above.
  const [{ count: total }, { count: optedIn }, { count: optedOut }] = await Promise.all([
    service.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', store.id),
    service.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('whatsapp_opt_in', true),
    service.from('customers').select('id', { count: 'exact', head: true }).eq('store_id', store.id).eq('whatsapp_opt_in', false),
  ])

  console.log(`[contacts/list] store=${store.id} contacts=${contacts?.length ?? 0} total=${total ?? 0}`)
  return NextResponse.json({
    contacts: contacts ?? [], store,
    counts: { total: total ?? 0, optedIn: optedIn ?? 0, optedOut: optedOut ?? 0 },
  })
}
