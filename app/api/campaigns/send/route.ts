import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { queueCampaignAudience } from '@/lib/campaign-queue'

export const maxDuration = 60

// POST /api/campaigns/send — snapshots the full audience into
// campaign_recipients and hands off to app/api/cron/campaign-send for the
// actual sending. Used to fetch up to 1000 matching customers and send to
// all of them in one synchronous loop inside this request — anything past
// 1000 silently never got messaged, and because message/opt-in logging only
// happened in one batch AFTER the whole loop finished, a timeout partway
// through (easy to hit well under 1000 recipients at real WhatsApp API
// latency) meant messages that were actually sent (and billed) left zero
// record of it. This route now just builds the recipient list and returns —
// no cap, no in-request sending, no risk of losing already-sent history to
// a timeout.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { campaign_id } = await req.json()
  if (!campaign_id) return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  // Check billing quota before doing anything else
  const { data: remaining } = await service.rpc('get_messages_remaining', { p_user_id: ownerId })
  if ((remaining ?? 0) <= 0) {
    return NextResponse.json({ error: 'Monthly message limit reached. Upgrade your plan for more messages.' }, { status: 403 })
  }

  // campaigns has no user_id column — it's scoped by store_id, like every
  // other table in this app. The query this route used to run,
  // .eq('user_id', ownerId), fails outright ("column campaigns.user_id does
  // not exist") and has been rejecting every single send attempt as
  // "Campaign not found." Fetch the campaign, then verify its store_id
  // belongs to one of the resolved owner's own stores.
  const { data: campaign, error: cErr } = await service
    .from('campaigns').select('*').eq('id', campaign_id).single()
  if (cErr || !campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  const { data: ownedStore } = await service
    .from('stores').select('id').eq('id', campaign.store_id).eq('user_id', ownerId).maybeSingle()
  if (!ownedStore) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

  // Atomic claim: only update if still in draft/scheduled — prevents double-send
  const { data: claimed } = await service
    .from('campaigns')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', campaign_id)
    .in('status', ['draft', 'scheduled'])
    .select('id')

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'Campaign already running or completed' }, { status: 400 })
  }

  const result = await queueCampaignAudience(service, campaign)
  if (!result.success) {
    await service.from('campaigns').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', campaign_id)
    return NextResponse.json({ error: result.error }, { status: result.error.startsWith('No eligible') ? 400 : 500 })
  }

  return NextResponse.json({ success: true, queued: result.queued })
}
