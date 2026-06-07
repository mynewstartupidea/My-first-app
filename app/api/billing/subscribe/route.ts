import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const PLAN_CONFIG: Record<string, { messages_limit: number; amount: number; label: string }> = {
  starter: { messages_limit: 500,   amount: 99900,  label: 'Starter' },
  growth:  { messages_limit: 5000,  amount: 299900, label: 'Growth'  },
  pro:     { messages_limit: 25000, amount: 799900, label: 'Pro'     },
}

const PLANS_TO_CREATE = [
  { name: 'starter', amount: 99900,  description: 'Wapaci Starter – 500 messages/month'    },
  { name: 'growth',  amount: 299900, description: 'Wapaci Growth – 5,000 messages/month'   },
  { name: 'pro',     amount: 799900, description: 'Wapaci Pro – 25,000 messages/month'      },
]

function rzAuth() {
  return `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`
}

// Creates all 3 plans in Razorpay and saves to DB if they don't exist.
// Returns the plan_id for the requested plan.
async function ensurePlanId(planName: string): Promise<string | null> {
  const service = createServiceClient()

  // Check if this specific plan already exists
  const { data: existing } = await service
    .from('razorpay_plans')
    .select('plan_id')
    .eq('plan_name', planName)
    .maybeSingle()

  if (existing?.plan_id) return existing.plan_id

  // Create all missing plans in Razorpay
  let targetPlanId: string | null = null

  for (const p of PLANS_TO_CREATE) {
    // Skip if already in DB
    const { data: alreadyExists } = await service
      .from('razorpay_plans')
      .select('plan_id')
      .eq('plan_name', p.name)
      .maybeSingle()

    if (alreadyExists?.plan_id) {
      if (p.name === planName) targetPlanId = alreadyExists.plan_id
      continue
    }

    const res = await fetch('https://api.razorpay.com/v1/plans', {
      method: 'POST',
      headers: { Authorization: rzAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period:   'monthly',
        interval: 1,
        item: {
          name:        p.description,
          amount:      p.amount,
          currency:    'INR',
          description: p.description,
        },
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error(`[setup-plans] Failed to create ${p.name}:`, data)
      continue
    }

    await service.from('razorpay_plans').insert({
      plan_name: p.name,
      plan_id:   data.id as string,
      amount:    p.amount,
    })

    if (p.name === planName) targetPlanId = data.id as string
  }

  return targetPlanId
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: 'Razorpay not configured — add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel' }, { status: 500 })
  }

  const body = await request.json()
  const { plan } = body as { plan: string }
  const planConfig = PLAN_CONFIG[plan]
  if (!planConfig) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const service = createServiceClient()

  // Auto-initialise plans in Razorpay on first use
  const razorpayPlanId = await ensurePlanId(plan)
  if (!razorpayPlanId) {
    return NextResponse.json({
      error: 'Failed to create Razorpay plan. Check that RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are correct.',
    }, { status: 500 })
  }

  // Get existing billing record
  const { data: billing } = await service
    .from('billing')
    .select('razorpay_customer_id, razorpay_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle()

  // Cancel existing subscription immediately so the new one starts now
  if (billing?.razorpay_subscription_id) {
    await fetch(`https://api.razorpay.com/v1/subscriptions/${billing.razorpay_subscription_id}/cancel`, {
      method: 'POST',
      headers: { Authorization: rzAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancel_at_cycle_end: 0 }),
    }).catch(() => null)
  }

  // Get or create Razorpay customer
  let customerId = billing?.razorpay_customer_id ?? null
  if (!customerId) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .maybeSingle()

    const custRes = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: { Authorization: rzAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:          profile?.full_name ?? user.email ?? 'Wapaci User',
        email:         user.email ?? '',
        contact:       profile?.phone ?? '',
        fail_existing: 0,
      }),
    })
    const custData = await custRes.json()
    if (custRes.ok) customerId = custData.id as string
  }

  // Create Razorpay subscription
  const subRes = await fetch('https://api.razorpay.com/v1/subscriptions', {
    method: 'POST',
    headers: { Authorization: rzAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_id:         razorpayPlanId,
      customer_id:     customerId,
      quantity:        1,
      total_count:     120,
      customer_notify: 1,
      notes:           { user_id: user.id, plan },
    }),
  })

  const subData = await subRes.json()
  if (!subRes.ok) {
    return NextResponse.json({ error: subData.error?.description ?? 'Failed to create subscription' }, { status: 500 })
  }

  // Get user's store
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // Save subscription IDs only — DO NOT change plan_name or status yet.
  // The webhook (subscription.activated) will update those after payment succeeds.
  // This prevents showing the wrong plan if the user dismisses the checkout.
  await service.from('billing').upsert({
    user_id:                  user.id,
    store_id:                 store?.id ?? null,
    billing_provider:         'razorpay',
    razorpay_customer_id:     customerId,
    razorpay_subscription_id: subData.id,
    razorpay_plan_id:         razorpayPlanId,
    updated_at:               new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return NextResponse.json({
    subscription_id: subData.id as string,
    key_id:          process.env.RAZORPAY_KEY_ID,
    plan,
    amount:          planConfig.amount,
    label:           planConfig.label,
  })
}
