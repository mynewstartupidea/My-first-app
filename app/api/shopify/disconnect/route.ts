import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Soft-disconnect: clear Shopify credentials but keep the store record, WhatsApp
// settings, automations, and all historical data intact.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('stores')
    .update({
      shopify_domain:       null,
      shopify_access_token: null,
      platform:             null,
      connected_at:         null,
      updated_at:           new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (error) {
    console.error('[Shopify disconnect] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
