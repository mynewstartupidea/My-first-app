import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

// Read by every signed-in user (e.g. Sidebar's message-usage bar), so this
// has to work for teammates too, not just the owner — billing is keyed by
// the owner's user_id and RLS is USING (user_id = auth.uid()), which used to
// mean a teammate always saw "Trial · 500 messages" regardless of the org's
// real plan.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: billing } = await service
    .from('billing')
    .select('plan_name, status, billing_provider, messages_limit, messages_used')
    .eq('user_id', ownerId)
    .maybeSingle()

  if (!billing) {
    return NextResponse.json({
      plan_name:        'free',
      status:           'active',
      billing_provider: 'razorpay',
      messages_limit:   500,
      messages_used:    0,
      messages_remaining: 500,
      current_period_end: null,
    })
  }

  return NextResponse.json({
    plan_name:           billing.plan_name ?? 'free',
    status:              billing.status ?? 'active',
    billing_provider:    billing.billing_provider ?? 'razorpay',
    messages_limit:      billing.messages_limit ?? 500,
    messages_used:       billing.messages_used ?? 0,
    messages_remaining:  Math.max(0, (billing.messages_limit ?? 500) - (billing.messages_used ?? 0)),
    current_period_end:  null,
  })
}
