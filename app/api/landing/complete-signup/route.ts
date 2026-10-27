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
import { getRazorpaySubscriptionStatus } from '@/lib/razorpay'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { leadId?: string; password?: string }
  const leadId   = (body.leadId ?? '').trim()
  const password = body.password ?? ''

  if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })

  const service = createServiceClient()

  const { data: lead, error: leadErr } = await service
    .from('landing_leads')
    .select('id, name, company_name, phone, email, source, razorpay_subscription_id, converted_user_id')
    .eq('id', leadId)
    .maybeSingle()

  if (leadErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  // Idempotent short-circuit, scoped to THIS lead only — never looked up by
  // email. A double-click/retry of the exact same submission (e.g. a fast
  // double-tap on mobile) just gets the same successful response again
  // instead of racing against its own in-flight account creation.
  if (lead.converted_user_id) {
    return NextResponse.json({ ok: true, email: lead.email })
  }

  // landing_leads.payment_status is written by a SEPARATELY-delivered
  // webhook (app/api/landing/razorpay-webhook/route.ts) that can lag behind
  // the client-side checkout-success callback that triggers this request —
  // trusting it here would mean a real paying customer could get wrongly
  // blocked right after paying just because the webhook hasn't landed yet.
  // It's also not a safe gate on its own: /api/landing/subscribe is a public,
  // unauthenticated endpoint, so anyone can create a landing_leads row (with
  // any email) and call this route directly with its id — asking Razorpay
  // directly, right now, is the only check that can't be faked by skipping
  // checkout entirely.
  if (!lead.razorpay_subscription_id) {
    return NextResponse.json({ error: 'No subscription found for this submission — please complete checkout first.' }, { status: 402 })
  }
  let razorpayStatus: string
  try {
    razorpayStatus = await getRazorpaySubscriptionStatus(lead.razorpay_subscription_id)
  } catch (e) {
    console.error('[landing/complete-signup] Razorpay status check failed:', e)
    return NextResponse.json({ error: 'Could not verify your payment right now — please try again in a moment.' }, { status: 502 })
  }
  // 'authenticated' = payment mandate confirmed (trial/first-cycle pending),
  // 'active' = already charging — both are genuine "they really committed to
  // paying" states, same set app/api/billing/razorpay-webhook/route.ts
  // treats as non-pending when deciding whether to promote a plan change.
  if (!['authenticated', 'active'].includes(razorpayStatus)) {
    return NextResponse.json({ error: 'Payment not confirmed yet — please complete checkout first.' }, { status: 402 })
  }

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

  if (createErr) {
    // Deliberately NOT attempting to recover by reusing/reconciling an
    // existing account here. The lead's email is fully attacker-controlled
    // (/api/landing/subscribe is public, unauthenticated, and never verifies
    // the submitter owns the email address they typed) — silently signing
    // into, or resetting the password on, whatever account already has that
    // email would turn "someone else's email happens to collide" into a real
    // account-takeover path. The only safe response is the same one
    // app/signup/page.tsx gives for the identical Supabase
    // already-registered case: tell them to log in instead.
    if (/already.*registered|already.*exists/i.test(createErr.message)) {
      return NextResponse.json({
        error: 'An account with this email already exists — please log in instead.',
        code: 'already_registered',
      }, { status: 409 })
    }
    console.error('[landing/complete-signup] createUser error:', createErr.message)
    return NextResponse.json({ error: 'Could not create your account — please try again or contact support@wapaci.com.' }, { status: 500 })
  }
  const userId = created.user.id

  // Mirrors what the normal /signup form writes, so provisionStore()
  // (lib/complete-login-setup.ts) — which reads company_name from here first,
  // falling back to user_metadata — sees the same shape of data either way.
  // Logged, not treated as fatal: the auth account + password above already
  // works, so failing the whole request here would strand them with no way
  // to retry (a retry would now hit the "already registered" branch above,
  // which deliberately has no recovery path) over what provisionStore can
  // already fall back to user_metadata for.
  const { error: profileErr } = await service.from('user_profiles').upsert({
    id:           userId,
    full_name:    lead.name,
    company_name: lead.company_name || null,
    phone:        lead.phone,
    email:        lead.email,
  }, { onConflict: 'id' })
  if (profileErr) console.error('[landing/complete-signup] user_profiles upsert failed:', profileErr.message)

  // The landing page's flat ₹1,999/month plan never touches the main app's
  // `billing` table on its own (/api/landing/subscribe only writes
  // landing_leads) — without this insert, this brand-new account would land
  // on dashboard defaults (trial, 500 msgs) despite having already paid, and
  // /api/billing/razorpay-webhook would have no row to find by subscription
  // id on their next billing cycle. status comes from the Razorpay check
  // above, not landing_leads.payment_status, so it's never stuck at
  // 'trialing' for someone who actually already paid.
  const planKey = lead.source === 'lp_ecommerce' ? 'lp_ecommerce_1999_monthly' : 'lp_leads_1999_monthly'
  const { data: planRow } = await service.from('razorpay_plans').select('plan_id').eq('plan_name', planKey).maybeSingle()
  const { error: billingErr } = await service.from('billing').upsert({
    user_id:                  userId,
    plan_name:                planKey,
    status:                   razorpayStatus === 'active' ? 'active' : 'trialing',
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
  if (billingErr) console.error('[landing/complete-signup] billing upsert failed:', billingErr.message)

  // Marks this lead as converted — the idempotency check at the top of this
  // function, so a retry/double-click never re-runs createUser against an
  // account it just made.
  await service.from('landing_leads').update({ converted_user_id: userId }).eq('id', lead.id)

  return NextResponse.json({ ok: true, email: lead.email, billingDegraded: !!billingErr })
}
