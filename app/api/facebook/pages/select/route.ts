// Confirms which newly-discovered Facebook Pages the merchant actually wants
// connected for Lead Ads sync. Pages land as 'pending' in the OAuth callback
// (see /api/facebook/callback) — this is where a pending page becomes active
// (subscribed to leadgen webhooks, forms registered) or gets dropped.

export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { subscribePageToLeadgen, getLeadForms } from '@/lib/facebook'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { syncFacebookPageLeads } from '@/lib/facebook-sync'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { selectedPageIds?: string[] }
  const selectedPageIds = new Set(body.selectedPageIds ?? [])

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: pending } = await service
    .from('facebook_connections')
    .select('id, page_id, page_name, store_id, page_access_token, user_access_token')
    .eq('user_id', ownerId)
    .eq('selection_status', 'pending')

  let activated = 0
  let synced    = 0

  for (const conn of pending ?? []) {
    if (!selectedPageIds.has(conn.page_id as string)) {
      // Not picked — drop it rather than leave a stale token sitting around.
      // Re-running "Connect Facebook" rediscovers it if they change their mind.
      await service.from('facebook_connections').delete().eq('id', conn.id)
      continue
    }

    const subscribed = await subscribePageToLeadgen(conn.page_id as string, conn.page_access_token as string)

    await service
      .from('facebook_connections')
      .update({ selection_status: 'active', subscribed_to_leadgen: subscribed, updated_at: new Date().toISOString() })
      .eq('id', conn.id)

    const forms = await getLeadForms(conn.page_id as string, conn.page_access_token as string, conn.user_access_token as string | null)
    if (forms.length) {
      const automationRows = forms.map(f => ({
        user_id:          ownerId,
        store_id:         conn.store_id ?? null,
        connection_id:    conn.id,
        form_id:          f.id,
        form_name:        f.name,
        message_template: '',
        is_enabled:       false,
        updated_at:       new Date().toISOString(),
      }))
      await service
        .from('lead_form_automations')
        .upsert(automationRows, { onConflict: 'user_id,form_id', ignoreDuplicates: true })
        .then(null, () => null)
    }

    activated++

    // Pull existing (historical) leads immediately, so the merchant doesn't
    // land on an empty "No leads yet" screen until the next manual refresh
    // or cron run — awaited so the response only comes back once real data
    // is actually there.
    try {
      const result = await syncFacebookPageLeads(service, ownerId, conn.page_id as string)
      synced += result.synced
    } catch (e) {
      console.error(`[Facebook select] initial sync failed for page ${conn.page_id}:`, e)
    }
  }

  return NextResponse.json({ ok: true, activated, synced })
}
