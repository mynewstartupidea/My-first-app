import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { renderTemplate } from '@/lib/utils'
import { queueCampaignAudience } from '@/lib/campaign-queue'

export const maxDuration = 60

// Processes campaign_recipients queued by app/api/campaigns/send, a batch
// per tick bounded by a shared time budget (not by recipient count) — the
// same shape as app/api/cron/shopify-sync. Each send result is written
// immediately, so a mid-batch failure or a Vercel restart loses at most the
// one in-flight message, never the whole campaign's history.
const BATCH_SIZE = 300
const TIME_BUDGET_MS = 50_000

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const tickStart = Date.now()

  // A campaign saved with status='scheduled' and a future scheduled_at had
  // nothing that ever auto-launched it — app/api/campaigns/route.ts lets it
  // be created, but only a human manually clicking Send later actually
  // queues its recipients. Due ones get claimed and queued here the same
  // way app/api/campaigns/send does (same shared helper), right before the
  // normal recipient-processing loop below picks them up like any other
  // pending batch.
  const { data: dueCampaigns } = await service
    .from('campaigns')
    .select('id, store_id, audience')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
  for (const due of dueCampaigns ?? []) {
    const { data: claimed } = await service
      .from('campaigns').update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', due.id).eq('status', 'scheduled').select('id')
    if (!claimed || claimed.length === 0) continue // claimed by a concurrent tick

    const result = await queueCampaignAudience(service, due)
    if (!result.success) {
      await service.from('campaigns').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', due.id)
      console.error(`[campaign-send cron] scheduled campaign ${due.id} failed to queue:`, result.error)
    }
  }

  const { data: recipients } = await service
    .from('campaign_recipients')
    .select('id, campaign_id, customer_id, phone, name, attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  const campaignIds = [...new Set(recipients.map(r => r.campaign_id))]
  const { data: campaigns } = await service.from('campaigns').select('*').in('id', campaignIds)
  const campaignMap = new Map((campaigns ?? []).map(c => [c.id, c]))

  const storeIds = [...new Set((campaigns ?? []).map(c => c.store_id))]
  const { data: stores } = await service.from('stores').select('*').in('id', storeIds)
  const storeMap = new Map((stores ?? []).map(s => [s.id, s]))

  // WhatsApp credentials are still cached per store for the tick — no
  // benefit to re-resolving those per message. Quota is NOT cached anymore:
  // it used to be read once via get_messages_remaining and decremented in
  // local memory, which let this cron and the automation cron
  // (app/api/cron/route.ts) each work off a stale snapshot and both send up
  // to the full remaining amount for the same owner if they ran in
  // overlapping windows. try_increment_messages_used (supabase/migrations.sql)
  // checks-and-increments atomically per message instead.
  const waConfigCache = new Map<string, { apiKey?: string; phoneNumberId?: string }>()

  const MAX_ATTEMPTS = 3
  let processed = 0, sent = 0, failed = 0, skippedQuota = 0

  for (const recipient of recipients) {
    if (Date.now() - tickStart >= TIME_BUDGET_MS) break

    const campaign = campaignMap.get(recipient.campaign_id)
    const store = campaign ? storeMap.get(campaign.store_id) : null
    if (!campaign || !store) {
      await service.from('campaign_recipients')
        .update({ status: 'failed', error_message: 'Campaign or store no longer exists' })
        .eq('id', recipient.id).eq('status', 'pending')
      continue
    }

    // Atomic claim — guards against two overlapping cron ticks double-sending
    const { data: claimed } = await service
      .from('campaign_recipients')
      .update({ status: 'sending' })
      .eq('id', recipient.id).eq('status', 'pending')
      .select('id')
    if (!claimed || claimed.length === 0) continue
    processed++

    const ownerId = store.user_id as string

    // Atomic check-and-increment — this IS the quota gate now, not a
    // pre-check against a cached read. If this returns false, the owner is
    // genuinely at their limit as of this exact instant, not as of whenever
    // this tick started.
    const { data: allowed } = await service.rpc('try_increment_messages_used', { p_user_id: ownerId })
    if (!allowed) {
      await service.from('campaign_recipients')
        .update({ status: 'skipped', error_message: 'Monthly message limit reached' })
        .eq('id', recipient.id)
      skippedQuota++
      continue
    }

    if (!waConfigCache.has(store.id)) {
      let apiKey: string | undefined = store.whatsapp_api_key ?? undefined
      let phoneNumberId: string | undefined
      if (store.whatsapp_bsp === 'meta') {
        const { data: wa } = await service
          .from('whatsapp_accounts')
          .select('phone_number_id, access_token')
          .eq('user_id', ownerId).eq('status', 'connected')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .limit(1).maybeSingle()
        apiKey = process.env.META_SYSTEM_USER_ACCESS_TOKEN ?? wa?.access_token ?? apiKey
        phoneNumberId = wa?.phone_number_id ?? undefined
      }
      waConfigCache.set(store.id, { apiKey, phoneNumberId })
    }
    const waConfig = waConfigCache.get(store.id)!

    const personalizedMessage = renderTemplate(campaign.message, { name: recipient.name ?? 'there' })
    const result = await sendWhatsAppMessage({
      to: recipient.phone,
      message: personalizedMessage,
      bsp: store.whatsapp_bsp,
      apiKey: waConfig.apiKey,
      phoneNumberId: waConfig.phoneNumberId,
    })

    if (result.success) {
      sent++
      await Promise.all([
        service.from('campaign_recipients').update({
          status: 'sent', bsp_message_id: result.messageId, sent_at: new Date().toISOString(),
        }).eq('id', recipient.id),
        service.from('messages').insert({
          store_id: store.id, customer_phone: recipient.phone, customer_name: recipient.name,
          type: 'broadcast', message: personalizedMessage, status: 'sent', bsp_message_id: result.messageId,
        }),
        service.from('customers').update({ whatsapp_opt_in: true }).eq('id', recipient.customer_id),
      ])
    } else {
      failed++
      // The quota unit was already spent atomically above (try_increment_
      // messages_used) before we knew the send would fail — refund it,
      // best-effort, so a failed send doesn't cost real quota. Not atomic
      // with the increment, but the failure path is rare enough that the
      // tiny residual race (another sender reading the count between spend
      // and refund) is an acceptable trade for closing the much bigger
      // concurrent-crons race the atomic increment exists to prevent.
      await service.rpc('decrement_messages_used', { p_user_id: ownerId }).then(() => null, () => null)

      // lib/whatsapp.ts's own error messages literally say "— will retry"
      // for WhatsApp rate-limit (130429) and transient service (131000)
      // errors, but nothing ever actually retried them — they were marked
      // 'failed' permanently like any other error, silently dropping
      // whoever got caught in a throughput limit partway through a batch.
      const isRetryable = /will retry/i.test(result.error ?? '')
      const attempts = (recipient.attempts ?? 0) + 1
      const notReachable = /not registered on WhatsApp|invalid phone number/i.test(result.error ?? '')

      await Promise.all([
        isRetryable && attempts < MAX_ATTEMPTS
          ? service.from('campaign_recipients').update({
              status: 'pending', attempts, error_message: result.error ?? 'Unknown error',
            }).eq('id', recipient.id)
          : service.from('campaign_recipients').update({
              status: 'failed', attempts, error_message: result.error ?? 'Unknown error',
            }).eq('id', recipient.id),
        notReachable
          ? service.from('customers').update({ whatsapp_opt_in: false }).eq('id', recipient.customer_id)
          : Promise.resolve(),
      ])
    }
  }

  // Refresh counts + flip to 'completed' for every campaign touched this
  // tick once it has no pending/sending recipients left — computed fresh
  // from campaign_recipients rather than incremented in app code, so it's
  // always consistent even across multiple ticks.
  for (const campaignId of campaignIds) {
    const [{ count: pendingCount }, { count: sentCount }, { count: failedCount }] = await Promise.all([
      service.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).in('status', ['pending', 'sending']),
      service.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('status', 'sent'),
      service.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).in('status', ['failed', 'skipped']),
    ])
    await service.from('campaigns').update({
      sent_count: sentCount ?? 0,
      failed_count: failedCount ?? 0,
      status: (pendingCount ?? 0) === 0 ? 'completed' : 'running',
      updated_at: new Date().toISOString(),
    }).eq('id', campaignId)
  }

  return NextResponse.json({ ok: true, processed, sent, failed, skippedQuota })
}
