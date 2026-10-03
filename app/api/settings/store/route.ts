import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getUserRole } from '@/lib/get-user-role'
import { pickPreferredStore } from '@/lib/store-selection'
import { SIDEBAR_SECTION_KEYS } from '@/lib/sidebar-sections'

// PATCH /api/settings/store — updates the org's store (name, manual WhatsApp
// number/API key). Settings → Store/WhatsApp used to write directly through
// the RLS-bound browser client (`stores_own` policy is USING (auth.uid() =
// user_id)) — for any non-owner teammate the UPDATE matched zero rows, and
// since no .select() was chained, Supabase returns no error for that, so
// the UI showed "Saved!" while nothing actually changed. Owner/admin only,
// same tier as Billing and Team — Store/WhatsApp wasn't gated at all before,
// so any role reaching Settings (including Sales) could attempt this.
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can change store settings.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    shop_name?: string
    whatsapp_number?: string | null
    whatsapp_api_key?: string | null
    business_type?: 'ecommerce' | 'lead_gen'
    visible_sections?: string[]
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: stores } = await service
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at')
    .eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(stores)
  if (!store) return NextResponse.json({ error: 'No store found' }, { status: 404 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.shop_name === 'string' && body.shop_name.trim()) updates.shop_name = body.shop_name.trim()
  if (body.whatsapp_number !== undefined || body.whatsapp_api_key !== undefined) {
    updates.whatsapp_bsp = 'meta'
    if (body.whatsapp_number !== undefined) updates.whatsapp_number = body.whatsapp_number || null
    if (body.whatsapp_api_key !== undefined) updates.whatsapp_api_key = body.whatsapp_api_key || null
  }
  if (body.business_type === 'ecommerce' || body.business_type === 'lead_gen') {
    updates.business_type = body.business_type
  }
  if (Array.isArray(body.visible_sections)) {
    // Validated against the known section keys, not trusted as-is — an
    // unrecognized key saved here would just permanently hide nothing (the
    // nav filter only shows items it recognizes), but filtering keeps the
    // stored value meaningful if SIDEBAR_SECTIONS ever changes shape.
    updates.visible_sections = body.visible_sections.filter(k => SIDEBAR_SECTION_KEYS.includes(k))
  }

  const { error } = await service.from('stores').update(updates).eq('id', store.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
