import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getFormLeads, getLeadForms, parseLeadFields, extractAllFields } from '@/lib/facebook'
import { renderTemplate, extractTemplateParams } from '@/lib/utils'

export const maxDuration = 60

// POST /api/facebook/sync?page_id=xxx
// Fetches new leads from all forms on the given page.
// Handles stale connection_ids (from page reconnects) by resolving forms via page_id.
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('page_id')
  if (!pageId) return NextResponse.json({ error: 'page_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // All connections for this user on this page (handles multiple reconnects)
  const { data: pageConns } = await service
    .from('facebook_connections')
    .select('id, page_id, page_access_token, user_access_token, store_id')
    .eq('user_id', user.id)
    .eq('page_id', pageId)

  if (!pageConns?.length) return NextResponse.json({ synced: 0, newLeads: 0 })

  const liveConn = pageConns[0]
  const liveConnId = liveConn.id as string
  const liveToken = (liveConn.user_access_token as string | null) ?? liveConn.page_access_token as string

  // All connection IDs that currently exist for this user — used to map connection_id → page_id
  const { data: allConns } = await service
    .from('facebook_connections')
    .select('id, page_id')
    .eq('user_id', user.id)

  const connPageMap: Record<string, string> = {}
  for (const c of allConns ?? []) connPageMap[c.id as string] = c.page_id as string

  // All form automations for this user
  const { data: allForms } = await service
    .from('lead_form_automations')
    .select('id, form_id, form_name, connection_id, message_template, is_enabled, last_lead_fetch, store_id, wa_template_name, wa_template_language')
    .eq('user_id', user.id)

  // Filter to forms on this page — works even with stale connection_ids
  let forms = (allForms ?? []).filter(f => connPageMap[f.connection_id as string] === pageId)

  // Heal stale connection_ids: update any form still pointing at an old connection
  const stale = forms.filter(f => f.connection_id !== liveConnId)
  if (stale.length) {
    await service
      .from('lead_form_automations')
      .update({ connection_id: liveConnId })
      .in('id', stale.map(f => f.id))
  }

  // If no forms found at all, fetch from Facebook and register them now
  if (!forms.length) {
    const fbForms = await getLeadForms(pageId, liveConn.page_access_token as string, liveToken)
    if (fbForms.length) {
      // Find which form_ids are already tracked (avoids relying on a unique constraint)
      const { data: existingForms } = await service
        .from('lead_form_automations')
        .select('form_id')
        .eq('user_id', user.id)
      const existingIds = new Set((existingForms ?? []).map(f => f.form_id as string))

      const newRows = fbForms
        .filter(f => !existingIds.has(f.id))
        .map(f => ({
          user_id:          user.id,
          store_id:         liveConn.store_id ?? null,
          connection_id:    liveConnId,
          form_id:          f.id,
          form_name:        f.name,
          message_template: '',
          is_enabled:       false,
          updated_at:       new Date().toISOString(),
        }))

      if (newRows.length) {
        await service.from('lead_form_automations').insert(newRows)
      }

      // Re-fetch all forms for this page (including any that already existed)
      const { data: allAfterInsert } = await service
        .from('lead_form_automations')
        .select('id, form_id, form_name, connection_id, message_template, is_enabled, last_lead_fetch, store_id, wa_template_name, wa_template_language')
        .eq('user_id', user.id)

      forms = (allAfterInsert ?? []).filter(f => connPageMap[f.connection_id as string] === pageId)
    }
  }

  if (!forms.length) return NextResponse.json({ synced: 0, newLeads: 0 })

  let synced   = 0
  let newLeads = 0

  for (const form of forms) {
    const since = form.last_lead_fetch as string | null

    const fbLeads = await getFormLeads(form.form_id as string, liveToken, since)
    if (!fbLeads.length) {
      await service
        .from('lead_form_automations')
        .update({ last_lead_fetch: new Date().toISOString() })
        .eq('id', form.id)
      continue
    }

    const parsed = fbLeads.map(fl => {
      const { name, email, phone } = parseLeadFields(fl.field_data ?? [])
      const fields = extractAllFields(fl.field_data ?? [])
      return { fl, name, email, phone, fields }
    })

    const rows = parsed.map(({ fl, name, email, phone, fields }) => ({
      user_id:          user.id,
      store_id:         form.store_id,
      facebook_lead_id: fl.id,
      page_id:          pageId,
      form_id:          form.form_id,
      form_name:        form.form_name,
      name, email, phone, fields,
      raw_data:   { field_data: fl.field_data },
      wa_status:  phone ? 'pending' : 'no_phone',
      created_at: fl.created_time,
    }))

    const { data: saved } = await service.from('leads')
      .upsert(rows, { onConflict: 'facebook_lead_id', ignoreDuplicates: true })
      .select('id, phone, name, form_id, fields')

    synced += fbLeads.length

    // Only queue WhatsApp jobs when automation is enabled for this form
    if (form.is_enabled && saved?.length && form.message_template) {
      const waTemplateName = (form.wa_template_name as string | null) || null
      const waTemplateLang = (form.wa_template_language as string | null) || 'en'
      const jobs = saved
        .filter(s => s.phone)
        .map(s => {
          const fields = (s.fields as Record<string, string>) ?? {}
          const vars = { ...fields, name: s.name ?? 'there', email: fields.email ?? '', phone: s.phone as string }
          const message = renderTemplate(form.message_template as string, vars)
          const waParams = waTemplateName ? extractTemplateParams(form.message_template as string, vars) : undefined
          return {
            store_id:       form.store_id,
            automation_id:  null,
            type:           'lead_ad',
            customer_phone: s.phone,
            customer_name:  s.name ?? 'Lead',
            message,
            context: {
              lead_id: s.id, form_id: form.form_id, source: 'manual_sync',
              ...(waTemplateName ? { wa_template_name: waTemplateName, wa_template_language: waTemplateLang, wa_template_params: waParams } : {}),
            },
            status:         'pending',
            scheduled_at:   new Date().toISOString(),
          }
        })
      if (jobs.length) {
        await service.from('automation_jobs').insert(jobs).then(null, () => null)
        newLeads += jobs.length
      }
    }

    await service
      .from('lead_form_automations')
      .update({ last_lead_fetch: new Date().toISOString() })
      .eq('id', form.id)
  }

  return NextResponse.json({ synced, newLeads })
}
