import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
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

  // Owner/admin only, same tier as every other billing mutation — this created
  // a real Shopify subscription (a financial action) with no role check at
  // all, and looked the store up by the CALLER's own user_id rather than the
  // org owner's — stores is keyed by the owner's id, so an invited Manager
  // (who has /dashboard/shopify nav access) hitting this matched zero rows
  // and got a confusing 404 instead of the subscription they asked for.
  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can change the billing plan.' }, { status: 403 })
  }

  const body = await request.json() as { planId?: string; shop?: string }
  const plan = PLAN_MAP[body.planId as ShopifyPlanId]
  if (!plan) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  if (!body.shop) return NextResponse.json({ error: 'Missing shop' }, { status: 400 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const { data: store } = await service
    .from('stores')
    .select('id, shopify_access_token')
    .eq('shopify_domain', body.shop)
    .eq('user_id', ownerId)
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
    console.error('[billing/create] Shopify userErrors:', result.userErrors)
    return NextResponse.json({ error: `Shopify couldn't set up billing for this plan: ${result.userErrors[0].message}` }, { status: 400 })
  }

  if (!result?.confirmationUrl) {
    console.error('[billing/create] no confirmationUrl in response:', JSON.stringify(gqlData))
    return NextResponse.json({ error: "Shopify didn't return a payment link. Please try again." }, { status: 502 })
  }

  return NextResponse.json({
    confirmationUrl: result.confirmationUrl,
    subscriptionId:  result.appSubscription?.id,
  })
}
