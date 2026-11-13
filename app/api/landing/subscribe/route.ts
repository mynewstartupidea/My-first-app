export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMetaCapiEvent } from '@/lib/meta-capi'
import { isValidWebsiteInput } from '@/lib/utils'

// Public — no auth. Submitted by anonymous visitors on the marketing landing
// pages (app/lp/*) and the homepage. Pure lead capture — no price is shown
// anywhere on the marketing site and no checkout happens here; every
// successful submission just saves the lead for a human to call and close
// manually. Previously created a Razorpay Plan + Subscription per submission
// and only fell back to this "saved" response if that failed — removed
// entirely per instruction to stop showing price and selling self-serve from
// these pages. (Self-serve signup/payment still exists separately at
// /signup, untouched by this.)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  // Check for an existing Wapaci account on this email — an existing
  // customer resubmitting this form should be told to log in rather than
  // being treated (and called) as a brand-new lead.
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

  return NextResponse.json({
    leadId: lead.id,
    message: "We've saved your details — our team will call you shortly to get you set up.",
  })
}
