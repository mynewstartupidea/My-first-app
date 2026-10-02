import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getValidAccessToken, ShopifyConnectionError } from '@/lib/shopify-custom-app'
import {
  syncLocationsPage, syncInventoryPage, syncProductsPage, syncOrdersPage,
  syncAbandonedCheckoutsPage, syncDiscountsPage,
  type SyncPageResult,
} from '@/lib/shopify-sync'

export const maxDuration = 60

// Processes shopify_sync_jobs for custom_app stores. Each claimed job pages
// through as many pages as fit in the shared time budget below (not just
// one) — a 10,000-order historical backfill at 25 orders/page used to take
// ~400 cron ticks (1/min) to finish, over 6 hours. Looping within the
// budget instead means one job can make dozens of calls in a single tick;
// Shopify's own 429 backoff (lib/shopify-rate-limit.ts) self-regulates how
// fast that can actually go, so this doesn't need its own throttle on top.
// A job whose resource isn't exhausted when the budget runs out just saves
// its current page_info and stays 'pending' for the next tick — still
// bounded by Vercel's 60s ceiling regardless of how large the backlog is.
const SYNC_FNS: Record<string, (shop: string, token: string, storeId: string, service: ReturnType<typeof createServiceClient>, pageInfo: string | null) => Promise<SyncPageResult>> = {
  locations: syncLocationsPage,
  inventory: syncInventoryPage,
  products: syncProductsPage,
  orders: syncOrdersPage,
  abandoned_checkouts: syncAbandonedCheckoutsPage,
  discounts: syncDiscountsPage,
}

const JOBS_PER_TICK = 10
const MAX_ATTEMPTS = 5
const TIME_BUDGET_MS = 50_000 // leaves ~10s margin under maxDuration=60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const tickStart = Date.now()

  const { data: jobs } = await service
    .from('shopify_sync_jobs')
    .select(`*, stores(shopify_domain, shopify_connection_type, shopify_client_id, shopify_client_secret_enc, shopify_access_token_enc, shopify_token_expires_at, id)`)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(JOBS_PER_TICK)

  let processed = 0, completed = 0, failed = 0, totalPages = 0

  for (const job of jobs ?? []) {
    if (Date.now() - tickStart >= TIME_BUDGET_MS) break

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

    let pageInfo = job.page_info as string | null
    let recordsSynced = job.records_synced ?? 0
    let done = false

    try {
      const token = await getValidAccessToken(store)
      while (Date.now() - tickStart < TIME_BUDGET_MS) {
        const result = await syncFn(store.shopify_domain, token, job.store_id, service, pageInfo)
        recordsSynced += result.recordsProcessed
        totalPages++
        pageInfo = result.nextPageInfo
        if (!pageInfo) { done = true; break }
      }

      await service.from('shopify_sync_jobs').update({
        status: done ? 'completed' : 'pending',
        page_info: pageInfo,
        records_synced: recordsSynced,
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)
      if (done) completed++
      if (!done) break // out of time budget — don't start another job this tick
    } catch (err) {
      const message = err instanceof ShopifyConnectionError ? `${err.code}: ${err.message}` : String(err)
      const attempts = (job.attempts ?? 0) + 1
      await service.from('shopify_sync_jobs').update({
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        page_info: pageInfo,
        records_synced: recordsSynced,
        attempts,
        error_message: message,
        updated_at: new Date().toISOString(),
      }).eq('id', job.id)
      if (attempts >= MAX_ATTEMPTS) failed++
      console.error(`[shopify-sync cron] job ${job.id} (${job.resource}) error:`, message)
    }
  }

  return NextResponse.json({ ok: true, processed, completed, failed, pages: totalPages })
}
