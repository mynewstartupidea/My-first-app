export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import MobileBottomNav from '@/components/mobile-bottom-nav'
import PageTransition from '@/components/page-transition'
import RouteProgress from '@/components/route-progress'
import InstallPromptInitializer from '@/components/install-prompt-initializer'
import { getUserRole } from '@/lib/get-user-role'
import { pickPreferredStore } from '@/lib/store-selection'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: storeRows } = await supabase
    .from('stores')
    .select('shop_name, plan, shopify_domain')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(storeRows)

  const displayName = store?.shop_name ?? null
  const role        = await getUserRole(user.id, user.email ?? '')

  return (
    <div className="flex min-h-screen bg-[#f1f5f9]">
      <InstallPromptInitializer />
      <RouteProgress />
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar storeName={displayName} plan={store?.plan} role={role} />

      {/* Main content — no left margin on mobile, sidebar margin on desktop.
          min-w-0 is load-bearing: without it, a flex item refuses to shrink below its
          content's natural width, so any wide descendant (a button row that "should" wrap)
          instead balloons this whole column past the viewport and everything below inherits
          the inflated width — overflow-x:hidden on body then just clips the symptom.
          Bottom padding must match MobileBottomNav's actual height (60px + its own
          safe-area-inset-bottom padding) or the last rows of a long scrollable list (e.g.
          leads) end up hidden behind the fixed nav on phones with a home indicator, where
          that safe-area inset is ~34px — a flat 76px undershoots it there.
          No fixed mobile header anymore — every page already renders its own title
          in-content (icon + name, sometimes with its own action buttons), and a
          second bar above that duplicating the same text just ate screen space for
          nothing. pt- here only needs to clear the phone's own status bar/notch. */}
      <main className="flex-1 min-w-0 ml-0 md:ml-[220px] min-h-screen pt-[env(safe-area-inset-top)] md:pt-0 pb-[calc(76px+env(safe-area-inset-bottom))] md:pb-0">
        <PageTransition>{children}</PageTransition>
      </main>

      {/* Mobile bottom tab bar — hidden on desktop */}
      <MobileBottomNav />
    </div>
  )
}
