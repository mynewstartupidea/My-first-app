'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':              'Dashboard',
  '/dashboard/leads':        'Lead Ads',
  '/dashboard/live-chat':    'Live Chat',
  '/dashboard/automations':  'Automations',
  '/dashboard/campaigns':    'Campaigns',
  '/dashboard/analytics':    'Analytics',
  '/dashboard/templates':    'Templates',
  '/dashboard/contacts':     'Contacts',
  '/dashboard/customers':    'Customers',
  '/dashboard/conversations':'Conversations',
  '/dashboard/messages':     'Messages',
  '/dashboard/integrations': 'Integrations',
  '/dashboard/developer':    'Developer',
  '/dashboard/support':      'Support',
  '/dashboard/settings':     'Settings',
  '/dashboard/team':         'Team',
  '/dashboard/billing':      'Billing',
  '/dashboard/shopify':      'Shopify',
}

export default function MobileHeader() {
  const pathname = usePathname()
  const isHome = pathname === '/dashboard'
  // Match longest prefix
  const title = Object.entries(PAGE_TITLES)
    .filter(([k]) => pathname.startsWith(k))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'Wapaci'

  // A native app's top bar shows the app's own name once, on its home screen —
  // every other screen just gets its own title, the way iOS/Android nav bars work.
  // Repeating the wordmark on every screen (the old layout) is what makes a page
  // read as a website with a banner instead of an app with navigation.
  // position: fixed, not sticky — html/body carry overflow-x: hidden (needed elsewhere
  // to stop a flex-overflow bug), which breaks position: sticky's containment in every
  // major mobile browser. fixed doesn't have that problem, same as MobileBottomNav below.
  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center px-4 bg-[#0a0f1e]/95 backdrop-blur-md border-b border-white/[0.06]"
      style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(52px + env(safe-area-inset-top))' }}
    >
      {isHome ? (
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#25D366] rounded-lg flex items-center justify-center flex-shrink-0">
            <MessageCircle size={15} className="text-white" />
          </div>
          <span className="text-white font-bold text-base tracking-tight">Wapaci</span>
        </Link>
      ) : (
        <h1 className="text-white font-semibold text-[17px] tracking-tight">{title}</h1>
      )}
    </header>
  )
}
