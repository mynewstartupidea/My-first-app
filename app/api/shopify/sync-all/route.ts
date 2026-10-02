import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { syncShopifyCustomers } from '@/lib/shopify'
import { getValidAccessToken } from '@/lib/shopify-custom-app'

// POST /api/shopify/sync-all — the "Sync Now" button on the Shopify store
// page. Re-enqueues a background job for every resource (skipping any
// already pending/processing, so repeated clicks don't pile up duplicate
// jobs) and kicks an immediate customer sync for fast visible feedback.
const RESOURCES = ['locations', 'products', 'orders', 'abandoned_checkouts', 'discounts', 'inventory']

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: store } = await service
    .from('stores')
    .select('id, shopify_domain, shopify_connection_type, shopify_client_id, shopify_client_secret_enc, shopify_access_token_enc, shopify_token_expires_at')
    .eq('user_id', ownerId)
    .eq('is_active', true)
    .not('shopify_domain', 'is', null)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (!store || store.shopify_connection_type !== 'custom_app') {
    return NextResponse.json({ error: 'No Shopify store connected' }, { status: 400 })
  }

  const { data: existingJobs } = await service
    .from('shopify_sync_jobs')
    .select('resource')
    .eq('store_id', store.id)
    .in('status', ['pending', 'processing'])
  const alreadyQueued = new Set((existingJobs ?? []).map(j => j.resource))

  const toEnqueue = RESOURCES.filter(r => !alreadyQueued.has(r))
  if (toEnqueue.length > 0) {
    await service.from('shopify_sync_jobs').insert(
      toEnqueue.map(resource => ({ store_id: store.id, resource, status: 'pending' as const }))
    )
  }

  // Fire-and-forget immediate customer sync so the page shows some movement
  // right away instead of waiting for the next cron tick.
  getValidAccessToken(store).then(token =>
    syncShopifyCustomers(store.shopify_domain!, token, store.id, service, 4)
  ).catch(e => console.error('[sync-all] customer sync error:', e))

  return NextResponse.json({ ok: true, queued: toEnqueue })
}
