export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrCreateLandingPlan, createRazorpaySubscription } from '@/lib/razorpay'

// Public — no auth. Submitted by anonymous visitors on the marketing landing
// pages (app/lp/*). The lead is saved BEFORE Razorpay is touched, so if plan/
// subscription creation fails, or the visitor abandons Razorpay Checkout, the
// row still exists for the sales team to call and close manually.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Keyed by the landing page's own `source` value — each lp/* page posts its
// own source, so the Razorpay plan/charge description actually matches what
// the visitor saw and signed up for, instead of every landing page silently
// billing under the first one's "Lead Response Plan" name regardless of
// which page they actually came from.
const PLANS: Record<string, { amountRupees: number; planKey: string; name: string }> = {
  lp_leads:     { amountRupees: 1999, planKey: 'lp_leads_1999_monthly',     name: 'Wapaci — Lead Response Plan (Monthly)' },
  lp_ecommerce: { amountRupees: 1999, planKey: 'lp_ecommerce_1999_monthly', name: 'Wapaci — Ecommerce Plan (Monthly)' },
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    name?: string; company?: string; phone?: string; email?: string; source?: string
  }
  const name    = (body.name ?? '').trim()
  const company = (body.company ?? '').trim()
  const phone   = (body.phone ?? '').trim()
  const email   = (body.email ?? '').trim().toLowerCase()
  const source  = (body.source ?? 'lp_leads').trim()
  const plan    = PLANS[source] ?? PLANS.lp_leads

  if (!name)  return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!phone) return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })

  const service = createServiceClient()

  const { data: lead, error: insertErr } = await service
    .from('landing_leads')
    .insert({ name, company_name: company || null, phone, email, source, payment_status: 'pending' })
    .select('id')
    .single()

  if (insertErr || !lead) {
    console.error('[landing/subscribe] insert error:', insertErr)
    return NextResponse.json({ error: 'Could not save your details — please try again' }, { status: 500 })
  }

  // From here on, the lead row already exists — a Razorpay failure is
  // reported to the visitor but never loses the contact details above.
  try {
    const planId = await getOrCreateLandingPlan(service, plan)
    const { subscriptionId } = await createRazorpaySubscription({
      planId,
      notes: { landing_lead_id: lead.id, source },
    })

    await service.from('landing_leads').update({ razorpay_subscription_id: subscriptionId }).eq('id', lead.id)

    return NextResponse.json({
      leadId: lead.id,
      subscriptionId,
      keyId: process.env.RAZORPAY_KEY_ID,
      prefill: { name, email, contact: phone },
    })
  } catch (e) {
    console.error('[landing/subscribe] Razorpay error:', e)
    return NextResponse.json({
      leadId: lead.id,
      error: 'saved_no_checkout',
      message: "We've saved your details — our team will reach out shortly to complete your subscription.",
    }, { status: 200 })
  }
}
