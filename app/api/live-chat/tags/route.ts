import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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
  const { data } = await service
    .from('leads')
    .select('phone, lead_status')
    .eq('user_id', user.id)
    .in('phone', phones)
    .not('lead_status', 'is', null)

  const tags: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.phone && row.lead_status) tags[row.phone] = row.lead_status
  }
  return NextResponse.json({ tags })
}

// PATCH /api/live-chat/tags  { phone, status }
// Updates lead_status on all leads with that phone for this user
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone, status } = await request.json() as { phone: string; status: string | null }
  if (status !== null && !VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('leads')
    .update({ lead_status: status })
    .eq('user_id', user.id)
    .eq('phone', phone)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
