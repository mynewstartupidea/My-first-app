import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SHOPIFY_PLANS, TRIAL_DAYS, APP_URL, type ShopifyPlanId } from '@/lib/shopify-billing'

function signBillingReturn(shop: string, planId: string): string {
  const secret = process.env.SHOPIFY_API_SECRET ?? ''
  return crypto.createHmac('sha256', secret).update(`${shop}:${planId}`).digest('hex')
}

const PLAN_MAP = Object.fromEntries(SHOPIFY_PLANS.map(p => [p.id, p]))

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { planId?: string; shop?: string }
  const plan = PLAN_MAP[body.planId as ShopifyPlanId]
  if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  if (!body.shop) return NextResponse.json({ error: 'Missing shop' }, { status: 400 })

  const service = createServiceClient()
  const { data: store } = await service
    .from('stores')
    .select('id, shopify_access_token')
    .eq('shopify_domain', body.shop)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!store?.shopify_access_token) {
    return NextResponse.json({ error: 'Store not found or not connected' }, { status: 404 })
  }

  const sig = signBillingReturn(body.shop, plan.id)
  const returnUrl =
    `${APP_URL}/api/shopify/billing/callback` +
    `?shop=${encodeURIComponent(body.shop)}&plan=${plan.id}&sig=${sig}`

  const mutation = `
    mutation AppSubscriptionCreate(
      $name: String!
      $lineItems: [AppSubscriptionLineItemInput!]!
      $returnUrl: URL!
      $trialDays: Int
    ) {
      appSubscriptionCreate(
        name: $name
        lineItems: $lineItems
        returnUrl: $returnUrl
        trialDays: $trialDays
      ) {
        appSubscription { id status }
        confirmationUrl
        userErrors { field message }
      }
    }
  `

  const gqlRes = await fetch(
    `https://${body.shop}/admin/api/2026-07/graphql.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': store.shopify_access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          name:       `Wapaci ${plan.name}`,
          returnUrl,
          trialDays:  TRIAL_DAYS,
          lineItems: [{
            plan: {
              appRecurringPricingDetails: {
                price:    { amount: plan.price, currencyCode: 'USD' },
                interval: 'EVERY_30_DAYS',
              },
            },
          }],
        },
      }),
    }
  )

  if (!gqlRes.ok) {
    const errBody = await gqlRes.text().catch(() => '(unreadable)')
    console.error('[billing/create] Shopify GQL HTTP error', gqlRes.status, errBody)
    const hint = gqlRes.status === 401
      ? 'Store token expired — please reconnect Shopify.'
      : gqlRes.status === 403
        ? 'App billing not enabled — check Partners Dashboard billing configuration.'
        : `Shopify returned ${gqlRes.status}.`
    return NextResponse.json({ error: hint }, { status: 502 })
  }

  const gqlData = await gqlRes.json() as {
    data?: {
      appSubscriptionCreate?: {
        appSubscription?: { id: string; status: string }
        confirmationUrl?: string
        userErrors?: { field: string; message: string }[]
      }
    }
  }

  const result = gqlData.data?.appSubscriptionCreate
  if (result?.userErrors?.length) {
    return NextResponse.json({ error: result.userErrors[0].message }, { status: 400 })
  }

  if (!result?.confirmationUrl) {
    return NextResponse.json({ error: 'No confirmation URL returned' }, { status: 502 })
  }

  return NextResponse.json({
    confirmationUrl: result.confirmationUrl,
    subscriptionId:  result.appSubscription?.id,
  })
}
