import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  await service.from('whatsapp_accounts').update({
    status:      'disconnected',
    access_token: null,
    updated_at:  new Date().toISOString(),
  }).eq('user_id', user.id)

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (store) {
    await service.from('stores').update({
      whatsapp_bsp:     'mock',
      whatsapp_api_key: null,
      updated_at:       new Date().toISOString(),
    }).eq('id', store.id)
  }

  return NextResponse.json({ success: true })
}
