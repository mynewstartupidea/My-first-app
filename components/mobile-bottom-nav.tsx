'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, UserPlus, MessageSquare, Zap, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/dashboard',             icon: LayoutDashboard, label: 'Home'        },
  { href: '/dashboard/leads',       icon: UserPlus,        label: 'Leads'       },
  { href: '/dashboard/live-chat',   icon: MessageSquare,   label: 'Chat'        },
  { href: '/dashboard/automations', icon: Zap,             label: 'Automations' },
  { href: '/dashboard/settings',    icon: Settings,        label: 'Settings'    },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#0a0f1e] border-t border-white/[0.06]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-[60px]">
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(href)
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
