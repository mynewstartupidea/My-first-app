// Manual lead entry — walk-ins, referrals, and anything else that doesn't
// come through Facebook Lead Ads or a landing page's ingest webhook.

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { normalizeIndianPhone } from '@/lib/utils'
import { triggerLeadSourceAutomation } from '@/lib/lead-source-automation'

const SOURCE_LABELS: Record<string, string> = {
  facebook_lead_ad: 'Facebook',
  landing_page:      'Landing Page',
  walk_in:           'Walk-in',
  referral:          'Referral',
  channel_partner:   'Channel Partner',
  manual:            'Manual',
  other:             'Other',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// India-shaped phone normalization can reasonably fail for real international
// numbers, so this doesn't require normalizeIndianPhone() to succeed — it
// just rejects things that clearly aren't a phone number at all (e.g. a name
// typed into the phone field) instead of silently saving the raw text.
const PHONE_SHAPE_RE = /^[\d\s+()-]{6,20}$/

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as {
    name?: string; phone?: string; email?: string; source?: string; notes?: string; force?: boolean
  }
  if (!body.name?.trim() && !body.phone?.trim() && !body.email?.trim()) {
    return NextResponse.json({ error: 'Provide at least one of: name, phone, email' }, { status: 400 })
  }
  if (body.email?.trim() && !EMAIL_RE.test(body.email.trim())) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }
  if (body.phone?.trim() && !PHONE_SHAPE_RE.test(body.phone.trim())) {
    return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
  }
  const source = body.source && SOURCE_LABELS[body.source] ? body.source : 'other'

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: store } = await service
    .from('stores').select('id').eq('user_id', ownerId).eq('is_active', true).maybeSingle()

  const normalizedPhone = body.phone?.trim() ? (normalizeIndianPhone(body.phone.trim()) ?? body.phone.trim()) : null

  // Unlike bulk CSV import (where silently skipping duplicates is the right
  // call for 500 rows at once), a single manual add is a deliberate action by
  // one rep — surface the existing lead and let them confirm rather than
  // either silently creating a duplicate or silently blocking a legitimate
  // repeat walk-in.
  if (normalizedPhone && !body.force) {
    const { data: existing } = await service
      .from('leads').select('id, name, lead_status, created_at')
      .eq('user_id', ownerId).eq('phone', normalizedPhone)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (existing) {
      return NextResponse.json({
        error: 'duplicate',
        existingLead: existing,
        message: `A lead with this phone number already exists${existing.name ? ` (${existing.name})` : ''}.`,
      }, { status: 409 })
    }
  }

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

  // Auto-trigger WhatsApp if the merchant has the Manually Added Leads
  // source automation turned on (configured from /dashboard/automations).
  if (normalizedPhone && store?.id) {
    await triggerLeadSourceAutomation(service, {
      storeId: store.id, ownerId, leadId: saved.id,
      source: 'manual', phone: normalizedPhone, name: body.name?.trim() || null,
    })
  }

  return NextResponse.json({ ok: true, lead_id: saved.id })
}
