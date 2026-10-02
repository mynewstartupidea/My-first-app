export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeLoginSetup } from '@/lib/complete-login-setup'

// Handles the PKCE (?code=) flow. Supabase's admin-triggered emails (team
// invites, sent via auth.admin.inviteUserByEmail) instead redirect with
// tokens in the URL hash (#access_token=...), which the server can never
// see — that case is completed client-side on the login page
// (app/login/page.tsx) and finished via /api/auth/post-login. But
// resetPasswordForEmail() is called from the BROWSER client, which
// (@supabase/ssr's createBrowserClient) defaults to PKCE flow — so a
// user-initiated password reset always arrives here via ?code=, not the hash.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/dashboard'
  // Set by us in the redirectTo passed to resetPasswordForEmail() — Supabase's
  // own `type=recovery` annotation lives on the hash-based flow, not this one,
  // so we mark it ourselves rather than relying on it surviving the redirect.
  const flow  = searchParams.get('flow')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      await completeLoginSetup(supabase)
      // A recovery code only ever authenticates via the one-time link — it
      // never sets a real password. Send them to set one instead of logging
      // straight into the dashboard with no way to sign back in later.
      if (flow === 'recovery') return NextResponse.redirect(`${origin}/login?needsPassword=1`)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // No ?code= — this is either a genuine failure, OR (confirmed live: the
  // Shopify App Store new-merchant auto-sign-in flow, which generates an
  // admin link server-side and redirects straight into it) a link type that
  // authenticates via the URL *hash* instead, which the server can never
  // see at all. That case still gets completed client-side on /login from
  // the hash — but this redirect used to just say "/login?error=auth_failed"
  // with no `next`, so even a SUCCESSFUL hash-based completion afterward had
  // nothing but the default /dashboard to go to: a brand-new Shopify
  // merchant landed in an empty dashboard instead of the pricing page they
  // were supposed to see. Forward `next` as `returnTo`, which /login's
  // existing hash-completion logic already reads.
  const fallbackParams = new URLSearchParams({ error: 'auth_failed' })
  if (next !== '/dashboard') fallbackParams.set('returnTo', next)
  return NextResponse.redirect(`${origin}/login?${fallbackParams}`)
}
