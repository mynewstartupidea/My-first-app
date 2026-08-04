import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: billing } = await supabase
    .from('billing')
    .select('plan_name, status, billing_provider, messages_limit, messages_used')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!billing) {
    return NextResponse.json({
      plan_name:        'free',
      status:           'active',
      billing_provider: 'shopify',
      messages_limit:   500,
      messages_used:    0,
      messages_remaining: 500,
      current_period_end: null,
    })
  }

  return NextResponse.json({
    plan_name:           billing.plan_name ?? 'free',
    status:              billing.status ?? 'active',
    billing_provider:    billing.billing_provider ?? 'shopify',
    messages_limit:      billing.messages_limit ?? 500,
    messages_used:       billing.messages_used ?? 0,
    messages_remaining:  Math.max(0, (billing.messages_limit ?? 500) - (billing.messages_used ?? 0)),
    current_period_end:  null,
  })
}
