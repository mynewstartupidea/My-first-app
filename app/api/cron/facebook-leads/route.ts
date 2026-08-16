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

  // Only sync forms that are explicitly activated — skip the rest
  const { data: activeForms } = await supabase
    .from('lead_form_automations')
    .select('id, user_id, store_id, connection_id, form_id, form_name, message_template, last_lead_fetch')
    .eq('is_enabled', true)

  let synced = 0

  for (const form of activeForms ?? []) {
    const { data: conn } = await supabase
      .from('facebook_connections')
      .select('page_id, page_access_token, user_access_token')
      .eq('id', form.connection_id)
      .maybeSingle()

    if (!conn) continue

    const token = (conn.user_access_token as string | null) ?? conn.page_access_token as string
    const since = form.last_lead_fetch as string | null

    const fbLeads = await getFormLeads(form.form_id as string, token, since)

    for (const fl of fbLeads) {
      const { name, email, phone } = parseLeadFields(fl.field_data ?? [])
      const fields = extractAllFields(fl.field_data ?? [])

      const { data: saved } = await supabase.from('leads').upsert({
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
      }, { onConflict: 'facebook_lead_id', ignoreDuplicates: true }).select('id').single()

      // Create WhatsApp job for new leads with phone numbers
      if (saved && phone && form.store_id && form.message_template) {
        const message = renderTemplate(form.message_template as string, {
          ...fields,
          name: name ?? 'there',
          email: email ?? '',
          phone,
        })
        await supabase.from('automation_jobs').insert({
          store_id:       form.store_id,
          automation_id:  null,
          type:           'lead_ad',
          customer_phone: phone,
          customer_name:  name ?? 'Lead',
          message,
          context:        { lead_id: saved.id, form_id: form.form_id },
          status:         'pending',
          scheduled_at:   new Date().toISOString(),
        }).then(null, () => null)
      }

      synced++
    }

    // Update per-form last_lead_fetch
    await supabase
      .from('lead_form_automations')
      .update({ last_lead_fetch: new Date().toISOString() })
      .eq('id', form.id)
  }

  return NextResponse.json({ synced, timestamp: new Date().toISOString() })
}
