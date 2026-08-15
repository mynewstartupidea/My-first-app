import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getFBLead, parseLeadFields, extractAllFields } from '@/lib/facebook'
import { renderTemplate } from '@/lib/utils'

// Facebook webhook verification
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN && challenge) {
    console.log('[Facebook webhook] verified')
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

// Real-time lead events
export async function POST(request: Request) {
  type LeadEvent = {
    object?: string
    entry?: {
      id: string
      changes: {
        field: string
        value: { leadgen_id: string; page_id: string; form_id: string; adgroup_id?: string }
      }[]
    }[]
  }

  const body = await request.json() as LeadEvent
  if (body.object !== 'page') return NextResponse.json({ ok: true })

  const supabase = createServiceClient()

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'leadgen') continue

      const { leadgen_id: leadId, page_id: pageId, form_id: formId } = change.value

      const { data: conn } = await supabase
        .from('facebook_connections')
        .select('id, page_access_token, user_id, store_id')
        .eq('page_id', pageId)
        .maybeSingle()

      if (!conn) { console.log(`[FB webhook] no connection for page ${pageId}`); continue }

      const fbLead = await getFBLead(leadId, conn.page_access_token)
      if (!fbLead) continue

      const { name, email, phone } = parseLeadFields(fbLead.field_data ?? [])
      const fields = extractAllFields(fbLead.field_data ?? [])

      const { data: saved, error: saveErr } = await supabase.from('leads').upsert({
        user_id:          conn.user_id,
        store_id:         conn.store_id,
        facebook_lead_id: leadId,
        page_id:          pageId,
        form_id:          formId,
        name,
        email,
        phone,
        fields,
        raw_data:  { field_data: fbLead.field_data },
        wa_status: phone ? 'pending' : 'no_phone',
      }, { onConflict: 'facebook_lead_id' }).select('id').single()

      if (saveErr) { console.error('[FB webhook] save lead error:', saveErr); continue }
      if (!phone || !conn.store_id || !saved) continue

      // Check for lead form automation
      const { data: auto } = await supabase
        .from('lead_form_automations')
        .select('*')
        .eq('form_id', formId)
        .eq('store_id', conn.store_id)
        .eq('is_enabled', true)
        .maybeSingle()

      if (!auto) continue

      const message = renderTemplate(auto.message_template, {
        ...fields,
        name:  name ?? 'there',
        email: email ?? '',
        phone: phone ?? '',
      })

      await supabase.from('automation_jobs').insert({
        store_id:       conn.store_id,
        automation_id:  null,
        type:           'lead_ad',
        customer_phone: phone,
        customer_name:  name ?? 'Lead',
        message,
        context:        { lead_id: saved.id, facebook_lead_id: leadId, form_id: formId },
        status:         'pending',
        scheduled_at:   new Date().toISOString(),
      })

      // Mark lead as queued
      await supabase.from('leads').update({ wa_status: 'pending' }).eq('id', saved.id)

      console.log(`[FB webhook] lead ${leadId} queued for WhatsApp → ${phone}`)
    }
  }

  return NextResponse.json({ ok: true })
}
