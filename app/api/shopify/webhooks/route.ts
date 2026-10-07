import { NextResponse } from 'next/server'
import { verifyShopifyWebhook, customerToE164 } from '@/lib/shopify'
import { createServiceClient } from '@/lib/supabase/server'
import { renderTemplate } from '@/lib/utils'
import { decrypt } from '@/lib/encryption'

// REST webhook payloads give plain numeric ids (order.id, line_item.id, ...)
// while the periodic GraphQL sync (lib/shopify-sync.ts) stores everything as
// GIDs (gid://shopify/Order/123) — constructing the same GID format here
// keeps store_id+shopify_order_id upserts from either path landing on the
// same row instead of silently creating a duplicate "REST-flavored" order
// row alongside the "GraphQL-flavored" one for the same real order.
function toGid(resource: string, id: unknown): string {
  return `gid://shopify/${resource}/${id}`
}

// Shopify's webhook delivery is "at least once", not "exactly once" — a slow
// response, a network blip, or our own transient DB error all make Shopify
// retry the SAME event. Without this, every automation_jobs insert below
// would fire a second (or third...) identical WhatsApp message on a retry —
// invisible at low volume, a real and growing problem at 10k orders/day
// where retries become routine rather than rare. Checked per (store, type,
// order) rather than deduping on a webhook-delivery id, since that's the
// actual thing that must not repeat: "order confirmation for order X."
async function automationJobExists(
  supabase: ReturnType<typeof createServiceClient>, storeId: string, type: string, orderId: unknown,
): Promise<boolean> {
  const { data } = await supabase
    .from('automation_jobs')
    .select('id')
    .eq('store_id', storeId)
    .eq('type', type)
    .contains('context', { order_id: String(orderId) })
    .limit(1)
    .maybeSingle()
  return !!data
}

export async function POST(request: Request) {
  const body      = await request.text()
  const hmac      = request.headers.get('X-Shopify-Hmac-Sha256') ?? ''
  const topic     = request.headers.get('X-Shopify-Topic') ?? ''
  const shopDomain = request.headers.get('X-Shopify-Shop-Domain') ?? ''

  const supabase = createServiceClient()

  // Store must be looked up before verifying — custom_app stores sign their
  // webhooks with their OWN client secret (set when the merchant created
  // their app), not the single shared SHOPIFY_API_SECRET the legacy OAuth
  // flow uses, so we need to know which kind of store this is first.
  const { data: store } = await supabase
    .from('stores')
    .select('id, whatsapp_bsp, whatsapp_api_key, shop_name, shopify_connection_type, shopify_client_secret_enc')
    .eq('shopify_domain', shopDomain)
    .eq('is_active', true)
    .maybeSingle()

  if (!store) return NextResponse.json({ ok: true })

  const webhookSecret = store.shopify_connection_type === 'custom_app' && store.shopify_client_secret_enc
    ? decrypt(store.shopify_client_secret_enc)
    : undefined // falls back to SHOPIFY_API_SECRET inside verifyShopifyWebhook

  if (!verifyShopifyWebhook(body, hmac, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)

  try {
    switch (topic) {
      case 'checkouts/create':
      case 'checkouts/update':
        await handleCheckout(supabase, store, payload)
        break
      case 'orders/create':
        await handleOrderCreate(supabase, store, payload)
        break
      case 'orders/fulfilled':
        await handleOrderFulfilled(supabase, store, payload)
        break
      case 'orders/updated':
        await handleOrderUpdated(supabase, store, payload)
        break
      case 'customers/data_request':
        // Shopify GDPR: customer requested their data — acknowledge receipt (no PII stored beyond phone/email)
        console.log(`[webhook] customers/data_request for ${shopDomain}`)
        break
      case 'customers/redact':
        // Shopify GDPR: delete customer data
        await supabase.from('customers').delete()
          .eq('store_id', store.id)
          .eq('phone', customerToE164(String((payload as Record<string, unknown>).phone ?? '')))
        console.log(`[webhook] customers/redact for ${shopDomain}`)
        break
      case 'shop/redact':
        // Shopify GDPR: merchant uninstalled 48h+ ago, delete all shop data
        await supabase.from('customers').delete().eq('store_id', store.id)
        await supabase.from('automation_jobs').delete().eq('store_id', store.id)
        console.log(`[webhook] shop/redact for ${shopDomain}`)
        break
      case 'app/uninstalled':
        await supabase.from('stores').update({
          is_active: false,
          shopify_access_token: null,
          shopify_access_token_enc: null,
          shopify_client_secret_enc: null,
          shopify_token_expires_at: null,
          updated_at: new Date().toISOString(),
        }).eq('shopify_domain', shopDomain)
        await supabase.from('billing').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('billing_provider', 'shopify')
          .in('user_id', (await supabase.from('stores').select('user_id').eq('shopify_domain', shopDomain).then(r => r.data?.map(s => s.user_id) ?? [])))
        break
      case 'app_subscriptions/update': {
        const sub = payload as { app_subscription?: { status?: string; admin_graphql_api_id?: string } }
        const subStatus = sub.app_subscription?.status
        const subId     = sub.app_subscription?.admin_graphql_api_id
        // Webhook sends a full GID (gid://shopify/AppSubscription/12345) but we store
        // the numeric ID from the callback URL — extract the numeric part to match.
        const numericSubId = subId?.split('/').pop()
        if (numericSubId) {
          const dbStatus = subStatus === 'ACTIVE' ? 'active'
            : subStatus === 'PENDING' ? 'trialing'
            : subStatus === 'CANCELLED' || subStatus === 'DECLINED' ? 'cancelled'
            : null
          if (dbStatus) {
            await supabase.from('billing').update({ status: dbStatus, updated_at: new Date().toISOString() })
              .eq('shopify_subscription_id', numericSubId)
          }
        }
        break
      }
    }
  } catch (err) {
    console.error(`Webhook error [${topic}]:`, err)
  }

  return NextResponse.json({ ok: true })
}

async function handleCheckout(supabase: ReturnType<typeof createServiceClient>, store: { id: string; shop_name: string | null }, checkout: Record<string, unknown>) {
  const rawPhone = String(checkout.phone ?? (checkout.shipping_address as Record<string, unknown>)?.phone ?? '')
  if (!rawPhone.replace(/\D/g, '')) return
  const countryCode = String(
    (checkout.shipping_address as Record<string, unknown>)?.country_code ??
    (checkout.billing_address  as Record<string, unknown>)?.country_code ?? ''
  ).toUpperCase()
  const phone = customerToE164(rawPhone, countryCode)
  const lineItems   = (checkout.line_items as Record<string, unknown>[]) ?? []
  const firstName   = String((checkout.shipping_address as Record<string, unknown>)?.first_name ?? 'there')
  const checkoutUrl = String(checkout.abandoned_checkout_url ?? '')

  // Upsert customer + mirror into shopify_abandoned_checkouts unconditionally
  // — this used to happen only when Abandoned Cart Recovery was enabled,
  // because both lived after that automation's early return below. Data
  // visibility (the Store page's Abandoned Checkouts list) shouldn't depend
  // on whether the merchant has that automation turned on; only the
  // WhatsApp-sending part should.
  const { data: customerRow } = await supabase.from('customers').upsert({
    store_id: store.id, phone, name: firstName,
    email: String(checkout.email ?? ''),
    whatsapp_opt_in: true,
  }, { onConflict: 'store_id,phone', ignoreDuplicates: false }).select('id').maybeSingle()

  if (checkout.id) {
    await supabase.from('shopify_abandoned_checkouts').upsert({
      store_id: store.id,
      customer_id: customerRow?.id ?? null,
      shopify_checkout_id: String(checkout.id),
      email: String(checkout.email ?? '') || null,
      phone,
      total_price: checkout.total_price ? parseFloat(String(checkout.total_price)) : null,
      currency: checkout.currency ? String(checkout.currency) : null,
      recovery_url: checkoutUrl || null,
      line_items: lineItems,
      abandoned_at: checkout.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id,shopify_checkout_id' })
  }

  const { data: auto } = await supabase
    .from('automations')
    .select('*')
    .eq('store_id', store.id)
    .eq('type', 'abandoned_cart')
    .eq('is_enabled', true)
    .maybeSingle()

  if (!auto) return

  // 'SAVE10' used to be sent here unconditionally whenever discount_enabled
  // was on, completely disconnected from the merchant's configured
  // discount_value and from any code that actually exists in their Shopify
  // store — a customer offered "25% off with SAVE10" for a code that either
  // doesn't exist or is a different percentage. No Shopify discount/price-
  // rule API integration exists in this codebase yet to create a real one,
  // so until that's built, don't promise a code that isn't real.
  const vars: Record<string, string> = {
    name:           firstName,
    shop_name:      store.shop_name ?? 'our store',
    cart_url:       checkoutUrl,
    discount_code:  '',
    discount_value: String(auto.discount_value ?? 10),
    // '' is falsy to renderTemplate's {{#discount}}...{{/discount}} check —
    // a template using that section to wrap its discount-code mention now
    // correctly omits the whole thing instead of printing it with a blank
    // code, instead of leaking raw {{#discount}} markup as before.
    discount:       '',
  }

  const message = renderTemplate(auto.template, vars)
  const scheduledAt = new Date(Date.now() + auto.delay_minutes * 60 * 1000).toISOString()

  // Cancel previous pending abandoned cart jobs for this phone
  await supabase
    .from('automation_jobs')
    .update({ status: 'cancelled' })
    .eq('store_id', store.id)
    .eq('customer_phone', phone)
    .eq('type', 'abandoned_cart')
    .eq('status', 'pending')

  await supabase.from('automation_jobs').insert({
    store_id:       store.id,
    automation_id:  auto.id,
    type:           'abandoned_cart',
    customer_phone: phone,
    customer_name:  firstName,
    message,
    context:        { checkout_id: checkout.id, line_items: lineItems.length, checkout_url: checkoutUrl },
    status:         'pending',
    scheduled_at:   scheduledAt,
  })
}

async function attributeRevenue(
  supabase: ReturnType<typeof createServiceClient>,
  storeId: string,
  customerPhone: string,
  orderValue: number,
  orderId: unknown,
) {
  // Find the most recent WhatsApp message sent to this phone in the last 24h
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentMsg } = await supabase
    .from('messages')
    .select('id, type, job_id, metadata')
    .eq('store_id', storeId)
    .eq('customer_phone', customerPhone)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!recentMsg) return

  // Merge attributed_order_id into existing metadata instead of replacing it
  const existingMeta = (recentMsg.metadata ?? {}) as Record<string, unknown>
  await supabase.from('messages')
    .update({ revenue_attributed: orderValue, metadata: { ...existingMeta, attributed_order_id: String(orderId) } })
    .eq('id', recentMsg.id)

  // Atomic increments — avoids read-then-write race where two concurrent order
  // webhooks both read the same baseline and one overwrites the other's update.
  const today = new Date().toISOString().split('T')[0]
  const isCartRecovery = recentMsg.type === 'abandoned_cart'
  await supabase.rpc('increment_analytics_by', {
    p_store_id: storeId,
    p_date:     today,
    p_field:    'revenue_recovered',
    p_amount:   orderValue,
  }).then(null, () => null)
  if (isCartRecovery) {
    await supabase.rpc('increment_analytics_by', {
      p_store_id: storeId,
      p_date:     today,
      p_field:    'carts_recovered',
      p_amount:   1,
    }).then(null, () => null)
  }
}

async function handleOrderCreate(supabase: ReturnType<typeof createServiceClient>, store: { id: string; shop_name: string | null }, order: Record<string, unknown>) {
  const rawPhone = String(order.phone ?? (order.shipping_address as Record<string, unknown>)?.phone ?? '')
  if (!rawPhone.replace(/\D/g, '')) return
  const countryCode = String(
    (order.shipping_address as Record<string, unknown>)?.country_code ??
    (order.billing_address  as Record<string, unknown>)?.country_code ?? ''
  ).toUpperCase()
  const phone = customerToE164(rawPhone, countryCode)

  const isCOD        = String((order.payment_gateway_names as string[])?.[0] ?? '').toLowerCase().includes('cod') ||
                       String(order.payment_gateway ?? '').toLowerCase().includes('cod') ||
                       String(order.financial_status ?? '').toLowerCase() === 'pending'
  const firstName    = String((order.customer as Record<string, unknown>)?.first_name ?? (order.shipping_address as Record<string, unknown>)?.first_name ?? 'there')
  const orderNumber  = String(order.order_number ?? order.name ?? '')
  const totalPrice   = String(order.total_price ?? '0')

  // Cancel pending abandoned cart jobs (customer checked out)
  await supabase
    .from('automation_jobs')
    .update({ status: 'cancelled' })
    .eq('store_id', store.id)
    .eq('customer_phone', phone)
    .eq('type', 'abandoned_cart')
    .eq('status', 'pending')

  // Order confirmation
  const { data: confirmAuto } = await supabase
    .from('automations').select('*')
    .eq('store_id', store.id).eq('type', 'order_confirmation').eq('is_enabled', true).maybeSingle()

  if (confirmAuto && !(await automationJobExists(supabase, store.id, 'order_confirmation', order.id))) {
    const msg = renderTemplate(confirmAuto.template, {
      name: firstName, order_number: orderNumber, shop_name: store.shop_name ?? 'our store',
      order_url: String(order.order_status_url ?? ''),
    })
    await supabase.from('automation_jobs').insert({
      store_id: store.id, automation_id: confirmAuto.id, type: 'order_confirmation',
      customer_phone: phone, customer_name: firstName, message: msg,
      // Store order_id as string so JSONB @> queries match at query time
      context: { order_id: String(order.id), order_number: orderNumber },
      status: 'pending', scheduled_at: new Date().toISOString(),
    })
  }

  // COD verification
  if (isCOD) {
    const { data: codAuto } = await supabase
      .from('automations').select('*')
      .eq('store_id', store.id).eq('type', 'cod_verification').eq('is_enabled', true).maybeSingle()

    if (codAuto && !(await automationJobExists(supabase, store.id, 'cod_verification', order.id))) {
      const msg = renderTemplate(codAuto.template, {
        name: firstName, order_number: orderNumber, amount: totalPrice, shop_name: store.shop_name ?? 'our store',
      })
      const scheduledAt = new Date(Date.now() + codAuto.delay_minutes * 60 * 1000).toISOString()
      await supabase.from('automation_jobs').insert({
        store_id: store.id, automation_id: codAuto.id, type: 'cod_verification',
        customer_phone: phone, customer_name: firstName, message: msg,
        context: { order_id: String(order.id), order_number: orderNumber, total_price: totalPrice },
        status: 'pending', scheduled_at: scheduledAt,
      })
    }
  }

  // increment_customer_order_stats (and revenue attribution, right below) must
  // only ever run once per real order — unlike automation_jobs (deduped via
  // automationJobExists above), neither had such a guard: a retried
  // orders/create webhook (Shopify's delivery is "at least once", not
  // exactly-once) would increment total_orders/total_spent, and separately
  // double-count revenue_recovered/carts_recovered in analytics_daily, a
  // second time for the same order. Checking whether shopify_orders already
  // has this order is what tells us whether this is a genuinely new order or
  // a replayed webhook.
  const shopifyOrderGid = toGid('Order', order.id)
  const { data: existingOrder } = await supabase
    .from('shopify_orders').select('id').eq('store_id', store.id).eq('shopify_order_id', shopifyOrderGid).maybeSingle()

  // Revenue attribution — attribute order value to last WhatsApp message within 24h
  const orderValue = parseFloat(String(order.total_price ?? '0'))
  if (orderValue > 0 && !existingOrder) {
    await attributeRevenue(supabase, store.id, phone, orderValue, order.id).catch(() => null)
  }

  let customerRow: { id: string } | null = null
  if (!existingOrder) {
    const { data: customerId } = await supabase.rpc('increment_customer_order_stats', {
      p_store_id: store.id,
      p_phone: phone,
      p_name: firstName,
      p_email: String((order.customer as Record<string, unknown>)?.email ?? order.email ?? ''),
      p_order_value: orderValue,
    })
    customerRow = customerId ? { id: customerId as string } : null
  } else {
    // Order already counted — still need the customer id to keep
    // shopify_orders.customer_id correct on a replayed webhook, just without
    // incrementing anything again.
    const { data: match } = await supabase.from('customers').select('id').eq('store_id', store.id).eq('phone', phone).maybeSingle()
    customerRow = match ?? null
  }

  // Mirror into shopify_orders immediately instead of waiting for the next
  // periodic sync (app/api/cron/shopify-sync) — that's what the Store page's
  // "Recent Orders" list reads from, and it used to only pick up an order
  // once someone clicked Sync Now or a cron tick happened to run.
  const { data: orderRow } = await supabase.from('shopify_orders').upsert({
    store_id: store.id,
    customer_id: customerRow?.id ?? null,
    shopify_order_id: shopifyOrderGid,
    order_number: String(order.name ?? orderNumber),
    email: String(order.email ?? ''),
    phone,
    currency: String(order.currency ?? 'INR'),
    total_price: orderValue,
    subtotal_price: order.subtotal_price ? parseFloat(String(order.subtotal_price)) : null,
    total_tax: order.total_tax ? parseFloat(String(order.total_tax)) : null,
    total_discounts: order.total_discounts ? parseFloat(String(order.total_discounts)) : null,
    financial_status: order.financial_status ? String(order.financial_status) : null,
    fulfillment_status: order.fulfillment_status ? String(order.fulfillment_status) : null,
    cancelled_at: order.cancelled_at ?? null,
    tags: String(order.tags ?? ''),
    note: order.note ? String(order.note) : null,
    shopify_created_at: order.created_at ?? new Date().toISOString(),
    shopify_updated_at: order.updated_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'store_id,shopify_order_id' }).select('id').maybeSingle()

  if (orderRow) {
    const lineItems = ((order.line_items as Record<string, unknown>[]) ?? []).map(li => ({
      order_id: orderRow.id,
      shopify_line_item_id: toGid('LineItem', li.id),
      shopify_product_id: li.product_id ? toGid('Product', li.product_id) : null,
      shopify_variant_id: li.variant_id ? toGid('ProductVariant', li.variant_id) : null,
      title: String(li.title ?? ''),
      variant_title: li.variant_title ? String(li.variant_title) : null,
      sku: li.sku ? String(li.sku) : null,
      quantity: Number(li.quantity ?? 0),
      price: li.price ? parseFloat(String(li.price)) : null,
    }))
    if (lineItems.length) {
      await supabase.from('shopify_order_line_items').upsert(lineItems, { onConflict: 'order_id,shopify_line_item_id' })
    }
  }
}

async function handleOrderFulfilled(supabase: ReturnType<typeof createServiceClient>, store: { id: string; shop_name: string | null }, order: Record<string, unknown>) {
  const rawPhone = String(order.phone ?? (order.shipping_address as Record<string, unknown>)?.phone ?? '')
  if (!rawPhone.replace(/\D/g, '')) return
  const countryCode = String(
    (order.shipping_address as Record<string, unknown>)?.country_code ??
    (order.billing_address  as Record<string, unknown>)?.country_code ?? ''
  ).toUpperCase()
  const customerPhone = customerToE164(rawPhone, countryCode)

  const firstName   = String((order.customer as Record<string, unknown>)?.first_name ?? 'there')
  const orderNumber = String(order.order_number ?? order.name ?? '')
  const fulfillments = (order.fulfillments as Record<string, unknown>[]) ?? []
  const trackingUrl  = String((fulfillments[0]?.tracking_url as string) ?? '')

  // Shipping update
  const { data: shipAuto } = await supabase
    .from('automations').select('*')
    .eq('store_id', store.id).eq('type', 'shipping_update').eq('is_enabled', true).maybeSingle()

  if (shipAuto && !(await automationJobExists(supabase, store.id, 'shipping_update', order.id))) {
    const msg = renderTemplate(shipAuto.template, {
      name: firstName, order_number: orderNumber, shop_name: store.shop_name ?? 'our store',
      tracking_url: trackingUrl,
    })
    await supabase.from('automation_jobs').insert({
      store_id: store.id, automation_id: shipAuto.id, type: 'shipping_update',
      customer_phone: customerPhone, customer_name: firstName, message: msg,
      context: { order_id: String(order.id), tracking_url: trackingUrl },
      status: 'pending', scheduled_at: new Date().toISOString(),
    })
  }

  // Post-purchase upsell — schedule 24h after fulfillment
  const { data: upsellAuto } = await supabase
    .from('automations').select('*')
    .eq('store_id', store.id).eq('type', 'post_purchase_upsell').eq('is_enabled', true).maybeSingle()

  if (upsellAuto && !(await automationJobExists(supabase, store.id, 'post_purchase_upsell', order.id))) {
    const delay = (upsellAuto.delay_minutes ?? 1440) * 60 * 1000
    const msg = renderTemplate(upsellAuto.template ?? DEFAULT_UPSELL_TEMPLATE, {
      name: firstName, shop_name: store.shop_name ?? 'our store',
      order_number: orderNumber,
    })
    await supabase.from('automation_jobs').insert({
      store_id: store.id, automation_id: upsellAuto.id, type: 'post_purchase_upsell',
      customer_phone: customerPhone, customer_name: firstName, message: msg,
      context: { order_id: String(order.id) },
      status: 'pending', scheduled_at: new Date(Date.now() + delay).toISOString(),
    })
  }

  // Review request — schedule 5 days after fulfillment
  const { data: reviewAuto } = await supabase
    .from('automations').select('*')
    .eq('store_id', store.id).eq('type', 'review_request').eq('is_enabled', true).maybeSingle()

  if (reviewAuto && !(await automationJobExists(supabase, store.id, 'review_request', order.id))) {
    const delay = (reviewAuto.delay_minutes ?? 7200) * 60 * 1000
    const msg = renderTemplate(reviewAuto.template ?? DEFAULT_REVIEW_TEMPLATE, {
      name: firstName, shop_name: store.shop_name ?? 'our store',
    })
    await supabase.from('automation_jobs').insert({
      store_id: store.id, automation_id: reviewAuto.id, type: 'review_request',
      customer_phone: customerPhone, customer_name: firstName, message: msg,
      context: { order_id: String(order.id) },
      status: 'pending', scheduled_at: new Date(Date.now() + delay).toISOString(),
    })
  }
}

// ─── orders/updated ──────────────────────────────────────────────────────────

async function handleOrderUpdated(supabase: ReturnType<typeof createServiceClient>, store: { id: string; shop_name: string | null }, order: Record<string, unknown>) {
  const fulfillmentStatus = String(order.fulfillment_status ?? '')
  const financialStatus   = String(order.financial_status   ?? '')
  const orderId           = String(order.id ?? '')

  // Cancel pending automation jobs (e.g. unconfirmed COD) when an order is refunded/voided/cancelled
  const now = new Date().toISOString()
  if (financialStatus === 'refunded' || financialStatus === 'voided' || String(order.cancelled_at ?? '')) {
    await supabase.from('automation_jobs')
      .update({ status: 'cancelled' })
      .eq('store_id', store.id)
      .contains('context', { order_id: orderId })
      .eq('status', 'pending')
  }

  // Mark automation jobs for this order as delivered when fulfillment is done.
  // Fetch then merge to avoid overwriting existing context fields.
  if (fulfillmentStatus === 'fulfilled') {
    const { data: matchingJobs } = await supabase.from('automation_jobs')
      .select('id, context')
      .eq('store_id', store.id)
      .contains('context', { order_id: orderId })
    for (const j of matchingJobs ?? []) {
      const ctx = (j.context as Record<string, unknown>) ?? {}
      await supabase.from('automation_jobs')
        .update({ context: { ...ctx, delivery_status: 'fulfilled' } })
        .eq('id', j.id)
    }
  }

  // Keep the shopify_orders mirror current too — same GID format the
  // periodic sync and handleOrderCreate both use as the upsert key, so this
  // updates the same row instead of creating a stray one.
  await supabase.from('shopify_orders').update({
    financial_status: financialStatus || null,
    fulfillment_status: fulfillmentStatus || null,
    total_refunded: order.total_refunded ? parseFloat(String(order.total_refunded)) : undefined,
    cancelled_at: order.cancelled_at ?? null,
    shopify_updated_at: order.updated_at ?? now,
    updated_at: now,
  }).eq('store_id', store.id).eq('shopify_order_id', toGid('Order', order.id))
}

// ─── Win-back: triggered by cron, not a webhook event ────────────────────────
// Win-back jobs are created by the nightly cron scanning for inactive customers.
// See /api/cron for implementation.

const DEFAULT_UPSELL_TEMPLATE = 'Hi {{name}}! Thank you for your order at {{shop_name}} ❤️\n\nCustomers who bought this also loved these picks — check them out!\n\nUse code THANKYOU10 for 10% off your next order!'

const DEFAULT_REVIEW_TEMPLATE = 'Hi {{name}}! Hope you\'re loving your purchase from {{shop_name}} 😊\n\nWould you mind leaving us a quick review? It helps us a lot and takes just 2 minutes!\n\nThank you!'
