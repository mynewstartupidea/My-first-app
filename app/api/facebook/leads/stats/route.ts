import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/facebook/leads/stats?page_id=xxx
// Returns aggregate counts for the selected page — always page-scoped,
// independent of which form tab or pagination page the user is on.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('page_id')
  if (!pageId) return NextResponse.json({ total: 0, withPhone: 0, sent: 0, pending: 0 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()

  const base = () =>
    service.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('page_id', pageId)

  const [totalRes, withPhoneRes, sentRes, pendingRes] = await Promise.all([
    base(),
    base().not('phone', 'is', null),
    base().eq('wa_status', 'sent'),
    base().eq('wa_status', 'pending'),
  ])

  return NextResponse.json({
    total:     totalRes.count     ?? 0,
    withPhone: withPhoneRes.count ?? 0,
    sent:      sentRes.count      ?? 0,
    pending:   pendingRes.count   ?? 0,
  })
}
