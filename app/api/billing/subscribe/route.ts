import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const PLAN_CONFIG: Record<string, { messages_limit: number; amount: number; label: string }> = {
  starter: { messages_limit: 500,   amount: 99900,  label: 'Starter' },
  growth:  { messages_limit: 5000,  amount: 299900, label: 'Growth'  },
  pro:     { messages_limit: 25000, amount: 799900, label: 'Pro'     },
}

function rzAuth() {
  return `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: 'Razorpay not configured' }, { status: 500 })
  }

  const body = await request.json()
  const { plan } = body as { plan: string }
  const planConfig = PLAN_CONFIG[plan]
  if (!planConfig) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const service = createServiceClient()

  // Get plan_id from razorpay_plans table
  const { data: rpPlan } = await service
    .from('razorpay_plans')
    .select('plan_id')
    .eq('plan_name', plan)
    .maybeSingle()

  if (!rpPlan) {
    return NextResponse.json({
      error: 'Razorpay plans not initialised. Admin must call POST /api/billing/setup-plans first.',
    }, { status: 400 })
  }

  // Get existing billing record
  const { data: billing } = await service
    .from('billing')
    .select('razorpay_customer_id, razorpay_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle()

  // Cancel existing subscription if any
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
      plan_id:         rpPlan.plan_id,
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

  // Upsert billing record
  await service.from('billing').upsert({
    user_id:                  user.id,
    store_id:                 store?.id ?? null,
    plan_name:                plan,
    status:                   'trialing',
    billing_provider:         'razorpay',
    razorpay_customer_id:     customerId,
    razorpay_subscription_id: subData.id,
    razorpay_plan_id:         rpPlan.plan_id,
    amount_paise:             planConfig.amount,
    messages_limit:           planConfig.messages_limit,
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
