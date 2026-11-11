import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'vaibhavsin9574395@gmail.com'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  let { data: leads, error } = await service
    .from('landing_leads')
    .select('id, name, company_name, phone, email, source, payment_status, razorpay_subscription_id, created_at, utm_source, utm_medium, utm_campaign, utm_term, utm_content')
    .order('created_at', { ascending: false })
    .limit(1000)

  // Same migration-not-run-yet fallback as /api/landing/subscribe — don't
  // let the whole admin view break just because the utm_* columns aren't
  // there yet in this environment.
  if (error?.code === '42703') {
    const fallback = await service
      .from('landing_leads')
      .select('id, name, company_name, phone, email, source, payment_status, razorpay_subscription_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000)
    error = fallback.error
    leads = fallback.data?.map(l => ({
      ...l, utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null,
    })) ?? null
  }

  if (error) return NextResponse.json({ error: `Couldn't load landing_leads: ${error.message}` }, { status: 500 })
  return NextResponse.json({ leads: leads ?? [] })
}
