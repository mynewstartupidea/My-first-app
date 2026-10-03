'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Menu, MessageSquare, Users, UserPlus, ShoppingBag,
  Megaphone, Zap, Sparkles, FileText, Plug, BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SIDEBAR_SECTIONS, MOBILE_FOOTER_PRIORITY, resolveVisibleSections } from '@/lib/sidebar-sections'

// Home and More are permanent; the two slots between them are picked from
// whichever sections the account has enabled, ranked by MOBILE_FOOTER_PRIORITY
// — so e.g. an ecommerce account sees Shopify here instead of Leads. Matches
// how Salesforce/HubSpot/Pipedrive/Close structure mobile nav for this app
// category: a few core destinations always visible, one hub for the rest.
const SECTION_ICONS: Record<string, typeof MessageSquare> = {
  live_chat: MessageSquare, contacts: Users, leads: UserPlus, shopify: ShoppingBag,
  campaigns: Megaphone, automations: Zap, ai_assistant: Sparkles,
  templates: FileText, integrations: Plug, analytics: BarChart2,
}

export default function MobileBottomNav({ visibleSections = null }: { visibleSections?: string[] | null }) {
  const pathname = usePathname()

  const enabledSections = resolveVisibleSections(visibleSections)
  const footerSections = MOBILE_FOOTER_PRIORITY
    .filter(key => enabledSections.has(key))
    .slice(0, 2)
    .map(key => SIDEBAR_SECTIONS.find(s => s.key === key))
    .filter((s): s is NonNullable<typeof s> => !!s)

  const TABS = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
    ...footerSections.map(s => ({ href: s.href, icon: SECTION_ICONS[s.key] ?? Menu, label: s.label === 'Live Chat' ? 'Chat' : s.label })),
    { href: '/dashboard/more', icon: Menu, label: 'More' },
  ]

  const activeHref = TABS.find(t =>
    t.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(t.href)
  )?.href
  // Any route not matched by a visible tab is reachable only via More
  // (Settings, and anything not in the footer's 2 picks), so More stays
  // highlighted there too — otherwise landing on Settings would show no
  // active tab at all.
  const isMore = !activeHref || activeHref === '/dashboard/more'

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0a0f1e] border-t border-white/[0.06]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-[60px]">
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = href === '/dashboard/more' ? isMore : activeHref === href
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full active:scale-90 transition-transform duration-100"
            >
              <Icon
                size={21}
                className={cn('transition-colors', active ? 'text-[#25D366]' : 'text-slate-500')}
              />
              <span className={cn('text-[10px] font-medium transition-colors leading-none', active ? 'text-[#25D366]' : 'text-slate-500')}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-[#25D366] rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
