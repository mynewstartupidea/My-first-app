import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SHOPIFY_API_VERSION = '2024-10'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rows } = await supabase
    .from('stores')
    .select('id, shopify_domain, shopify_access_token')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)

  const store = rows?.[0]

  if (!store?.shopify_domain || !store?.shopify_access_token) {
    return NextResponse.json({ error: 'No Shopify store connected' }, { status: 400 })
  }

  try {
    const headers = { 'X-Shopify-Access-Token': store.shopify_access_token }

    // Fetch total product count
    const countRes = await fetch(
      `https://${store.shopify_domain}/admin/api/${SHOPIFY_API_VERSION}/products/count.json`,
      { headers }
    )
    if (!countRes.ok) {
      throw new Error(`Shopify products/count returned ${countRes.status}`)
    }
    const { count } = await countRes.json() as { count: number }

    // Fetch first 10 products for display
    const listRes = await fetch(
      `https://${store.shopify_domain}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=10&fields=id,title,status,variants`,
      { headers }
    )
    if (!listRes.ok) {
      throw new Error(`Shopify products list returned ${listRes.status}`)
    }
    const { products } = await listRes.json() as {
      products: { id: number; title: string; status: string }[]
    }

    // Persist product count on the store record
    await supabase
      .from('stores')
      .update({ product_count: count, updated_at: new Date().toISOString() })
      .eq('id', store.id)

    return NextResponse.json({ count, products })
  } catch (err) {
    console.error('[Shopify sync-products] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
