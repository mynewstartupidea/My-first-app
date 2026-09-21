import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const VALID_STATUSES = new Set(['hot', 'warm', 'cold', 'lost', 'converted', 'junk', 'resolved'])

// PATCH /api/leads/[id]/status  { status: 'hot' | null }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { status: string | null }

  if (body.status !== null && !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: lead } = await service
    .from('leads')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await service.from('leads').update({ lead_status: body.status }).eq('id', id)

  return NextResponse.json({ ok: true })
}
