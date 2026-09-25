export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeLoginSetup } from '@/lib/complete-login-setup'

// Handles the PKCE (?code=) flow only. Supabase's invite/magic-link/reset
// emails instead redirect with tokens in the URL hash (#access_token=...),
// which the server can never see — that case is completed client-side on
// the login page (app/login/page.tsx) and finished via /api/auth/post-login.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      await completeLoginSetup(supabase)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
