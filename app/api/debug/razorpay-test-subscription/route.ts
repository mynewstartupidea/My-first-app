// TEMPORARY, one-off diagnostic route — delete after the UPI AutoPay mandate
// investigation is done. total_count: 12 confirmed working (UPI AutoPay
// mandate authorized successfully) where the real flow's total_count: 1200
// (100 years) failed across multiple apps/amounts — this now takes
// ?months=N so the actual safe upper bound can be found (e.g. 60/120/240)
// without a redeploy per test, so the real flow doesn't overcorrect to
// something shorter than necessary (annual re-authorization is a real UX/
// support cost; a 10-year bound with the same renewal mechanism is not).
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getOrCreateLandingPlan, createRazorpaySubscription } from '@/lib/razorpay'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const months = Number(new URL(request.url).searchParams.get('months') ?? '12')
  if (!Number.isInteger(months) || months < 1 || months > 1200) {
    return NextResponse.json({ error: 'months must be an integer between 1 and 1200' }, { status: 400 })
  }

  const service = createServiceClient()

  try {
    const planId = await getOrCreateLandingPlan(service, {
      planKey: 'debug_test_50_monthly',
      amountRupees: 50,
      name: 'DEBUG — UPI mandate duration test',
    })

    const { subscriptionId, shortUrl } = await createRazorpaySubscription({
      planId,
      notes: { purpose: 'upi_autopay_mandate_duration_debug', months: String(months) },
      totalCount: months,
    })

    return NextResponse.json({ ok: true, months, planId, subscriptionId, shortUrl })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
