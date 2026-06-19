// Client-safe role helpers — no server imports.
// getUserRole lives in lib/get-user-role.ts (server-only).

export type UserRole = 'owner' | 'admin' | 'manager' | 'support' | 'member'

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
