import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getLeadForms } from '@/lib/facebook'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: connections } = await service
    .from('facebook_connections')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const pages = await Promise.all(
    (connections ?? []).map(async conn => {
      const forms = await getLeadForms(conn.page_id, conn.page_access_token)

      // Fetch automation config for each form
      const { data: autos } = await service
        .from('lead_form_automations')
        .select('form_id, message_template, is_enabled')
        .eq('store_id', conn.store_id ?? '')
        .in('form_id', forms.map(f => f.id))

      const autoMap = Object.fromEntries((autos ?? []).map(a => [a.form_id, a]))

      return {
        ...conn,
        forms: forms.map(f => ({ ...f, automation: autoMap[f.id] ?? null })),
      }
    })
  )

  return NextResponse.json({ pages })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pageId } = await request.json() as { pageId: string }
  const service = createServiceClient()
  await service.from('facebook_connections').delete().eq('user_id', user.id).eq('page_id', pageId)

  return NextResponse.json({ ok: true })
}
