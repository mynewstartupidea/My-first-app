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

// Every resource job only ever ran once — at connect time, or whenever
// someone clicked "Sync Now". That meant turning on Abandoned Cart Recovery
// a week after connecting did nothing for checkouts that already existed:
// nothing would ever re-check them. This re-enqueues an abandoned_checkouts
// job for every custom_app store whose last one finished more than this
// long ago (and isn't already in flight) — a recurring heartbat so a
// newly-enabled automation (or a webhook that got missed — Shopify's
// delivery is "at least once", not guaranteed) actually gets caught up by
// the next tick or two, not left stale indefinitely.
const RESYNC_INTERVAL_MS = 5 * 60 * 1000

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const tickStart = Date.now()

  // A job claimed into 'processing' had no reclaim at all — if the function
  // was hard-killed mid-job (Vercel's 60s ceiling firing while a fetch was
  // in flight, an OOM) rather than throwing a catchable JS error, the row
  // stayed 'processing' forever: invisible to the main query below (which
  // only looks at 'pending'), and actively blocking a fresh job from being
  // enqueued later, since sync-all/sync-orders only enqueue when none is
  // already pending/processing for that resource. 10 minutes is generous
  // enough to never reclaim a job that's still genuinely working within the
  // same tick's 50s budget.
  const stuckCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  await service.from('shopify_sync_jobs').update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('status', 'processing').lt('updated_at', stuckCutoff)

  await requeueStaleAbandonedCheckoutSync(service)

  const { data: jobs } = await service
    .from('shopify_sync_jobs')
    .select(`*, stores(shopify_domain, shopify_connection_type, shopify_client_id, shopify_client_secret_enc, shopify_access_token_enc, shopify_token_expires_at, id, user_id)`)
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
      id: string; user_id: string; shopify_domain: string | null; shopify_connection_type: string | null
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
      if (attempts >= MAX_ATTEMPTS) {
        failed++
        // This cron has no UI of its own, and the dashboard's Shopify page
        // never reads shopify_sync_jobs.error_message — a store that looked
        // "connected" could have its orders/inventory/products silently
        // stuck mid-backfill forever with nothing anywhere telling the
        // merchant it had given up retrying. Surface it as a notification,
        // deduped per store+resource per day so retries within the same
        // day across ticks don't pile up duplicates.
        if (store?.user_id) {
          const today = new Date().toISOString().split('T')[0]
          const { count: alreadyNotified } = await service
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', store.user_id)
            .eq('type', 'shopify_sync_failed')
            .eq('link', `/dashboard/shopify?resource=${job.resource}`)
            .gte('created_at', `${today}T00:00:00.000Z`)
          if (!alreadyNotified) {
            await service.from('notifications').insert({
              user_id: store.user_id,
              type:    'shopify_sync_failed',
              title:   `⚠️ Shopify ${job.resource} sync failed`,
              body:    `We couldn't sync your Shopify ${job.resource} after several attempts (${message}). Try reconnecting Shopify from Settings if this continues.`,
              link:    `/dashboard/shopify?resource=${job.resource}`,
              is_read: false,
            })
          }
        }
      }
      console.error(`[shopify-sync cron] job ${job.id} (${job.resource}) error:`, message)
    }
  }

  return NextResponse.json({ ok: true, processed, completed, failed, pages: totalPages })
}

async function requeueStaleAbandonedCheckoutSync(service: ReturnType<typeof createServiceClient>) {
  const { data: stores } = await service
    .from('stores')
    .select('id')
    .eq('shopify_connection_type', 'custom_app')
    .eq('is_active', true)
  if (!stores?.length) return

  // One query for the most recent abandoned_checkouts job per store, rather
  // than a query per store — fine to loop in JS from here since this runs
  // against however many stores are actually connected, not per recipient.
  const { data: recentJobs } = await service
    .from('shopify_sync_jobs')
    .select('store_id, status, updated_at')
    .eq('resource', 'abandoned_checkouts')
    .in('store_id', stores.map(s => s.id))
    .order('updated_at', { ascending: false })
  const latestByStore = new Map<string, { status: string; updated_at: string }>()
  for (const j of recentJobs ?? []) {
    if (!latestByStore.has(j.store_id)) latestByStore.set(j.store_id, j)
  }

  const cutoff = Date.now() - RESYNC_INTERVAL_MS
  const toEnqueue = stores
    .filter(s => {
      const latest = latestByStore.get(s.id)
      if (!latest) return true // never synced at all
      if (latest.status === 'pending' || latest.status === 'processing') return false // already in flight
      return new Date(latest.updated_at).getTime() < cutoff
    })
    .map(s => ({ store_id: s.id, resource: 'abandoned_checkouts' as const, status: 'pending' as const }))

  if (toEnqueue.length) {
    await service.from('shopify_sync_jobs').insert(toEnqueue)
  }
}
