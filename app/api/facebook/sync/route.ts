import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { syncFacebookPageLeads } from '@/lib/facebook-sync'

export const maxDuration = 60

// POST /api/facebook/sync?page_id=xxx
// Fetches new leads from all forms on the given page.
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('page_id')
  if (!pageId) return NextResponse.json({ error: 'page_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const result = await syncFacebookPageLeads(service, ownerId, pageId)
  return NextResponse.json(result)
}
