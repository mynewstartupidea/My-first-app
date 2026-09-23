import { createServiceClient } from '@/lib/supabase/server'

// facebook_connections, lead_form_automations, whatsapp_accounts and leads are all
// scoped by a `user_id` column that points at the org owner's own auth.users.id —
// these tables predate the team/org model and were never given an organization_id
// column. Any active teammate (any role — member reps included, not just admins)
// needs their org owner's id to read or write this data; the owner (or a solo user
// with no team) just uses their own id. Mirrors the lookup already proven in
// app/api/facebook/leads/route.ts, extracted here so every Facebook-data route uses
// the same resolution instead of each re-deriving it (and some routes skipping it
// entirely, which was the bug: team members saw empty pages/leads/stats).
export async function resolveOwnerUserId(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<string> {
  const { data: memberRow } = await service
    .from('team_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (!memberRow?.organization_id) return userId

  const { data: org } = await service
    .from('organizations')
    .select('owner_id')
    .eq('id', memberRow.organization_id)
    .maybeSingle()
  return (org?.owner_id as string | undefined) ?? userId
}
