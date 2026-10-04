// Supabase's built-in email sender is currently failing project-wide (every
// client-side supabase.auth.signUp() call gets a 500 "Error sending
// confirmation email," with no custom SMTP configured to fall back to) —
// confirmed independently, not an application bug, but it means nobody can
// create an account through the normal client-side signUp() path at all
// until that's fixed in the Supabase dashboard. This route creates the user
// server-side via the admin API with email_confirm: true, which never
// attempts to send anything, so signup keeps working regardless of SMTP
// state. The client still establishes its own session afterward via
// signInWithPassword (this route has no way to hand back a session itself).
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    email?: string
    password?: string
    full_name?: string
    company_name?: string
    phone?: string
    team_size?: string
    business_type?: string
  }

  const email = body.email?.trim().toLowerCase()
  const password = body.password ?? ''
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
  }

  const fullName     = body.full_name?.trim() ?? ''
  const companyName  = body.company_name?.trim() ?? ''
  const phone        = body.phone?.trim() ?? ''
  const teamSize     = body.team_size ?? ''
  // Defaults to lead_gen (same fallback used everywhere else business_type
  // is read) rather than rejecting the request — this field only picks
  // which sidebar defaults get applied, never gates a feature, so there's
  // nothing to validate-and-reject here even if it's missing or malformed.
  const businessType = body.business_type === 'ecommerce' ? 'ecommerce' : 'lead_gen'

  const service = createServiceClient()
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      company_name: companyName,
      phone,
      team_size: teamSize,
      business_type: businessType,
    },
  })

  if (error) {
    const isDuplicate = /already.*registered|already exists|email.*exists/i.test(error.message)
    return NextResponse.json(
      { error: isDuplicate ? 'An account with this email already exists — try signing in instead.' : error.message },
      { status: isDuplicate ? 409 : 500 }
    )
  }

  if (data.user) {
    await service.from('user_profiles').upsert({
      id:           data.user.id,
      full_name:    fullName,
      company_name: companyName,
      phone,
      team_size:    teamSize,
      email,
    }, { onConflict: 'id' })
  }

  return NextResponse.json({ ok: true })
}
