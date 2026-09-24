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

  const insertRows = usableRows.map(r => {
    const normalizedPhone = r.phone?.trim() ? (normalizeIndianPhone(r.phone.trim()) ?? r.phone.trim()) : null
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

  const { data: saved, error } = await service.from('leads').insert(insertRows).select('id')

  if (error) {
    console.error('[leads/bulk-import] insert error:', error)
    return NextResponse.json({ error: 'Failed to import leads' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, imported: saved?.length ?? 0, skipped: rows.length - usableRows.length })
}
