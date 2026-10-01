import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

// The Missed Call Follow-up automation is org-wide, not per-person — the
// only place that actually reads it (/api/leads/[id]/conversation-status)
// checks the ORG OWNER's user_profiles row. The toggle on the Automations
// page used to read/write the CALLER's own row directly via the RLS-bound
// client, so for any non-owner (Admin/Manager both have nav access here)
// the toggle was pure UI theater: it visually turned "on" but never
// affected anyone, and there was no way for a non-owner to actually change
// the one row that matters.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data } = await service
    .from('user_profiles')
    .select('missed_call_followup_enabled')
    .eq('id', ownerId)
    .maybeSingle()

  return NextResponse.json({ enabled: data?.missed_call_followup_enabled ?? false })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { enabled?: boolean }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { error } = await service
    .from('user_profiles')
    .update({ missed_call_followup_enabled: body.enabled })
    .eq('id', ownerId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, enabled: body.enabled })
}
