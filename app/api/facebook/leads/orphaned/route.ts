import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getUserRole } from '@/lib/get-user-role'

type ServiceClient = ReturnType<typeof createServiceClient>

// "Orphaned" leads: tied to a page_id that isn't any of the account's
// CURRENTLY connected Facebook pages — left behind when a merchant
// disconnects or reconnects to a different page. facebook_connections only
// ever keeps the live connection row, so once that happens the lead rows'
// page_id no longer matches anything, with no way to browse them under the
// normal per-page selector even though the data itself is untouched (same
// convention every CRM follows: disconnecting an integration stops future
// syncing, it never deletes what's already been captured). Deliberately
// EXCLUDES leads with page_id IS NULL — manual/CSV/website-form leads never
// had a page to begin with, so they're never "orphaned."
// A placeholder that can never equal a real Facebook page_id, used so the
// "not in (...)" filter is always a single, unconditional chain — reassigning
// a Supabase query builder across an `if` (query = query.not(...)) blows up
// TS2589 (excessively deep type instantiation) rather than a real bug.
async function connectedPageIdsFilter(service: ServiceClient, ownerId: string): Promise<string> {
  const { data: conns } = await service.from('facebook_connections').select('page_id').eq('user_id', ownerId)
  const connectedPageIds = (conns ?? []).map(c => c.page_id as string)
  const ids = connectedPageIds.length > 0 ? connectedPageIds : ['__none_connected__']
  return `(${ids.map(id => `"${id}"`).join(',')})`
}

// GET — just the count, for the "N leads from disconnected pages" banner.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const notIn = await connectedPageIdsFilter(service, ownerId)
  const { count } = await service.from('leads').select('id', { count: 'exact', head: true })
    .eq('user_id', ownerId)
    .not('page_id', 'is', null)
    .not('page_id', 'in', notIn)
  return NextResponse.json({ count: count ?? 0 })
}

// DELETE — permanently removes every orphaned lead. Deliberately its own,
// separate, explicitly-triggered action rather than something that happens
// as a side effect of disconnecting a page — disconnecting never deletes
// data on its own, same as every other CRM's integration-disconnect flow.
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Same tier as disconnecting a page — this is a permanent, irreversible
  // bulk delete of real lead records, not a routine per-lead action.
  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can delete leads.' }, { status: 403 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const notIn = await connectedPageIdsFilter(service, ownerId)

  const { error } = await service.from('leads').delete()
    .eq('user_id', ownerId)
    .not('page_id', 'is', null)
    .not('page_id', 'in', notIn)
  if (error) {
    console.error('[leads/orphaned] delete failed:', error.message)
    return NextResponse.json({ error: "Couldn't delete these leads. Please try again." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
