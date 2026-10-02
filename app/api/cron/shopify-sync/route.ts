import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getValidAccessToken, ShopifyConnectionError } from '@/lib/shopify-custom-app'
import {
  syncLocationsPage, syncInventoryPage, syncProductsPage, syncOrdersPage,
  syncAbandonedCheckoutsPage, syncDiscountsPage, syncReturnsPage,
  type SyncPageResult,
} from '@/lib/shopify-sync'

export const maxDuration = 60

// Processes shopify_sync_jobs for custom_app stores. One PAGE per job per
// tick — a job re-queues itself (new page_info, stays 'pending') until its
// resource is exhausted, so a single invocation can never run past Vercel's
// 60s ceiling no matter how large a store's history is. Same optimistic-lock
// claim pattern as the automation_jobs cron (app/api/cron/route.ts).
const SYNC_FNS: Record<string, (shop: string, token: string, storeId: string, service: ReturnType<typeof createServiceClient>, pageInfo: string | null) => Promise<SyncPageResult>> = {
  locations: syncLocationsPage,
  inventory: syncInventoryPage,
  products: syncProductsPage,
  orders: syncOrdersPage,
  abandoned_checkouts: syncAbandonedCheckoutsPage,
  discounts: syncDiscountsPage,
  returns: syncReturnsPage,
}

const JOBS_PER_TICK = 10
const MAX_ATTEMPTS = 5

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()

  const { data: jobs } = await service
    .from('shopify_sync_jobs')
    .select(`*, stores(shopify_domain, shopify_connection_type, shopify_client_id, shopify_client_secret_enc, shopify_access_token_enc, shopify_token_expires_at, id)`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(JOBS_PER_TICK)

  let processed = 0, completed = 0, failed = 0

  for (const job of jobs ?? []) {
    const { data: claimed } = await service
      .from('shopify_sync_jobs')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')
    if (!claimed || claimed.length === 0) continue
    processed++

    const store = job.stores as {
      id: string; shopify_domain: string | null; shopify_connection_type: string | null
      shopify_client_id: string | null; shopify_client_secret_enc: string | null
      shopify_access_token_enc: string | null; shopify_token_expires_at: string | null
    } | null

    const syncFn = SYNC_FNS[job.resource]
    if (!store?.shopify_domain || store.shopify_connection_type !== 'custom_app' || !syncFn) {
      await service.from('shopify_sync_jobs').update({
        status: 'failed', error_message: 'Store not found or not a custom-app connection.', updated_at: new Date().toISOString(),
      }).eq('id', job.id)
      failed++
      continue
    }

    try {
      const token = await getValidAccessToken(store)
      const result = await syncFn(store.shopify_domain, token, job.store_id, service, job.page_info)

      if (result.nextPageInfo) {
        await service.from('shopify_sync_jobs').update({
          status: 'pending',
          page_info: result.nextPageInfo,
          records_synced: job.records_synced + result.recordsProcessed,
          updated_at: new Date().toISOString(),
        }).eq('id', job.id)
      } else {
        await service.from('shopify_sync_jobs').update({
          status: 'completed',
          records_synced: job.records_synced + result.recordsProcessed,
          updated_at: new Date().toISOString(),
        }).eq('id', job.id)
        completed++
      }
    } catch (err) {
      const message = err instanceof ShopifyConnectionError ? `${err.code}: ${err.message}` : String(err)
      const attempts = (job.attempts ?? 0) + 1
      await service.from('shopify_sync_jobs').update({
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        attempts,
        error_message: message,
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)
      if (attempts >= MAX_ATTEMPTS) failed++
      console.error(`[shopify-sync cron] job ${job.id} (${job.resource}) error:`, message)
    }
  }

  return NextResponse.json({ ok: true, processed, completed, failed })
}
