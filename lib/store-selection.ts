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
