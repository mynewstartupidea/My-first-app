import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('page_id')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Get connection IDs for the requested page (if filtering by page)
  let connectionIds: string[] | null = null
  if (pageId) {
    const { data: conns } = await service
      .from('facebook_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('page_id', pageId)
    connectionIds = (conns ?? []).map(c => c.id as string)
    if (connectionIds.length === 0) return NextResponse.json({ forms: [] })
  }

  const buildQuery = (withNewCols: boolean) => {
    const cols = withNewCols
      ? 'id, form_id, form_name, connection_id, message_template, is_enabled, color_index, last_lead_fetch'
      : 'id, form_id, form_name, connection_id, message_template, is_enabled'
    let q = service
      .from('lead_form_automations')
      .select(cols)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (connectionIds !== null) q = q.in('connection_id', connectionIds)
    return q
  }

  // Try with new columns first; fall back if the SQL migration hasn't been run yet
  let result = await buildQuery(true)
  if (result.error) {
    console.warn('[active-forms] new columns not found, using fallback query:', result.error.message)
    result = await buildQuery(false)
  }

  const automations = result.data
  if (!automations?.length) return NextResponse.json({ forms: [] })

  // Get page_id for each automation's connection
  const connIds = [...new Set(automations.map(a => a.connection_id as string))]
  const { data: connections } = await service
    .from('facebook_connections')
    .select('id, page_id')
    .in('id', connIds)

  const connPageMap: Record<string, string> = {}
  for (const c of connections ?? []) {
    connPageMap[c.id as string] = c.page_id as string
  }

  // Lead count per form
  const formIds = automations.map(a => a.form_id as string)
  const counts = await Promise.all(
    formIds.map(async fid => {
      const { count } = await service
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('form_id', fid)
      return { formId: fid, count: count ?? 0 }
    })
  )
  const countMap: Record<string, number> = {}
  for (const { formId, count } of counts) countMap[formId] = count

  const forms = automations.map((a, i) => ({
    id:               a.id,
    form_id:          a.form_id,
    form_name:        a.form_name,
    connection_id:    a.connection_id,
    page_id:          connPageMap[a.connection_id as string] ?? null,
    message_template: a.message_template,
    is_enabled:       a.is_enabled,
    // Use DB value if available, else fall back to position in list
    color_index:      (a as any).color_index ?? i,
    last_lead_fetch:  (a as any).last_lead_fetch ?? null,
    lead_count:       countMap[a.form_id as string] ?? 0,
  }))

  return NextResponse.json({ forms })
}
