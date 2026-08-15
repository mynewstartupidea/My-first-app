import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getLeadForms, getFormLeads, parseLeadFields } from '@/lib/facebook'
import { renderTemplate } from '@/lib/utils'

export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: connections } = await supabase
    .from('facebook_connections')
    .select('*')

  let synced = 0

  for (const conn of connections ?? []) {
    const forms = await getLeadForms(conn.page_id, conn.page_access_token)

    for (const form of forms) {
      const fbLeads = await getFormLeads(form.id, conn.page_access_token, conn.last_lead_fetch)

      for (const fl of fbLeads) {
        const { name, email, phone } = parseLeadFields(fl.field_data ?? [])

        const { data: saved } = await supabase.from('leads').upsert({
          user_id:          conn.user_id,
          store_id:         conn.store_id,
          facebook_lead_id: fl.id,
          page_id:          conn.page_id,
          form_id:          form.id,
          name, email, phone,
          raw_data:   { field_data: fl.field_data },
          wa_status:  phone ? 'pending' : 'no_phone',
          created_at: fl.created_time,
        }, { onConflict: 'facebook_lead_id', ignoreDuplicates: true }).select('id').single()

        if (saved && phone && conn.store_id) {
          const { data: auto } = await supabase
            .from('lead_form_automations')
            .select('*')
            .eq('form_id', form.id)
            .eq('store_id', conn.store_id)
            .eq('is_enabled', true)
            .maybeSingle()

          if (auto) {
            const message = renderTemplate(auto.message_template, {
              name: name ?? 'there', email: email ?? '', phone,
            })
            await supabase.from('automation_jobs').insert({
              store_id:       conn.store_id,
              automation_id:  null,
              type:           'lead_ad',
              customer_phone: phone,
              customer_name:  name ?? 'Lead',
              message,
              context:        { lead_id: saved.id, form_id: form.id },
              status:         'pending',
              scheduled_at:   new Date().toISOString(),
            }).then(null, () => null)
          }
        }

        synced++
      }
    }

    await supabase
      .from('facebook_connections')
      .update({ last_lead_fetch: new Date().toISOString() })
      .eq('id', conn.id)
  }

  return NextResponse.json({ synced, timestamp: new Date().toISOString() })
}
