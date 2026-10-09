import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/facebook/leads/stats?page_id=xxx  or  ?source=walk_in
// Returns aggregate counts for the selected page (or, for non-Facebook leads
// with no page_id, the selected source) — independent of which form tab or
// pagination page the user is on.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('page_id')
  const source = searchParams.get('source')
  // "every lead regardless of page" mode — see ALL_PAGES_ID in the Leads
  // page for why this exists (leads from a page connected before the
  // current one would otherwise have no way to be counted or browsed at all).
  const all = searchParams.get('all') === 'true'
  if (!pageId && !source && !all) return NextResponse.json({ total: 0, withPhone: 0, sent: 0, pending: 0 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Mirrors /api/facebook/leads' own visibility resolution exactly — this
  // used to just filter by `user_id.eq(ownerId)` with no open_pool
  // restriction at all, so a team member in open_pool mode (who only sees
  // their own assigned + unclaimed leads in the actual list) was shown the
  // ENTIRE org's totals in the header stats — a visible mismatch between
  // the summary count and the rows actually rendered below it.
  let orgOwnerId: string | null = null
  let distMode = 'manual'
  const { data: memberRow } = await service
    .from('team_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (memberRow?.organization_id) {
    const { data: org } = await service
      .from('organizations')
      .select('owner_id, lead_distribution_mode')
      .eq('id', memberRow.organization_id)
      .maybeSingle()
    if (org) {
      orgOwnerId = org.owner_id
      distMode   = org.lead_distribution_mode ?? 'manual'
    }
  }
  const ownerId = orgOwnerId ?? user.id
  // assigned_to is only trusted for a currently active team member (a
  // removed teammate has no memberRow, same fallback as the real owner's
  // case) — see isActiveOrgMember's docstring in lib/resolve-owner-user-id.ts.
  // The owner loses nothing: user_id.eq.ownerId already covers their org.
  const activeMember = !!memberRow
  const visibilityFilter = (orgOwnerId && distMode === 'open_pool' && activeMember)
    ? `assigned_to.eq.${user.id},and(user_id.eq.${ownerId},assigned_to.is.null)`
    : activeMember
      ? `user_id.eq.${ownerId},assigned_to.eq.${user.id}`
      : `user_id.eq.${ownerId}`

  const base = () => {
    const q = service.from('leads').select('id', { count: 'exact', head: true }).or(visibilityFilter)
    return source ? q.eq('source', source) : all ? q : q.eq('page_id', pageId as string)
  }

  const [totalRes, withPhoneRes, sentRes, pendingRes] = await Promise.all([
    base(),
    base().not('phone', 'is', null),
    base().eq('wa_status', 'sent'),
    base().eq('wa_status', 'pending'),
  ])

  return NextResponse.json({
    total:     totalRes.count     ?? 0,
    withPhone: withPhoneRes.count ?? 0,
    sent:      sentRes.count      ?? 0,
    pending:   pendingRes.count   ?? 0,
  })
}
