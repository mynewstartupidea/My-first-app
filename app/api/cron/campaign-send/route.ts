import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { renderTemplate } from '@/lib/utils'

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

  const { data: recipients } = await service
    .from('campaign_recipients')
    .select('id, campaign_id, customer_id, phone, name')
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

  // Cached per tick so a batch spanning many recipients for the same
  // campaign/store doesn't re-resolve WhatsApp credentials or re-query quota
  // on every single message.
  const waConfigCache = new Map<string, { apiKey?: string; phoneNumberId?: string }>()
  const quotaCache = new Map<string, number>()

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

    if (!quotaCache.has(ownerId)) {
      const { data: remaining } = await service.rpc('get_messages_remaining', { p_user_id: ownerId })
      quotaCache.set(ownerId, remaining ?? 0)
    }
    const remainingQuota = quotaCache.get(ownerId)!
    if (remainingQuota <= 0) {
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
      quotaCache.set(ownerId, remainingQuota - 1)
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
      const notReachable = /not registered on WhatsApp|invalid phone number/i.test(result.error ?? '')
      await Promise.all([
        service.from('campaign_recipients').update({
          status: 'failed', error_message: result.error ?? 'Unknown error',
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
