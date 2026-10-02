import { createServiceClient } from '@/lib/supabase/server'
import { fetchShopify } from '@/lib/shopify-rate-limit'

const API_VERSION = '2026-07'

// Products/orders/discounts/returns go through GraphQL, not REST — Shopify
// has been retiring REST access for these resources for apps created after
// 2024 (the custom apps this flow creates are all "new" by that definition),
// so REST would likely 404/410 outright. Locations and inventory levels stay
// on REST: Shopify's own docs still recommend REST for inventory operations
// and the Locations resource was never part of that deprecation.
async function shopifyGraphQL<T>(shop: string, token: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetchShopify(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Shopify GraphQL HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  const json = await res.json() as { data?: T; errors?: unknown[] }
  if (json.errors?.length) throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`)
  if (!json.data) throw new Error('Shopify GraphQL returned no data')
  return json.data
}

async function shopifyRestPage(
  shop: string, token: string, path: string, baseParams: Record<string, string>, pageInfo: string | null,
): Promise<{ json: Record<string, unknown>; nextPageInfo: string | null }> {
  const params = new URLSearchParams(pageInfo ? { page_info: pageInfo, limit: baseParams.limit ?? '50' } : baseParams)
  const res = await fetchShopify(`https://${shop}/admin/api/${API_VERSION}/${path}?${params}`, {
    headers: { 'X-Shopify-Access-Token': token },
  })
  if (!res.ok) throw new Error(`Shopify ${path} HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  const json = await res.json() as Record<string, unknown>
  const linkHeader = res.headers.get('link') ?? ''
  const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/)
  return { json, nextPageInfo: nextMatch ? decodeURIComponent(nextMatch[1]) : null }
}

// Extracts the trailing numeric id from a GraphQL GID (gid://shopify/X/123 -> "123").
// Used only where a value must match REST's plain-numeric id format elsewhere
// (inventory_item_id is written by REST inventory sync and read by GraphQL
// product/variant sync — both need to agree on the same string).
function gidToNumeric(gid: string | null | undefined): string | null {
  if (!gid) return null
  return gid.split('/').pop() ?? gid
}

function money(set: { shopMoney?: { amount?: string } } | null | undefined): number | null {
  const amount = set?.shopMoney?.amount
  return amount != null ? parseFloat(amount) : null
}

export interface SyncPageResult {
  nextPageInfo: string | null
  recordsProcessed: number
}

type Service = ReturnType<typeof createServiceClient>

// ─── Locations (REST) ──────────────────────────────────────────────────────

export async function syncLocationsPage(shop: string, token: string, storeId: string, service: Service, pageInfo: string | null): Promise<SyncPageResult> {
  const { json, nextPageInfo } = await shopifyRestPage(shop, token, 'locations.json', { limit: '50' }, pageInfo)
  const locations = (json.locations as Record<string, unknown>[]) ?? []
  const toUpsert = locations.map(l => ({
    store_id: storeId,
    shopify_location_id: String(l.id),
    name: l.name ?? null,
    address1: l.address1 ?? null,
    city: l.city ?? null,
    province: l.province ?? null,
    country: l.country ?? null,
    active: l.active ?? true,
    updated_at: new Date().toISOString(),
  }))
  if (toUpsert.length) {
    const { error } = await service.from('shopify_locations').upsert(toUpsert, { onConflict: 'store_id,shopify_location_id' })
    if (error) throw new Error(`shopify_locations upsert: ${error.message}`)
  }
  return { nextPageInfo, recordsProcessed: toUpsert.length }
}

// ─── Inventory levels (REST) ───────────────────────────────────────────────
// Depends on locations already being synced — the cron enqueues locations
// before inventory for a given store (see app/api/cron/shopify-sync).

export async function syncInventoryPage(shop: string, token: string, storeId: string, service: Service, pageInfo: string | null): Promise<SyncPageResult> {
  const { data: locations } = await service.from('shopify_locations').select('shopify_location_id').eq('store_id', storeId)
  const locationIds = (locations ?? []).map(l => l.shopify_location_id).join(',')
  if (!locationIds) return { nextPageInfo: null, recordsProcessed: 0 }

  const { json, nextPageInfo } = await shopifyRestPage(
    shop, token, 'inventory_levels.json', { location_ids: locationIds, limit: '250' }, pageInfo,
  )
  const levels = (json.inventory_levels as Record<string, unknown>[]) ?? []
  const toUpsert = levels.map(l => ({
    store_id: storeId,
    inventory_item_id: String(l.inventory_item_id),
    shopify_location_id: String(l.location_id),
    available: l.available ?? null,
    updated_at: new Date().toISOString(),
  }))
  if (toUpsert.length) {
    const { error } = await service.from('shopify_inventory_levels').upsert(toUpsert, { onConflict: 'store_id,inventory_item_id,shopify_location_id' })
    if (error) throw new Error(`shopify_inventory_levels upsert: ${error.message}`)
  }
  return { nextPageInfo, recordsProcessed: toUpsert.length }
}

// ─── Products + variants (GraphQL) ─────────────────────────────────────────

const PRODUCTS_QUERY = `
  query SyncProducts($cursor: String) {
    products(first: 30, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id title vendor productType status tags createdAt updatedAt
          featuredImage { url }
          variants(first: 100) {
            edges { node { id title sku price compareAtPrice inventoryQuantity inventoryItem { id } } }
          }
        }
      }
    }
  }
`

interface ProductsResponse {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    edges: { node: {
      id: string; title: string; vendor: string; productType: string; status: string
      tags: string[]; createdAt: string; updatedAt: string
      featuredImage: { url: string } | null
      variants: { edges: { node: {
        id: string; title: string; sku: string | null; price: string; compareAtPrice: string | null
        inventoryQuantity: number | null; inventoryItem: { id: string } | null
      } }[] }
    } }[]
  }
}

export async function syncProductsPage(shop: string, token: string, storeId: string, service: Service, pageInfo: string | null): Promise<SyncPageResult> {
  const data = await shopifyGraphQL<ProductsResponse>(shop, token, PRODUCTS_QUERY, { cursor: pageInfo })
  const edges = data.products.edges
  let count = 0

  for (const { node: p } of edges) {
    const { data: productRow, error: productErr } = await service.from('shopify_products').upsert({
      store_id: storeId,
      shopify_product_id: p.id,
      title: p.title,
      vendor: p.vendor,
      product_type: p.productType,
      status: p.status,
      tags: (p.tags ?? []).join(', '),
      image_url: p.featuredImage?.url ?? null,
      shopify_created_at: p.createdAt,
      shopify_updated_at: p.updatedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id,shopify_product_id' }).select('id').single()
    if (productErr || !productRow) throw new Error(`shopify_products upsert: ${productErr?.message}`)
    count++

    const variants = p.variants.edges.map(({ node: v }) => ({
      store_id: storeId,
      product_id: productRow.id,
      shopify_variant_id: v.id,
      shopify_product_id: p.id,
      title: v.title,
      sku: v.sku,
      price: v.price ? parseFloat(v.price) : null,
      compare_at_price: v.compareAtPrice ? parseFloat(v.compareAtPrice) : null,
      inventory_item_id: gidToNumeric(v.inventoryItem?.id),
      inventory_quantity: v.inventoryQuantity,
      updated_at: new Date().toISOString(),
    }))
    if (variants.length) {
      const { error } = await service.from('shopify_product_variants').upsert(variants, { onConflict: 'store_id,shopify_variant_id' })
      if (error) throw new Error(`shopify_product_variants upsert: ${error.message}`)
    }
  }

  return {
    nextPageInfo: data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null,
    recordsProcessed: count,
  }
}

// ─── Orders + line items (GraphQL) ─────────────────────────────────────────

const ORDERS_QUERY = `
  query SyncOrders($cursor: String) {
    orders(first: 25, after: $cursor, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id name email phone currencyCode
          totalPriceSet { shopMoney { amount } }
          subtotalPriceSet { shopMoney { amount } }
          totalTaxSet { shopMoney { amount } }
          totalDiscountsSet { shopMoney { amount } }
          totalRefundedSet { shopMoney { amount } }
          displayFinancialStatus
          displayFulfillmentStatus
          cancelledAt
          tags
          note
          createdAt
          updatedAt
          customer { id }
          fulfillments(first: 3) { trackingInfo { number url } }
          lineItems(first: 50) {
            edges { node {
              id title variantTitle sku quantity
              originalUnitPriceSet { shopMoney { amount } }
              variant { id }
              product { id }
            } }
          }
        }
      }
    }
  }
`

interface OrdersResponse {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    edges: { node: {
      id: string; name: string; email: string | null; phone: string | null; currencyCode: string
      totalPriceSet: { shopMoney: { amount: string } } | null
      subtotalPriceSet: { shopMoney: { amount: string } } | null
      totalTaxSet: { shopMoney: { amount: string } } | null
      totalDiscountsSet: { shopMoney: { amount: string } } | null
      totalRefundedSet: { shopMoney: { amount: string } } | null
      displayFinancialStatus: string | null
      displayFulfillmentStatus: string | null
      cancelledAt: string | null
      tags: string[]
      note: string | null
      createdAt: string
      updatedAt: string
      customer: { id: string } | null
      fulfillments: { trackingInfo: { number: string | null; url: string | null }[] }[]
      lineItems: { edges: { node: {
        id: string; title: string; variantTitle: string | null; sku: string | null; quantity: number
        originalUnitPriceSet: { shopMoney: { amount: string } } | null
        variant: { id: string } | null
        product: { id: string } | null
      } }[] }
    } }[]
  }
}

export async function syncOrdersPage(shop: string, token: string, storeId: string, service: Service, pageInfo: string | null): Promise<SyncPageResult> {
  const data = await shopifyGraphQL<OrdersResponse>(shop, token, ORDERS_QUERY, { cursor: pageInfo })
  const edges = data.orders.edges
  let count = 0

  for (const { node: o } of edges) {
    let customerId: string | null = null
    if (o.customer?.id) {
      const { data: match } = await service.from('customers')
        .select('id').eq('store_id', storeId).eq('shopify_customer_id', gidToNumeric(o.customer.id)).maybeSingle()
      customerId = match?.id ?? null
    }
    const tracking = o.fulfillments[0]?.trackingInfo?.[0]

    const { data: orderRow, error: orderErr } = await service.from('shopify_orders').upsert({
      store_id: storeId,
      customer_id: customerId,
      shopify_order_id: o.id,
      order_number: o.name,
      email: o.email,
      phone: o.phone,
      currency: o.currencyCode,
      total_price: money(o.totalPriceSet),
      subtotal_price: money(o.subtotalPriceSet),
      total_tax: money(o.totalTaxSet),
      total_discounts: money(o.totalDiscountsSet),
      total_refunded: money(o.totalRefundedSet) ?? 0,
      financial_status: o.displayFinancialStatus,
      fulfillment_status: o.displayFulfillmentStatus,
      tracking_number: tracking?.number ?? null,
      tracking_url: tracking?.url ?? null,
      cancelled_at: o.cancelledAt,
      tags: (o.tags ?? []).join(', '),
      note: o.note,
      shopify_created_at: o.createdAt,
      shopify_updated_at: o.updatedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id,shopify_order_id' }).select('id').single()
    if (orderErr || !orderRow) throw new Error(`shopify_orders upsert: ${orderErr?.message}`)
    count++

    const lineItems = o.lineItems.edges.map(({ node: li }) => ({
      order_id: orderRow.id,
      shopify_line_item_id: li.id,
      shopify_product_id: li.product?.id ?? null,
      shopify_variant_id: li.variant?.id ?? null,
      title: li.title,
      variant_title: li.variantTitle,
      sku: li.sku,
      quantity: li.quantity,
      price: money(li.originalUnitPriceSet),
    }))
    if (lineItems.length) {
      const { error } = await service.from('shopify_order_line_items').upsert(lineItems, { onConflict: 'order_id,shopify_line_item_id' })
      if (error) throw new Error(`shopify_order_line_items upsert: ${error.message}`)
    }
  }

  return {
    nextPageInfo: data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null,
    recordsProcessed: count,
  }
}

// ─── Abandoned checkouts (REST) ────────────────────────────────────────────

export async function syncAbandonedCheckoutsPage(shop: string, token: string, storeId: string, service: Service, pageInfo: string | null): Promise<SyncPageResult> {
  const { json, nextPageInfo } = await shopifyRestPage(shop, token, 'checkouts.json', { limit: '50' }, pageInfo)
  const checkouts = (json.checkouts as Record<string, unknown>[]) ?? []
  let count = 0

  for (const c of checkouts) {
    const email = (c.email as string | null) ?? null
    const phone = (c.phone as string | null) ?? ((c.shipping_address as Record<string, unknown> | null)?.phone as string | null) ?? null
    let customerId: string | null = null
    if (phone) {
      const { data: match } = await service.from('customers').select('id').eq('store_id', storeId).eq('phone', phone).maybeSingle()
      customerId = match?.id ?? null
    }

    const { error } = await service.from('shopify_abandoned_checkouts').upsert({
      store_id: storeId,
      customer_id: customerId,
      shopify_checkout_id: String(c.id),
      email,
      phone,
      total_price: c.total_price ? parseFloat(String(c.total_price)) : null,
      currency: c.currency ?? null,
      recovery_url: c.abandoned_checkout_url ?? null,
      line_items: c.line_items ?? [],
      abandoned_at: c.created_at ?? null,
      completed_at: c.completed_at ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id,shopify_checkout_id' })
    if (error) throw new Error(`shopify_abandoned_checkouts upsert: ${error.message}`)
    count++
  }

  return { nextPageInfo, recordsProcessed: count }
}

// ─── Discounts (GraphQL) ────────────────────────────────────────────────────

const DISCOUNTS_QUERY = `
  query SyncDiscounts($cursor: String) {
    discountNodes(first: 30, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          discount {
            ... on DiscountCodeBasic {
              title status startsAt endsAt
              codes(first: 1) { edges { node { code } } }
              customerGets { value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } } }
            }
            ... on DiscountAutomaticBasic {
              title status startsAt endsAt
              customerGets { value { ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } } } }
            }
          }
        }
      }
    }
  }
`

interface DiscountsResponse {
  discountNodes: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    edges: { node: {
      id: string
      discount: {
        title?: string; status?: string; startsAt?: string; endsAt?: string | null
        codes?: { edges: { node: { code: string } }[] }
        customerGets?: { value: { percentage?: number; amount?: { amount: string } } }
      }
    } }[]
  }
}

export async function syncDiscountsPage(shop: string, token: string, storeId: string, service: Service, pageInfo: string | null): Promise<SyncPageResult> {
  const data = await shopifyGraphQL<DiscountsResponse>(shop, token, DISCOUNTS_QUERY, { cursor: pageInfo })
  const edges = data.discountNodes.edges
  let count = 0

  for (const { node: d } of edges) {
    const disc = d.discount
    if (!disc.title) continue // unsupported discount subtype, skip rather than write a blank row
    const code = disc.codes?.edges?.[0]?.node?.code ?? null
    const value = disc.customerGets?.value
    const valueStr = value?.percentage != null ? `${value.percentage * 100}%`
      : value?.amount?.amount != null ? value.amount.amount
      : null

    const { error } = await service.from('shopify_discounts').upsert({
      store_id: storeId,
      shopify_discount_id: d.id,
      title: disc.title,
      code,
      discount_type: code ? 'code' : 'automatic',
      value: valueStr,
      status: disc.status ?? null,
      starts_at: disc.startsAt ?? null,
      ends_at: disc.endsAt ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id,shopify_discount_id' })
    if (error) throw new Error(`shopify_discounts upsert: ${error.message}`)
    count++
  }

  return {
    nextPageInfo: data.discountNodes.pageInfo.hasNextPage ? data.discountNodes.pageInfo.endCursor : null,
    recordsProcessed: count,
  }
}

// ─── Returns (GraphQL) ──────────────────────────────────────────────────────

const RETURNS_QUERY = `
  query SyncReturns($cursor: String) {
    returns(first: 30, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges { node { id status totalQuantity requestedAt order { id } } }
    }
  }
`

interface ReturnsResponse {
  returns: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    edges: { node: { id: string; status: string; totalQuantity: number; requestedAt: string | null; order: { id: string } | null } }[]
  }
}

export async function syncReturnsPage(shop: string, token: string, storeId: string, service: Service, pageInfo: string | null): Promise<SyncPageResult> {
  const data = await shopifyGraphQL<ReturnsResponse>(shop, token, RETURNS_QUERY, { cursor: pageInfo })
  const edges = data.returns.edges
  let count = 0

  for (const { node: r } of edges) {
    let orderId: string | null = null
    if (r.order?.id) {
      const { data: match } = await service.from('shopify_orders').select('id').eq('store_id', storeId).eq('shopify_order_id', r.order.id).maybeSingle()
      orderId = match?.id ?? null
    }

    const { error } = await service.from('shopify_returns').upsert({
      store_id: storeId,
      order_id: orderId,
      shopify_return_id: r.id,
      status: r.status,
      total_quantity: r.totalQuantity,
      requested_at: r.requestedAt,
    }, { onConflict: 'store_id,shopify_return_id' })
    if (error) throw new Error(`shopify_returns upsert: ${error.message}`)
    count++
  }

  return {
    nextPageInfo: data.returns.pageInfo.hasNextPage ? data.returns.pageInfo.endCursor : null,
    recordsProcessed: count,
  }
}
