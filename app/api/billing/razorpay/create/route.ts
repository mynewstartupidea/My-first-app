export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getOrCreateLandingPlan, createRazorpaySubscription, cancelRazorpaySubscription } from '@/lib/razorpay'

// Turns the Settings → Billing "Upgrade" buttons (previously just a WhatsApp
// chat link — no automated checkout existed) into a real subscription. The
// `billing` table already defaulted billing_provider to 'razorpay' before
// this route existed; this fills that in rather than replacing anything live
// — no store currently has an active Shopify subscription (checked before
// building this), so there's nothing to migrate.
//
// Owner/admin only — Settings is reachable by every role, and this used to
// let ANY teammate (e.g. a Sales rep) click "Upgrade", complete real payment,
// and create a billing row keyed to their own user_id with zero effect on
// the org's actual plan.

const PLANS: Record<string, { name: string; priceInr: number; messagesLimit: number }> = {
  starter:    { name: 'Starter',    priceInr: 2499,  messagesLimit: 5000 },
  growth:     { name: 'Growth',     priceInr: 3999,  messagesLimit: 15000 },
  scale:      { name: 'Scale',      priceInr: 7999,  messagesLimit: 50000 },
  enterprise: { name: 'Enterprise', priceInr: 24999, messagesLimit: 999_999_999 },
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can change the plan.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { planId?: string }
  const plan = body.planId ? PLANS[body.planId] : undefined
  if (!plan || !body.planId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: existing } = await service
    .from('billing').select('razorpay_subscription_id, status').eq('user_id', ownerId).maybeSingle()

  const planId = await getOrCreateLandingPlan(service, {
    planKey: `wapaci_${body.planId}_${plan.priceInr}_monthly`,
    amountRupees: plan.priceInr,
    name: `Wapaci ${plan.name} (Monthly)`,
  })

  // Create the NEW subscription before touching the old one — Razorpay
  // subscriptions don't support in-place plan changes on the basic API, so
  // switching plans means cancel-old + create-new, but cancelling first and
  // then having the create step fail (network blip, Razorpay 5xx) would
  // leave the org with no active subscription at all until the next manual
  // retry. Creating first means a failure here just leaves the old
  // subscription exactly as it was.
  const { subscriptionId } = await createRazorpaySubscription({
    planId,
    notes: { user_id: ownerId, plan_id: body.planId },
  })

  if (existing?.razorpay_subscription_id && existing.status === 'active') {
    try { await cancelRazorpaySubscription(existing.razorpay_subscription_id) }
    catch (e) { console.error('[billing/razorpay/create] cancel-old failed:', e) }
  }

  await service.from('billing').upsert(
    {
      user_id: ownerId,
      plan_name: body.planId,
      status: 'pending',
      billing_provider: 'razorpay',
      razorpay_subscription_id: subscriptionId,
      razorpay_plan_id: planId,
      messages_limit: plan.messagesLimit,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  return NextResponse.json({
    subscriptionId,
    keyId: process.env.RAZORPAY_KEY_ID,
    prefill: { name: user.user_metadata?.full_name ?? '', email: user.email ?? '' },
  })
}
