import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { resolveStoreFast } from '@/lib/store-selection'
import { normalizePhone, last10Digits } from '@/lib/whatsapp'

const VALID_STATUSES = new Set(['hot', 'warm', 'cold', 'lost', 'converted', 'junk', 'resolved'])

// GET /api/live-chat/tags?phones=+91xxx,+91yyy
// Returns { [phone]: lead_status } for all matching leads
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const phones = (searchParams.get('phones') ?? '').split(',').map(p => p.trim()).filter(Boolean)
  if (!phones.length) return NextResponse.json({ tags: {} })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)
  // leads.phone is stored in whatever raw format its own source produced —
  // never normalized — so an exact .in('phone', phones) against Live
  // Chat's normalized format silently matched nothing for most contacts.
  // Matched by last10Digits like every other cross-table phone lookup in
  // this codebase, not an unbounded fetch — leads.user_id is already
  // indexed, and this is bounded to the specific phones asked for below.
  const target10s = new Set(phones.map(last10Digits))
  const { data } = await service
    .from('leads')
    .select('phone, lead_status')
    .eq('user_id', ownerId)
    .not('lead_status', 'is', null)

  const tags: Record<string, string> = {}
  for (const row of data ?? []) {
    if (!row.phone || !row.lead_status) continue
    if (target10s.has(last10Digits(row.phone))) tags[normalizePhone(row.phone)] = row.lead_status
  }
  return NextResponse.json({ tags })
}

// PATCH /api/live-chat/tags  { phone, status, storeId? }
// Updates lead_status on the lead matching this phone for this user — or
// creates a minimal one if this Live Chat contact was never tracked as a
// lead at all (never came through Facebook Lead Ads or a manual add).
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone, status, storeId } = await request.json() as { phone: string; status: string | null; storeId?: string }
  if (status !== null && !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  // Same raw-format problem as GET above, but for a single contact and a
  // write — an exact .eq('phone', phone) matched zero rows for most Live
  // Chat contacts (e.g. a stored "7359354869" against an incoming
  // "+917359354869"), so the tag silently updated nothing every time, and
  // the optimistic UI tag reverted the moment the next background poll
  // re-fetched real (still-untagged) data. That's the "tag disappears
  // immediately" bug — not a visual glitch, the write was never landing.
  const target10 = last10Digits(phone)
  const { data: candidates } = await service
    .from('leads').select('id, phone')
    .eq('user_id', ownerId)
  const ids = (candidates ?? []).filter(c => last10Digits(c.phone ?? '') === target10).map(c => c.id)

  if (ids.length) {
    const { error } = await service.from('leads').update({ lead_status: status }).in('id', ids)
    if (error) {
      console.error('[live-chat/tags] update failed:', error.message)
      return NextResponse.json({ error: "Couldn't save this tag — please try again." }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // No lead row exists for this contact at all (they only ever messaged in
  // organically — never a Facebook lead, never manually added). Create a
  // minimal one so tagging works for every Live Chat conversation, not just
  // ones that happen to already be tracked as a lead.
  // 'live_chat' isn't in leads.source's CHECK constraint (confirmed live —
  // the insert errors) and this codebase has no live-visible way to extend
  // that constraint from here, so this uses 'other', the same catch-all
  // app/api/leads/manual/route.ts falls back to for anything that doesn't
  // fit a known category.
  const store = await resolveStoreFast(service, ownerId, storeId ?? null)
  const { error: insertErr } = await service.from('leads').insert({
    user_id: ownerId, store_id: store?.id ?? null, phone: normalizePhone(phone),
    source: 'other', lead_status: status, wa_status: 'imported',
  })
  if (insertErr) {
    console.error('[live-chat/tags] create-on-tag failed:', insertErr.message)
    return NextResponse.json({ error: "Couldn't save this tag — please try again." }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
