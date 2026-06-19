// Server-only — uses createServiceClient (next/headers). Do not import in Client Components.
import { createServiceClient } from '@/lib/supabase/server'
export type { UserRole } from '@/lib/user-role'
export { ROLE_NAV_ACCESS, canAccess } from '@/lib/user-role'

export async function getUserRole(userId: string, userEmail: string): Promise<import('@/lib/user-role').UserRole> {
  try {
    const service = createServiceClient()

    const { data: store } = await service
      .from('stores')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (store) return 'owner'

    const { data: member } = await service
      .from('team_members')
      .select('role')
      .eq('email', userEmail)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (member?.role) return member.role as import('@/lib/user-role').UserRole

    return 'owner'
  } catch {
    return 'owner'
  }
}
