import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { pickPreferredStore } from '@/lib/store-selection'

// This key is a shared, org-level credential — any landing page pointed at
// it keeps working until someone rotates it, so it's the same tier as the
// Shopify/WhatsApp connection: owner/admin only, and resolved to the org
// OWNER's store, not the caller's own id. Both GET and POST used to query
// `stores` with .eq('user_id', user.id) directly against the session client
// — stores' RLS is USING (auth.uid() = user_id) with no team-member
// carve-out, so any invited teammate got "No store found" here even though
// the org had one, and (via GET's auto-generate-on-first-fetch) could have
// silently minted and returned a key for a DIFFERENT store they happen to
// independently own, not the org's.

// GET — return existing api_key for the org owner's store
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can view the API key.' }, { status: 403 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: storeRows } = await service
    .from('stores').select('id, api_key, shopify_domain, connected_at, updated_at, created_at')
    .eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(storeRows)

  if (!store) return NextResponse.json({ error: 'No store found' }, { status: 404 })

  // Auto-generate on first fetch if none exists
  if (!store.api_key) {
    const newKey = `wap_live_${crypto.randomUUID().replace(/-/g, '')}`
    await service.from('stores').update({ api_key: newKey }).eq('id', store.id)
    return NextResponse.json({ api_key: newKey })
  }

  return NextResponse.json({ api_key: store.api_key })
}

// POST — rotate (generate a new key) for the org owner's store
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can rotate the API key.' }, { status: 403 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: storeRows } = await service
    .from('stores').select('id, shopify_domain, connected_at, updated_at, created_at')
    .eq('user_id', ownerId).eq('is_active', true)
    .order('connected_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(10)
  const store = pickPreferredStore(storeRows)

  if (!store) return NextResponse.json({ error: 'No store found' }, { status: 404 })

  const newKey = `wap_live_${crypto.randomUUID().replace(/-/g, '')}`
  await service.from('stores').update({ api_key: newKey }).eq('id', store.id)

  return NextResponse.json({ api_key: newKey })
}
