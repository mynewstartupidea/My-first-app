import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { pickPreferredStore } from '@/lib/store-selection'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getUserRole } from '@/lib/get-user-role'

// GET /api/campaigns — list campaigns for the org's store. Resolved to the
// owner and read via the service client — stores/campaigns RLS is USING
// (auth.uid() = user_id) with no team-member carve-out, so a teammate
// always got an empty campaigns list here regardless of the org's real data.
//
// Campaigns are manager/admin/owner-only (lib/user-role.ts) — this and POST
// below previously only checked for a logged-in user, so a 'member' or
// 'support' teammate (no Campaigns nav link, no UI access) could still list,
// create, and (via /api/campaigns/send) actually send WhatsApp campaigns by
// calling the API directly. The page hiding the link was the only gate.
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

  const { data: stores } = await service
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at').eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(stores)
  if (!store) return NextResponse.json({ campaigns: [] })

  const { data, error } = await service
    .from('campaigns')
    .select('*')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data })
}

// POST /api/campaigns — create a campaign
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ error: 'You don\'t have access to Campaigns.' }, { status: 403 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: stores } = await service
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at').eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(stores)
  if (!store) return NextResponse.json({ error: 'No active store' }, { status: 400 })

  const body = await req.json()
  const { name, message, audience, scheduled_at } = body

  if (!name || !message || !audience) {
    return NextResponse.json({ error: 'name, message, and audience are required' }, { status: 400 })
  }

  const { data, error } = await service
    .from('campaigns')
    .insert({
      store_id:    store.id,
      name:        name.trim(),
      message:     message.trim(),
      audience,
      status:      scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign: data })
}
