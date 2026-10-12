import { createServiceClient } from '@/lib/supabase/server'

// Resolves the organization a given user can manage: either they own it directly,
// or they're an active admin teammate on someone else's org. Several team/settings
// API routes used to check only organizations.owner_id = userId, which meant an
// invited Admin — who has full ('*') access everywhere else in the app — got 403s
// and empty results for team management endpoints. Owner and admin are meant to be
// equivalent for managing the team; this is the one place that decides it.
export async function resolveManagedOrg(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  userEmail: string,
): Promise<{ id: string } & Record<string, unknown> | null> {
  const { data: ownedOrg } = await service
    .from('organizations').select('*').eq('owner_id', userId).maybeSingle()
  if (ownedOrg) return ownedOrg

  // Matched by user_id, not email — every other identity resolver in this
  // codebase (getUserRole, resolveOwnerUserId) keys off user_id, and
  // team_members.email is always stored lowercased at invite/activation
  // time while the caller's auth email is passed through as-is. An admin
  // whose auth email has any uppercase (OAuth-provided casing, e.g.) failed
  // this exact-match lookup and got 403'd from team management/lead
  // distribution/team activity/FB pages, while getUserRole (user_id-based)
  // still correctly reported them as admin everywhere else — a confusing
  // split-permission state. user_id is reliably populated once a teammate
  // is active (same assumption resolveOwnerUserId already makes).
  const { data: membership } = await service
    .from('team_members').select('organization_id, role')
    .eq('user_id', userId).eq('status', 'active').maybeSingle()
  if (membership?.role !== 'admin' || !membership.organization_id) return null

  const { data: org } = await service
    .from('organizations').select('*').eq('id', membership.organization_id).maybeSingle()
  return org ?? null
}
