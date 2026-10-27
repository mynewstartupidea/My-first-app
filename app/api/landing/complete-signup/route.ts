// Called right after Razorpay's checkout `handler` fires client-side (payment
// succeeded) on /lp/leads or /lp/ecommerce — turns the landing_leads row,
// which already has their name/company/phone/email from the lead form, into
// a real logged-in account. No OTP email step here: a completed payment is
// already a stronger identity signal than the normal signup flow's email
// link, and asking them to go check their inbox right after paying is exactly
// the friction this exists to avoid.
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { leadId?: string; password?: string }
  const leadId   = (body.leadId ?? '').trim()
  const password = body.password ?? ''

  if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })

  const service = createServiceClient()

  const { data: lead, error: leadErr } = await service
    .from('landing_leads')
    .select('id, name, company_name, phone, email, source, payment_status, razorpay_subscription_id')
    .eq('id', leadId)
    .maybeSingle()

  if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // lp_leads/lp_ecommerce are the only two landing pages with their own
  // inline payment form (see app/lp/*/route checks in /api/landing/subscribe)
  // — anything else defaults to lead_gen's sidebar preset same as provisionStore does.
  const businessType = lead.source === 'lp_ecommerce' ? 'ecommerce' : 'lead_gen'

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email: lead.email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name:     lead.name,
      company_name:  lead.company_name ?? '',
      phone:         lead.phone,
      business_type: businessType,
    },
  })

  let userId: string
  if (createErr) {
    // Only recover from "this email already has an account" — anything else
    // (rate limit, DB error, bad input) should surface, not be swallowed.
    if (!/already.*registered|already.*exists/i.test(createErr.message)) {
      console.error('[landing/complete-signup] createUser error:', createErr.message)
      return NextResponse.json({ error: 'Could not create your account — please try again or contact support@wapaci.com.' }, { status: 500 })
    }
    // They already have an account under this email (separate earlier signup,
    // or a retried submission after this same call already succeeded once).
    // user_profiles.email is the only email-indexed lookup available via the
    // service client without extra admin-API round-trips — set by both the
    // normal signup flow and the insert below, so this also makes the whole
    // route idempotent on retry.
    const { data: existingProfile } = await service
      .from('user_profiles').select('id').eq('email', lead.email).maybeSingle()
    if (!existingProfile) {
      return NextResponse.json({
        error: 'An account with this email already exists — please log in instead.',
        code: 'already_registered',
      }, { status: 409 })
    }
    userId = existingProfile.id
  } else {
    userId = created.user.id
  }

  // Mirrors what the normal /signup form writes, so provisionStore()
  // (lib/complete-login-setup.ts) — which reads company_name from here first,
  // falling back to user_metadata — sees the same shape of data either way.
  await service.from('user_profiles').upsert({
    id:           userId,
    full_name:    lead.name,
    company_name: lead.company_name || null,
    phone:        lead.phone,
    email:        lead.email,
  }, { onConflict: 'id' })

  // The landing page's flat ₹1,999/month plan never touches the main app's
  // `billing` table on its own (/api/landing/subscribe only writes
  // landing_leads) — without this insert, this brand-new account would land
  // on dashboard defaults (trial, 500 msgs) despite having already paid, and
  // /api/billing/razorpay-webhook would have no row to find by subscription
  // id on their next billing cycle.
  const planKey = lead.source === 'lp_ecommerce' ? 'lp_ecommerce_1999_monthly' : 'lp_leads_1999_monthly'
  const { data: planRow } = await service.from('razorpay_plans').select('plan_id').eq('plan_name', planKey).maybeSingle()
  const { error: billingErr } = await service.from('billing').upsert({
    user_id:                  userId,
    plan_name:                planKey,
    status:                   lead.payment_status === 'active' ? 'active' : 'trialing',
    billing_provider:         'razorpay',
    razorpay_subscription_id: lead.razorpay_subscription_id,
    razorpay_plan_id:         planRow?.plan_id ?? null,
    amount_paise:             199900,
    // Both landing pages' copy promises "Unlimited leads & follow-ups" —
    // 999_999_999 is this codebase's existing unlimited sentinel (same value
    // Enterprise uses, and what components/sidebar.tsx already checks
    // against to hide the usage bar entirely for an unlimited plan).
    messages_limit:           999_999_999,
    messages_used:            0,
  }, { onConflict: 'user_id' })
  if (billingErr) console.error('[landing/complete-signup] billing upsert failed (non-fatal):', billingErr.message)

  return NextResponse.json({ ok: true, email: lead.email })
}
