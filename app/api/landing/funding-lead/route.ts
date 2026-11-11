export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendMetaCapiEvent } from '@/lib/meta-capi'
import { isValidWebsiteInput } from '@/lib/utils'
import { FUNDING_QUESTIONS, FUNDING_DESCRIPTION_MAX_LEN } from '@/lib/funding-lead-questions'

// Public — no auth. A pure qualification funnel for /lp/funding, modeled on
// a Meta Instant Form's question list. Unlike every other app/api/landing/*
// route, this one never touches Razorpay — there's no product being sold
// here, just a lead + their answers for a human to follow up on.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    name?: string; phone?: string; email?: string
    companyName?: string; website?: string
    answers?: Record<string, string>; description?: string
    utm_source?: string | null; utm_medium?: string | null; utm_campaign?: string | null
    utm_term?: string | null; utm_content?: string | null
    fbp?: string | null; fbc?: string | null; fbEventId?: string | null
  }

  const name        = (body.name ?? '').trim()
  const phone       = (body.phone ?? '').trim()
  const email       = (body.email ?? '').trim().toLowerCase()
  const companyName = (body.companyName ?? '').trim()
  const website     = (body.website ?? '').trim()
  const description = (body.description ?? '').trim()
  const answers     = body.answers ?? {}

  if (!name)        return NextResponse.json({ error: 'Name is required', message: 'Please enter your name.' }, { status: 400 })
  if (!phone)       return NextResponse.json({ error: 'Phone number is required', message: 'Please enter a phone number.' }, { status: 400 })
  if (!email || !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Valid email is required', message: 'Please enter a valid email address.' }, { status: 400 })
  if (!companyName) return NextResponse.json({ error: 'Startup name is required', message: 'Please enter your startup name.' }, { status: 400 })
  if (website && !isValidWebsiteInput(website)) {
    return NextResponse.json({ error: 'Invalid website', message: "That doesn't look like a website — enter your website URL, or leave it blank." }, { status: 400 })
  }

  // Every multiple-choice answer must be one of its question's own listed
  // options — a direct POST to this route (skipping the actual <select>
  // elements) could otherwise write arbitrary free text into what's meant to
  // be a closed set, breaking any later filtering/reporting on these answers.
  for (const q of FUNDING_QUESTIONS) {
    const value = answers[q.key]
    if (!value || !(q.options as readonly string[]).includes(value)) {
      return NextResponse.json({ error: `Missing or invalid answer for: ${q.question}`, message: 'Please answer every question before submitting.' }, { status: 400 })
    }
  }
  if (!description) return NextResponse.json({ error: 'Description is required', message: 'Please briefly describe your startup.' }, { status: 400 })
  if (description.length > FUNDING_DESCRIPTION_MAX_LEN) {
    return NextResponse.json({ error: 'Description too long', message: 'Please keep your description a bit shorter.' }, { status: 400 })
  }

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

  const service = createServiceClient()

  let { data: lead, error: insertErr } = await service
    .from('landing_leads')
    .insert({
      name, company_name: companyName, website, phone, email,
      source: 'lp_funding', payment_status: 'pending',
      answers: { ...answers, description },
      ...utm, fbp, fbc, fb_lead_event_id: fbEventId,
    })
    .select('id')
    .single()

  // Same intent as /api/landing/subscribe's fallback — the website/answers/
  // utm_*/fb* columns are added by a migration that may not have run yet in
  // every environment; never let that break lead capture itself. Confirmed
  // live against the real Supabase project that PostgREST reports a missing
  // column as PGRST204 ("Could not find the '<col>' column … in the schema
  // cache"), NOT Postgres's own 42703 — checking only 42703 (as the sibling
  // route does) never actually catches this over REST.
  if (insertErr?.code === '42703' || insertErr?.code === 'PGRST204') {
    console.error('[landing/funding-lead] some columns missing, retrying with core fields only:', insertErr.message)
    ;({ data: lead, error: insertErr } = await service
      .from('landing_leads')
      .insert({ name, company_name: companyName, phone, email, source: 'lp_funding', payment_status: 'pending' })
      .select('id')
      .single())
  }

  if (insertErr || !lead) {
    console.error('[landing/funding-lead] insert error:', insertErr)
    return NextResponse.json({ error: 'Could not save your details', message: 'Could not save your details — please try again.' }, { status: 500 })
  }

  // Best-effort — same server-side Meta lead-quality signal every other
  // lp/* page sends, deduped against the client pixel's fbq('track','Lead')
  // via the shared fbEventId.
  void sendMetaCapiEvent({
    eventName: 'Lead',
    eventId: fbEventId ?? undefined,
    eventSourceUrl: request.headers.get('referer') ?? 'https://www.wapaci.com',
    email, phone, fbp, fbc,
    clientIp: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true, leadId: lead.id })
}
