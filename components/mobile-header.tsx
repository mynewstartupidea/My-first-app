'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':             'Dashboard',
  '/dashboard/leads':       'Lead Ads',
  '/dashboard/live-chat':   'Live Chat',
  '/dashboard/automations': 'Automations',
  '/dashboard/campaigns':   'Campaigns',
  '/dashboard/analytics':   'Analytics',
  '/dashboard/templates':   'Templates',
  '/dashboard/contacts':    'Contacts',
  '/dashboard/integrations':'Integrations',
  '/dashboard/developer':   'Developer',
  '/dashboard/support':     'Support',
  '/dashboard/settings':    'Settings',
  '/dashboard/team':        'Team',
}

export default function MobileHeader() {
  const pathname = usePathname()
  // Match longest prefix
  const title = Object.entries(PAGE_TITLES)
    .filter(([k]) => pathname.startsWith(k))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'Wapaci'

  return (
    <header
      className="md:hidden flex items-center justify-between px-4 bg-[#0a0f1e] border-b border-white/[0.06]"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(52px + env(safe-area-inset-top))' }}
    >
      <Link href="/dashboard" className="flex items-center gap-2">
        <div className="w-7 h-7 bg-[#25D366] rounded-lg flex items-center justify-center flex-shrink-0">
          <MessageCircle size={15} className="text-white" />
        </div>
        <span className="text-white font-bold text-sm tracking-tight">Wapaci</span>
      </Link>
      <span className="text-slate-300 text-sm font-medium">{title}</span>
      <div className="w-16" />
    </header>
  )
}
