import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    connectionId: string
    formId: string
    formName: string
    messageTemplate: string
    isEnabled: boolean
  }

  const service = createServiceClient()

  const { data: conn } = await service
    .from('facebook_connections')
    .select('store_id')
    .eq('id', body.connectionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!conn?.store_id) return NextResponse.json({ error: 'Connection not found or no store linked' }, { status: 404 })

  await service.from('lead_form_automations').upsert({
    user_id:          user.id,
    store_id:         conn.store_id,
    connection_id:    body.connectionId,
    form_id:          body.formId,
    form_name:        body.formName,
    message_template: body.messageTemplate,
    is_enabled:       body.isEnabled,
    updated_at:       new Date().toISOString(),
  }, { onConflict: 'store_id,form_id' })

  return NextResponse.json({ ok: true })
}
