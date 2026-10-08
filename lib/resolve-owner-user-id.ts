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

// resolveOwnerUserId falls back to returning the caller's own id both for a
// genuine solo owner AND for someone who is no longer an active member of
// any org (a removed teammate, or someone never invited) — the two cases
// are indistinguishable from its return value alone. Several lead routes
// additionally trust `assigned_to.eq.<caller>` as a second way in (so a rep
// can act on leads assigned to them without being the org owner); without
// this check, a removed team member keeps indefinite read/write access to
// every lead that was ever assigned to them, since nothing clears
// `assigned_to` when they're removed and the `.or(...)` filter silently
// re-validates against their own (no-longer-meaningful) user id instead of
// denying them. Any route trusting an `assigned_to.eq.<caller>` branch must
// gate it on this being true first.
export async function isActiveOrgMember(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
): Promise<boolean> {
  const [{ data: ownedOrg }, { data: memberRow }] = await Promise.all([
    service.from('organizations').select('id').eq('owner_id', userId).maybeSingle(),
    service.from('team_members').select('id').eq('user_id', userId).eq('status', 'active').maybeSingle(),
  ])
  return !!ownedOrg || !!memberRow
}
