import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getFBLead, parseLeadFields, extractAllFields } from '@/lib/facebook'
import { renderTemplate, extractTemplateParams } from '@/lib/utils'

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

  const rawBody = await request.text()

  // Verify Facebook webhook signature (x-hub-signature-256)
  const appSecret = process.env.META_APP_SECRET
  if (appSecret) {
    const signature = request.headers.get('x-hub-signature-256') ?? ''
    const expected  = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
    if (signature !== expected) {
      return new Response('Forbidden', { status: 403 })
    }
  }

  const body = JSON.parse(rawBody) as LeadEvent
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

      // Look up form_name from lead_form_automations
      const { data: formAuto } = await supabase
        .from('lead_form_automations')
        .select('form_name')
        .eq('form_id', formId)
        .eq('store_id', conn.store_id)
        .maybeSingle()

      // Save lead as 'imported' — only upgrade to 'pending' when a job is actually queued
      const { data: saved, error: saveErr } = await supabase.from('leads').upsert({
        user_id:          conn.user_id,
        store_id:         conn.store_id,
        facebook_lead_id: leadId,
        page_id:          pageId,
        form_id:          formId,
        form_name:        formAuto?.form_name ?? null,
        name,
        email,
        phone,
        fields,
        raw_data:  { field_data: fbLead.field_data },
        wa_status: phone ? 'imported' : 'no_phone',
      }, { onConflict: 'facebook_lead_id' }).select('id').single()

      if (saveErr) { console.error('[FB webhook] save lead error:', saveErr); continue }
      if (!phone || !conn.store_id || !saved) continue

      // Check automation is enabled for this form
      const { data: auto } = await supabase
        .from('lead_form_automations')
        .select('message_template, wa_template_name, wa_template_language')
        .eq('form_id', formId)
        .eq('store_id', conn.store_id)
        .eq('is_enabled', true)
        .maybeSingle()

      if (!auto) continue

      // Only queue if WhatsApp is connected
      const { data: wa } = await supabase
        .from('whatsapp_accounts')
        .select('id')
        .eq('user_id', conn.user_id)
        .eq('status', 'connected')
        .maybeSingle()

      if (!wa) {
        console.log(`[FB webhook] WhatsApp not connected for user ${conn.user_id} — lead saved as imported`)
        continue
      }

      const vars = { ...fields, name: name ?? 'there', email: email ?? '', phone: phone ?? '' }
      const message = renderTemplate(auto.message_template, vars)
      const waTemplateName = (auto.wa_template_name as string | null) || null
      const waTemplateLang = (auto.wa_template_language as string | null) || 'en'
      const waParams = waTemplateName ? extractTemplateParams(auto.message_template, vars) : undefined

      await supabase.from('automation_jobs').insert({
        store_id:       conn.store_id,
        automation_id:  null,
        type:           'lead_ad',
        customer_phone: phone,
        customer_name:  name ?? 'Lead',
        message,
        context: {
          lead_id: saved.id, facebook_lead_id: leadId, form_id: formId,
          ...(waTemplateName ? { wa_template_name: waTemplateName, wa_template_language: waTemplateLang, wa_template_params: waParams } : {}),
        },
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
