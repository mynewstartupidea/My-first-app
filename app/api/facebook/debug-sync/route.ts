import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getFormLeads, getLeadForms } from '@/lib/facebook'

// GET /api/facebook/debug-sync?page_id=xxx
// Returns diagnostic info about what the sync route would find.
// Remove this file before shipping to production.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('page_id')
  if (!pageId) return NextResponse.json({ error: 'page_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  // Step 1: Connections for this page
  const { data: pageConns } = await service
    .from('facebook_connections')
    .select('id, page_id, page_name, subscribed_to_leadgen, store_id, user_access_token, page_access_token')
    .eq('user_id', user.id)
    .eq('page_id', pageId)

  if (!pageConns?.length) {
    return NextResponse.json({ step: 'connections', result: 'NONE FOUND', pageId })
  }

  const liveConn = pageConns[0]
  const liveToken = (liveConn.user_access_token as string | null) ?? liveConn.page_access_token as string

  // Step 2: All connections for page_id mapping
  const { data: allConns } = await service
    .from('facebook_connections')
    .select('id, page_id')
    .eq('user_id', user.id)

  const connPageMap: Record<string, string> = {}
  for (const c of allConns ?? []) connPageMap[c.id as string] = c.page_id as string

  // Step 3: All form automations
  const { data: allForms, error: formsError } = await service
    .from('lead_form_automations')
    .select('id, form_id, form_name, connection_id, is_enabled, last_lead_fetch, store_id')
    .eq('user_id', user.id)

  const formsForPage = (allForms ?? []).filter(f => connPageMap[f.connection_id as string] === pageId)

  // Step 4: What does Facebook return for each form?
  const fbResults = []
  for (const form of formsForPage.slice(0, 3)) { // limit to 3 to avoid timeout
    const since = form.last_lead_fetch as string | null
    try {
      const leads = await getFormLeads(form.form_id as string, liveToken, since)
      fbResults.push({
        form_id: form.form_id,
        form_name: form.form_name,
        is_enabled: form.is_enabled,
        last_lead_fetch: form.last_lead_fetch,
        since_used: since,
        fb_leads_returned: leads.length,
        newest_lead_date: leads[0]?.created_time ?? null,
        oldest_lead_date: leads[leads.length - 1]?.created_time ?? null,
      })
    } catch (e) {
      fbResults.push({
        form_id: form.form_id,
        form_name: form.form_name,
        error: String(e),
      })
    }
  }

  // Step 5: If no forms in DB, check what Facebook has
  let fbFormsCount = null
  if (!formsForPage.length) {
    try {
      const fbForms = await getLeadForms(pageId, liveConn.page_access_token as string, liveToken)
      fbFormsCount = fbForms.map(f => ({ id: f.id, name: f.name }))
    } catch (e) {
      fbFormsCount = `error: ${e}`
    }
  }

  // Step 6: Count of leads in DB for this page
  const { count: leadsInDb } = await service
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('page_id', pageId)

  const { count: leadsTotal } = await service
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return NextResponse.json({
    pageId,
    connections: pageConns.map(c => ({
      id: c.id,
      page_name: c.page_name,
      subscribed_to_leadgen: c.subscribed_to_leadgen,
      has_user_token: !!c.user_access_token,
      has_page_token: !!c.page_access_token,
      store_id: c.store_id,
    })),
    allConnsCount: allConns?.length,
    formsInDb: {
      total_for_user: allForms?.length ?? 0,
      for_this_page: formsForPage.length,
      forms_error: formsError?.message ?? null,
      forms: formsForPage.map(f => ({
        id: f.id,
        form_name: f.form_name,
        connection_id: f.connection_id,
        connection_maps_to_page: connPageMap[f.connection_id as string],
        is_enabled: f.is_enabled,
        last_lead_fetch: f.last_lead_fetch,
      })),
    },
    fbFormsIfNoneInDb: fbFormsCount,
    facebookLeadsCheck: fbResults,
    leadsInDbForPage: leadsInDb,
    leadsInDbTotal: leadsTotal,
    serverTime: new Date().toISOString(),
  })
}
