export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { canAccess } from '@/lib/user-role'
import {
  Settings, Megaphone, Zap, BarChart2, Sparkles,
  Users, FileText, Plug, Code2, LifeBuoy, ChevronRight, ShoppingBag, UserPlus,
} from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { resolveVisibleSections, MOBILE_FOOTER_PRIORITY, SIDEBAR_SECTIONS } from '@/lib/sidebar-sections'
import InstallAppCard from '@/components/install-app-card'
import SignOutButton from '@/components/sign-out-button'
import NotificationBell from '@/components/notification-bell'

// Everything that doesn't earn one of the bottom nav's 2 dynamic tab slots
// (see components/mobile-bottom-nav.tsx — picked per-account from
// visible_sections, not hardcoded to Leads/Chat anymore) lives here instead,
// grouped by how often it actually gets touched. `key` matches
// lib/sidebar-sections.ts's SIDEBAR_SECTIONS; items with none (Developer,
// Support) are account-wide utilities and always show. Filtered by the same
// canAccess() the desktop sidebar already uses, so a sales rep sees exactly
// the reduced set they're meant to, same as everywhere else in the app.
const GROUPS: { title: string; items: { key?: string; href: string; icon: typeof Settings; label: string; blurb: string }[] }[] = [
  {
    title: 'Run the business',
    items: [
      { key: 'leads',       href: '/dashboard/leads',       icon: UserPlus,    label: 'Leads',       blurb: 'Capture and follow up with leads' },
      { key: 'shopify',     href: '/dashboard/shopify',     icon: ShoppingBag, label: 'Shopify',     blurb: 'Orders, abandoned checkouts, revenue' },
      { key: 'automations', href: '/dashboard/automations', icon: Zap,         label: 'Automations', blurb: 'Auto-replies and follow-up rules' },
      { key: 'ai_assistant', href: '/dashboard/ai-assistant', icon: Sparkles,  label: 'AI Assistant', blurb: 'AI auto-reply on WhatsApp' },
      { key: 'campaigns',   href: '/dashboard/campaigns',   icon: Megaphone,   label: 'Campaigns',   blurb: 'Bulk WhatsApp sends' },
      { key: 'analytics',   href: '/dashboard/analytics',   icon: BarChart2,   label: 'Analytics',   blurb: 'Lead quality and close rate' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { key: 'contacts',     href: '/dashboard/contacts',     icon: Users,    label: 'Contacts',     blurb: 'Saved WhatsApp contacts' },
      { key: 'templates',    href: '/dashboard/templates',    icon: FileText, label: 'Templates',    blurb: 'Approved WhatsApp message templates' },
      { key: 'integrations', href: '/dashboard/integrations', icon: Plug,     label: 'Integrations', blurb: 'Connect other tools' },
    ],
  },
  {
    title: 'Help',
    items: [
      { href: '/dashboard/developer', icon: Code2,    label: 'Developer', blurb: 'API keys and custom forms' },
      { href: '/dashboard/support',   icon: LifeBuoy, label: 'Support',   blurb: 'Get help from our team' },
    ],
  },
]

export default async function MorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = await getUserRole(user.id, user.email ?? '')

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const { data: store } = await service
    .from('stores').select('visible_sections').eq('user_id', ownerId).eq('is_active', true)
    .limit(1).maybeSingle()

  const enabledSections = resolveVisibleSections(store?.visible_sections ?? null)
  // Whichever 2 sections the bottom nav is already showing as tabs — kept out
  // of this list so nothing appears twice. Must mirror MobileBottomNav's own
  // canAccess() filtering exactly, or a restricted role (Sales/Support/
  // Manager) could see an item here that it actually never got a footer tab
  // for (role-filtered out there), duplicating nothing — but equally, an
  // item the bottom nav DID give to a lower role instead of a higher-
  // priority one it couldn't access would otherwise show twice here too.
  const footerPicks = new Set(
    MOBILE_FOOTER_PRIORITY
      .filter(k => enabledSections.has(k))
      .filter(k => { const s = SIDEBAR_SECTIONS.find(s => s.key === k); return s && canAccess(role, s.href) })
      .slice(0, 2)
  )

  const groups = GROUPS
    .map(g => ({
      ...g,
      items: g.items.filter(item =>
        (!item.key || enabledSections.has(item.key)) &&
        !(item.key && footerPicks.has(item.key)) &&
        canAccess(role, item.href)
      ),
    }))
    .filter(g => g.items.length > 0)

  return (
    <div className="p-4 space-y-5 md:hidden">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">More</h1>
        {/* NotificationBell previously only existed in the desktop sidebar
            (hidden md:flex) — a mobile-only user had no way to see or act
            on in-app notifications at all, same class of gap as the
            desktop-only sign-out button fixed earlier. */}
        <NotificationBell variant="light" />
      </div>

      <InstallAppCard />

      <Link
        href="/dashboard/settings"
        className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 active:scale-[0.98] transition"
      >
        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Settings className="w-5 h-5 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Settings</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {role === 'owner' || role === 'admin' ? 'Account, WhatsApp, team, billing' : 'Account, password'}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </Link>

      {groups.map(group => (
        <div key={group.title}>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">{group.title}</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
            {group.items.map(({ href, icon: Icon, label, blurb }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 p-4 active:bg-gray-50 transition"
              >
                <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{blurb}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      <SignOutButton />
    </div>
  )
}
