import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { pickPreferredStore } from '@/lib/store-selection'

// The Settings page used to read `stores`/`whatsapp_accounts` straight from
// the browser client with .eq('user_id', user.id) — both tables are keyed by
// the ORG OWNER's auth id, and stores' RLS policy is USING (auth.uid() =
// user_id), so any invited teammate got zero rows back and Settings showed
// "no store" / "WhatsApp not connected" even when the org's real setup was
// fine. This resolves to the owner server-side first.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const [{ data: sRows }, { data: wa }] = await Promise.all([
    service.from('stores').select('*').eq('user_id', ownerId).eq('is_active', true)
      .order('connected_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(10),
    service.from('whatsapp_accounts')
      .select('status, display_phone_number, token_type, connection_mode')
      .eq('user_id', ownerId)
      .maybeSingle(),
  ])

  return NextResponse.json({
    store: pickPreferredStore(sRows),
    whatsapp: wa ?? null,
  })
}
