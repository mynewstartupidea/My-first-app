import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getFormLeads, parseLeadFields, extractAllFields } from '@/lib/facebook'
import { renderTemplate } from '@/lib/utils'

// POST /api/facebook/sync?page_id=xxx
// Fetches new leads from Facebook for all active forms on the given page
// (same logic as the cron, but user-scoped and triggered on demand)
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('page_id')
  if (!pageId) return NextResponse.json({ error: 'page_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Get all connections for this user on this page
  const { data: conns } = await service
    .from('facebook_connections')
    .select('id, page_id, page_access_token, user_access_token')
    .eq('user_id', user.id)
    .eq('page_id', pageId)

  if (!conns?.length) return NextResponse.json({ synced: 0, newLeads: 0 })

  const connIds = conns.map(c => c.id as string)
  const connMap: Record<string, typeof conns[0]> = {}
  for (const c of conns) connMap[c.id as string] = c

  // Get active forms for this page (match by connection id)
  const { data: activeForms } = await service
    .from('lead_form_automations')
    .select('id, form_id, form_name, connection_id, message_template, is_enabled, last_lead_fetch, store_id')
    .eq('user_id', user.id)
    .eq('is_enabled', true)
    .in('connection_id', connIds)

  if (!activeForms?.length) return NextResponse.json({ synced: 0, newLeads: 0 })

  let synced   = 0
  let newLeads = 0

  for (const form of activeForms) {
    const conn = connMap[form.connection_id as string]
    if (!conn) continue

    const token = (conn.user_access_token as string | null) ?? conn.page_access_token as string
    const since = form.last_lead_fetch as string | null

    const fbLeads = await getFormLeads(form.form_id as string, token, since)
    if (!fbLeads.length) continue

    for (const fl of fbLeads) {
      const { name, email, phone } = parseLeadFields(fl.field_data ?? [])
      const fields = extractAllFields(fl.field_data ?? [])

      const { data: saved, error: upsertErr } = await service.from('leads').upsert({
        user_id:          user.id,
        store_id:         form.store_id,
        facebook_lead_id: fl.id,
        page_id:          conn.page_id,
        form_id:          form.form_id,
        form_name:        form.form_name,
        name, email, phone, fields,
        raw_data:  { field_data: fl.field_data },
        wa_status: phone ? 'pending' : 'no_phone',
        created_at: fl.created_time,
      }, { onConflict: 'facebook_lead_id', ignoreDuplicates: true }).select('id').maybeSingle()

      if (!upsertErr && saved && phone && form.store_id && form.message_template) {
        const message = renderTemplate(form.message_template as string, {
          ...fields, name: name ?? 'there', email: email ?? '', phone,
        })
        await service.from('automation_jobs').insert({
          store_id:       form.store_id,
          automation_id:  null,
          type:           'lead_ad',
          customer_phone: phone,
          customer_name:  name ?? 'Lead',
          message,
          context:        { lead_id: saved.id, form_id: form.form_id, source: 'manual_sync' },
          status:         'pending',
          scheduled_at:   new Date().toISOString(),
        }).then(null, () => null)
      }

      if (saved) newLeads++
      synced++
    }

    await service
      .from('lead_form_automations')
      .update({ last_lead_fetch: new Date().toISOString() })
      .eq('id', form.id)
  }

  return NextResponse.json({ synced, newLeads })
}
