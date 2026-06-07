import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: billing } = await supabase
    .from('billing')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!billing) {
    // No billing record — return free trial defaults
    return NextResponse.json({
      plan_name:                'trial',
      status:                   'trialing',
      messages_limit:           500,
      messages_used:            0,
      messages_remaining:       500,
      next_billing_date:        null,
      current_period_end:       null,
      current_period_start:     null,
      razorpay_subscription_id: null,
      razorpay_customer_id:     null,
      amount_paise:             0,
      cancelled_at:             null,
    })
  }

  return NextResponse.json({
    ...billing,
    messages_remaining: Math.max(0, (billing.messages_limit ?? 500) - (billing.messages_used ?? 0)),
  })
}
