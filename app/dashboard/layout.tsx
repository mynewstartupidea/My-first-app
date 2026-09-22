export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
import MobileBottomNav from '@/components/mobile-bottom-nav'
import MobileHeader from '@/components/mobile-header'
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
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar storeName={displayName} plan={store?.plan} role={role} />

      {/* Main content — no left margin on mobile, sidebar margin on desktop */}
      <main className="flex-1 ml-0 md:ml-[220px] min-h-screen pb-[76px] md:pb-0">
        <MobileHeader />
        {children}
      </main>

      {/* Mobile bottom tab bar — hidden on desktop */}
      <MobileBottomNav />
    </div>
  )
}
