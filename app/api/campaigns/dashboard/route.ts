import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getUserRole } from '@/lib/get-user-role'

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

  const { data: store } = await service
    .from('stores').select('id').eq('user_id', ownerId).eq('is_active', true)
    .order('shopify_domain', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()

  if (!store) return NextResponse.json({ hasStore: false, campaigns: [], templates: [], customers: [] })

  const [campsRes, tmplRes, custsRes] = await Promise.all([
    service.from('campaigns').select('*').eq('store_id', store.id).order('created_at', { ascending: false }),
    service.from('templates').select('id,name,body,category').eq('user_id', ownerId).eq('is_archived', false).limit(50),
    service.from('customers').select('phone,whatsapp_opt_in,total_orders,total_spent,last_order_at').eq('store_id', store.id),
  ])

  return NextResponse.json({
    hasStore: true,
    campaigns: campsRes.data ?? [],
    templates: tmplRes.data ?? [],
    customers: custsRes.data ?? [],
  })
}
