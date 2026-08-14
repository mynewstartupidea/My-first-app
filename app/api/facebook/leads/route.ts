import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLeadForms, getFormLeads, parseLeadFields } from '@/lib/facebook'
import { renderTemplate } from '@/lib/utils'

// GET /api/facebook/leads?sync=1  — optionally sync from Facebook first
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sync    = new URL(request.url).searchParams.get('sync') === '1'
  const service = createServiceClient()

  if (sync) {
    const { data: connections } = await service
      .from('facebook_connections')
      .select('*')
      .eq('user_id', user.id)

    for (const conn of connections ?? []) {
      const forms = await getLeadForms(conn.page_id, conn.page_access_token)

      for (const form of forms) {
        const fbLeads = await getFormLeads(form.id, conn.page_access_token, conn.last_lead_fetch)

        for (const fl of fbLeads) {
          const { name, email, phone } = parseLeadFields(fl.field_data ?? [])

          const { data: saved } = await service.from('leads').upsert({
            user_id:          user.id,
            store_id:         conn.store_id,
            facebook_lead_id: fl.id,
            page_id:          conn.page_id,
            form_id:          form.id,
            form_name:        form.name,
            name, email, phone,
            raw_data:  { field_data: fl.field_data },
            wa_status: phone ? 'pending' : 'no_phone',
            created_at: fl.created_time,
          }, { onConflict: 'facebook_lead_id', ignoreDuplicates: true }).select('id').single()

          // Auto-send WhatsApp if automation exists and lead has phone
          if (saved && phone && conn.store_id) {
            const { data: auto } = await service
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
              await service.from('automation_jobs').insert({
                store_id: conn.store_id, automation_id: null,
                type: 'lead_ad', customer_phone: phone, customer_name: name ?? 'Lead',
                message, context: { lead_id: saved.id, form_id: form.id },
                status: 'pending', scheduled_at: new Date().toISOString(),
              }).then(null, () => null) // ignore duplicate key if job already exists
            }
          }
        }
      }

      await service.from('facebook_connections')
        .update({ last_lead_fetch: new Date().toISOString() })
        .eq('id', conn.id)
    }
  }

  const { data: leads } = await service
    .from('leads')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  return NextResponse.json({ leads: leads ?? [] })
}

// POST /api/facebook/leads  — manually send WhatsApp to a specific lead
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

  await service.from('automation_jobs').insert({
    store_id: lead.store_id, automation_id: null,
    type: 'lead_ad', customer_phone: lead.phone, customer_name: lead.name ?? 'Lead',
    message, context: { lead_id: leadId, form_id: lead.form_id, manual: true },
    status: 'pending', scheduled_at: new Date().toISOString(),
  })

  await service.from('leads').update({ wa_status: 'pending' }).eq('id', leadId)

  return NextResponse.json({ ok: true })
}
