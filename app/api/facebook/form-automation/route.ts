import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getFormLeads, parseLeadFields, extractAllFields } from '@/lib/facebook'

export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    connectionId: string
    formId: string
    formName: string
    messageTemplate: string
    isEnabled: boolean
    waTemplateName?: string
    waTemplateLanguage?: string
  }

  const service = createServiceClient()

  const { data: conn } = await service
    .from('facebook_connections')
    .select('id, store_id, page_id, page_access_token, user_access_token')
    .eq('id', body.connectionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!conn?.store_id) return NextResponse.json({ error: 'Connection not found or no store linked' }, { status: 404 })

  // Check if this is a brand-new activation or an update
  const { data: existing } = await service
    .from('lead_form_automations')
    .select('id, color_index')
    .eq('user_id', user.id)
    .eq('form_id', body.formId)
    .maybeSingle()

  const isNew = !existing

  // Assign next color for new activations (cycles through 8 colors)
  let colorIndex = (existing?.color_index as number | null) ?? 0
  if (isNew) {
    const { count } = await service
      .from('lead_form_automations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    colorIndex = (count ?? 0) % 8
  }

  // Try upsert with new columns; fall back without them if SQL migration hasn't run yet
  const baseRow = {
    user_id:              user.id,
    store_id:             conn.store_id,
    connection_id:        body.connectionId,
    form_id:              body.formId,
    form_name:            body.formName,
    message_template:     body.messageTemplate,
    is_enabled:           body.isEnabled,
    wa_template_name:     body.waTemplateName ?? null,
    wa_template_language: body.waTemplateLanguage ?? 'en',
    updated_at:           new Date().toISOString(),
  }
  const { error: upsertErr } = await service.from('lead_form_automations').upsert(
    { ...baseRow, color_index: colorIndex },
    { onConflict: 'store_id,form_id' }
  )
  if (upsertErr) {
    // color_index column probably doesn't exist yet — retry without it
    await service.from('lead_form_automations').upsert(baseRow, { onConflict: 'store_id,form_id' })
  }

  // On first activation: import historical leads as 'imported' only — no WhatsApp jobs.
  // Users must explicitly trigger a campaign to reach historical leads.
  // Only leads arriving AFTER activation get WhatsApp messages automatically.
  let leadsFetched = 0
  if (isNew && body.isEnabled) {
    const token = (conn.user_access_token as string | null) ?? conn.page_access_token
    const fbLeads = await getFormLeads(body.formId, token, null, 100, null, 500)

    if (fbLeads.length > 0) {
      const rows = fbLeads.map(fl => {
        const { name, email, phone } = parseLeadFields(fl.field_data ?? [])
        const fields = extractAllFields(fl.field_data ?? [])
        return {
          user_id:          user.id,
          store_id:         conn.store_id,
          facebook_lead_id: fl.id,
          page_id:          conn.page_id,
          form_id:          body.formId,
          form_name:        body.formName,
          name, email, phone, fields,
          raw_data:   { field_data: fl.field_data },
          wa_status:  phone ? 'imported' : 'no_phone',
          created_at: fl.created_time,
        }
      })

      const { data: upserted } = await service
        .from('leads')
        .upsert(rows, { onConflict: 'facebook_lead_id', ignoreDuplicates: true })
        .select('id')

      leadsFetched = upserted?.length ?? 0
    }

    // Set last_lead_fetch = now so the cron/sync only picks up leads arriving after activation
    await service.from('lead_form_automations')
      .update({ last_lead_fetch: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('form_id', body.formId)
      .then(null, () => null)
  }

  return NextResponse.json({ ok: true, colorIndex, leadsFetched, leadsQueued: 0, isNew })
}
