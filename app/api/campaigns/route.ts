import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pickPreferredStore } from '@/lib/store-selection'

// GET /api/campaigns — list campaigns for authenticated user's store
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: stores } = await supabase
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at').eq('user_id', user.id).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(stores)
  if (!store) return NextResponse.json({ campaigns: [] })

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data })
}

// POST /api/campaigns — create a campaign
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: stores } = await supabase
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at').eq('user_id', user.id).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(stores)
  if (!store) return NextResponse.json({ error: 'No active store' }, { status: 400 })

  const body = await req.json()
  const { name, message, audience, scheduled_at } = body

  if (!name || !message || !audience) {
    return NextResponse.json({ error: 'name, message, and audience are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      store_id:    store.id,
      name:        name.trim(),
      message:     message.trim(),
      audience,
      status:      scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: scheduled_at ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign: data })
}
