import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { SHOPIFY_PLANS, APP_URL, type ShopifyPlanId } from '@/lib/shopify-billing'

const PLAN_MAP = Object.fromEntries(SHOPIFY_PLANS.map(p => [p.id, p]))

function verifyBillingReturn(shop: string, planId: string, sig: string): boolean {
  const secret = process.env.SHOPIFY_API_SECRET ?? ''
  if (!secret) return false
  const expected = crypto.createHmac('sha256', secret).update(`${shop}:${planId}`).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(sig, 'hex')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const shop     = searchParams.get('shop')
  const planId   = searchParams.get('plan') as ShopifyPlanId | null
  const chargeId = searchParams.get('charge_id')
  const sig      = searchParams.get('sig') ?? ''

  if (!shop || !planId || !chargeId) {
    return NextResponse.redirect(`${APP_URL}/dashboard?billing=failed`)
  }

  // Verify the plan wasn't tampered with in the return URL
  if (!verifyBillingReturn(shop, planId, sig)) {
    console.error('[billing/callback] plan signature verification failed')
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

  // Shopify returns a numeric charge_id in the callback URL.
  // The node query requires a full GID — convert if needed.
  const gid = chargeId.startsWith('gid://')
    ? chargeId
    : `gid://shopify/AppSubscription/${chargeId}`

  // Verify subscription status with Shopify
  const query = `{ node(id: ${JSON.stringify(gid)}) { ... on AppSubscription { id status } } }`
  let status: string | undefined
  try {
    const verifyRes = await fetch(`https://${shop}/admin/api/2026-07/graphql.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.shopify_access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    })
    if (!verifyRes.ok) {
      console.error(`[billing/callback] Shopify verify returned ${verifyRes.status}`)
      return NextResponse.redirect(`${APP_URL}/shopify/pricing?shop=${encodeURIComponent(shop)}&declined=1`)
    }
    const verifyData = await verifyRes.json() as {
      data?: { node?: { id: string; status: string } }
    }
    status = verifyData.data?.node?.status
  } catch (err) {
    console.error('[billing/callback] Shopify verify request failed:', err)
    return NextResponse.redirect(`${APP_URL}/shopify/pricing?shop=${encodeURIComponent(shop)}&declined=1`)
  }

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

  // Route new merchants (no WhatsApp connected yet) through onboarding.
  // Returning merchants go straight to dashboard.
  const { data: wa } = await supabase
    .from('whatsapp_accounts')
    .select('id')
    .eq('user_id', store.user_id)
    .maybeSingle()

  const destination = wa
    ? `${APP_URL}/dashboard?billing=success&plan=${planId}`
    : `${APP_URL}/onboarding?billing=success&plan=${planId}`

  return NextResponse.redirect(destination)
}
