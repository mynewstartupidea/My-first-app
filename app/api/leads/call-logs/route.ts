import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { renderTemplate } from '@/lib/utils'

const VALID_OUTCOMES = new Set(['connected', 'no_answer', 'voicemail', 'callback', 'busy'])
const VALID_STATUSES = new Set(['hot', 'warm', 'cold', 'lost', 'converted', 'junk', 'resolved'])

// Template bodies used for WhatsApp follow-up after missed call / voicemail
const FOLLOWUP_TEMPLATES: Record<string, { name: string; body: string }> = {
  no_answer: { name: 'wapaci_missed_call',       body: 'Hi {{name}}, we tried calling you. Feel free to reply here whenever you\'re free.' },
  voicemail: { name: 'wapaci_voicemail_followup', body: 'Hi {{name}}, we left you a voicemail. You can also reply here anytime and we\'ll get back to you.' },
}

// GET /api/leads/call-logs?lead_id=xxx
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  if (!leadId) return NextResponse.json({ logs: [] })

  const service = createServiceClient()

  // Verify the lead belongs to the requesting user before returning its call logs
  const { data: lead } = await service
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!lead) return NextResponse.json({ logs: [] })

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
    sendFollowup?: boolean
  }

  if (!VALID_OUTCOMES.has(body.outcome)) {
    return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 })
  }
  if (body.tagStatus !== undefined && body.tagStatus !== null && !VALID_STATUSES.has(body.tagStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify the lead belongs to the requesting user before writing any data
  const { data: ownedLead } = await service
    .from('leads')
    .select('id')
    .eq('id', body.leadId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!ownedLead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

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

  // Queue WhatsApp follow-up message if requested
  let followupQueued = false
  if (body.sendFollowup && FOLLOWUP_TEMPLATES[body.outcome]) {
    const tmpl = FOLLOWUP_TEMPLATES[body.outcome]
    const { data: lead } = await service
      .from('leads')
      .select('id, name, phone, store_id, form_id')
      .eq('id', body.leadId)
      .maybeSingle()

    if (lead?.phone && lead?.store_id) {
      const message = renderTemplate(tmpl.body, {
        name: lead.name ?? 'there',
        phone: lead.phone,
      })
      await service.from('automation_jobs').insert({
        store_id: lead.store_id,
        automation_id: null,
        type: 'lead_ad',
        customer_phone: lead.phone,
        customer_name: lead.name ?? 'Lead',
        message,
        context: {
          lead_id: lead.id,
          form_id: lead.form_id,
          manual: true,
          missed_call_followup: true,
          template_name: tmpl.name,
        },
        status: 'pending',
        scheduled_at: new Date().toISOString(),
      })
      await service.from('leads').update({ wa_status: 'pending' }).eq('id', body.leadId)
      followupQueued = true
    }
  }

  return NextResponse.json({ log: data, followupQueued })
}
