// In-app subscription webhook (distinct from /api/landing/razorpay-webhook,
// which is the pre-signup landing page's lead capture — this one updates
// existing customers' `billing` rows). Register this URL in Razorpay
// Dashboard → Settings → Webhooks alongside the landing one; both can share
// the same RAZORPAY_WEBHOOK_SECRET since Razorpay signs with one account-wide
// secret per webhook endpoint you register.

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyRazorpayWebhookSignature, cancelRazorpaySubscription } from '@/lib/razorpay'

interface RazorpayWebhookPayload {
  event: string
  payload?: {
    subscription?: { entity?: { id?: string; current_start?: number; current_end?: number } }
  }
}

const STATUS_BY_EVENT: Record<string, string> = {
  'subscription.authenticated': 'trialing',
  'subscription.activated':     'active',
  'subscription.charged':       'active',
  'subscription.completed':     'active',
  'subscription.pending':       'past_due',
  'subscription.halted':        'past_due',
  'subscription.cancelled':     'cancelled',
}

export async function POST(request: Request) {
  const rawBody   = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    console.error('[billing/razorpay-webhook] signature verification failed')
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  let body: RazorpayWebhookPayload
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookPayload
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const newStatus = STATUS_BY_EVENT[body.event]
  const entity = body.payload?.subscription?.entity
  const subscriptionId = entity?.id

  if (!newStatus || !subscriptionId) {
    console.log('[billing/razorpay-webhook] unhandled event:', body.event)
    return NextResponse.json({ ok: true })
  }

  const service = createServiceClient()

  // Idempotency — Razorpay redelivers on a slow/5xx response, same as every
  // other webhook provider in this codebase. Keyed on event+subscription+
  // cycle-start (not a payload delivery id, which isn't reliably present
  // across Razorpay API versions) — already unique per real billing-cycle
  // event. A duplicate key insert means this exact event was already fully
  // processed; return 200 immediately without repeating any side effect
  // (most importantly, never reset messages_used twice for one real charge).
  const idempotencyKey = `${body.event}:${subscriptionId}:${entity?.current_start ?? ''}`
  const { error: dedupErr } = await service.from('razorpay_webhook_events')
    .insert({ idempotency_key: idempotencyKey, event: body.event })
  if (dedupErr) {
    if (dedupErr.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
    // Any other error here (not a conflict) means we can't safely guarantee
    // exactly-once processing — fail loudly so Razorpay retries rather than
    // silently risking a double-apply.
    console.error('[billing/razorpay-webhook] idempotency insert failed:', dedupErr.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
  if (entity?.current_start) updates.current_period_start = new Date(entity.current_start * 1000).toISOString()
  if (entity?.current_end)   updates.current_period_end   = new Date(entity.current_end * 1000).toISOString()
  if (newStatus === 'active' && body.event === 'subscription.charged') updates.messages_used = 0 // new billing cycle
  if (newStatus === 'cancelled') updates.cancelled_at = new Date().toISOString()

  const { data: updated, error } = await service
    .from('billing').update(updates).eq('razorpay_subscription_id', subscriptionId).select('user_id')
  if (error) {
    console.error('[billing/razorpay-webhook] update error:', error.message)
    // A write failure here must not return 200 — Razorpay won't retry a
    // success response, so a transient DB error on a real charge event used
    // to permanently lose that event: the merchant paid, but plan/quota
    // never updated, with no record anywhere that anything went wrong.
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  // No row has this as its ACTIVE subscription — check whether it's a
  // PENDING plan change instead (see app/api/billing/razorpay/create/route.ts).
  if (updated && updated.length > 0) return NextResponse.json({ ok: true })

  const { data: pendingRow } = await service
    .from('billing')
    .select('user_id, pending_plan_name, pending_messages_limit, previous_razorpay_subscription_id')
    .eq('pending_razorpay_subscription_id', subscriptionId)
    .maybeSingle()

  if (!pendingRow) {
    // Recognized event, but it matches no row in this app at all — worth
    // knowing about (a stale/unlinked Razorpay subscription, or an event
    // for a different environment sharing the same webhook secret), but not
    // something to retry forever, so still 200.
    console.log('[billing/razorpay-webhook] event matched no billing row:', body.event, subscriptionId)
    return NextResponse.json({ ok: true })
  }

  // subscription.authenticated only confirms the payment MANDATE was
  // verified — the actual first charge can still fail afterward (insufficient
  // funds, bank decline), arriving later as subscription.pending/halted. It
  // used to be treated as confirming enough to promote AND cancel the old
  // (working, paid) subscription immediately — exactly the failure mode
  // this pending-change design was built to prevent (a merchant left with no
  // working subscription), just moved one event earlier. Only a genuine
  // 'active' status (activated/charged/completed) promotes now; 'authenticated'
  // (trialing) is treated as non-terminal below — wait for what happens next,
  // touch nothing yet.
  if (newStatus === 'active') {
    const { error: promoteErr } = await service.from('billing').update({
      razorpay_subscription_id: subscriptionId,
      plan_name: pendingRow.pending_plan_name,
      messages_limit: pendingRow.pending_messages_limit,
      status: newStatus,
      messages_used: 0,
      pending_razorpay_subscription_id: null,
      pending_plan_name: null,
      pending_messages_limit: null,
      // previous_razorpay_subscription_id is deliberately NOT cleared here —
      // only once the cancel call below actually succeeds. Clearing it
      // unconditionally meant a failed cancel (network blip, Razorpay 5xx)
      // left the merchant billed on both the old and new subscriptions
      // indefinitely, with no record anywhere of the old one to retry or
      // manually clean up.
      current_period_start: entity?.current_start ? new Date(entity.current_start * 1000).toISOString() : undefined,
      current_period_end:   entity?.current_end   ? new Date(entity.current_end   * 1000).toISOString() : undefined,
      updated_at: new Date().toISOString(),
    }).eq('user_id', pendingRow.user_id)

    if (promoteErr) {
      console.error('[billing/razorpay-webhook] promotion update failed:', promoteErr.message)
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    if (pendingRow.previous_razorpay_subscription_id) {
      try {
        await cancelRazorpaySubscription(pendingRow.previous_razorpay_subscription_id)
        await service.from('billing').update({ previous_razorpay_subscription_id: null }).eq('user_id', pendingRow.user_id)
      } catch (e) {
        // Old subscription id stays in previous_razorpay_subscription_id —
        // still billing on both until this is retried (manually, or by a
        // future cron sweep) rather than silently lost.
        console.error('[billing/razorpay-webhook] cancel-old failed, left for retry:', e)
      }
    }
  } else if (newStatus === 'cancelled' || newStatus === 'past_due') {
    // The new subscription failed/was cancelled before ever activating —
    // drop the pending change, leave the real active subscription alone.
    await service.from('billing').update({
      pending_razorpay_subscription_id: null,
      pending_plan_name: null,
      pending_messages_limit: null,
      previous_razorpay_subscription_id: null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', pendingRow.user_id)
  }
  // else (trialing/authenticated): non-terminal, intentionally a no-op —
  // wait for the next event instead of treating "not yet confirmed" the
  // same as "confirmed" or "failed."

  return NextResponse.json({ ok: true })
}
