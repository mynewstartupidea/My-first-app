import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET — return existing api_key for the current user's store
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id, api_key')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!store) return NextResponse.json({ error: 'No store found' }, { status: 404 })

  // Auto-generate on first fetch if none exists
  if (!store.api_key) {
    const newKey = `wap_live_${crypto.randomUUID().replace(/-/g, '')}`
    const svc = createServiceClient()
    await svc.from('stores').update({ api_key: newKey }).eq('id', store.id)
    return NextResponse.json({ api_key: newKey })
  }

  return NextResponse.json({ api_key: store.api_key })
}

// POST — rotate (generate a new key)
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!store) return NextResponse.json({ error: 'No store found' }, { status: 404 })

  const newKey = `wap_live_${crypto.randomUUID().replace(/-/g, '')}`
  const svc = createServiceClient()
  await svc.from('stores').update({ api_key: newKey }).eq('id', store.id)

  return NextResponse.json({ api_key: newKey })
}
