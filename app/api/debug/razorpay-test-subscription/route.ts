// TEMPORARY, one-off diagnostic route — delete after the UPI AutoPay mandate
// investigation is done. Creates a REAL ₹50/month Live Mode subscription
// with total_count: 12 (vs. the real flow's 1200) and returns Razorpay's own
// hosted authentication link (short_url), so the 12-month-vs-100-year
// mandate-duration hypothesis can be tested independently of this app's own
// checkout.js integration — isolates whether the QR/mandate failure is
// caused by total_count specifically, or is unconditional (points at the
// Razorpay account/UPI routing level instead).
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

  const service = createServiceClient()

  try {
    const planId = await getOrCreateLandingPlan(service, {
      planKey: 'debug_test_12mo_50_monthly',
      amountRupees: 50,
      name: 'DEBUG — UPI mandate duration test (12 months)',
    })

    const { subscriptionId, shortUrl } = await createRazorpaySubscription({
      planId,
      notes: { purpose: 'upi_autopay_mandate_duration_debug' },
      totalCount: 12,
    })

    return NextResponse.json({ ok: true, planId, subscriptionId, shortUrl })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
