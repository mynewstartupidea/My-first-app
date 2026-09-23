'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, UserPlus, MessageSquare, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

// Only these three get a permanent tab — the things done constantly (checking
// leads, replying to chats). Everything else (Automations, Campaigns,
// Analytics, Templates, Settings, ...) lives behind "More" instead of eating
// a tab slot for something opened once a week. Matches how Salesforce,
// HubSpot, Pipedrive and Close all structure mobile nav for this category of
// app: a few core destinations always visible, one hub for the rest — never
// a top hamburger hiding the core workflow itself.
const TABS = [
  { href: '/dashboard',           icon: LayoutDashboard, label: 'Home'  },
  { href: '/dashboard/leads',     icon: UserPlus,        label: 'Leads' },
  { href: '/dashboard/live-chat', icon: MessageSquare,   label: 'Chat'  },
  { href: '/dashboard/more',      icon: Menu,            label: 'More'  },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  const isHome  = pathname === '/dashboard'
  const isLeads = pathname.startsWith('/dashboard/leads')
  const isChat  = pathname.startsWith('/dashboard/live-chat')
  // Any route that isn't one of the three primary tabs is reachable only via
  // More (Settings, Automations, Campaigns, ...), so More stays highlighted
  // there too — otherwise landing on Settings would show no active tab at all.
  const isMore  = !isHome && !isLeads && !isChat

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0a0f1e] border-t border-white/[0.06]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-[60px]">
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = href === '/dashboard' ? isHome
            : href === '/dashboard/leads' ? isLeads
            : href === '/dashboard/live-chat' ? isChat
            : isMore
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
