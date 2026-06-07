// Meta Embedded Signup — OAuth callback
// Called after user completes Meta Business verification flow.
// Exchanges code for access token, retrieves WABA + phone number, saves to DB.

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { exchangeMetaCode } from '@/lib/whatsapp'

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

  if (!info) {
    return NextResponse.redirect(
      `${origin}/dashboard/settings?tab=whatsapp&error=${encodeURIComponent('Could not retrieve WhatsApp account. Check Meta app configuration.')}`
    )
  }

  const service = createServiceClient()

  // Get or find store
  const { data: store } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // Upsert WhatsApp account
  await service.from('whatsapp_accounts').upsert({
    user_id:              user.id,
    store_id:             store?.id ?? null,
    business_id:          info.businessId,
    waba_id:              info.wabaId,
    phone_number_id:      info.phoneNumberId,
    display_phone_number: info.displayPhoneNumber,
    access_token:         info.accessToken,
    status:               'connected',
    provider:             'meta',
    updated_at:           new Date().toISOString(),
  }, { onConflict: 'user_id' })

  // Also update store with meta BSP details
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
