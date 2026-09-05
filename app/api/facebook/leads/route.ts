import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { renderTemplate } from '@/lib/utils'

// GET /api/facebook/leads?form_id=xxx&page_id=xxx&limit=50&offset=0&from_date=YYYY-MM-DD&to_date=YYYY-MM-DD
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const formId   = searchParams.get('form_id')
  const pageId   = searchParams.get('page_id')
  const fromDate = searchParams.get('from_date')
  const toDate   = searchParams.get('to_date')
  const download = searchParams.get('download') === 'true'
  const limit    = download ? 5000 : Math.min(parseInt(searchParams.get('limit') ?? '50') || 50, 200)
  const offset   = parseInt(searchParams.get('offset') ?? '0') || 0
  const q           = searchParams.get('q')?.trim() ?? ''
  const leadStatus  = searchParams.get('lead_status')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const buildQuery = (countOnly = false) => {
    let query = service
      .from('leads')
      .select('id,name,email,phone,form_id,form_name,page_id,wa_status,lead_status,assigned_to,assigned_name,followup_at,created_at,fields', countOnly ? { count: 'exact', head: true } : { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (formId) query = query.eq('form_id', formId)
    else if (pageId) query = query.eq('page_id', pageId)
    if (fromDate) query = query.gte('created_at', `${fromDate}T00:00:00.000Z`)
    if (toDate)   query = query.lte('created_at', `${toDate}T23:59:59.999Z`)
    if (q) {
      const esc = q.replace(/[%_\\]/g, '\\$&')
      query = query.or(`name.ilike.%${esc}%,phone.ilike.%${esc}%,email.ilike.%${esc}%`)
    }
    if (leadStatus) query = query.eq('lead_status', leadStatus)
    return query
  }

  const { data: leads, count } = await buildQuery().range(offset, offset + limit - 1)

  const total = count ?? 0
  return NextResponse.json({
    leads: leads ?? [],
    total,
    hasMore: offset + limit < total,
  })
}

// POST /api/facebook/leads — manually send WhatsApp to a specific lead
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leadId, message } = await request.json() as { leadId: string; message: string }
  const service = createServiceClient()

  const { data: lead } = await service
    .from('leads').select('*').eq('id', leadId).eq('user_id', user.id).maybeSingle()

  if (!lead?.phone) return NextResponse.json({ error: 'Lead not found or has no phone' }, { status: 400 })
  if (!lead.store_id) return NextResponse.json({ error: 'No store connected' }, { status: 400 })

  // Render template with lead fields if the caller didn't already do it
  const { data: auto } = await service
    .from('lead_form_automations')
    .select('message_template')
    .eq('form_id', lead.form_id)
    .eq('user_id', user.id)
    .maybeSingle()

  const finalMessage = auto?.message_template
    ? renderTemplate(auto.message_template, {
        ...(lead.fields as Record<string, string> ?? {}),
        name: lead.name ?? 'there',
        email: lead.email ?? '',
        phone: lead.phone,
      })
    : message

  if (!finalMessage.trim()) {
    return NextResponse.json({ error: 'No message template found for this form. Edit the form template first.' }, { status: 400 })
  }

  await service.from('automation_jobs').insert({
    store_id: lead.store_id, automation_id: null,
    type: 'lead_ad', customer_phone: lead.phone, customer_name: lead.name ?? 'Lead',
    message: finalMessage,
    context: { lead_id: leadId, form_id: lead.form_id, manual: true },
    status: 'pending', scheduled_at: new Date().toISOString(),
  })

  await service.from('leads').update({ wa_status: 'pending' }).eq('id', leadId)

  return NextResponse.json({ ok: true })
}
