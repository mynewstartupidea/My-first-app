import { createServiceClient } from '@/lib/supabase/server'

type ServiceClient = ReturnType<typeof createServiceClient>

type StoreCandidate = {
  shopify_domain?: string | null
  connected_at?: string | null
  updated_at?: string | null
  created_at?: string | null
}

function timestamp(value?: string | null) {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function pickPreferredStore<T extends StoreCandidate>(stores: T[] | null | undefined): T | null {
  const rows = stores ?? []
  if (rows.length === 0) return null

  const connectedStores = rows.filter(store => !!store.shopify_domain)
  if (connectedStores.length > 0) {
    return [...connectedStores].sort((a, b) => {
      const aTime = timestamp(a.connected_at ?? a.updated_at ?? a.created_at)
      const bTime = timestamp(b.connected_at ?? b.updated_at ?? b.created_at)
      return bTime - aTime
    })[0] ?? null
  }

  return [...rows].sort((a, b) => {
    const aTime = timestamp(a.updated_at ?? a.created_at)
    const bTime = timestamp(b.updated_at ?? b.created_at)
    return bTime - aTime
  })[0] ?? null
}

export function hasShopifyConnection(store: StoreCandidate | null | undefined) {
  return !!store?.shopify_domain
}

type StoreRow = { id: string; shopify_domain: string | null; connected_at: string | null; updated_at: string | null; created_at: string | null }

// Every Live Chat route (thread GET/DELETE, send) re-ran the full
// "fetch up to 10 active stores, sort in JS, pick the preferred one"
// resolution on every single request — real, avoidable latency on a hot
// path (conversation open, every send) when the caller almost always
// already knows which store it's viewing (the thread list that's already
// on screen resolved it moments earlier). Tries a single targeted row
// lookup against the hinted id first; only falls back to the full scan if
// the hint is missing, stale, or doesn't actually belong to this owner —
// so a forged/wrong storeId can't be used to read another org's data, it
// just silently falls through to the normal, safe resolution instead.
export async function resolveStoreFast(
  service: ServiceClient, ownerId: string, hintedStoreId: string | null | undefined,
): Promise<StoreRow | null> {
  if (hintedStoreId) {
    const { data } = await service
      .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at')
      .eq('id', hintedStoreId).eq('user_id', ownerId).eq('is_active', true).maybeSingle()
    if (data) return data
  }
  const { data: stores } = await service
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at')
    .eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  return pickPreferredStore(stores)
}
