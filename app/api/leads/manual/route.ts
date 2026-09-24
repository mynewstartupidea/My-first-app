// Manual lead entry — walk-ins, referrals, and anything else that doesn't
// come through Facebook Lead Ads or a landing page's ingest webhook.

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { normalizeIndianPhone } from '@/lib/utils'

const SOURCE_LABELS: Record<string, string> = {
  facebook_lead_ad: 'Facebook',
  landing_page:      'Landing Page',
  walk_in:           'Walk-in',
  referral:          'Referral',
  channel_partner:   'Channel Partner',
  manual:            'Manual',
  other:             'Other',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as {
    name?: string; phone?: string; email?: string; source?: string; notes?: string
  }
  if (!body.name?.trim() && !body.phone?.trim() && !body.email?.trim()) {
    return NextResponse.json({ error: 'Provide at least one of: name, phone, email' }, { status: 400 })
  }
  const source = body.source && SOURCE_LABELS[body.source] ? body.source : 'other'

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: store } = await service
    .from('stores').select('id').eq('user_id', ownerId).eq('is_active', true).maybeSingle()

  const normalizedPhone = body.phone?.trim() ? (normalizeIndianPhone(body.phone.trim()) ?? body.phone.trim()) : null

  const { data: saved, error } = await service
    .from('leads')
    .insert({
      user_id:   ownerId,
      store_id:  store?.id ?? null,
      name:      body.name?.trim() || null,
      email:     body.email?.trim() || null,
      phone:     normalizedPhone,
      source,
      form_name: SOURCE_LABELS[source],
      fields:    body.notes?.trim() ? { notes: body.notes.trim() } : null,
      wa_status: normalizedPhone ? 'imported' : 'no_phone',
    })
    .select('id')
    .single()

  if (error || !saved) {
    console.error('[leads/manual] insert error:', error)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, lead_id: saved.id })
}
