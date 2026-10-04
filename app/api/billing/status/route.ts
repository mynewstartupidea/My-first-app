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
    // 'trial'/'trialing', not 'free'/'active' — Settings → Billing's Account-tab
    // label and plan card both explicitly special-case plan_name === 'trial' to
    // show "Trial" (see app/dashboard/settings/page.tsx), and this comment above
    // already documented "Trial · 500 messages" as the expected teammate view.
    // Returning 'active' here also made a brand-new account's own Billing tab
    // show a real "Cancel subscription" link (status === 'active' is the only
    // gate on it) that led nowhere — there's no razorpay_subscription_id to
    // cancel, so /api/billing/cancel always 400s "No active subscription."
    return NextResponse.json({
      plan_name:        'trial',
      status:           'trialing',
      billing_provider: 'razorpay',
      messages_limit:   500,
      messages_used:    0,
      messages_remaining: 500,
      current_period_end: null,
    })
  }

  return NextResponse.json({
    plan_name:           billing.plan_name ?? 'trial',
    status:              billing.status ?? 'trialing',
    billing_provider:    billing.billing_provider ?? 'razorpay',
    messages_limit:      billing.messages_limit ?? 500,
    messages_used:       billing.messages_used ?? 0,
    messages_remaining:  Math.max(0, (billing.messages_limit ?? 500) - (billing.messages_used ?? 0)),
    current_period_end:  null,
  })
}
