// Manual WhatsApp connect — user provides WABA ID + phone number ID + access token directly.
// Used as a fallback when Embedded Signup's automatic WABA discovery fails.

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as {
    wabaId?:             string
    phoneNumberId?:      string
    displayPhoneNumber?: string
    accessToken?:        string
    businessId?:         string
  }

  const { wabaId, phoneNumberId, displayPhoneNumber, accessToken, businessId } = body

  if (!wabaId?.trim())        return NextResponse.json({ ok: false, error: 'WABA ID is required' }, { status: 400 })
  if (!phoneNumberId?.trim()) return NextResponse.json({ ok: false, error: 'Phone Number ID is required' }, { status: 400 })
  if (!accessToken?.trim())   return NextResponse.json({ ok: false, error: 'Access token is required' }, { status: 400 })

  // Verify the token + phone number ID are valid by hitting Meta's API
  let verifiedPhone = displayPhoneNumber?.trim() ?? ''
  try {
    const res  = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId.trim()}?fields=display_phone_number,verified_name&access_token=${accessToken.trim()}`
    )
    const data = await res.json() as { display_phone_number?: string; verified_name?: string; error?: { message: string } }
    console.log('[Meta manual] phone number verify HTTP:', res.status, JSON.stringify(data))
    if (data.error) {
      return NextResponse.json({ ok: false, error: `Meta API error: ${data.error.message}` })
    }
    if (data.display_phone_number) verifiedPhone = data.display_phone_number
  } catch (e) {
    console.error('[Meta manual] phone number verify failed:', e)
    return NextResponse.json({ ok: false, error: 'Could not verify phone number ID with Meta. Check the ID and token.' })
  }

  const service = createServiceClient()
  const authClient = await createClient()

  const { data: storeRows } = await authClient
    .from('stores')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
  const store = storeRows?.[0] ?? null

  const { error: upsertErr } = await service.from('whatsapp_accounts').upsert({
    user_id:              user.id,
    store_id:             store?.id ?? null,
    business_id:          businessId?.trim() ?? wabaId.trim(),
    waba_id:              wabaId.trim(),
    phone_number_id:      phoneNumberId.trim(),
    display_phone_number: verifiedPhone,
    access_token:         accessToken.trim(),
    token_type:           'user_token',
    status:               'connected',
    provider:             'meta',
    updated_at:           new Date().toISOString(),
  }, { onConflict: 'user_id' })

  if (upsertErr) {
    console.error('[Meta manual] DB upsert failed:', upsertErr.message)
    return NextResponse.json({ ok: false, error: `Database error: ${upsertErr.message}` })
  }

  if (store) {
    await service.from('stores').update({
      whatsapp_number:  verifiedPhone,
      whatsapp_bsp:     'meta',
      whatsapp_api_key: accessToken.trim(),
      updated_at:       new Date().toISOString(),
    }).eq('id', store.id)
  }

  console.log(`[Meta manual] connected — wabaId=${wabaId} phoneId=${phoneNumberId} phone=${verifiedPhone}`)
  return NextResponse.json({ ok: true, phone: verifiedPhone })
}
