import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

// Orders sync always runs through the background job queue (lib/shopify-sync.ts
// + app/api/cron/shopify-sync) — a store's order history can be far larger
// than a single request can safely page through before Vercel's time limit.
// This route just reports current progress and (re)kicks off a pass.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: store } = await service
    .from('stores')
    .select('id, shopify_domain, shopify_connection_type')
    .eq('user_id', ownerId)
    .eq('is_active', true)
    .not('shopify_domain', 'is', null)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!store || store.shopify_connection_type !== 'custom_app') {
    return NextResponse.json({ error: 'No Shopify store connected' }, { status: 400 })
  }

  const { count } = await service
    .from('shopify_orders')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)

  const { data: existingJob } = await service
    .from('shopify_sync_jobs')
    .select('id')
    .eq('store_id', store.id)
    .eq('resource', 'orders')
    .in('status', ['pending', 'processing'])
    .maybeSingle()

  if (!existingJob) {
    await service.from('shopify_sync_jobs').insert({ store_id: store.id, resource: 'orders', status: 'pending' })
  }

  return NextResponse.json({
    count: count ?? 0,
    syncing: true,
    message: `Order sync running in the background — ${count ?? 0} order${count === 1 ? '' : 's'} synced so far.`,
  })
}
