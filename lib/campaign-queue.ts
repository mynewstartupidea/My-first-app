import { createServiceClient } from '@/lib/supabase/server'

type Service = ReturnType<typeof createServiceClient>

interface CampaignRow {
  id: string
  store_id: string
  audience: string
}

// Shared by app/api/campaigns/send (manual "Send now") and
// app/api/cron/campaign-send (auto-launching campaigns whose scheduled_at
// has arrived — previously nothing did this at all; a campaign saved with
// status='scheduled' just sat there forever unless a human came back and
// clicked Send manually). Both need the exact same audience-building and
// recipient-queueing logic; duplicating it risked the two silently
// diverging the way the frontend preview and backend send logic already
// had (different audience counts for the same segment).
export async function queueCampaignAudience(
  service: Service, campaign: CampaignRow,
): Promise<{ success: true; queued: number } | { success: false; error: string }> {
  // Rebuilt fresh per page (a Supabase query builder can't be reused after
  // a .range() call is swapped), rather than fetched once with no limit:
  // Supabase/PostgREST projects commonly have a server-side "Max Rows"
  // setting that silently caps any single request at that count regardless
  // of what the client asks for.
  function buildAudienceQuery() {
    let q = service.from('customers').select('id, phone, name').eq('store_id', campaign.store_id)
    if (campaign.audience === 'opted_in') {
      q = q.eq('whatsapp_opt_in', true)
    } else if (campaign.audience === 'inactive_30') {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      q = q.eq('whatsapp_opt_in', true).or(`last_order_at.is.null,last_order_at.lt.${cutoff}`)
    } else if (campaign.audience === 'inactive_60') {
      const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
      q = q.eq('whatsapp_opt_in', true).or(`last_order_at.is.null,last_order_at.lt.${cutoff}`)
    } else if (campaign.audience === 'inactive_90') {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      q = q.eq('whatsapp_opt_in', true).or(`last_order_at.is.null,last_order_at.lt.${cutoff}`)
    } else if (campaign.audience === 'vip') {
      q = q.eq('whatsapp_opt_in', true).gte('total_spent', 5000)
    } else if (campaign.audience === 'repeat_buyers') {
      q = q.eq('whatsapp_opt_in', true).gte('total_orders', 2)
    } else if (campaign.audience === 'first_time') {
      q = q.eq('whatsapp_opt_in', true).eq('total_orders', 1)
    }
    // 'all' intentionally includes all synced contacts. Actual send failures
    // will update whatsapp_opt_in for numbers Meta reports as invalid.
    return q.order('id', { ascending: true })
  }

  const PAGE_SIZE = 1000
  const customers: { id: string; phone: string; name: string | null }[] = []
  for (let page = 0; ; page++) {
    const { data: batch, error: fetchErr } = await buildAudienceQuery().range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (fetchErr) return { success: false, error: `Failed to build audience: ${fetchErr.message}` }
    customers.push(...(batch ?? []))
    if (!batch || batch.length < PAGE_SIZE) break
  }
  if (customers.length === 0) return { success: false, error: 'No eligible customers in this audience segment' }

  // Bulk insert in chunks — a single call with 10k+ rows risks hitting a
  // payload-size limit; 500-row chunks stay comfortably under it either way.
  const CHUNK = 500
  for (let i = 0; i < customers.length; i += CHUNK) {
    const chunk = customers.slice(i, i + CHUNK).map(c => ({
      campaign_id: campaign.id, customer_id: c.id, phone: c.phone, name: c.name, status: 'pending' as const,
    }))
    const { error: insErr } = await service.from('campaign_recipients').upsert(chunk, { onConflict: 'campaign_id,customer_id', ignoreDuplicates: true })
    if (insErr) return { success: false, error: `Failed to queue recipients: ${insErr.message}` }
  }

  return { success: true, queued: customers.length }
}
