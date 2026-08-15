import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFacebookOAuthUrl } from '@/lib/facebook'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login?returnTo=/dashboard/leads`)

  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return NextResponse.json({ error: 'META_APP_ID / META_APP_SECRET not set in Vercel env vars' }, { status: 500 })
  }

  const state = crypto.randomBytes(16).toString('hex')
  const res   = NextResponse.redirect(getFacebookOAuthUrl(state))
  res.cookies.set('fb_oauth_state', state, { httpOnly: true, maxAge: 600, sameSite: 'lax', secure: true })
  return res
}
