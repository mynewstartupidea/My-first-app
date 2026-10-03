import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

// Owner/admin only — same tier as every other Settings mutation
// (/api/settings/store). This had no role check at all, and both queries
// below used the CALLER's own user_id instead of the org owner's — for any
// invited teammate (whatsapp_accounts/stores are keyed by the owner's id,
// not theirs), both updates matched zero rows and this still returned
// {success:true}, so a Sales/Support/Manager rep clicking "Disconnect"
// saw a success message while the org's real WhatsApp connection was
// completely untouched.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can disconnect WhatsApp.' }, { status: 403 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  await service.from('whatsapp_accounts').update({
    status:      'disconnected',
    access_token: null,
    updated_at:  new Date().toISOString(),
  }).eq('user_id', ownerId)

  const { data: store } = await service
    .from('stores')
    .select('id')
    .eq('user_id', ownerId)
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
