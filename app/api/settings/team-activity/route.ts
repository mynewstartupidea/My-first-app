import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveManagedOrg } from '@/lib/resolve-managed-org'

// GET — per-rep activity summary for the sales team: leads assigned, calls logged,
// conversion rate, last activity. Owner/admin only — everyone else gets 403, since
// this exposes every teammate's individual performance numbers. resolveManagedOrg
// itself is the gate: it returns null (and this 403s) for anyone who isn't the
// owner or an active admin teammate.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const org = await resolveManagedOrg(service, user.id, user.email ?? '')
  if (!org) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ownerId = org.owner_id as string
  let ownerEmail = user.email ?? ''
  if (ownerId !== user.id) {
    const { data: ownerUser } = await service.auth.admin.getUserById(ownerId)
    ownerEmail = ownerUser?.user?.email ?? ownerEmail
  }

  const { data: members } = await service
    .from('team_members')
    .select('id, user_id, email, role')
    .eq('organization_id', org.id)
    .eq('status', 'active')
    .not('user_id', 'is', null)

  const people = [
    { user_id: ownerId, email: ownerEmail, role: 'owner' },
    ...(members ?? []).map(m => ({ user_id: m.user_id as string, email: m.email as string, role: m.role as string })),
  ]
  const peopleIds = people.map(p => p.user_id)

  const [{ data: leads }, { data: callLogs }] = await Promise.all([
    service.from('leads').select('assigned_to, lead_status').eq('user_id', ownerId),
    service.from('call_logs').select('called_by, created_at').in('called_by', peopleIds),
  ])

  const activity = people.map(person => {
    const assigned = (leads ?? []).filter(l => l.assigned_to === person.user_id)
    const converted = assigned.filter(l => l.lead_status === 'converted').length
    const calls = (callLogs ?? []).filter(c => c.called_by === person.user_id)
    const lastActivityAt = calls.reduce<string | null>((latest, c) => {
      const t = c.created_at as string
      return !latest || t > latest ? t : latest
    }, null)

    return {
      user_id:        person.user_id,
      email:           person.email,
      role:            person.role,
      leads_assigned:  assigned.length,
      converted,
      calls_logged:    calls.length,
      last_activity_at: lastActivityAt,
    }
  })

  return NextResponse.json({ activity })
}
