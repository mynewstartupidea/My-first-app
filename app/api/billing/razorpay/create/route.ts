export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateLandingPlan, createRazorpaySubscription, cancelRazorpaySubscription } from '@/lib/razorpay'

// Turns the Settings → Billing "Upgrade" buttons (previously just a WhatsApp
// chat link — no automated checkout existed) into a real subscription. The
// `billing` table already defaulted billing_provider to 'razorpay' before
// this route existed; this fills that in rather than replacing anything live
// — no store currently has an active Shopify subscription (checked before
// building this), so there's nothing to migrate.

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

  const body = await request.json().catch(() => ({})) as { planId?: string }
  const plan = body.planId ? PLANS[body.planId] : undefined
  if (!plan || !body.planId) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const service = createServiceClient()

  const { data: existing } = await service
    .from('billing').select('razorpay_subscription_id, status').eq('user_id', user.id).maybeSingle()

  // Switching plans (or retrying after a failed/cancelled subscription):
  // Razorpay subscriptions don't support in-place plan changes on the basic
  // API, so cancel the old one and issue a fresh subscription for the new plan.
  if (existing?.razorpay_subscription_id && existing.status === 'active') {
    try { await cancelRazorpaySubscription(existing.razorpay_subscription_id) }
    catch (e) { console.error('[billing/razorpay/create] cancel-old failed:', e) }
  }

  const planId = await getOrCreateLandingPlan(service, {
    planKey: `wapaci_${body.planId}_${plan.priceInr}_monthly`,
    amountRupees: plan.priceInr,
    name: `Wapaci ${plan.name} (Monthly)`,
  })
  const { subscriptionId } = await createRazorpaySubscription({
    planId,
    notes: { user_id: user.id, plan_id: body.planId },
  })

  await service.from('billing').upsert(
    {
      user_id: user.id,
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
