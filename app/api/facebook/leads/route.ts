import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { renderTemplate } from '@/lib/utils'

// GET /api/facebook/leads?form_id=xxx&page_id=xxx&limit=50&offset=0
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const formId = searchParams.get('form_id')
  const pageId = searchParams.get('page_id')
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const buildQuery = (countOnly = false) => {
    let q = service
      .from('leads')
      .select('id,name,email,phone,form_id,form_name,page_id,wa_status,created_at,fields', countOnly ? { count: 'exact', head: true } : { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (formId) q = q.eq('form_id', formId)
    else if (pageId) q = q.eq('page_id', pageId)
    return q
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
