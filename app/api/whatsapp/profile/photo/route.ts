// Uploads a WhatsApp Business Profile photo. Separate from route.ts's text
// fields because Meta's photo flow is a different mechanism entirely —
// their Resumable Upload API (3 round-trips: start a session, upload the
// bytes, then point the profile at the resulting file handle), not a plain
// JSON field on whatsapp_business_profile.
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { getUserRole } from '@/lib/get-user-role'
import { resolvePhoneCreds } from '../route'

const MAX_BYTES = 5 * 1024 * 1024 // Meta's own limit for a profile photo

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can edit the business profile.' }, { status: 403 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  const creds = await resolvePhoneCreds(ownerId)
  if (!creds) return NextResponse.json({ error: 'WhatsApp not connected' }, { status: 400 })

  const appId = process.env.META_APP_ID
  if (!appId) {
    return NextResponse.json({ error: 'Meta app not configured on the server (META_APP_ID missing). Contact support.' }, { status: 500 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('photo')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No photo provided' }, { status: 400 })
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    return NextResponse.json({ error: 'Please upload a JPEG or PNG image.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image is too large — please use one under 5MB.' }, { status: 400 })
  }

  const bytes = Buffer.from(await file.arrayBuffer())

  // Step 1: start an upload session
  const sessionRes = await fetch(
    `https://graph.facebook.com/v21.0/${appId}/uploads?file_length=${bytes.length}&file_type=${encodeURIComponent(file.type)}&access_token=${encodeURIComponent(creds.token)}`,
    { method: 'POST' },
  )
  const sessionData = await sessionRes.json() as { id?: string; error?: { message: string } }
  if (!sessionRes.ok || !sessionData.id) {
    return NextResponse.json({ error: sessionData.error?.message ?? 'Could not start the image upload with Meta.' }, { status: 500 })
  }

  // Step 2: upload the actual bytes to that session, get back a file handle
  const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${sessionData.id}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${creds.token}`, file_offset: '0' },
    body: bytes,
  })
  const uploadData = await uploadRes.json() as { h?: string; error?: { message: string } }
  if (!uploadRes.ok || !uploadData.h) {
    return NextResponse.json({ error: uploadData.error?.message ?? 'Could not upload the image to Meta.' }, { status: 500 })
  }

  // Step 3: point the business profile at the uploaded file
  const profileRes = await fetch(`https://graph.facebook.com/v21.0/${creds.phoneNumberId}/whatsapp_business_profile`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', profile_picture_handle: uploadData.h }),
  })
  const profileData = await profileRes.json() as { success?: boolean; error?: { message: string } }
  if (!profileRes.ok || !profileData.success) {
    return NextResponse.json({ error: profileData.error?.message ?? 'Meta rejected this photo. Try a different image.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
