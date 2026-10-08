// WhatsApp Business Profile — the "about/description/website/logo" info
// shown when someone opens a chat with the business on WhatsApp. This is
// its own separate profile, distinct from the Facebook page or Meta
// Business Manager — it has to be set explicitly via this API, which
// nothing in this codebase did before, so every connected number showed up
// with no photo and no business details.
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getUserRole } from '@/lib/get-user-role'

const PROFILE_FIELDS = 'about,address,description,email,profile_picture_url,websites,vertical'

export async function resolvePhoneCreds(ownerId: string) {
  const service = createServiceClient()
  const { data: wa } = await service
    .from('whatsapp_accounts')
    .select('phone_number_id, access_token')
    .eq('user_id', ownerId)
    .eq('status', 'connected')
    .maybeSingle()
  if (!wa?.phone_number_id) return null
  const token = process.env.META_SYSTEM_USER_ACCESS_TOKEN ?? wa.access_token
  return { phoneNumberId: wa.phone_number_id as string, token: token as string }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ownerId = await resolveOwnerUserId(createServiceClient(), user.id)
  const creds = await resolvePhoneCreds(ownerId)
  if (!creds) return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 })

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${creds.phoneNumberId}/whatsapp_business_profile?fields=${PROFILE_FIELDS}`,
    { headers: { Authorization: `Bearer ${creds.token}` } },
  )
  const data = await res.json() as { data?: Record<string, unknown>[]; error?: { message: string } }
  if (!res.ok) {
    return NextResponse.json({ error: data.error?.message ?? 'Could not load your WhatsApp business profile.' }, { status: 500 })
  }
  return NextResponse.json({ profile: data.data?.[0] ?? {} })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Same tier as every other WhatsApp-connection mutation — this is public-
  // facing business identity, not something a non-admin teammate should change.
  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can edit the business profile.' }, { status: 403 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const creds = await resolvePhoneCreds(ownerId)
  if (!creds) return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 })

  const body = await request.json().catch(() => ({})) as {
    about?: string; description?: string; email?: string; address?: string
    website?: string; vertical?: string
  }

  // Meta's endpoint takes a `websites` array (up to 2) — this UI only
  // collects one, so wrap it. description/email/address/websites all
  // accept an empty value to clear the field — verified directly against
  // a real WABA. `about` is the one exception: Meta rejects an empty
  // string for it with a generic, unhelpful 500 ("Something went wrong"),
  // confirmed the same way. So an empty `about` is never sent at all —
  // clearing that specific field isn't something Meta's API supports, and
  // the merchant gets told that directly instead of a cryptic failure.
  let aboutWarning: string | undefined
  const payload: Record<string, unknown> = { messaging_product: 'whatsapp' }
  if (body.about !== undefined) {
    const trimmed = body.about.trim()
    if (trimmed) payload.about = trimmed
    else aboutWarning = "WhatsApp doesn't support clearing the About field once set — leave it as is, or replace it with new text."
  }
  if (body.description !== undefined) payload.description = body.description.trim()
  if (body.email        !== undefined) payload.email       = body.email.trim()
  if (body.address      !== undefined) payload.address     = body.address.trim()
  if (body.vertical     !== undefined) payload.vertical    = body.vertical
  if (body.website      !== undefined) payload.websites    = body.website.trim() ? [body.website.trim()] : []

  const res = await fetch(`https://graph.facebook.com/v21.0/${creds.phoneNumberId}/whatsapp_business_profile`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json() as { success?: boolean; error?: { message: string } }
  if (!res.ok || !data.success) {
    return NextResponse.json({ error: data.error?.message ?? 'Meta rejected this update — check the website is a valid URL.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, warning: aboutWarning })
}
