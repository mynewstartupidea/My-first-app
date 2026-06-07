import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createHmac, timingSafeEqual } from 'crypto'

const PLAN_LIMITS: Record<string, number> = {
  starter: 500,
  growth:  5000,
  pro:     25000,
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('x-razorpay-signature') ?? ''
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''

  if (secret && !verifySignature(body, signature, secret)) {
    console.error('[Razorpay webhook] Invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body) as {
    event: string
    payload: {
      subscription?: { entity: Record<string, unknown> }
      payment?: { entity: Record<string, unknown> }
    }
  }

  const service = createServiceClient()
  const now = new Date().toISOString()

  // ── Subscription events ──────────────────────────────
  const subEntity = event.payload?.subscription?.entity
  if (subEntity) {
    const subId   = subEntity.id as string
    const userId  = (subEntity.notes as Record<string, string>)?.user_id
    const plan    = (subEntity.notes as Record<string, string>)?.plan ?? 'starter'

    const toTs = (unix: unknown) =>
      typeof unix === 'number' ? new Date(unix * 1000).toISOString() : null

    switch (event.event) {
      case 'subscription.activated': {
        if (!userId) break
        await service.from('billing').update({
          status:               'active',
          plan_name:            plan,
          messages_limit:       PLAN_LIMITS[plan] ?? 500,
          messages_used:        0,
          current_period_start: toTs(subEntity.current_start),
          current_period_end:   toTs(subEntity.current_end),
          next_billing_date:    toTs(subEntity.charge_at),
          updated_at:           now,
        }).eq('user_id', userId)
        break
      }

      case 'subscription.charged': {
        // Monthly renewal — reset usage
        await service.from('billing').update({
          status:             'active',
          messages_used:      0,
          current_period_end: toTs(subEntity.current_end),
          next_billing_date:  toTs(subEntity.charge_at),
          updated_at:         now,
        }).eq('razorpay_subscription_id', subId)
        break
      }

      case 'subscription.cancelled':
      case 'subscription.completed': {
        await service.from('billing').update({
          status:       'cancelled',
          cancelled_at: now,
          updated_at:   now,
        }).eq('razorpay_subscription_id', subId)
        break
      }

      case 'subscription.halted': {
        await service.from('billing').update({
          status:     'past_due',
          updated_at: now,
        }).eq('razorpay_subscription_id', subId)
        break
      }
    }
  }

  // ── Payment events ───────────────────────────────────
  const payEntity = event.payload?.payment?.entity
  if (payEntity && event.event === 'payment.failed') {
    const subId = payEntity.subscription_id as string | undefined
    if (subId) {
      await service.from('billing').update({
        status:     'past_due',
        updated_at: now,
      }).eq('razorpay_subscription_id', subId)
    }
  }

  return NextResponse.json({ ok: true })
}
