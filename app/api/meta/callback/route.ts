// Meta Embedded Signup — OAuth callback
// Called after user completes Meta Business verification flow.
// Exchanges code for access token, retrieves WABA + phone number, saves to DB.
// Also: assigns platform System User to merchant WABA (for permanent token),
// and subscribes app to WABA webhooks (for delivery receipts + inbound messages).

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { assignSystemUserToWABA, exchangeMetaCode, subscribeWABAWebhooks } from '@/lib/whatsapp'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    const desc = searchParams.get('error_description') ?? 'Meta authorization failed'
    return NextResponse.redirect(`${origin}/dashboard/settings?tab=whatsapp&error=${encodeURIComponent(desc)}`)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const info = await exchangeMetaCode(code)
  console.log(`[Meta callback] exchangeMetaCode: ${info ? 'OK' : 'FAILED'}`)

  if (!info) {
    return NextResponse.redirect(
      `${origin}/dashboard/settings?tab=whatsapp&error=${encodeURIComponent('Could not retrieve WhatsApp account. Check Meta app configuration.')}`
    )
  }

  // Try to assign platform System User to merchant's WABA and subscribe webhooks.
  // Both are best-effort — failure does not block the connection.
  // System user token (META_SYSTEM_USER_ACCESS_TOKEN) is used for webhook subscription
  // if set, otherwise the merchant's user token is used.
  const systemUserToken = process.env.META_SYSTEM_USER_ACCESS_TOKEN
  const [assignedSystemUser, webhooksSubscribed] = await Promise.all([
    assignSystemUserToWABA(info.wabaId, info.accessToken),
    subscribeWABAWebhooks(info.wabaId, systemUserToken ?? info.accessToken),
  ])

  console.log(`[Meta callback] system user assigned: ${assignedSystemUser}, webhooks subscribed: ${webhooksSubscribed}`)

  // token_type = 'system_user_token' only when:
  //   1. META_SYSTEM_USER_ACCESS_TOKEN is configured in env, AND
  //   2. System user was successfully assigned to this merchant's WABA.
  // Otherwise we fall back to the merchant's user token (~60-day expiry).
  const tokenType: 'user_token' | 'system_user_token' =
    systemUserToken && assignedSystemUser ? 'system_user_token' : 'user_token'

  const service = createServiceClient()

  // Get active store for this user
  const { data: storeRows } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('shopify_domain', { ascending: true, nullsFirst: false })
    .limit(1)
  const store = storeRows?.[0] ?? null

  // Upsert WhatsApp account — one per user (UNIQUE constraint on user_id)
  await service.from('whatsapp_accounts').upsert({
    user_id:              user.id,
    store_id:             store?.id ?? null,
    business_id:          info.businessId,
    waba_id:              info.wabaId,
    phone_number_id:      info.phoneNumberId,
    display_phone_number: info.displayPhoneNumber,
    access_token:         info.accessToken,
    token_type:           tokenType,
    status:               'connected',
    provider:             'meta',
    updated_at:           new Date().toISOString(),
  }, { onConflict: 'user_id' })

  console.log(`[Meta callback] whatsapp_accounts upserted — token_type: ${tokenType}`)

  // Also update store with meta BSP details so the cron can pick up bsp='meta'
  if (store) {
    await service.from('stores').update({
      whatsapp_number:  info.displayPhoneNumber,
      whatsapp_bsp:     'meta',
      whatsapp_api_key: info.accessToken,
      updated_at:       new Date().toISOString(),
    }).eq('id', store.id)
  }

  return NextResponse.redirect(`${origin}/dashboard/settings?tab=whatsapp&connected=meta`)
}
