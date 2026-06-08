import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getShopDetails } from '@/lib/shopify'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rows } = await supabase
    .from('stores')
    .select('shopify_domain, shopify_access_token, shop_name')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)

  const store = rows?.[0]

  if (!store?.shopify_domain || !store?.shopify_access_token) {
    return NextResponse.json({ connected: false, error: 'No Shopify store connected' })
  }

  try {
    const details = await getShopDetails(store.shopify_domain, store.shopify_access_token) as {
      name: string; plan_name?: string; email?: string; myshopify_domain?: string
    }
    return NextResponse.json({
      connected:   true,
      shop_name:   details.name,
      shop_domain: store.shopify_domain,
      plan:        details.plan_name ?? null,
    })
  } catch (err) {
    console.error('[Shopify test-connection] error:', err)
    return NextResponse.json({
      connected: false,
      error: 'Could not reach Shopify — token may be invalid or store may have been uninstalled',
    })
  }
}
