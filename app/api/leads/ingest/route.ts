import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeIndianPhone } from '@/lib/utils'
import { triggerLeadSourceAutomation } from '@/lib/lead-source-automation'

const STANDARD_KEYS = new Set(['name', 'email', 'phone', 'source', 'full_name', 'first_name', 'last_name'])

export async function POST(req: Request) {
  // Auth via Bearer token
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 })

  const supabase = createServiceClient()

  // Look up store by api_key
  const { data: store } = await supabase
    .from('stores')
    .select('id, user_id')
    .eq('api_key', token)
    .eq('is_active', true)
    .maybeSingle()

  if (!store) return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })

  let body: Record<string, string>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { name, email, phone, source, source_type, ...rest } = body
  if (!name && !phone && !email) {
    return NextResponse.json({ error: 'Provide at least one of: name, phone, email' }, { status: 400 })
  }
  const ALLOWED_SOURCE_TYPES = new Set(['landing_page', 'referral', 'other'])
  const sourceType = source_type && ALLOWED_SOURCE_TYPES.has(source_type) ? source_type : 'landing_page'

  // Normalize phone to E.164-ish Indian format when possible
  const normalizedPhone = phone ? (normalizeIndianPhone(phone) ?? phone) : null

  // Custom fields — everything except standard keys
  const fields = Object.fromEntries(Object.entries(rest).filter(([k]) => !STANDARD_KEYS.has(k)))

  // This endpoint has no natural idempotency key (unlike Facebook's
  // leadgen_id) — a flaky client double-submitting the same form, or a
  // landing page's own retry logic, created a second lead row and queued a
  // second WhatsApp message with no guard at all. A short debounce window
  // (not a permanent dedupe — the same person legitimately re-submitting
  // weeks later should still create a fresh lead) catches the realistic
  // failure mode without blocking genuine repeat interest.
  if (normalizedPhone) {
    const { data: recent } = await supabase
      .from('leads').select('id')
      .eq('store_id', store.id).eq('phone', normalizedPhone)
      .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
      .limit(1).maybeSingle()
    if (recent) return NextResponse.json({ success: true, lead_id: recent.id, duplicate: true })
  }

  // Save lead
  const { data: saved, error: saveErr } = await supabase
    .from('leads')
    .insert({
      user_id:   store.user_id,
      store_id:  store.id,
      name:      name || null,
      email:     email || null,
      phone:     normalizedPhone,
      form_name: source || 'Landing Page',
      source:    sourceType,
      fields:    Object.keys(fields).length > 0 ? fields : null,
      wa_status: normalizedPhone ? 'imported' : 'no_phone',
    })
    .select('id')
    .single()

  if (saveErr || !saved) {
    console.error('[leads/ingest] save error:', saveErr)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }

  // Auto-trigger WhatsApp if the merchant has the Landing Page source
  // automation turned on (configured from /dashboard/automations, same
  // place as the Facebook Lead Ad Response card).
  if (normalizedPhone) {
    await triggerLeadSourceAutomation(supabase, {
      storeId: store.id, ownerId: store.user_id, leadId: saved.id,
      source: 'landing_page', phone: normalizedPhone, name: name || null, fields,
    })
  }

  return NextResponse.json({ success: true, lead_id: saved.id })
}

// CORS preflight for cross-origin landing page submissions
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
