// Thin Razorpay REST wrapper — plain fetch + Basic Auth, matching how this
// codebase already talks to Meta's Graph API (lib/whatsapp.ts) rather than
// adding the razorpay npm SDK for a handful of calls.

import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

type ServiceClient = ReturnType<typeof createServiceClient>

const BASE = 'https://api.razorpay.com/v1'

function authHeader(): string {
  const keyId     = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not configured')
  return 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64')
}

async function rzFetch<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json() as T & { error?: { description?: string } }
  if (!res.ok) throw new Error(data.error?.description ?? `Razorpay ${path} failed (HTTP ${res.status})`)
  return data
}

interface RazorpayPlan { id: string }
interface RazorpaySubscription { id: string }

// Finds the cached Plan for this exact price/period, or creates it once via
// Razorpay's API and caches the returned plan_id — so a Vercel cold start (or
// a second landing page reusing the same price point) doesn't spawn a
// duplicate Plan in the Razorpay dashboard every time.
export async function getOrCreateLandingPlan(
  service: ServiceClient,
  params: { planKey: string; amountRupees: number; name: string },
): Promise<string> {
  const { planKey, amountRupees, name } = params

  const { data: cached } = await service
    .from('razorpay_plans').select('plan_id').eq('plan_name', planKey).maybeSingle()
  if (cached?.plan_id) return cached.plan_id as string

  const plan = await rzFetch<RazorpayPlan>('/plans', {
    period: 'monthly',
    interval: 1,
    item: {
      name,
      amount: Math.round(amountRupees * 100), // paise
      currency: 'INR',
    },
  })

  await service.from('razorpay_plans').upsert(
    { plan_name: planKey, plan_id: plan.id, amount: amountRupees },
    { onConflict: 'plan_name' },
  )
  return plan.id
}

// Razorpay's Subscriptions API requires total_count (billing cycles before
// the subscription auto-completes) — there's no "forever" option. 1200
// monthly cycles (100 years) is the documented convention Razorpay itself
// suggests for an open-ended subscription; it just needs to outlast any real
// customer relationship.
const INDEFINITE_TOTAL_COUNT = 1200

export async function createRazorpaySubscription(params: {
  planId: string
  notes?: Record<string, string>
}): Promise<{ subscriptionId: string }> {
  const sub = await rzFetch<RazorpaySubscription>('/subscriptions', {
    plan_id: params.planId,
    customer_notify: 1,
    total_count: INDEFINITE_TOTAL_COUNT,
    notes: params.notes ?? {},
  })
  return { subscriptionId: sub.id }
}

// Verifies the X-Razorpay-Signature header on an incoming webhook against
// RAZORPAY_WEBHOOK_SECRET (set when the webhook is registered in the
// Razorpay dashboard — see app/api/landing/razorpay-webhook/route.ts).
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
