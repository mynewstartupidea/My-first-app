// Razorpay subscription webhook — register this URL (https://<domain>/api/landing/razorpay-webhook)
// in Razorpay Dashboard → Settings → Webhooks, subscribed to the
// subscription.* and payment.failed events, and set RAZORPAY_WEBHOOK_SECRET
// to the secret shown there. Keeps landing_leads.payment_status in sync so
// the admin view (app/admin/landing-leads) reflects who actually paid.

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay'
import { sendMetaCapiEvent } from '@/lib/meta-capi'

// Matches the real price in app/api/landing/subscribe/route.ts's PLANS —
// used only as the value signal on the 'Subscribe' Meta event, not for
// anything billing-related.
const SUBSCRIPTION_VALUE_INR = 1999

interface RazorpayWebhookPayload {
  event: string
  payload?: {
    subscription?: { entity?: { id?: string; customer_id?: string } }
  }
}

const STATUS_BY_EVENT: Record<string, string> = {
  'subscription.authenticated': 'authenticated',
  'subscription.activated':     'active',
  'subscription.charged':       'active',
  'subscription.completed':     'active',
  'subscription.pending':       'pending',
  'subscription.halted':        'failed',
  'subscription.cancelled':     'cancelled',
  'payment.failed':             'failed',
}

export async function POST(request: Request) {
  const rawBody   = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    console.error('[razorpay-webhook] signature verification failed')
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  let body: RazorpayWebhookPayload
  try {
    body = JSON.parse(rawBody) as RazorpayWebhookPayload
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const newStatus = STATUS_BY_EVENT[body.event]
  const subscriptionId = body.payload?.subscription?.entity?.id
  const customerId = body.payload?.subscription?.entity?.customer_id

  if (newStatus && subscriptionId) {
    const service = createServiceClient()
    const updates: Record<string, string> = { payment_status: newStatus, updated_at: new Date().toISOString() }
    if (customerId) updates.razorpay_customer_id = customerId
    const { error } = await service.from('landing_leads').update(updates).eq('razorpay_subscription_id', subscriptionId)
    if (error) console.error('[razorpay-webhook] update error:', error.message)

    // Meta lead-quality feedback loop, second half: a lead that actually
    // authenticates/activates a real payment is the one real signal that
    // separates a good lead from one like Kanha Kp's (random text typed
    // into every field, never paid). Fired once per subscription, not once
    // per webhook — 'subscription.charged' re-fires monthly on every
    // renewal and must never re-trigger this.
    if (newStatus === 'authenticated' || newStatus === 'active') {
      await fireQualifiedLeadEvent(service, subscriptionId)
    }
  } else {
    console.log('[razorpay-webhook] unhandled event:', body.event)
  }

  return NextResponse.json({ ok: true })
}

async function fireQualifiedLeadEvent(service: ReturnType<typeof createServiceClient>, subscriptionId: string) {
  // Atomic claim via the .is() filter — only the first webhook to observe
  // this subscription cross into a paid state wins the update and fires
  // the event; every later webhook for the same subscription (renewals,
  // or Razorpay's own at-least-once retry of this same event) sees
  // fb_qualified_event_sent_at already set and the filter matches zero rows.
  const { data: claimed, error } = await service
    .from('landing_leads')
    .update({ fb_qualified_event_sent_at: new Date().toISOString() })
    .eq('razorpay_subscription_id', subscriptionId)
    .is('fb_qualified_event_sent_at', null)
    .select('email, phone, fbp, fbc')
    .maybeSingle()

  if (error) { console.error('[razorpay-webhook] qualified-claim error:', error.message); return }
  if (!claimed) return // already sent for this subscription, or no matching lead

  await sendMetaCapiEvent({
    eventName: 'Subscribe',
    eventSourceUrl: 'https://www.wapaci.com/pricing',
    email: claimed.email, phone: claimed.phone, fbp: claimed.fbp, fbc: claimed.fbc,
    value: SUBSCRIPTION_VALUE_INR,
    currency: 'INR',
  })
}
