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
    .select('id, shopify_domain, shopify_connection_type, shopify_client_id, shopify_client_secret_enc, shopify_access_token_enc, shopify_access_token, shopify_token_expires_at')
    .eq('user_id', ownerId)
    .eq('is_active', true)
    .not('shopify_domain', 'is', null)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  // This job queue now handles both connection types (see
  // app/api/cron/shopify-sync/route.ts) — a legacy Shopify-App-Store OAuth
  // connection ('oauth_app') used to be rejected here outright with a
  // misleading "No Shopify store connected" even though one genuinely was,
  // and had no way to ever get historical data synced at all. Confirmed
  // live: most of the app's currently connected Shopify stores are this
  // type, not custom_app.
  const isCustomApp = store?.shopify_connection_type === 'custom_app'
  const isOAuthApp  = store?.shopify_connection_type === 'oauth_app'
  if (!store || !(isCustomApp || isOAuthApp)) {
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
  // right away instead of waiting for the next cron tick. oauth_app's token
  // is a standard long-lived Shopify OAuth token used directly — no
  // client_id/secret of its own to refresh with, unlike custom_app.
  const tokenPromise = isCustomApp ? getValidAccessToken(store) : Promise.resolve(store.shopify_access_token as string)
  tokenPromise.then(token =>
    syncShopifyCustomers(store.shopify_domain!, token, store.id, service, 4)
  ).catch(e => console.error('[sync-all] customer sync error:', e))

  return NextResponse.json({ ok: true, queued: toEnqueue })
}
