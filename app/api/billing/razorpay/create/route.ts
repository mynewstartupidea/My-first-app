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
    .from('billing')
    .select('razorpay_subscription_id, status, pending_razorpay_subscription_id')
    .eq('user_id', ownerId).maybeSingle()

  // A second upgrade click before the first's webhook arrives (double-click,
  // or retrying after a slow/failed checkout popup) used to overwrite
  // pending_razorpay_subscription_id with the new attempt's id, with no
  // record anywhere of the FIRST attempt's subscription. If that first
  // checkout was actually completed, it became a permanent, untracked,
  // still-billing Razorpay subscription — the webhook for it later matches
  // neither the active row (still the old subscription) nor the pending row
  // (already overwritten), so it's silently dropped. Cancel any outstanding
  // pending attempt first so there's never more than one unresolved pending
  // subscription per owner at a time.
  if (existing?.pending_razorpay_subscription_id) {
    try { await cancelRazorpaySubscription(existing.pending_razorpay_subscription_id) }
    catch (e) { console.error('[billing/razorpay/create] failed to cancel superseded pending subscription:', e) }
  }

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

  // Record this as a PENDING change, not an immediate switch — the person
  // hasn't actually paid yet at this point (the Razorpay checkout popup only
  // opens client-side after this response returns). The old subscription
  // stays fully active and untouched; the webhook promotes pending → active
  // (and only then cancels the old subscription) once Razorpay confirms the
  // new one was actually authenticated/charged. If they abandon checkout,
  // the old subscription is simply still there, exactly as it was.
  const { error: upsertErr } = await service.from('billing').upsert(
    {
      user_id: ownerId,
      billing_provider: 'razorpay',
      pending_razorpay_subscription_id: subscriptionId,
      pending_plan_name: body.planId,
      pending_messages_limit: plan.messagesLimit,
      previous_razorpay_subscription_id: existing?.status === 'active' ? existing.razorpay_subscription_id : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (upsertErr) {
    console.error('[billing/razorpay/create] billing upsert failed:', upsertErr.message)
    return NextResponse.json({ error: 'Could not start checkout. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({
    subscriptionId,
    keyId: process.env.RAZORPAY_KEY_ID,
    prefill: { name: user.user_metadata?.full_name ?? '', email: user.email ?? '' },
  })
}
