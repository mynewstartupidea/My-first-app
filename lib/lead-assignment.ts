import { createServiceClient } from '@/lib/supabase/server'

type ServiceClient = ReturnType<typeof createServiceClient>

// Round-robin auto-assignment for newly created leads. Extracted from
// lib/facebook-sync.ts, which only ran this for the manual "Sync Now"
// button and the initial page-connect sync — the two paths that actually
// deliver leads in production (the real-time webhook in
// app/api/facebook/webhook/route.ts, and the 5-minute polling cron in
// app/api/cron/facebook-leads/route.ts) never assigned anyone. An org with
// round-robin distribution turned on saw every real lead land unassigned;
// this is what every lead-ingestion path now calls so the setting actually
// does something.
export async function assignRoundRobin(
  service: ServiceClient,
  ownerId: string,
  newLeadIds: string[],
): Promise<void> {
  if (!newLeadIds.length) return

  const { data: orgRow } = await service
    .from('organizations')
    .select('id, lead_distribution_mode, distribution_members')
    .eq('owner_id', ownerId)
    .maybeSingle()
  if (orgRow?.lead_distribution_mode !== 'round_robin') return

  const distMembers = (orgRow.distribution_members ?? []) as Array<{ user_id: string }>
  if (!distMembers.length) return

  const { data: tmRows } = await service
    .from('team_members')
    .select('user_id, email')
    .eq('organization_id', orgRow.id)
    .eq('status', 'active')
    .in('user_id', distMembers.map(m => m.user_id))

  const rrMembers = distMembers
    .map(m => {
      const tm = tmRows?.find(t => t.user_id === m.user_id)
      return tm ? { user_id: m.user_id!, email: tm.email as string } : null
    })
    .filter(Boolean) as Array<{ user_id: string; email: string }>
  if (!rrMembers.length) return

  // advance_round_robin_position atomically reads+advances rr_current_pos and
  // returns the position this batch should start from — safe under
  // concurrent callers (webhook + cron could both fire for the same org
  // close together) instead of a read-once/advance-locally/write-once race.
  const { data: batchStartPos } = await service.rpc('advance_round_robin_position', {
    p_org_id: orgRow.id, p_count: newLeadIds.length, p_member_count: rrMembers.length,
  })
  const startPos = batchStartPos ?? 0
  for (let idx = 0; idx < newLeadIds.length; idx++) {
    const member = rrMembers[(startPos + idx) % rrMembers.length]
    await service.from('leads')
      .update({ assigned_to: member.user_id, assigned_name: member.email })
      .eq('id', newLeadIds[idx])
      .is('assigned_to', null)
  }
}
