// Server-only — uses createServiceClient (next/headers). Do not import in Client Components.
import { createServiceClient } from '@/lib/supabase/server'
export type { UserRole } from '@/lib/user-role'
export { ROLE_NAV_ACCESS, canAccess } from '@/lib/user-role'

export async function getUserRole(userId: string, userEmail: string): Promise<import('@/lib/user-role').UserRole> {
  void userEmail // kept for call-site stability; membership is now matched by user_id (see below)
  try {
    const service = createServiceClient()

    // An active team membership takes priority over any store this account happens
    // to independently own. Checking `stores` first (the old order) meant someone
    // who'd previously self-signed-up for their own trial store — then got invited
    // as Sales/Support/Manager into a different organization — was classified
    // 'owner' of their own old store, which grants '*' nav access everywhere,
    // silently overriding the role they were actually invited with.
    const { data: member } = await service
      .from('team_members')
      .select('role')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (member?.role) return member.role as import('@/lib/user-role').UserRole

    const { data: store } = await service
      .from('stores')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (store) return 'owner'

    return 'owner'
  } catch {
    return 'owner'
  }
}
