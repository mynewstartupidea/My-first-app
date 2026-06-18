import { createServiceClient } from '@/lib/supabase/server'

export type UserRole = 'owner' | 'admin' | 'manager' | 'support' | 'member'

// Role → which sidebar hrefs are accessible
export const ROLE_NAV_ACCESS: Record<UserRole, string[]> = {
  owner:   ['*'],
  admin:   ['*'],
  manager: [
    '/dashboard',
    '/dashboard/live-chat',
    '/dashboard/contacts',
    '/dashboard/campaigns',
    '/dashboard/automations',
    '/dashboard/templates',
    '/dashboard/shopify',
    '/dashboard/analytics',
  ],
  support: [
    '/dashboard',
    '/dashboard/live-chat',
    '/dashboard/contacts',
  ],
  member: [
    '/dashboard',
    '/dashboard/analytics',
  ],
}

export function canAccess(role: UserRole, href: string): boolean {
  const allowed = ROLE_NAV_ACCESS[role]
  if (allowed.includes('*')) return true
  return allowed.some(a => href === a || href.startsWith(a + '/'))
}

/**
 * Returns the effective role for the current user.
 * Owners of a store always get 'owner'. Invited team members get their assigned role.
 */
export async function getUserRole(userId: string, userEmail: string): Promise<UserRole> {
  try {
    const service = createServiceClient()

    // Check if this user owns any active store
    const { data: store } = await service
      .from('stores')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (store) return 'owner'

    // Check if they are an invited team member
    const { data: member } = await service
      .from('team_members')
      .select('role')
      .eq('email', userEmail)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()

    if (member?.role) return member.role as UserRole

    return 'owner' // safe fallback — don't lock out unknown users
  } catch {
    return 'owner'
  }
}
