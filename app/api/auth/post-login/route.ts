// Called from the login page right after it establishes a session client-side
// from a hash-fragment token (invite/magic-link/reset emails) — the server
// can't see that token at all (it never leaves the browser), so this runs
// once the browser's own supabase.auth.setSession() call has set the
// session cookies this route can then read.

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { completeLoginSetup } from '@/lib/complete-login-setup'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await completeLoginSetup(supabase)
  return NextResponse.json({ ok: true })
}
