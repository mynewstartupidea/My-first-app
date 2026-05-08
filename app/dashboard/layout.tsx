export const dynamic = 'force-dynamic'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: store } = await supabase
    .from('stores')
    .select('shop_name, plan')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  return (
    <div className="flex min-h-screen bg-[#f1f5f9]">
      <Sidebar storeName={store?.shop_name} plan={store?.plan} />
      <main className="flex-1 ml-[240px] min-h-screen">
        {children}
      </main>
    </div>
  )
}
