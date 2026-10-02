import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'

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

  // Build audience — same segment logic as before, just no .limit(1000).
  let query = service
    .from('customers')
    .select('id, phone, name')
    .eq('store_id', campaign.store_id)

  if (campaign.audience === 'opted_in') {
    query = query.eq('whatsapp_opt_in', true)
  } else if (campaign.audience === 'inactive_30') {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    query = query.eq('whatsapp_opt_in', true).or(`last_order_at.is.null,last_order_at.lt.${cutoff}`)
  } else if (campaign.audience === 'inactive_60') {
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    query = query.eq('whatsapp_opt_in', true).or(`last_order_at.is.null,last_order_at.lt.${cutoff}`)
  } else if (campaign.audience === 'inactive_90') {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    query = query.eq('whatsapp_opt_in', true).or(`last_order_at.is.null,last_order_at.lt.${cutoff}`)
  } else if (campaign.audience === 'vip') {
    query = query.eq('whatsapp_opt_in', true).gte('total_spent', 5000)
  } else if (campaign.audience === 'repeat_buyers') {
    query = query.eq('whatsapp_opt_in', true).gte('total_orders', 2)
  } else if (campaign.audience === 'first_time') {
    query = query.eq('whatsapp_opt_in', true).eq('total_orders', 1)
  }
  // 'all' intentionally includes all synced contacts. Actual send failures will
  // update whatsapp_opt_in for numbers Meta reports as invalid/not registered.

  const { data: customers } = await query
  if (!customers || customers.length === 0) {
    await service.from('campaigns').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', campaign_id)
    return NextResponse.json({ error: 'No eligible customers in this audience segment' }, { status: 400 })
  }

  // Bulk insert in chunks — a single call with 10k+ rows risks hitting a
  // payload-size limit; 500-row chunks stay comfortably under it either way.
  const CHUNK = 500
  for (let i = 0; i < customers.length; i += CHUNK) {
    const chunk = customers.slice(i, i + CHUNK).map(c => ({
      campaign_id, customer_id: c.id, phone: c.phone, name: c.name, status: 'pending' as const,
    }))
    const { error: insErr } = await service.from('campaign_recipients').upsert(chunk, { onConflict: 'campaign_id,customer_id', ignoreDuplicates: true })
    if (insErr) {
      await service.from('campaigns').update({ status: 'draft', updated_at: new Date().toISOString() }).eq('id', campaign_id)
      return NextResponse.json({ error: `Failed to queue recipients: ${insErr.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, queued: customers.length })
}
