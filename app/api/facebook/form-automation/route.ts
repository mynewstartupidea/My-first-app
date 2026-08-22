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
    user_id:          user.id,
    store_id:         conn.store_id,
    connection_id:    body.connectionId,
    form_id:          body.formId,
    form_name:        body.formName,
    message_template: body.messageTemplate,
    is_enabled:       body.isEnabled,
    updated_at:       new Date().toISOString(),
  }
  const { error: upsertErr } = await service.from('lead_form_automations').upsert(
    { ...baseRow, color_index: colorIndex },
    { onConflict: 'store_id,form_id' }
  )
  if (upsertErr) {
    // color_index column probably doesn't exist yet — retry without it
    await service.from('lead_form_automations').upsert(baseRow, { onConflict: 'store_id,form_id' })
  }

  // On first activation: fetch last 50 leads immediately (historical — no WhatsApp)
  let leadsFetched = 0
  if (isNew && body.isEnabled) {
    const token = (conn.user_access_token as string | null) ?? conn.page_access_token
    // Fetch up to 500 historical leads (paginated, 100/page) on first activation
    const fbLeads = await getFormLeads(body.formId, token, null, 100, null, 500)

    for (const fl of fbLeads) {
      const { name, email, phone } = parseLeadFields(fl.field_data ?? [])
      const fields = extractAllFields(fl.field_data ?? [])

      await service.from('leads').upsert({
        user_id:          user.id,
        store_id:         conn.store_id,
        facebook_lead_id: fl.id,
        page_id:          conn.page_id,
        form_id:          body.formId,
        form_name:        body.formName,
        name, email, phone, fields,
        raw_data:   { field_data: fl.field_data },
        wa_status:  'imported',
        created_at: fl.created_time,
      }, { onConflict: 'facebook_lead_id', ignoreDuplicates: true })

      leadsFetched++
    }

    // Set last_lead_fetch = now so the cron only picks up leads after this point
    // (ignore error if column doesn't exist yet)
    await service.from('lead_form_automations')
      .update({ last_lead_fetch: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('form_id', body.formId)
      .then(null, () => null)
  }

  return NextResponse.json({ ok: true, colorIndex, leadsFetched, isNew })
}
