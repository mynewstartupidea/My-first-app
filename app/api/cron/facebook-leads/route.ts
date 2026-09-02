import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getFormLeads, parseLeadFields, extractAllFields } from '@/lib/facebook'
import { renderTemplate } from '@/lib/utils'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Sync ALL tracked forms regardless of is_enabled.
  // Lead syncing is independent of WhatsApp automation — a form added to
  // lead_form_automations always gets its leads pulled; WhatsApp jobs are
  // only created when is_enabled = true.
  const { data: forms } = await supabase
    .from('lead_form_automations')
    .select('id, user_id, store_id, connection_id, form_id, form_name, message_template, is_enabled, last_lead_fetch')

  let synced = 0

  for (const form of forms ?? []) {
    const { data: conn } = await supabase
      .from('facebook_connections')
      .select('page_id, page_access_token, user_access_token')
      .eq('id', form.connection_id)
      .maybeSingle()

    if (!conn) continue

    const token = (conn.user_access_token as string | null) ?? conn.page_access_token as string
    const since = form.last_lead_fetch as string | null

    const fbLeads = await getFormLeads(form.form_id as string, token, since)
    if (!fbLeads.length) {
      // Still update last_lead_fetch so next run uses a fresh window
      await supabase
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
      user_id:          form.user_id,
      store_id:         form.store_id,
      facebook_lead_id: fl.id,
      page_id:          conn.page_id,
      form_id:          form.form_id,
      form_name:        form.form_name,
      name, email, phone, fields,
      raw_data:   { field_data: fl.field_data },
      wa_status:  phone ? 'pending' : 'no_phone',
      created_at: fl.created_time,
    }))

    const { data: savedRows } = await supabase.from('leads')
      .upsert(rows, { onConflict: 'facebook_lead_id', ignoreDuplicates: true })
      .select('id, phone, name, fields')

    synced += fbLeads.length

    // Only queue WhatsApp jobs when automation is enabled for this form
    if (form.is_enabled && savedRows?.length && form.message_template) {
      const jobs = savedRows
        .filter(s => s.phone)
        .map(s => {
          const fields = (s.fields as Record<string, string>) ?? {}
          const message = renderTemplate(form.message_template as string, {
            ...fields, name: s.name ?? 'there', email: fields.email ?? '', phone: s.phone,
          })
          return {
            store_id:       form.store_id,
            automation_id:  null,
            type:           'lead_ad',
            customer_phone: s.phone,
            customer_name:  s.name ?? 'Lead',
            message,
            context:        { lead_id: s.id, form_id: form.form_id },
            status:         'pending',
            scheduled_at:   new Date().toISOString(),
          }
        })
      if (jobs.length) await supabase.from('automation_jobs').insert(jobs).then(null, () => null)
    }

    await supabase
      .from('lead_form_automations')
      .update({ last_lead_fetch: new Date().toISOString() })
      .eq('id', form.id)
  }

  return NextResponse.json({ synced, timestamp: new Date().toISOString() })
}
