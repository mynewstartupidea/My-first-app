import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'vaibhavsin9574395@gmail.com'

const PLANS_TO_CREATE = [
  { name: 'starter', amount: 99900,  description: 'Wapaci Starter – 500 messages/month'    },
  { name: 'growth',  amount: 299900, description: 'Wapaci Growth – 5,000 messages/month'   },
  { name: 'pro',     amount: 799900, description: 'Wapaci Pro – 25,000 messages/month'      },
]

function rzAuth() {
  return `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: 'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set' }, { status: 500 })
  }

  const service = createServiceClient()
  const results: Record<string, unknown> = {}

  for (const plan of PLANS_TO_CREATE) {
    const { data: existing } = await service
      .from('razorpay_plans')
      .select('plan_id')
      .eq('plan_name', plan.name)
      .maybeSingle()

    if (existing) {
      results[plan.name] = { plan_id: existing.plan_id, status: 'already_exists' }
      continue
    }

    const res = await fetch('https://api.razorpay.com/v1/plans', {
      method: 'POST',
      headers: { Authorization: rzAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period:   'monthly',
        interval: 1,
        item: {
          name:        plan.description,
          amount:      plan.amount,
          currency:    'INR',
          description: plan.description,
        },
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      results[plan.name] = { error: data.error?.description ?? 'Failed to create plan' }
      continue
    }

    await service.from('razorpay_plans').insert({
      plan_name: plan.name,
      plan_id:   data.id as string,
      amount:    plan.amount,
    })

    results[plan.name] = { plan_id: data.id, status: 'created' }
  }

  return NextResponse.json({ plans: results })
}
