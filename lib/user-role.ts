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
    '/dashboard/live-chat',
    '/dashboard/contacts',
    '/dashboard/leads',
    '/dashboard/support',
    '/dashboard/settings',
  ],
}

export function canAccess(role: UserRole, href: string): boolean {
  const allowed = ROLE_NAV_ACCESS[role]
  if (allowed.includes('*')) return true
  // '/dashboard' is in every restricted role's list (it's the home page), but
  // every other route also starts with '/dashboard/' — so prefix-matching it
  // like any other entry silently granted every role access to every route.
  // Exact-match it instead; keep prefix matching for actual section entries
  // (e.g. '/dashboard/leads' still covers '/dashboard/leads/123').
  return allowed.some(a => href === a || (a !== '/dashboard' && href.startsWith(a + '/')))
}
