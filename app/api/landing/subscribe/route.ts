export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrCreateLandingPlan, createRazorpaySubscription } from '@/lib/razorpay'
import { sendMetaCapiEvent } from '@/lib/meta-capi'
import { isValidWebsiteInput } from '@/lib/utils'

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
  // Homepage serves both segments (unlike the single-industry lp/* pages),
  // so it uses the same flat price already proven on both of those rather
  // than inventing a new figure — same reasoning as reusing real stats
  // instead of new ones elsewhere on the site.
  homepage:     { amountRupees: 1999, planKey: 'homepage_1999_monthly',     name: 'Wapaci — Homepage Plan (Monthly)' },
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    name?: string; company?: string; phone?: string; email?: string; source?: string
    utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null
    utm_term?: string | null; utm_content?: string | null
    fbp?: string | null; fbc?: string | null; fbEventId?: string | null
  }
  const name    = (body.name ?? '').trim()
  const company = (body.company ?? '').trim()
  const phone   = (body.phone ?? '').trim()
  const email   = (body.email ?? '').trim().toLowerCase()
  const source  = (body.source ?? 'lp_leads').trim()
  const plan    = PLANS[source] ?? PLANS.lp_leads
  const utm = {
    utm_source:   body.utm_source?.trim() || null,
    utm_medium:   body.utm_medium?.trim() || null,
    utm_campaign: body.utm_campaign?.trim() || null,
    utm_term:     body.utm_term?.trim() || null,
    utm_content:  body.utm_content?.trim() || null,
  }
  const fbp = body.fbp?.trim() || null
  const fbc = body.fbc?.trim() || null
  const fbEventId = body.fbEventId?.trim() || null

  // Every error response below returns `error`, but both landing pages'
  // handleSubmit only ever reads `data.message` to show the visitor
  // anything — `data.message` was always undefined for every one of these,
  // so a missing name, an invalid email, or a failed DB insert all silently
  // fell through to the generic "Something went wrong" text with no way to
  // tell which one actually happened. Every return below now sets both.
  if (!name)  return NextResponse.json({ error: 'Name is required', message: 'Please enter your name.' }, { status: 400 })
  if (!phone) return NextResponse.json({ error: 'Phone number is required', message: 'Please enter a phone number.' }, { status: 400 })
  if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Valid email is required', message: 'Please enter a valid email address.' }, { status: 400 })
  // lp_ecommerce and lp_leads both ask for this as a website (homepage's
  // equivalent field is still "Company / Store" — a different, optional
  // question). Required on both because real leads kept typing their own
  // phone/email into it instead, which the client form now also blocks —
  // this is the same check enforced server-side so a direct POST to this
  // endpoint can't skip it.
  if (source === 'lp_ecommerce' || source === 'lp_leads') {
    if (!company) return NextResponse.json({ error: 'Website is required', message: 'Please enter your website.' }, { status: 400 })
    if (!isValidWebsiteInput(company)) return NextResponse.json({ error: 'Invalid website', message: "That doesn't look like a website — enter your website URL." }, { status: 400 })
  }

  const service = createServiceClient()

  // Check for an existing Wapaci account on this email BEFORE creating
  // anything — this used to only get caught much later, at
  // /api/landing/complete-signup, AFTER a real Razorpay charge had already
  // gone through: the visitor would pay, then be told "an account with this
  // email already exists, log in instead," with no account created to show
  // for the money they'd just paid. Stopping it here means the Razorpay
  // popup never even opens for an email that already has an account.
  //
  // Checking user_profiles alone isn't enough — confirmed live, several real
  // auth.users accounts (including the admin's own) have no user_profiles
  // row at all, so that check silently missed them and let a real duplicate
  // through. auth.users is the actual source of truth for "does this email
  // have an account," and Supabase's Admin API has no direct get-by-email
  // lookup — paginating listUsers (same pattern app/api/admin/users/route.ts
  // already uses) is the reliable way to check it. Fine at today's user
  // count; would need a real index-backed lookup if that grows large enough
  // for this to matter.
  let existingAccount = false
  {
    let page = 1
    outer: while (true) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 })
      if (error || !data?.users?.length) break
      for (const u of data.users) {
        if ((u.email ?? '').toLowerCase() === email) { existingAccount = true; break outer }
      }
      if (data.users.length < 1000) break
      page++
    }
  }
  if (existingAccount) {
    return NextResponse.json({
      error: 'already_registered',
      message: 'An account with this email already exists — please log in instead.',
    }, { status: 409 })
  }

  let { data: lead, error: insertErr } = await service
    .from('landing_leads')
    .insert({ name, company_name: company || null, phone, email, source, payment_status: 'pending', ...utm, fbp, fbc, fb_lead_event_id: fbEventId })
    .select('id')
    .single()

  // The utm_*/fb* columns are added by migrations that may not have run yet
  // on every environment — never let a missing column break lead capture
  // itself, just drop the extra data and save the lead without it.
  if (insertErr?.code === '42703') {
    console.error('[landing/subscribe] utm_*/fb* columns missing, retrying without them:', insertErr.message)
    ;({ data: lead, error: insertErr } = await service
      .from('landing_leads')
      .insert({ name, company_name: company || null, phone, email, source, payment_status: 'pending' })
      .select('id')
      .single())
  }

  if (insertErr || !lead) {
    console.error('[landing/subscribe] insert error:', insertErr)
    return NextResponse.json({ error: 'Could not save your details', message: 'Could not save your details — please try again.' }, { status: 500 })
  }

  // Best-effort — the server-side half of the Meta lead-quality feedback
  // loop. Deduped against the client pixel's own fbq('track','Lead') call
  // via the shared fbEventId. Never blocks lead capture or checkout.
  void sendMetaCapiEvent({
    eventName: 'Lead',
    eventId: fbEventId ?? undefined,
    eventSourceUrl: request.headers.get('referer') ?? 'https://www.wapaci.com',
    email, phone, fbp, fbc,
    clientIp: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
  })

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
