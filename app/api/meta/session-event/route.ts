// Meta Embedded Signup — session event logging
// Logs window.postMessage(WA_EMBEDDED_SIGNUP) events from the settings page.
// Meta requires session logging for Coexistence, and these events can arrive
// separately from (and out of order with) the FB.login() callback — logging
// them here gives us something to debug a failed signup against.

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as {
    eventType?: string
    sessionId?: string
    data?: Record<string, unknown>
  }
  if (!body.eventType) return NextResponse.json({ ok: false, error: 'Missing eventType' }, { status: 400 })

  const service = createServiceClient()
  const { error } = await service.from('meta_signup_events').insert({
    user_id:    user.id,
    event_type: body.eventType,
    session_id: body.sessionId ?? null,
    data:       body.data ?? {},
  })

  if (error) console.error('[Meta session-event] insert failed:', error.message)
  return NextResponse.json({ ok: !error })
}
