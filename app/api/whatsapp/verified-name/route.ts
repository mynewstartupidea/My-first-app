import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

// GET — just the WhatsApp number's Meta-verified business name, for the
// Facebook page picker's mismatch warning (see PagePickerModal). Read-only,
// single Graph API call, no retries — this runs once when the picker opens,
// not on every keystroke.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('phone_number_id, access_token')
    .eq('user_id', ownerId)
    .eq('status', 'connected')
    .maybeSingle()
  if (!wa?.phone_number_id) return NextResponse.json({ verifiedName: null })

  const token = process.env.META_SYSTEM_USER_ACCESS_TOKEN ?? wa.access_token
  const res = await fetch(`https://graph.facebook.com/v21.0/${wa.phone_number_id}?fields=verified_name`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return NextResponse.json({ verifiedName: null })
  const data = await res.json() as { verified_name?: string }
  return NextResponse.json({ verifiedName: data.verified_name ?? null })
}
