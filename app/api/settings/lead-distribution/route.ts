import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getOrg(service: ReturnType<typeof createServiceClient>, userId: string) {
  const { data } = await service
    .from('organizations')
    .select('id, lead_distribution_mode, rr_current_pos, distribution_members')
    .eq('owner_id', userId)
    .maybeSingle()
  return data
}

// GET — current distribution settings + active team members
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const org = await getOrg(service, user.id)
  if (!org) return NextResponse.json({ mode: 'manual', members: [], distribution_members: [] })

  const { data: members } = await service
    .from('team_members')
    .select('id, user_id, email, role, status')
    .eq('organization_id', org.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: true })

  return NextResponse.json({
    mode:                 org.lead_distribution_mode ?? 'manual',
    rr_current_pos:       org.rr_current_pos ?? 0,
    distribution_members: org.distribution_members ?? [],
    active_members:       members ?? [],
  })
}

// PATCH — update mode and/or member order
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    mode?: string
    distribution_members?: { user_id: string; weight: number }[]
  }

  const service = createServiceClient()
  const org = await getOrg(service, user.id)
  if (!org) return NextResponse.json({ error: 'No organization found. Invite a team member first.' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (body.mode)                 updates.lead_distribution_mode = body.mode
  if (body.distribution_members) updates.distribution_members   = body.distribution_members
  // Reset pointer when member order changes
  if (body.distribution_members) updates.rr_current_pos = 0

  const { error } = await service
    .from('organizations')
    .update(updates)
    .eq('id', org.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
