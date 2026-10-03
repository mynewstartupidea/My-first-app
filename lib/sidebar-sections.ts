// Shared source of truth for the user-customizable sidebar/mobile-footer
// sections — used by onboarding (initial picks), Settings → Sidebar (ongoing
// edits), and both nav components (what actually renders). Dashboard,
// Settings, Support, and Developer are NOT in this list — those stay
// permanently in the nav, since they're account-wide utilities rather than
// a workflow a given business type would or wouldn't use.
export interface SidebarSection {
  key: string
  label: string
  href: string
}

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  { key: 'live_chat',    label: 'Live Chat',    href: '/dashboard/live-chat' },
  { key: 'contacts',     label: 'Contacts',     href: '/dashboard/contacts' },
  { key: 'leads',        label: 'Leads',        href: '/dashboard/leads' },
  { key: 'shopify',      label: 'Shopify',      href: '/dashboard/shopify' },
  { key: 'campaigns',    label: 'Campaigns',    href: '/dashboard/campaigns' },
  { key: 'automations',  label: 'Automations',  href: '/dashboard/automations' },
  { key: 'ai_assistant', label: 'AI Assistant', href: '/dashboard/ai-assistant' },
  { key: 'templates',    label: 'Templates',    href: '/dashboard/templates' },
  { key: 'integrations', label: 'Integrations', href: '/dashboard/integrations' },
  { key: 'analytics',    label: 'Analytics',    href: '/dashboard/analytics' },
]

export const SIDEBAR_SECTION_KEYS = SIDEBAR_SECTIONS.map(s => s.key)

// Onboarding pre-checks these based on the business type just chosen — fully
// adjustable afterward, this just saves most people from unchecking a pile of
// boxes for the one section that obviously doesn't apply to them yet.
export const DEFAULT_SECTIONS_BY_BUSINESS_TYPE: Record<'ecommerce' | 'lead_gen', string[]> = {
  ecommerce: ['shopify', 'campaigns', 'automations', 'contacts', 'live_chat', 'analytics', 'templates', 'integrations', 'ai_assistant'],
  lead_gen:  ['leads', 'campaigns', 'automations', 'contacts', 'live_chat', 'analytics', 'templates', 'integrations', 'ai_assistant'],
}

// Which 2 selected sections win the mobile footer's fixed middle slots
// (Home and More are always the outer two) — ranked by workflow importance,
// not the sidebar's own display order, so e.g. Leads/Shopify beats Contacts/
// Analytics when both are selected. Matches today's hardcoded Home/Leads/
// Chat/More exactly when leads is the selected primary section.
export const MOBILE_FOOTER_PRIORITY = [
  'leads', 'live_chat', 'shopify', 'campaigns', 'contacts',
  'automations', 'analytics', 'templates', 'integrations', 'ai_assistant',
]

// NULL/empty visible_sections means "show everything" — every account that
// pre-dates this feature, or hasn't customized yet, keeps its current full
// nav rather than suddenly losing links.
export function resolveVisibleSections(visibleSections: string[] | null | undefined): Set<string> {
  if (!visibleSections || visibleSections.length === 0) return new Set(SIDEBAR_SECTION_KEYS)
  return new Set(visibleSections)
}
