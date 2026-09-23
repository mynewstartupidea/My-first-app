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

  const { data: membership } = await service
    .from('team_members').select('organization_id, role')
    .eq('email', userEmail).eq('status', 'active').maybeSingle()
  if (membership?.role !== 'admin' || !membership.organization_id) return null

  const { data: org } = await service
    .from('organizations').select('*').eq('id', membership.organization_id).maybeSingle()
  return org ?? null
}
