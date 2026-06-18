import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

function rzAuth() {
  return `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { reason?: string; detail?: string }

  const service = createServiceClient()

  // Save churn feedback (best-effort)
  if (body.reason) {
    await service.from('cancellation_feedback').insert({
      user_id: user.id,
      reason:  body.reason,
      detail:  body.detail ?? null,
    }).then(null, () => null)
  }

  const { data: billing } = await service
    .from('billing')
    .select('razorpay_subscription_id, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!billing?.razorpay_subscription_id) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
  }

  if (billing.status === 'cancelled') {
    return NextResponse.json({ error: 'Subscription already cancelled' }, { status: 400 })
  }

  const res = await fetch(
    `https://api.razorpay.com/v1/subscriptions/${billing.razorpay_subscription_id}/cancel`,
    {
      method: 'POST',
      headers: { Authorization: rzAuth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancel_at_cycle_end: 1 }),
    }
  )

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data.error?.description ?? 'Failed to cancel subscription' }, { status: 500 })
  }

  await service.from('billing').update({
    status:       'cancelled',
    cancelled_at: new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  }).eq('user_id', user.id)

  return NextResponse.json({ success: true, cancelled_at_cycle_end: true })
}
