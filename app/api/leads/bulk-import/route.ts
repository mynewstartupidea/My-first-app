// CSV bulk import for channel partners — a business shares a spreadsheet of
// leads (walk-in list, partner referrals) and it lands tagged with source
// 'channel_partner' and the partner's name as the label, same way a Facebook
// form name or "Landing Page" already labels other sources.

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { normalizeIndianPhone } from '@/lib/utils'

const MAX_ROWS = 2000
// Same shape-check as manual entry (app/api/leads/manual/route.ts) — doesn't
// require normalizeIndianPhone() to succeed (real international numbers can
// reasonably fail that), just rejects things that clearly aren't a phone
// number (e.g. a mis-mapped column landing text like a city name here).
const PHONE_SHAPE_RE = /^[\d\s+()-]{6,20}$/

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as {
    rows?: { name?: string; phone?: string; email?: string }[]
    sourceLabel?: string
  }
  const rows = (body.rows ?? []).slice(0, MAX_ROWS)
  const sourceLabel = body.sourceLabel?.trim() || 'Channel Partner'

  const usableRows = rows.filter(r => r.name?.trim() || r.phone?.trim() || r.email?.trim())
  if (!usableRows.length) return NextResponse.json({ error: 'No usable rows — need at least name, phone, or email per row' }, { status: 400 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: store } = await service
    .from('stores').select('id').eq('user_id', ownerId).eq('is_active', true).maybeSingle()

  let invalidPhones = 0
  const candidateRows = usableRows.map(r => {
    const rawPhone = r.phone?.trim() ?? ''
    let normalizedPhone: string | null = null
    if (rawPhone) {
      if (PHONE_SHAPE_RE.test(rawPhone)) {
        normalizedPhone = normalizeIndianPhone(rawPhone) ?? rawPhone
      } else {
        invalidPhones++ // clearly not a phone (e.g. a mis-mapped column) — drop it, don't save garbage as "imported"
      }
    }
    return {
      user_id:   ownerId,
      store_id:  store?.id ?? null,
      name:      r.name?.trim() || null,
      email:     r.email?.trim() || null,
      phone:     normalizedPhone,
      source:    'channel_partner',
      form_name: sourceLabel,
      wa_status: normalizedPhone ? 'imported' : 'no_phone',
    }
  })

  // Duplicate detection — leads has no uniqueness constraint on (user_id,
  // phone) for non-Facebook sources, so re-uploading the same partner CSV
  // (e.g. after a refresh mid-import, or just not being sure it worked the
  // first time — the modal gives no "already imported" feedback) silently
  // created a second copy of every row, which then gets WhatsApp-messaged
  // twice by a bulk send.
  const phonesToCheck = [...new Set(candidateRows.map(r => r.phone).filter((p): p is string => !!p))]
  let existingPhones = new Set<string>()
  if (phonesToCheck.length) {
    const { data: existing } = await service
      .from('leads').select('phone').eq('user_id', ownerId).in('phone', phonesToCheck)
    existingPhones = new Set((existing ?? []).map(r => r.phone as string))
  }

  const seenInBatch = new Set<string>()
  let duplicateRows = 0
  const insertRows = candidateRows.filter(r => {
    if (!r.phone) return true // no phone to dedupe on — keep it (name/email-only lead)
    if (existingPhones.has(r.phone) || seenInBatch.has(r.phone)) { duplicateRows++; return false }
    seenInBatch.add(r.phone)
    return true
  })

  const { data: saved, error } = insertRows.length
    ? await service.from('leads').insert(insertRows).select('id')
    : { data: [], error: null }

  if (error) {
    console.error('[leads/bulk-import] insert error:', error)
    return NextResponse.json({ error: 'Failed to import leads' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    imported: saved?.length ?? 0,
    skipped: rows.length - usableRows.length,
    duplicates: duplicateRows,
    invalidPhones,
  })
}
