import { NextResponse } from 'next/server'
import { verifyShopifyWebhook } from '@/lib/shopify'
import { createServiceClient } from '@/lib/supabase/server'
import { renderTemplate } from '@/lib/utils'

// Normalise a raw phone string to E.164.
// Uses the Shopify address country_code to determine prefix for bare 10-digit numbers.
// Defaults to +91 (India) when country is unknown — primary market.
function toE164(raw: string, countryCode = ''): string {
  if (!raw) return ''
  if (raw.startsWith('+')) return `+${raw.replace(/\D/g, '')}`
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  // Already includes country code digits (11–15 digits)
  if (digits.length > 10) return `+${digits}`
  // 10-digit number — infer country prefix
  if (digits.length === 10) {
    if (countryCode === 'US' || countryCode === 'CA') return `+1${digits}`
    if (countryCode === 'GB') return `+44${digits}`
    if (countryCode === 'AU') return `+61${digits}`
    if (countryCode === 'AE') return `+971${digits}`
    return `+91${digits}` // default: India
  }
  return `+91${digits}`
}

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
          .eq('phone', toE164(String((payload as Record<string, unknown>).phone ?? '')))
        console.log(`[webhook] customers/redact for ${shopDomain}`)
        break
      case 'shop/redact':
        // Shopify GDPR: merchant uninstalled 48h+ ago, delete all shop data
        await supabase.from('customers').delete().eq('store_id', store.id)
        await supabase.from('automation_jobs').delete().eq('store_id', store.id)
        console.log(`[webhook] shop/redact for ${shopDomain}`)
        break
      case 'app/uninstalled':
        await supabase.from('stores').update({ is_active: false, shopify_access_token: null, updated_at: new Date().toISOString() }).eq('shopify_domain', shopDomain)
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
  const phone = toE164(rawPhone, countryCode)

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

  // Upsert customer
  await supabase.from('customers').upsert({
    store_id:      store.id,
    phone,
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
  const rawPhone = String(order.phone ?? (order.shipping_address as Record<string, unknown>)?.phone ?? '')
  if (!rawPhone.replace(/\D/g, '')) return
  const countryCode = String(
    (order.shipping_address as Record<string, unknown>)?.country_code ??
    (order.billing_address  as Record<string, unknown>)?.country_code ?? ''
  ).toUpperCase()
  const phone = toE164(rawPhone, countryCode)

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

  if (confirmAuto) {
    const msg = renderTemplate(confirmAuto.template, {
      name: firstName, order_number: orderNumber, shop_name: store.shop_name ?? 'our store',
      order_url: String(order.order_status_url ?? ''),
    })
    await supabase.from('automation_jobs').insert({
      store_id: store.id, automation_id: confirmAuto.id, type: 'order_confirmation',
      customer_phone: phone, customer_name: firstName, message: msg,
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
        customer_phone: phone, customer_name: firstName, message: msg,
        context: { order_id: order.id, order_number: orderNumber, total_price: totalPrice },
        status: 'pending', scheduled_at: scheduledAt,
      })
    }
  }

  // Revenue attribution — attribute order value to last WhatsApp message within 24h
  const orderValue = parseFloat(String(order.total_price ?? '0'))
  if (orderValue > 0) {
    await attributeRevenue(supabase, store.id, phone, orderValue, order.id).catch(() => null)
  }

  // Update customer stats
  await supabase.from('customers').upsert({
    store_id: store.id, phone, name: firstName,
    email: String((order.customer as Record<string, unknown>)?.email ?? order.email ?? ''),
    whatsapp_opt_in: true, total_orders: 1, last_order_at: new Date().toISOString(),
  }, { onConflict: 'store_id,phone', ignoreDuplicates: false })
}

async function handleOrderFulfilled(supabase: ReturnType<typeof createServiceClient>, store: { id: string; shop_name: string | null }, order: Record<string, unknown>) {
  const rawPhone = String(order.phone ?? (order.shipping_address as Record<string, unknown>)?.phone ?? '')
  if (!rawPhone.replace(/\D/g, '')) return
  const countryCode = String(
    (order.shipping_address as Record<string, unknown>)?.country_code ??
    (order.billing_address  as Record<string, unknown>)?.country_code ?? ''
  ).toUpperCase()
  const customerPhone = toE164(rawPhone, countryCode)

  const firstName   = String((order.customer as Record<string, unknown>)?.first_name ?? 'there')
  const orderNumber = String(order.order_number ?? order.name ?? '')
  const fulfillments = (order.fulfillments as Record<string, unknown>[]) ?? []
  const trackingUrl  = String((fulfillments[0]?.tracking_url as string) ?? '')

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

  // Mark automation jobs for this order as delivered when fulfillment is done
  if (fulfillmentStatus === 'fulfilled') {
    await supabase.from('automation_jobs')
      .update({ context: { order_id: orderId, delivery_status: 'fulfilled' } })
      .eq('store_id', store.id)
      .contains('context', { order_id: orderId })
  }
}

// ─── Win-back: triggered by cron, not a webhook event ────────────────────────
// Win-back jobs are created by the nightly cron scanning for inactive customers.
// See /api/cron for implementation.

const DEFAULT_UPSELL_TEMPLATE = 'Hi {{name}}! Thank you for your order at {{shop_name}} ❤️\n\nCustomers who bought this also loved these picks — check them out!\n\nUse code THANKYOU10 for 10% off your next order!'

const DEFAULT_REVIEW_TEMPLATE = 'Hi {{name}}! Hope you\'re loving your purchase from {{shop_name}} 😊\n\nWould you mind leaving us a quick review? It helps us a lot and takes just 2 minutes!\n\nThank you!'
