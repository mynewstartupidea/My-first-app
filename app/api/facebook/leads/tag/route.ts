import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId, isActiveOrgMember } from '@/lib/resolve-owner-user-id'

const VALID_STATUSES = new Set(['hot', 'warm', 'cold', 'lost', 'converted', 'junk', 'resolved'])

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leadId, status } = await request.json() as { leadId: string; status: string | null }

  if (status !== null && !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  // leads.user_id is the org owner's id, not necessarily the caller's — a team
  // member tagging a lead assigned to them (or, being an active teammate,
  // any lead in the shared org) previously always failed this check silently.
  // assigned_to is only trusted for a currently active org member — see
  // isActiveOrgMember's docstring for why.
  const activeMember = await isActiveOrgMember(service, user.id)
  const accessFilter = activeMember ? `user_id.eq.${ownerId},assigned_to.eq.${user.id}` : `user_id.eq.${ownerId}`
  const { error } = await service
    .from('leads')
    .update({ lead_status: status })
    .eq('id', leadId)
    .or(accessFilter)

  if (error) {
    console.error('[leads/tag] update failed:', error.message)
    return NextResponse.json({ error: "Couldn't update this lead's status. Please try again." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
