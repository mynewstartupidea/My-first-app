'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Zap, MessageSquare, Users,
  Settings, LogOut, MessageCircle, Store, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard',              icon: LayoutDashboard, label: 'Overview'    },
  { href: '/dashboard/automations',  icon: Zap,             label: 'Automations' },
  { href: '/dashboard/messages',     icon: MessageSquare,   label: 'Messages'    },
  { href: '/dashboard/contacts',     icon: Users,           label: 'Contacts'    },
  { href: '/dashboard/settings',     icon: Settings,        label: 'Settings'    },
]

interface SidebarProps {
  storeName?: string | null
  plan?: string
}

export default function Sidebar({ storeName, plan = 'starter' }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const planColors: Record<string, string> = {
    starter: 'bg-slate-700 text-slate-300',
    growth:  'bg-blue-900 text-blue-300',
    scale:   'bg-purple-900 text-purple-300',
  }

  return (
    <aside className="w-[240px] min-h-screen bg-[#0f172a] flex flex-col fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#25D366] rounded-xl flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-lg leading-none">UpsellAI</span>
            <p className="text-slate-500 text-[10px] mt-0.5">Revenue Recovery</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                active
                  ? 'bg-[#25D366] text-white shadow-lg shadow-green-900/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
              <span>{label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />}
            </Link>
          )
        })}
      </nav>

      {/* Store info + sign out */}
      <div className="p-3 border-t border-slate-800 space-y-1">
        {storeName ? (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-800">
            <div className="w-7 h-7 bg-[#25D366]/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Store className="w-3.5 h-3.5 text-[#25D366]" />
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-medium truncate">{storeName}</p>
              <span className={cn('text-[10px] capitalize font-medium px-1.5 py-0.5 rounded-md', planColors[plan] ?? planColors.starter)}>
                {plan}
              </span>
            </div>
          </div>
        ) : (
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 transition"
          >
            <Store className="w-4 h-4 text-[#25D366]" />
            <span className="text-[#25D366] text-xs font-medium">Connect Shopify Store</span>
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
