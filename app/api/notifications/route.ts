import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

// Most notification writers (cron quota/template-status/facebook-leads/
// shopify-sync/campaign-send, the meta webhook) insert with user_id = the
// org OWNER's id, per lib/resolve-owner-user-id.ts's documented convention
// for this class of table. One type is the deliberate exception:
// 'followup_due' (app/api/cron/route.ts) targets whichever team member a
// lead is actually assigned to, specifically so "your follow-ups are due"
// reaches the rep working it, not just the owner. This route used to
// filter on the caller's own auth id directly with no service client —
// which only ever matched the exception case, so every OWNER-scoped type
// (quota, WhatsApp health, template approval, Facebook-access-lost,
// Shopify-sync-failure) was invisible to a team member's bell, while an
// owner with no personally-assigned leads saw nothing at all. Matching
// against both ids (deduped automatically when they're the same person)
// covers both conventions correctly instead of only one.
async function notificationUserIds(service: ReturnType<typeof createServiceClient>, userId: string): Promise<string[]> {
  const ownerId = await resolveOwnerUserId(service, userId)
  return [...new Set([ownerId, userId])]
}

// GET — fetch recent notifications for the logged-in user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const userIds = await notificationUserIds(service, user.id)

  const { data } = await service
    .from('notifications')
    .select('id, type, title, body, link, is_read, created_at')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ notifications: data ?? [] })
}

// PATCH — mark notifications as read
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const userIds = await notificationUserIds(service, user.id)

  const body = await request.json().catch(() => ({})) as { ids?: string[]; all?: boolean }

  let query = service.from('notifications').update({ is_read: true }).in('user_id', userIds)
  if (!body.all && body.ids?.length) {
    query = query.in('id', body.ids)
  }

  await query
  return NextResponse.json({ ok: true })
}
