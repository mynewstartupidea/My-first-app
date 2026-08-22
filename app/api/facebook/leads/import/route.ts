import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getFormLeads, parseLeadFields, extractAllFields } from '@/lib/facebook'

// POST /api/facebook/leads/import
// Body: { connectionId, formId, fromDate, toDate }
// Fetches historical leads in date range — no WhatsApp triggered for these
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    connectionId: string
    formId: string
    fromDate: string  // ISO date string e.g. "2025-01-01"
    toDate: string    // ISO date string e.g. "2025-03-31"
  }

  const service = createServiceClient()

  const { data: conn } = await service
    .from('facebook_connections')
    .select('id, store_id, page_id, page_access_token, user_access_token')
    .eq('id', body.connectionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  const { data: auto } = await service
    .from('lead_form_automations')
    .select('form_name')
    .eq('user_id', user.id)
    .eq('form_id', body.formId)
    .maybeSingle()

  const token = (conn.user_access_token as string | null) ?? conn.page_access_token

  // Fetch leads in the date range (paginated, up to 500)
  const fbLeads = await getFormLeads(
    body.formId,
    token,
    `${body.fromDate}T00:00:00.000Z`,
    100,
    `${body.toDate}T23:59:59.999Z`,
    500,
  )

  if (!fbLeads.length) return NextResponse.json({ imported: 0, total: 0 })

  const formName = (auto?.form_name as string | null) ?? body.formId
  const rows = fbLeads.map(fl => {
    const { name, email, phone } = parseLeadFields(fl.field_data ?? [])
    const fields = extractAllFields(fl.field_data ?? [])
    return {
      user_id:          user.id,
      store_id:         conn.store_id,
      facebook_lead_id: fl.id,
      page_id:          conn.page_id,
      form_id:          body.formId,
      form_name:        formName,
      name, email, phone, fields,
      raw_data:   { field_data: fl.field_data },
      wa_status:  'imported',
      created_at: fl.created_time,
    }
  })

  const { data: saved } = await service.from('leads')
    .upsert(rows, { onConflict: 'facebook_lead_id', ignoreDuplicates: true })
    .select('id')

  return NextResponse.json({ imported: saved?.length ?? 0, total: fbLeads.length })
}
