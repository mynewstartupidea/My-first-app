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

  if (newStatus && subscriptionId) {
    const service = createServiceClient()
    const updates: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
    if (entity?.current_start) updates.current_period_start = new Date(entity.current_start * 1000).toISOString()
    if (entity?.current_end)   updates.current_period_end   = new Date(entity.current_end * 1000).toISOString()
    if (newStatus === 'active' && body.event === 'subscription.charged') updates.messages_used = 0 // new billing cycle
    if (newStatus === 'cancelled') updates.cancelled_at = new Date().toISOString()

    const { data: updated, error } = await service
      .from('billing').update(updates).eq('razorpay_subscription_id', subscriptionId).select('user_id')
    if (error) console.error('[billing/razorpay-webhook] update error:', error.message)

    // No row has this as its ACTIVE subscription yet — check whether it's a
    // PENDING plan change instead (see app/api/billing/razorpay/create/route.ts).
    // Only a confirming event promotes it; an abandoned/failed checkout just
    // clears the pending fields and leaves the still-active old subscription
    // untouched.
    if (!error && (!updated || updated.length === 0)) {
      const { data: pendingRow } = await service
        .from('billing')
        .select('user_id, pending_plan_name, pending_messages_limit, previous_razorpay_subscription_id')
        .eq('pending_razorpay_subscription_id', subscriptionId)
        .maybeSingle()

      if (pendingRow) {
        const isConfirming = ['trialing', 'active'].includes(newStatus)
        if (isConfirming) {
          await service.from('billing').update({
            razorpay_subscription_id: subscriptionId,
            plan_name: pendingRow.pending_plan_name,
            messages_limit: pendingRow.pending_messages_limit,
            status: newStatus,
            messages_used: 0,
            pending_razorpay_subscription_id: null,
            pending_plan_name: null,
            pending_messages_limit: null,
            previous_razorpay_subscription_id: null,
            current_period_start: entity?.current_start ? new Date(entity.current_start * 1000).toISOString() : undefined,
            current_period_end:   entity?.current_end   ? new Date(entity.current_end   * 1000).toISOString() : undefined,
            updated_at: new Date().toISOString(),
          }).eq('user_id', pendingRow.user_id)

          if (pendingRow.previous_razorpay_subscription_id) {
            try { await cancelRazorpaySubscription(pendingRow.previous_razorpay_subscription_id) }
            catch (e) { console.error('[billing/razorpay-webhook] cancel-old failed:', e) }
          }
        } else {
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
      }
    }
  } else {
    console.log('[billing/razorpay-webhook] unhandled event:', body.event)
  }

  return NextResponse.json({ ok: true })
}
