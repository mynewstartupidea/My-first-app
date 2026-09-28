// Razorpay subscription webhook — register this URL (https://<domain>/api/landing/razorpay-webhook)
// in Razorpay Dashboard → Settings → Webhooks, subscribed to the
// subscription.* and payment.failed events, and set RAZORPAY_WEBHOOK_SECRET
// to the secret shown there. Keeps landing_leads.payment_status in sync so
// the admin view (app/admin/landing-leads) reflects who actually paid.

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay'

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
  } else {
    console.log('[razorpay-webhook] unhandled event:', body.event)
  }

  return NextResponse.json({ ok: true })
}
