import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

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
  const { error } = await service
    .from('leads')
    .update({ lead_status: status })
    .eq('id', leadId)
    .or(`user_id.eq.${ownerId},assigned_to.eq.${user.id}`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
