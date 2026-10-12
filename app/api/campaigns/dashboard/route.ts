import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getUserRole } from '@/lib/get-user-role'
import { pickPreferredStore } from '@/lib/store-selection'

// Backs the main Campaigns page load — previously three direct client-side
// Supabase queries (stores/campaigns/templates/customers), all blocked by
// RLS (USING auth.uid() = user_id, no team-member carve-out) for anyone but
// the store owner. Resolved to the owner and read via the service client.
//
// Campaigns is manager/admin/owner-only (lib/user-role.ts) — gate this the
// same as app/api/campaigns/route.ts so a 'member'/'support' teammate can't
// pull customer phone numbers/spend data via direct API call either.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ error: 'You don\'t have access to Campaigns.' }, { status: 403 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  // pickPreferredStore (most-recently-connected Shopify store, falling back
  // to most-recently-updated) is what every other campaign/send/automation
  // route uses to resolve "the" store — this route alone picked the
  // alphabetically-first connected domain instead. If an owner ever ends up
  // with more than one is_active store row (stores has no uniqueness
  // constraint; both Shopify connect routes do a non-atomic check-then-
  // insert), this page's campaign list/templates/audience preview could
  // silently reflect a different store than the one campaigns actually get
  // created/sent against.
  const { data: stores } = await service
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at')
    .eq('user_id', ownerId).eq('is_active', true)
  const store = pickPreferredStore(stores)

  if (!store) return NextResponse.json({ hasStore: false, campaigns: [], templates: [], customers: [] })

  // Paginated — PostgREST commonly caps a single request at a server-side
  // "Max Rows" setting regardless of what's asked for (same reasoning
  // lib/campaign-queue.ts's actual send-time audience query already
  // documents). Without this, a store with more customers than that cap
  // showed an under-counted "N contacts will receive this" preview here,
  // while the real send (which does paginate) reached everyone — the
  // opposite direction of "preview promises more than it delivers," but the
  // same class of preview/reality mismatch.
  const customers: { phone: string; whatsapp_opt_in: boolean; total_orders: number; total_spent: number; last_order_at: string | null }[] = []
  for (let offset = 0; ; offset += 1000) {
    const { data: page } = await service
      .from('customers').select('phone,whatsapp_opt_in,total_orders,total_spent,last_order_at')
      .eq('store_id', store.id).range(offset, offset + 999)
    if (!page?.length) break
    customers.push(...page)
    if (page.length < 1000) break
  }

  const [campsRes, tmplRes] = await Promise.all([
    service.from('campaigns').select('*').eq('store_id', store.id).order('created_at', { ascending: false }),
    service.from('templates').select('id,name,body,category').eq('user_id', ownerId).eq('is_archived', false).limit(50),
  ])

  return NextResponse.json({
    hasStore: true,
    campaigns: campsRes.data ?? [],
    templates: tmplRes.data ?? [],
    customers,
  })
}
