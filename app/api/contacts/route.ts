import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get the user's active store — same logic as upload API
  const { data: stores } = await supabase
    .from('stores')
    .select('id, shop_name, shopify_domain')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(5)

  const store = stores?.[0] ?? null
  console.log(`[contacts/list] user=${user.id} stores_found=${stores?.length ?? 0} using_store=${store?.id ?? 'none'}`)

  if (!store) {
    return NextResponse.json({ contacts: [], store: null, debug: 'no_active_store' })
  }

  const { data: contacts, error } = await supabase
    .from('customers')
    .select('*')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[contacts/list] query error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log(`[contacts/list] store=${store.id} contacts=${contacts?.length ?? 0}`)
  return NextResponse.json({ contacts: contacts ?? [], store })
}
