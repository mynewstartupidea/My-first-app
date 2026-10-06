import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

const VALID_STATUSES = new Set(['hot', 'warm', 'cold', 'lost', 'converted', 'junk', 'resolved'])

// PATCH /api/leads/[id]/status  { status: 'hot' | null }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { status: string | null }

  if (body.status !== null && !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: lead } = await service
    .from('leads')
    .select('id')
    .eq('id', id)
    .or(`user_id.eq.${ownerId},assigned_to.eq.${user.id}`)
    .maybeSingle()

  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Previously this didn't check the result at all — a failed update (RLS,
  // dropped connection, etc.) still returned { ok: true }, so the client had
  // no way to know the status tag it just applied was never actually saved.
  const { error } = await service.from('leads').update({ lead_status: body.status }).eq('id', id)
  if (error) {
    console.error('[leads/status] update error:', error.message)
    return NextResponse.json({ error: "Couldn't update this lead's status. Please try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
