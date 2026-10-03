import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

// Soft-disconnect: clear Shopify credentials but keep the store record, WhatsApp
// settings, automations, and all historical data intact.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Owner-resolved + service client — this previously ran on the RLS-bound
  // client filtered by the caller's own user.id, same bug class fixed
  // everywhere else this session: a non-owner teammate clicking Disconnect
  // matched zero rows (stores is keyed by the ORG OWNER's id), so the button
  // appeared to succeed while silently doing nothing.
  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { error } = await service
    .from('stores')
    .update({
      shopify_domain:            null,
      shopify_access_token:      null,
      // Custom-app credentials were never cleared here at all — a
      // disconnected store kept its client id, encrypted client secret,
      // encrypted access token, token expiry, and connection_type sitting
      // in the database indefinitely after "disconnecting."
      shopify_connection_type:   null,
      shopify_client_id:         null,
      shopify_client_secret_enc: null,
      shopify_access_token_enc:  null,
      shopify_token_expires_at:  null,
      shopify_granted_scopes:    null,
      platform:                  null,
      connected_at:              null,
      updated_at:                new Date().toISOString(),
    })
    .eq('user_id', ownerId)
    .eq('is_active', true)

  if (error) {
    console.error('[Shopify disconnect] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
