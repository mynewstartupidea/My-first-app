export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { canAccess } from '@/lib/user-role'
import {
  Settings, Megaphone, Zap, BarChart2,
  Users, FileText, Plug, Code2, LifeBuoy, ChevronRight,
} from 'lucide-react'
import InstallAppCard from '@/components/install-app-card'

// Everything that doesn't earn a permanent bottom-tab slot (Home/Leads/Chat
// are the only things opened constantly) lives here instead — grouped by how
// often it actually gets touched, not dumped as one flat list. Filtered by
// the same canAccess() the desktop sidebar already uses, so a sales rep sees
// exactly the reduced set they're meant to, same as everywhere else in the app.
const GROUPS: { title: string; items: { href: string; icon: typeof Settings; label: string; blurb: string }[] }[] = [
  {
    title: 'Run the business',
    items: [
      { href: '/dashboard/automations', icon: Zap,        label: 'Automations', blurb: 'Auto-replies and follow-up rules' },
      { href: '/dashboard/campaigns',   icon: Megaphone,   label: 'Campaigns',   blurb: 'Bulk WhatsApp sends' },
      { href: '/dashboard/analytics',   icon: BarChart2,   label: 'Analytics',   blurb: 'Lead quality and close rate' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { href: '/dashboard/contacts',     icon: Users,    label: 'Contacts',     blurb: 'Saved WhatsApp contacts' },
      { href: '/dashboard/templates',    icon: FileText, label: 'Templates',    blurb: 'Approved WhatsApp message templates' },
      { href: '/dashboard/integrations', icon: Plug,     label: 'Integrations', blurb: 'Connect other tools' },
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
  const groups = GROUPS
    .map(g => ({ ...g, items: g.items.filter(item => canAccess(role, item.href)) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="p-4 space-y-5 md:hidden">
      <h1 className="text-xl font-bold text-gray-900">More</h1>

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
          <p className="text-xs text-gray-400 mt-0.5">Account, WhatsApp, team, billing</p>
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
    </div>
  )
}
