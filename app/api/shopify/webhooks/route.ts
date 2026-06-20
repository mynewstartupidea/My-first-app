import { NextResponse } from 'next/server'
import { verifyShopifyWebhook } from '@/lib/shopify'
import { createServiceClient } from '@/lib/supabase/server'
import { renderTemplate } from '@/lib/utils'

export async function POST(request: Request) {
  const body      = await request.text()
  const hmac      = request.headers.get('X-Shopify-Hmac-Sha256') ?? ''
  const topic     = request.headers.get('X-Shopify-Topic') ?? ''
  const shopDomain = request.headers.get('X-Shopify-Shop-Domain') ?? ''

  if (!verifyShopifyWebhook(body, hmac)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(body)
  const supabase = createServiceClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, whatsapp_bsp, whatsapp_api_key, shop_name')
    .eq('shopify_domain', shopDomain)
    .eq('is_active', true)
    .maybeSingle()

  if (!store) return NextResponse.json({ ok: true })

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
    }
  } catch (err) {
    console.error(`Webhook error [${topic}]:`, err)
  }

  return NextResponse.json({ ok: true })
}

async function handleCheckout(supabase: ReturnType<typeof createServiceClient>, store: { id: string; shop_name: string | null }, checkout: Record<string, unknown>) {
  const phone = String(checkout.phone ?? (checkout.shipping_address as Record<string, unknown>)?.phone ?? '').replace(/\D/g, '')
  if (!phone) return

  const { data: auto } = await supabase
    .from('automations')
    .select('*')
    .eq('store_id', store.id)
    .eq('type', 'abandoned_cart')
    .eq('is_enabled', true)
    .maybeSingle()

  if (!auto) return

  const lineItems   = (checkout.line_items as Record<string, unknown>[]) ?? []
  const firstName   = String((checkout.shipping_address as Record<string, unknown>)?.first_name ?? 'there')
  const checkoutUrl = String(checkout.abandoned_checkout_url ?? '')

  const vars: Record<string, string> = {
    name:           firstName,
    shop_name:      store.shop_name ?? 'our store',
    cart_url:       checkoutUrl,
    discount_code:  auto.discount_enabled ? 'SAVE10' : '',
    discount_value: String(auto.discount_value ?? 10),
  }

  const message = renderTemplate(auto.template, vars)
  const scheduledAt = new Date(Date.now() + auto.delay_minutes * 60 * 1000).toISOString()

  // Cancel previous pending abandoned cart jobs for this phone
  await supabase
    .from('automation_jobs')
    .update({ status: 'cancelled' })
    .eq('store_id', store.id)
    .eq('customer_phone', `+91${phone}`)
    .eq('type', 'abandoned_cart')
    .eq('status', 'pending')

  await supabase.from('automation_jobs').insert({
    store_id:       store.id,
    automation_id:  auto.id,
    type:           'abandoned_cart',
    customer_phone: `+91${phone}`,
    customer_name:  firstName,
    message,
    context:        { checkout_id: checkout.id, line_items: lineItems.length, checkout_url: checkoutUrl },
    status:         'pending',
    scheduled_at:   scheduledAt,
  })

  // Upsert customer
  await supabase.from('customers').upsert({
    store_id:      store.id,
    phone:         `+91${phone}`,
    name:          firstName,
    email:         String(checkout.email ?? ''),
    whatsapp_opt_in: true,
  }, { onConflict: 'store_id,phone', ignoreDuplicates: false })
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

  // Increment analytics_daily — read then write to avoid overwriting existing totals
  const today = new Date().toISOString().split('T')[0]
  const { data: existing } = await supabase
    .from('analytics_daily')
    .select('revenue_recovered, carts_recovered')
    .eq('store_id', storeId)
    .eq('date', today)
    .maybeSingle()

  const isCartRecovery = recentMsg.type === 'abandoned_cart'
  await supabase.from('analytics_daily').upsert(
    {
      store_id:         storeId,
      date:             today,
      revenue_recovered: Number(existing?.revenue_recovered ?? 0) + orderValue,
      carts_recovered:  (existing?.carts_recovered ?? 0) + (isCartRecovery ? 1 : 0),
    },
    { onConflict: 'store_id,date' }
  ).then(null, () => null)
}

async function handleOrderCreate(supabase: ReturnType<typeof createServiceClient>, store: { id: string; shop_name: string | null }, order: Record<string, unknown>) {
  const phone = String(order.phone ?? (order.shipping_address as Record<string, unknown>)?.phone ?? '').replace(/\D/g, '')
  if (!phone) return

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
    .eq('customer_phone', `+91${phone}`)
    .eq('type', 'abandoned_cart')
    .eq('status', 'pending')

  // Order confirmation
  const { data: confirmAuto } = await supabase
    .from('automations').select('*')
    .eq('store_id', store.id).eq('type', 'order_confirmation').eq('is_enabled', true).maybeSingle()

  if (confirmAuto) {
    const msg = renderTemplate(confirmAuto.template, {
      name: firstName, order_number: orderNumber, shop_name: store.shop_name ?? 'our store',
      order_url: String(order.order_status_url ?? ''),
    })
    await supabase.from('automation_jobs').insert({
      store_id: store.id, automation_id: confirmAuto.id, type: 'order_confirmation',
      customer_phone: `+91${phone}`, customer_name: firstName, message: msg,
      context: { order_id: order.id, order_number: orderNumber },
      status: 'pending', scheduled_at: new Date().toISOString(),
    })
  }

  // COD verification
  if (isCOD) {
    const { data: codAuto } = await supabase
      .from('automations').select('*')
      .eq('store_id', store.id).eq('type', 'cod_verification').eq('is_enabled', true).maybeSingle()

    if (codAuto) {
      const msg = renderTemplate(codAuto.template, {
        name: firstName, order_number: orderNumber, amount: totalPrice, shop_name: store.shop_name ?? 'our store',
      })
      const scheduledAt = new Date(Date.now() + codAuto.delay_minutes * 60 * 1000).toISOString()
      await supabase.from('automation_jobs').insert({
        store_id: store.id, automation_id: codAuto.id, type: 'cod_verification',
        customer_phone: `+91${phone}`, customer_name: firstName, message: msg,
        context: { order_id: order.id, order_number: orderNumber, total_price: totalPrice },
        status: 'pending', scheduled_at: scheduledAt,
      })
    }
  }

  // Revenue attribution — attribute order value to last WhatsApp message within 24h
  const orderValue = parseFloat(String(order.total_price ?? '0'))
  if (orderValue > 0) {
    await attributeRevenue(supabase, store.id, `+91${phone}`, orderValue, order.id).catch(() => null)
  }

  // Update customer stats
  await supabase.from('customers').upsert({
    store_id: store.id, phone: `+91${phone}`, name: firstName,
    email: String((order.customer as Record<string, unknown>)?.email ?? order.email ?? ''),
    whatsapp_opt_in: true, total_orders: 1, last_order_at: new Date().toISOString(),
  }, { onConflict: 'store_id,phone', ignoreDuplicates: false })
}

async function handleOrderFulfilled(supabase: ReturnType<typeof createServiceClient>, store: { id: string; shop_name: string | null }, order: Record<string, unknown>) {
  const phone = String(order.phone ?? (order.shipping_address as Record<string, unknown>)?.phone ?? '').replace(/\D/g, '')
  if (!phone) return

  const firstName   = String((order.customer as Record<string, unknown>)?.first_name ?? 'there')
  const orderNumber = String(order.order_number ?? order.name ?? '')
  const fulfillments = (order.fulfillments as Record<string, unknown>[]) ?? []
  const trackingUrl  = String((fulfillments[0]?.tracking_url as string) ?? '')
  const customerPhone = `+91${phone}`

  // Shipping update
  const { data: shipAuto } = await supabase
    .from('automations').select('*')
    .eq('store_id', store.id).eq('type', 'shipping_update').eq('is_enabled', true).maybeSingle()

  if (shipAuto) {
    const msg = renderTemplate(shipAuto.template, {
      name: firstName, order_number: orderNumber, shop_name: store.shop_name ?? 'our store',
      tracking_url: trackingUrl,
    })
    await supabase.from('automation_jobs').insert({
      store_id: store.id, automation_id: shipAuto.id, type: 'shipping_update',
      customer_phone: customerPhone, customer_name: firstName, message: msg,
      context: { order_id: order.id, tracking_url: trackingUrl },
      status: 'pending', scheduled_at: new Date().toISOString(),
    })
  }

  // Post-purchase upsell — schedule 24h after fulfillment
  const { data: upsellAuto } = await supabase
    .from('automations').select('*')
    .eq('store_id', store.id).eq('type', 'post_purchase_upsell').eq('is_enabled', true).maybeSingle()

  if (upsellAuto) {
    const delay = (upsellAuto.delay_minutes ?? 1440) * 60 * 1000
    const msg = renderTemplate(upsellAuto.template ?? DEFAULT_UPSELL_TEMPLATE, {
      name: firstName, shop_name: store.shop_name ?? 'our store',
      order_number: orderNumber,
    })
    await supabase.from('automation_jobs').insert({
      store_id: store.id, automation_id: upsellAuto.id, type: 'post_purchase_upsell',
      customer_phone: customerPhone, customer_name: firstName, message: msg,
      context: { order_id: order.id },
      status: 'pending', scheduled_at: new Date(Date.now() + delay).toISOString(),
    })
  }

  // Review request — schedule 5 days after fulfillment
  const { data: reviewAuto } = await supabase
    .from('automations').select('*')
    .eq('store_id', store.id).eq('type', 'review_request').eq('is_enabled', true).maybeSingle()

  if (reviewAuto) {
    const delay = (reviewAuto.delay_minutes ?? 7200) * 60 * 1000
    const msg = renderTemplate(reviewAuto.template ?? DEFAULT_REVIEW_TEMPLATE, {
      name: firstName, shop_name: store.shop_name ?? 'our store',
    })
    await supabase.from('automation_jobs').insert({
      store_id: store.id, automation_id: reviewAuto.id, type: 'review_request',
      customer_phone: customerPhone, customer_name: firstName, message: msg,
      context: { order_id: order.id },
      status: 'pending', scheduled_at: new Date(Date.now() + delay).toISOString(),
    })
  }
}

// ─── Win-back: triggered by cron, not a webhook event ────────────────────────
// Win-back jobs are created by the nightly cron scanning for inactive customers.
// See /api/cron for implementation.

const DEFAULT_UPSELL_TEMPLATE = 'Hi {{name}}! Thank you for your order at {{shop_name}} ❤️\n\nCustomers who bought this also loved these picks — check them out!\n\nUse code THANKYOU10 for 10% off your next order!'

const DEFAULT_REVIEW_TEMPLATE = 'Hi {{name}}! Hope you\'re loving your purchase from {{shop_name}} 😊\n\nWould you mind leaving us a quick review? It helps us a lot and takes just 2 minutes!\n\nThank you!'
