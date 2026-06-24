export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'
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

  const displayName = store?.shopify_domain ? (store.shop_name ?? store.shopify_domain) : null
  const role        = await getUserRole(user.id, user.email ?? '')

  return (
    <div className="flex min-h-screen bg-[#f1f5f9]">
      <Sidebar storeName={displayName} plan={store?.plan} role={role} />
      <main className="flex-1 ml-[220px] min-h-screen">
        {children}
      </main>
    </div>
  )
}
