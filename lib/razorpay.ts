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
interface RazorpaySubscription { id: string; short_url?: string }

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
// monthly cycles (100 years) is a commonly-cited convention for an
// open-ended subscription, but it's the actual, confirmed root cause of a
// real production outage: every UPI AutoPay mandate attempt on the real
// landing-page checkout AND the in-app billing-upgrade flow (both call
// createRazorpaySubscription with no explicit totalCount, so both hit this
// same default) failed inside the customer's UPI app — across multiple
// apps, multiple amounts (₹1/₹50/₹1,999) — while completely unrelated to
// price. Live-tested directly against this Razorpay account (not a docs
// guess): total_count: 1200 fails every time; 12 and 120 both succeed
// (real UPI AutoPay mandate authorized). 120 (10 years) is used here —
// comfortably longer than almost any real subscription relationship, and
// nowhere near whatever this account's actual NPCI/mandate ceiling is.
// When a subscription actually approaches its 120th cycle, it needs a
// renewal (a fresh mandate) before then — correctly, this is a problem for
// ~2036, not now, but it's a real one: nothing currently creates a
// replacement subscription automatically.
const INDEFINITE_TOTAL_COUNT = 120

export async function createRazorpaySubscription(params: {
  planId: string
  notes?: Record<string, string>
  totalCount?: number
}): Promise<{ subscriptionId: string; shortUrl?: string }> {
  const sub = await rzFetch<RazorpaySubscription>('/subscriptions', {
    plan_id: params.planId,
    customer_notify: 1,
    total_count: params.totalCount ?? INDEFINITE_TOTAL_COUNT,
    notes: params.notes ?? {},
  })
  return { subscriptionId: sub.id, shortUrl: sub.short_url }
}

export async function cancelRazorpaySubscription(subscriptionId: string): Promise<void> {
  await rzFetch(`/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: 0 })
}

// Reads a subscription's status directly from Razorpay rather than trusting
// a webhook-mirrored column — used by app/api/landing/complete-signup/route.ts,
// where landing_leads.payment_status is written by a separately-delivered
// webhook that can lag behind the client-side checkout-success callback by
// more than this flow is willing to wait, and where trusting any
// client-supplied or DB-cached status at all would let someone call that
// route with an unpaid lead's id and get a free account.
export async function getRazorpaySubscriptionStatus(subscriptionId: string): Promise<string> {
  const res  = await fetch(`${BASE}/subscriptions/${subscriptionId}`, {
    headers: { Authorization: authHeader() },
  })
  const data = await res.json() as { status?: string; error?: { description?: string } }
  if (!res.ok) throw new Error(data.error?.description ?? `Razorpay subscription fetch failed (HTTP ${res.status})`)
  if (!data.status) throw new Error('Razorpay subscription fetch returned no status')
  return data.status
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
