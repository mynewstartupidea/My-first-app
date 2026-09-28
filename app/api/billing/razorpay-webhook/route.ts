// In-app subscription webhook (distinct from /api/landing/razorpay-webhook,
// which is the pre-signup landing page's lead capture — this one updates
// existing customers' `billing` rows). Register this URL in Razorpay
// Dashboard → Settings → Webhooks alongside the landing one; both can share
// the same RAZORPAY_WEBHOOK_SECRET since Razorpay signs with one account-wide
// secret per webhook endpoint you register.

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { verifyRazorpayWebhookSignature } from '@/lib/razorpay'

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

    const { error } = await service.from('billing').update(updates).eq('razorpay_subscription_id', subscriptionId)
    if (error) console.error('[billing/razorpay-webhook] update error:', error.message)
  } else {
    console.log('[billing/razorpay-webhook] unhandled event:', body.event)
  }

  return NextResponse.json({ ok: true })
}
