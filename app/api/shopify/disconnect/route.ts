import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getShopifyAppUrl, unregisterWebhooks } from '@/lib/shopify'
import { getValidAccessToken } from '@/lib/shopify-custom-app'

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

  const { data: store } = await service
    .from('stores')
    .select('id, shopify_domain, shopify_connection_type, shopify_client_id, shopify_client_secret_enc, shopify_access_token_enc, shopify_token_expires_at')
    .eq('user_id', ownerId).eq('is_active', true)
    .not('shopify_domain', 'is', null)
    .maybeSingle()

  // Best-effort: tell Shopify to stop sending events here before we discard
  // the token that lets us ask. There was previously no unregister call at
  // all — disconnecting locally never actually told Shopify anything, so
  // reconnecting a different custom app on the same shop could pile up
  // duplicate webhook subscriptions over repeated connect/disconnect
  // cycles. A failure here must never block the local disconnect itself.
  if (store?.shopify_domain && store.shopify_connection_type === 'custom_app') {
    try {
      const token = await getValidAccessToken(store)
      await unregisterWebhooks(store.shopify_domain, token, getShopifyAppUrl())
    } catch (e) {
      console.error('[Shopify disconnect] webhook unregister failed (continuing):', e)
    }
  }

  // Any in-flight background sync for this store is now pointless and would
  // otherwise just sit there — previously left as-is indefinitely, including
  // rows in 'processing' that a reconnect's "only enqueue if none pending/
  // processing" check (app/api/shopify/sync-all) would treat as still live.
  if (store?.id) {
    await service.from('shopify_sync_jobs').delete().eq('store_id', store.id).in('status', ['pending', 'processing'])
  }

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
