import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { SHOPIFY_PLANS, APP_URL, type ShopifyPlanId } from '@/lib/shopify-billing'

const PLAN_MAP = Object.fromEntries(SHOPIFY_PLANS.map(p => [p.id, p]))

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const shop     = searchParams.get('shop')
  const planId   = searchParams.get('plan') as ShopifyPlanId | null
  const chargeId = searchParams.get('charge_id')

  if (!shop || !planId || !chargeId) {
    return NextResponse.redirect(`${APP_URL}/dashboard?billing=failed`)
  }

  const plan = PLAN_MAP[planId]
  if (!plan) return NextResponse.redirect(`${APP_URL}/dashboard?billing=failed`)

  const supabase = createServiceClient()

  const { data: store } = await supabase
    .from('stores')
    .select('id, user_id, shopify_access_token')
    .eq('shopify_domain', shop)
    .eq('is_active', true)
    .maybeSingle()

  if (!store?.shopify_access_token) {
    return NextResponse.redirect(`${APP_URL}/dashboard?billing=failed`)
  }

  // Verify subscription status with Shopify
  const query = `{ node(id: ${JSON.stringify(chargeId)}) { ... on AppSubscription { id status } } }`
  const verifyRes = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': store.shopify_access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  const verifyData = await verifyRes.json() as {
    data?: { node?: { id: string; status: string } }
  }
  const status = verifyData.data?.node?.status

  // PENDING = in trial, ACTIVE = charged, DECLINED = user cancelled
  if (status === 'DECLINED' || !status) {
    return NextResponse.redirect(`${APP_URL}/shopify/pricing?shop=${encodeURIComponent(shop)}&declined=1`)
  }

  const dbStatus = status === 'ACTIVE' ? 'active' : 'trialing'
  const now      = new Date().toISOString()
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  await supabase.from('billing').upsert({
    user_id:                  store.user_id,
    store_id:                 store.id,
    plan_name:                planId,
    status:                   dbStatus,
    billing_provider:         'shopify',
    shopify_subscription_id:  chargeId,
    messages_limit:           plan.messages === -1 ? 999_999_999 : plan.messages,
    messages_used:            0,
    current_period_start:     now,
    current_period_end:       periodEnd,
    updated_at:               now,
  }, { onConflict: 'user_id' })

  console.log(`[billing/callback] store=${store.id} plan=${planId} status=${dbStatus}`)
  return NextResponse.redirect(`${APP_URL}/dashboard?billing=success&plan=${planId}`)
}
