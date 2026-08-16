import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLeadForms } from '@/lib/facebook'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('page_id')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: connections } = await service
    .from('facebook_connections')
    .select('id, page_id, page_name, store_id, subscribed_to_leadgen, page_access_token, user_access_token')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  // With page_id: return forms for that page (called from "Activate a form" modal)
  if (pageId) {
    const conn = (connections ?? []).find(c => c.page_id === pageId)
    if (!conn) return NextResponse.json({ forms: [], connectionId: null })
    const forms = await getLeadForms(conn.page_id as string, conn.page_access_token as string, conn.user_access_token as string | null)
    return NextResponse.json({ forms, connectionId: conn.id })
  }

  // Without page_id: return just the page list (fast, no Facebook API calls)
  const pages = (connections ?? []).map(conn => ({
    id:                    conn.id,
    page_id:               conn.page_id,
    page_name:             conn.page_name,
    store_id:              conn.store_id,
    subscribed_to_leadgen: conn.subscribed_to_leadgen,
  }))

  return NextResponse.json({ pages })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { pageId?: string; all?: boolean }
  const service = createServiceClient()

  if (body.all) {
    await service.from('facebook_connections').delete().eq('user_id', user.id)
    await service.from('lead_form_automations').delete().eq('user_id', user.id)
  } else if (body.pageId) {
    const { data: conn } = await service
      .from('facebook_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('page_id', body.pageId)
      .maybeSingle()
    if (conn) {
      await service.from('facebook_connections').delete().eq('id', conn.id)
      await service.from('lead_form_automations').delete().eq('connection_id', conn.id)
    }
  }

  return NextResponse.json({ ok: true })
}
