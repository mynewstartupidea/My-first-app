export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: storeRows } = await supabase
    .from('stores')
    .select('shop_name, plan, shopify_domain')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('shopify_domain', { ascending: true, nullsFirst: false })
    .limit(1)
  const store = storeRows?.[0] ?? null

  // Only show store name when a real Shopify store is connected.
  // Mock stores (no shopify_domain) show "Connect Your Store" in sidebar.
  const displayName = store?.shopify_domain ? store.shop_name : null

  return (
    <div className="flex min-h-screen bg-[#f1f5f9]">
      <Sidebar storeName={displayName} plan={store?.plan} />
      <main className="flex-1 ml-[240px] min-h-screen">
        {children}
      </main>
    </div>
  )
}
