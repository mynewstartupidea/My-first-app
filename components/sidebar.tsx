'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, MessageSquare, Users, Megaphone, Zap,
  FileText, ShoppingBag, BarChart2, Code2,
  Settings, LogOut, MessageCircle, Store,
  ChevronRight, LifeBuoy, Plug, UserPlus, ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/user-role'
import { canAccess } from '@/lib/user-role'
import NotificationBell from '@/components/notification-bell'

interface WaHealth {
  connected: boolean
  quality_rating?: string
  messaging_limit_tier?: string
  display_phone_number?: string
}

function WaHealthBadge() {
  const [health, setHealth] = useState<WaHealth | null>(null)

  useEffect(() => {
    const fetch_ = () =>
      fetch('/api/whatsapp/health')
        .then(r => r.json())
        .then((d: WaHealth) => setHealth(d))
        .catch(() => {})

    fetch_()
    const id = setInterval(fetch_, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (!health?.connected) return null
  const rating = health.quality_rating ?? 'GREEN'
  if (rating === 'GREEN') return null

  const isRed = rating === 'RED'

  return (
    <Link
      href="/dashboard/settings?tab=whatsapp"
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold transition',
        isRed
          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
          : 'bg-amber-400/10 text-amber-400 hover:bg-amber-400/20'
      )}
      title={isRed ? 'WhatsApp account restricted — click for details' : 'WhatsApp quality dropping — click for details'}
    >
      <ShieldAlert size={12} className="flex-shrink-0" />
      <span>{isRed ? 'WA Restricted' : 'WA Quality ↓'}</span>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ml-auto',
        isRed ? 'bg-red-400' : 'bg-amber-400')} />
    </Link>
  )
}

const NAV = [
  { href: '/dashboard',             icon: LayoutDashboard, label: 'Dashboard'   },
  { href: '/dashboard/live-chat',   icon: MessageSquare,   label: 'Live Chat',  badge: 'NEW' },
  { href: '/dashboard/contacts',    icon: Users,           label: 'Contacts'    },
  { href: '/dashboard/leads',       icon: UserPlus,        label: 'Leads'       },
  { href: '/dashboard/campaigns',   icon: Megaphone,       label: 'Campaigns'   },
  { href: '/dashboard/automations', icon: Zap,             label: 'Automations' },
  { href: '/dashboard/templates',   icon: FileText,        label: 'Templates'   },
  { href: '/dashboard/shopify',      icon: ShoppingBag,     label: 'Shopify'     },
  { href: '/dashboard/integrations', icon: Plug,            label: 'Integrations' },
  { href: '/dashboard/analytics',   icon: BarChart2,       label: 'Analytics'   },
]

const NAV_BOTTOM = [
  { href: '/dashboard/developer',   icon: Code2,           label: 'Developer'   },
  { href: '/dashboard/support',     icon: LifeBuoy,        label: 'Support'     },
  { href: '/dashboard/settings',    icon: Settings,        label: 'Settings'    },
]

interface SidebarProps {
  storeName?: string | null
  plan?: string
  role?: UserRole
}

interface BillingUsage {
  messages_used: number
  messages_limit: number
  messages_remaining: number
}

export default function Sidebar({ storeName, plan = 'starter', role = 'owner' }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [billingUsage, setBillingUsage] = useState<BillingUsage | null>(null)

  useEffect(() => {
    const fetchBilling = () =>
      fetch('/api/billing/status')
        .then(r => r.json())
        .then((d: BillingUsage) => setBillingUsage(d))
        .catch(() => {})
    fetchBilling()
    const id = setInterval(fetchBilling, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const planBadge: Record<string, { label: string; cls: string }> = {
    trial:   { label: 'Trial',   cls: 'bg-slate-700 text-slate-300' },
    starter: { label: 'Starter', cls: 'bg-slate-700 text-slate-300' },
    growth:  { label: 'Growth',  cls: 'bg-blue-900/60 text-blue-300' },
    scale:   { label: 'Scale',   cls: 'bg-purple-900/60 text-purple-300' },
  }
  const badge = planBadge[plan] ?? planBadge.starter

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  const visibleNav       = NAV.filter(item => canAccess(role, item.href))
  const visibleNavBottom = NAV_BOTTOM.filter(item => canAccess(role, item.href))

  return (
    <aside className="w-[220px] min-h-screen bg-[#0a0f1e] flex flex-col fixed left-0 top-0 z-30 border-r border-white/[0.05]">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/[0.06] flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#25D366] rounded-lg flex items-center justify-center flex-shrink-0">
            <MessageCircle size={17} className="text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-base leading-none tracking-tight">Wapaci</span>
            <p className="text-slate-500 text-[9px] mt-0.5 tracking-widest uppercase">WhatsApp Revenue</p>
          </div>
        </Link>
        <NotificationBell />
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {visibleNav.map(({ href, icon: Icon, label, badge: itemBadge }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href}
              className={cn(
                'group flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all',
                active
                  ? 'bg-[#25D366]/15 text-[#25D366]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
              )}>
              <Icon size={15} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {itemBadge && !active && (
                <span className="text-[9px] font-bold bg-[#25D366]/20 text-[#25D366] px-1.5 py-0.5 rounded-full">
                  {itemBadge}
                </span>
              )}
              {active && <ChevronRight size={12} className="opacity-40" />}
            </Link>
          )
        })}

        {visibleNavBottom.length > 0 && <div className="my-2 border-t border-white/[0.05]" />}

        {visibleNavBottom.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href}
              className={cn(
                'group flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all',
                active
                  ? 'bg-[#25D366]/15 text-[#25D366]'
                  : 'text-slate-500 hover:text-white hover:bg-white/[0.06]'
              )}>
              <Icon size={15} className="flex-shrink-0" />
              <span>{label}</span>
              {active && <ChevronRight size={12} className="opacity-40" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-2.5 border-t border-white/[0.05] space-y-1">
        {/* Role badge for non-owners */}
        {role !== 'owner' && role !== 'admin' && (
          <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Role:</span>
            <span className="text-[11px] font-semibold capitalize text-white">{role}</span>
          </div>
        )}

        {storeName ? (
          <div className="px-3 py-2.5 rounded-lg bg-white/[0.04]">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 bg-[#25D366]/20 rounded-md flex items-center justify-center flex-shrink-0">
                <Store size={12} className="text-[#25D366]" />
              </div>
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-white text-[11px] font-medium truncate">{storeName}</p>
                <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded capitalize', badge.cls)}>
                  {badge.label}
                </span>
              </div>
            </div>
            {/* Live message usage bar */}
            {billingUsage && billingUsage.messages_limit < 999_999_999 && (() => {
              const pct  = Math.min(100, Math.round((billingUsage.messages_used / billingUsage.messages_limit) * 100))
              const low  = pct >= 80
              const crit = pct >= 95
              return (
                <div className="mt-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-slate-500">
                      {billingUsage.messages_remaining.toLocaleString()} msgs left
                    </span>
                    {low && (
                      <Link href="/dashboard/settings?tab=billing"
                        className={cn('text-[9px] font-semibold hover:underline', crit ? 'text-red-400' : 'text-amber-400')}>
                        Upgrade ↑
                      </Link>
                    )}
                  </div>
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700',
                        crit ? 'bg-red-500' : low ? 'bg-amber-400' : 'bg-[#25D366]')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-600 mt-1 tabular-nums">
                    {billingUsage.messages_used.toLocaleString()} / {billingUsage.messages_limit.toLocaleString()}
                  </p>
                </div>
              )
            })()}
          </div>
        ) : (
          canAccess(role, '/dashboard/shopify') ? (
            <Link href="/dashboard/shopify"
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/15 transition">
              <Store size={13} className="text-[#25D366]" />
              <span className="text-[#25D366] text-[12px] font-medium">Connect Shopify</span>
            </Link>
          ) : null
        )}
        <WaHealthBadge />
        <button onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] text-[13px] transition">
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
