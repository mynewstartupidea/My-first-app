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
      order_url: `https://${(order.order_status_url as string) ?? ''}`,
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

  const { data: auto } = await supabase
    .from('automations').select('*')
    .eq('store_id', store.id).eq('type', 'shipping_update').eq('is_enabled', true).maybeSingle()
  if (!auto) return

  const firstName   = String((order.customer as Record<string, unknown>)?.first_name ?? 'there')
  const orderNumber = String(order.order_number ?? order.name ?? '')
  const fulfillments = (order.fulfillments as Record<string, unknown>[]) ?? []
  const trackingUrl  = String((fulfillments[0]?.tracking_url as string) ?? '')

  const msg = renderTemplate(auto.template, {
    name: firstName, order_number: orderNumber, shop_name: store.shop_name ?? 'our store',
    tracking_url: trackingUrl,
  })

  await supabase.from('automation_jobs').insert({
    store_id: store.id, automation_id: auto.id, type: 'shipping_update',
    customer_phone: `+91${phone}`, customer_name: firstName, message: msg,
    context: { order_id: order.id, tracking_url: trackingUrl },
    status: 'pending', scheduled_at: new Date().toISOString(),
  })
}
