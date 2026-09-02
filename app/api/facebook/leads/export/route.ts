import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getFormLeads, parseLeadFields, extractAllFields } from '@/lib/facebook'

// GET /api/facebook/leads/export?connection_id=xxx&form_id=xxx&from_date=xxx&to_date=xxx
// Fetches leads from Facebook for the given range and returns them as JSON for CSV export.
// Does NOT save to DB.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const connectionId = searchParams.get('connection_id')
  const formId       = searchParams.get('form_id')
  const fromDate     = searchParams.get('from_date')
  const toDate       = searchParams.get('to_date')

  if (!connectionId || !formId) {
    return NextResponse.json({ error: 'connection_id and form_id required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const { data: conn } = await service
    .from('facebook_connections')
    .select('page_access_token, user_access_token')
    .eq('id', connectionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  const token = (conn.user_access_token as string | null) ?? conn.page_access_token as string

  const fbLeads = await getFormLeads(
    formId,
    token,
    fromDate ? `${fromDate}T00:00:00.000Z` : undefined,
    100,
    toDate   ? `${toDate}T23:59:59.999Z`   : undefined,
    2000,
  )

  const leads = fbLeads.map(fl => {
    const { name, email, phone } = parseLeadFields(fl.field_data ?? [])
    const extra = extractAllFields(fl.field_data ?? [])
    return { name, email, phone, date: fl.created_time, ...extra }
  })

  return NextResponse.json({ leads, total: leads.length })
}
