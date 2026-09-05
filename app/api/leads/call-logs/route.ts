import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const VALID_OUTCOMES = new Set(['connected', 'no_answer', 'voicemail', 'callback', 'busy'])
const VALID_STATUSES = new Set(['hot', 'warm', 'cold', 'lost', 'converted', 'junk', 'resolved'])

// GET /api/leads/call-logs?lead_id=xxx
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  if (!leadId) return NextResponse.json({ logs: [] })

  const service = createServiceClient()
  const { data } = await service
    .from('call_logs')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ logs: data ?? [] })
}

// POST /api/leads/call-logs  { leadId, outcome, notes, followupAt, tagStatus }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    leadId: string
    outcome: string
    notes?: string
    followupAt?: string | null
    tagStatus?: string | null
    callerName?: string
  }

  if (!VALID_OUTCOMES.has(body.outcome)) {
    return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 })
  }
  if (body.tagStatus !== undefined && body.tagStatus !== null && !VALID_STATUSES.has(body.tagStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const service = createServiceClient()

  // Get caller name from profile
  const { data: profile } = await service
    .from('user_profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()
  const callerName = body.callerName ?? profile?.full_name ?? user.email?.split('@')[0] ?? 'Unknown'

  const { data, error } = await service
    .from('call_logs')
    .insert({
      lead_id: body.leadId,
      called_by: user.id,
      caller_name: callerName,
      outcome: body.outcome,
      notes: body.notes ?? '',
      followup_at: body.followupAt ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update lead's followup_at and/or tag if provided
  const updates: Record<string, unknown> = {}
  if (body.followupAt) updates.followup_at = body.followupAt
  if (body.tagStatus !== undefined) updates.lead_status = body.tagStatus
  if (Object.keys(updates).length > 0) {
    await service.from('leads').update(updates).eq('id', body.leadId)
  }

  return NextResponse.json({ log: data })
}
