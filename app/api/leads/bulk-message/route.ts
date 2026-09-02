import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { renderTemplate, extractTemplateParams } from '@/lib/utils'

export const maxDuration = 60

// GET — count leads matching filters (for preview)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const formId   = searchParams.get('form_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo   = searchParams.get('date_to')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  let q = service
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('phone', 'is', null)
    .in('wa_status', ['imported', 'failed'])

  if (formId)   q = q.eq('form_id', formId)
  if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00Z`)
  if (dateTo)   q = q.lte('created_at', `${dateTo}T23:59:59Z`)

  const { count } = await q
  return NextResponse.json({ count: count ?? 0 })
}

// POST — create automation_jobs for matching leads
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    form_id?: string | null
    date_from?: string | null
    date_to?: string | null
    template_name: string
    template_language?: string
    message: string
    campaign_id?: string | null
  }

  const { form_id, date_from, date_to, template_name, template_language = 'en', message, campaign_id } = body

  if (!message?.trim())       return NextResponse.json({ error: 'message required' }, { status: 400 })
  if (!template_name?.trim()) return NextResponse.json({ error: 'template_name required' }, { status: 400 })

  const service = createServiceClient()

  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'connected')
    .maybeSingle()

  if (!wa) return NextResponse.json({ error: 'WhatsApp not connected. Connect in Settings first.' }, { status: 400 })

  const { data: store } = await service
    .from('stores')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  let leadsQ = service
    .from('leads')
    .select('id, name, phone, fields, form_id')
    .eq('user_id', user.id)
    .not('phone', 'is', null)
    .in('wa_status', ['imported', 'failed'])

  if (form_id)   leadsQ = leadsQ.eq('form_id', form_id)
  if (date_from) leadsQ = leadsQ.gte('created_at', `${date_from}T00:00:00Z`)
  if (date_to)   leadsQ = leadsQ.lte('created_at', `${date_to}T23:59:59Z`)

  const { data: leads } = await leadsQ.limit(5000)
  if (!leads?.length) return NextResponse.json({ queued: 0 })

  const jobs = leads.map(lead => {
    const fields = (lead.fields as Record<string, string>) ?? {}
    const vars = { ...fields, name: lead.name ?? 'there', phone: lead.phone as string }
    const rendered = renderTemplate(message, vars)
    const waParams = extractTemplateParams(message, vars)
    return {
      store_id:       store?.id ?? null,
      automation_id:  null,
      type:           'lead_ad',
      customer_phone: lead.phone,
      customer_name:  lead.name ?? 'Lead',
      message:        rendered,
      context: {
        lead_id:              lead.id,
        form_id:              lead.form_id,
        source:               campaign_id ? 'lead_campaign' : 'bulk_message',
        wa_template_name:     template_name,
        wa_template_language: template_language,
        wa_template_params:   waParams,
        ...(campaign_id ? { lead_campaign_id: campaign_id } : {}),
      },
      status:       'pending',
      scheduled_at: new Date().toISOString(),
    }
  })

  // Batch inserts to avoid payload limits
  for (let i = 0; i < jobs.length; i += 500) {
    await service.from('automation_jobs').insert(jobs.slice(i, i + 500)).then(null, () => null)
  }

  // Mark matched leads as pending
  const ids = leads.map(l => l.id)
  for (let i = 0; i < ids.length; i += 500) {
    await service.from('leads').update({ wa_status: 'pending' }).in('id', ids.slice(i, i + 500))
  }

  // Update campaign record if triggered from a campaign
  if (campaign_id) {
    await service
      .from('lead_campaigns')
      .update({
        status:      'completed',
        total_leads: leads.length,
        sent_count:  leads.length,
        sent_at:     new Date().toISOString(),
      })
      .eq('id', campaign_id)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ queued: leads.length })
}
