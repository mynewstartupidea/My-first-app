import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('page_id')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Fetch all connections for this user up-front (used for page_id mapping)
  const { data: allConns } = await service
    .from('facebook_connections')
    .select('id, page_id')
    .eq('user_id', user.id)

  const connPageMap: Record<string, string> = {}
  for (const c of allConns ?? []) connPageMap[c.id as string] = c.page_id as string

  // Build reverse map: page_id → connection_id (to find the live token later)
  const pageConnMap: Record<string, string> = {}
  for (const c of allConns ?? []) pageConnMap[c.page_id as string] = c.id as string

  // Get ALL automations for this user — no connection_id filter here.
  // We filter by page_id in application code so stale connection_ids
  // (after a page reconnect) don't silently hide activated forms.
  type AutoRow = {
    id: string; form_id: string; form_name: string; connection_id: string
    message_template: string; is_enabled: boolean
    color_index?: number; last_lead_fetch?: string | null
  }

  const runQuery = async (includeMigrationCols: boolean) => {
    const q = service
      .from('lead_form_automations')
      .select('id, form_id, form_name, connection_id, message_template, is_enabled' +
        (includeMigrationCols ? ', color_index, last_lead_fetch' : ''))
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return q as unknown as Promise<{ data: AutoRow[] | null; error: any }>
  }

  let { data: automations, error } = await runQuery(true)
  if (error) {
    console.warn('[active-forms] new columns missing, using fallback:', error.message)
    ;({ data: automations } = await runQuery(false))
  }

  if (!automations?.length) return NextResponse.json({ forms: [] })

  // Filter by page_id in application code.
  // If the automation's connection_id is stale (reconnected page), fall back to
  // the live connection for that page so the form still appears.
  let filtered = automations.map(a => {
    const resolvedPageId = connPageMap[a.connection_id]
      ?? null  // stale connection — we'll still try to match below

    // If this automation's connection was re-created, point it at the live connection
    const liveConnectionId = resolvedPageId
      ? a.connection_id
      : (pageConnMap[connPageMap[a.connection_id] ?? ''] ?? a.connection_id)

    return { ...a, _resolvedPageId: resolvedPageId, _liveConnectionId: liveConnectionId }
  })

  if (pageId) {
    filtered = filtered.filter(a => {
      // Match on the resolved page_id; also accept stale connections by checking
      // if ANY current connection maps to this page
      if (a._resolvedPageId === pageId) return true
      // Stale: connection gone, but a live connection exists for this page
      const liveConn = pageConnMap[pageId]
      return liveConn !== undefined && a._liveConnectionId === liveConn
    })
  }

  if (!filtered.length) return NextResponse.json({ forms: [] })

  // Lead count per form
  const counts = await Promise.all(
    filtered.map(async a => {
      const { count } = await service
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('form_id', a.form_id)
      return { formId: a.form_id, count: count ?? 0 }
    })
  )
  const countMap: Record<string, number> = {}
  for (const { formId, count } of counts) countMap[formId] = count

  const forms = filtered.map((a, i) => ({
    id:               a.id,
    form_id:          a.form_id,
    form_name:        a.form_name,
    connection_id:    a._liveConnectionId,
    page_id:          a._resolvedPageId ?? pageId ?? null,
    message_template: a.message_template,
    is_enabled:       a.is_enabled,
    color_index:      a.color_index ?? i,
    last_lead_fetch:  a.last_lead_fetch ?? null,
    lead_count:       countMap[a.form_id] ?? 0,
  }))

  return NextResponse.json({ forms })
}
