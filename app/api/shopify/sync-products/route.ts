import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

const SHOPIFY_API_VERSION = '2026-07'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Resolved to the org owner — stores is keyed by the owner's user_id, a
  // teammate querying by their own id found nothing.
  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: rows } = await service
    .from('stores')
    .select('id, shopify_domain, shopify_access_token, shopify_connection_type')
    .eq('user_id', ownerId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)

  const store = rows?.[0]
  if (!store?.shopify_domain) {
    return NextResponse.json({ error: 'No Shopify store connected' }, { status: 400 })
  }

  // Custom-app stores sync products via GraphQL through the background job
  // queue (lib/shopify-sync.ts + app/api/cron/shopify-sync) — Shopify has
  // been retiring REST product access for apps created after 2024, so the
  // REST calls below would likely fail outright for these. This button just
  // reports what's already synced and (re)kicks off a fresh sync pass.
  if (store.shopify_connection_type === 'custom_app') {
    const { count } = await service
      .from('shopify_products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', store.id)

    const { data: existingJob } = await service
      .from('shopify_sync_jobs')
      .select('id')
      .eq('store_id', store.id)
      .eq('resource', 'products')
      .in('status', ['pending', 'processing'])
      .maybeSingle()

    if (!existingJob) {
      await service.from('shopify_sync_jobs').insert({ store_id: store.id, resource: 'products', status: 'pending' })
    }

    return NextResponse.json({
      count: count ?? 0,
      syncing: true,
      message: 'Product sync running in the background — refresh in a minute to see updated counts.',
    })
  }

  if (!store.shopify_access_token) {
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
      const body = await countRes.text()
      console.error(`[sync-products] 403 body: ${body}`)
      throw new Error(`Shopify products/count returned ${countRes.status}: ${body}`)
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
    await service
      .from('stores')
      .update({ product_count: count, updated_at: new Date().toISOString() })
      .eq('id', store.id)

    return NextResponse.json({ count, products })
  } catch (err) {
    console.error('[Shopify sync-products] error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
