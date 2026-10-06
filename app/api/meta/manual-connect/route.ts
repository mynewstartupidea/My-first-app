// Manual WhatsApp connect — user provides WABA ID + phone number ID + access token directly.
// Used as a fallback when Embedded Signup's automatic WABA discovery fails.

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  // Owner/admin only, same tier as the Embedded Signup flow and every other
  // Settings mutation — had no role check at all, and wrote whatsapp_accounts
  // keyed by the CALLER's own user_id rather than the org owner's, so a
  // team member "connecting" WhatsApp here created a stray row under their
  // own id that the rest of the app never reads (every lookup resolves to
  // the owner's row), reporting success while doing nothing real.
  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Only the account owner or an admin can connect WhatsApp.' }, { status: 403 })
  }

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
      return NextResponse.json({ ok: false, error: `Meta rejected these credentials — double-check the Phone Number ID and access token were copied correctly. (Meta said: ${data.error.message})` })
    }
    if (data.display_phone_number) verifiedPhone = data.display_phone_number
  } catch (e) {
    console.error('[Meta manual] phone number verify failed:', e)
    return NextResponse.json({ ok: false, error: 'Could not verify phone number ID with Meta. Check the ID and token.' })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: storeRows } = await service
    .from('stores')
    .select('id')
    .eq('user_id', ownerId)
    .eq('is_active', true)
    .limit(1)
  const store = storeRows?.[0] ?? null

  await service.from('whatsapp_accounts').delete().eq('user_id', ownerId)

  const { error: insertErr } = await service.from('whatsapp_accounts').insert({
    user_id:              ownerId,
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
  })

  if (insertErr) {
    console.error('[Meta manual] DB insert failed:', insertErr.message)
    return NextResponse.json({ ok: false, error: "Meta verified your credentials, but saving the connection failed. Please try again — if this keeps happening, contact support." })
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
