import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { renderTemplate } from '@/lib/utils'
import { waTemplateFields } from '@/app/api/shopify/webhooks/route'

export const maxDuration = 60

// Nightly scan for the 4 lifecycle automations that have no webhook to
// trigger off of — nothing in Shopify tells us "this customer has gone
// quiet" or "this customer just crossed a spend threshold" the way
// orders/create or orders/fulfilled tells us about an order. Modeled on the
// one existing "periodic scan + dedupe + insert automation_jobs" precedent
// in this codebase (requeueStaleAbandonedCheckoutSync in lib/shopify-sync.ts).
// Inserted jobs are picked up by the existing per-minute /api/cron processor
// exactly like every webhook-driven automation's jobs are — this route only
// ever decides WHO should get a message and marks them claimed; it never
// sends anything itself.
type ServiceClient = ReturnType<typeof createServiceClient>
type Automation = { id: string; type: string; is_enabled: boolean; template: string; wa_template_name: string | null; wa_template_language: string | null }

async function getEnabledAutomations(service: ServiceClient, storeId: string, types: string[]): Promise<Record<string, Automation>> {
  const { data } = await service.from('automations').select('*')
    .eq('store_id', storeId).eq('is_enabled', true).in('type', types)
  const out: Record<string, Automation> = {}
  for (const row of data ?? []) out[row.type as string] = row as Automation
  return out
}

async function processWinBack(service: ServiceClient, store: { id: string; shop_name: string | null }) {
  const autos = await getEnabledAutomations(service, store.id, ['win_back'])
  const auto = autos.win_back
  if (!auto) return

  const { data: candidates } = await service.rpc('claim_winback_candidates', { p_store_id: store.id })
  for (const c of candidates ?? []) {
    const vars = { name: c.name ?? 'there', shop_name: store.shop_name ?? 'our store' }
    const msg = renderTemplate(auto.template, vars)
    await service.from('automation_jobs').insert({
      store_id: store.id, automation_id: auto.id, type: 'win_back',
      customer_phone: c.phone, customer_name: c.name, message: msg,
      context: { customer_id: String(c.id), ...waTemplateFields(auto, auto.template, vars) },
      status: 'pending', scheduled_at: new Date().toISOString(),
    })
  }
}

async function processReorderReminders(service: ServiceClient, store: { id: string; shop_name: string | null }) {
  const autos = await getEnabledAutomations(service, store.id, ['repeat_purchase', 'replenishment_reminder'])
  const winner = autos.repeat_purchase ?? autos.replenishment_reminder
  if (!winner) return

  const { data: candidates } = await service.rpc('get_reorder_candidates', { p_store_id: store.id })
  for (const c of candidates ?? []) {
    // Atomic claim is the real dedupe — if repeat_purchase and
    // replenishment_reminder are BOTH enabled, whichever store's scan
    // reaches this customer first wins; this just always evaluates
    // repeat_purchase first when both are on, so it's the deterministic
    // winner, not the claim mechanism itself.
    const { data: claimed } = await service.rpc('claim_reorder_reminder', {
      p_customer_id: c.customer_id, p_last_order_at: c.last_order_at,
    })
    if (!claimed) continue
    const vars = { name: c.name ?? 'there', shop_name: store.shop_name ?? 'our store' }
    const msg = renderTemplate(winner.template, vars)
    await service.from('automation_jobs').insert({
      store_id: store.id, automation_id: winner.id, type: winner.type,
      customer_phone: c.phone, customer_name: c.name, message: msg,
      context: { customer_id: String(c.customer_id), ...waTemplateFields(winner, winner.template, vars) },
      status: 'pending', scheduled_at: new Date().toISOString(),
    })
  }
}

async function processVipMilestones(service: ServiceClient, store: { id: string; shop_name: string | null }) {
  const autos = await getEnabledAutomations(service, store.id, ['vip_milestone'])
  const auto = autos.vip_milestone
  if (!auto) return

  const { data: candidates } = await service.rpc('claim_vip_milestone_candidates', { p_store_id: store.id })
  for (const c of candidates ?? []) {
    const vars = { name: c.name ?? 'there', shop_name: store.shop_name ?? 'our store' }
    const msg = renderTemplate(auto.template, vars)
    await service.from('automation_jobs').insert({
      store_id: store.id, automation_id: auto.id, type: 'vip_milestone',
      customer_phone: c.phone, customer_name: c.name, message: msg,
      context: { customer_id: String(c.id), ...waTemplateFields(auto, auto.template, vars) },
      status: 'pending', scheduled_at: new Date().toISOString(),
    })
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data: stores } = await service.from('stores').select('id, shop_name').eq('is_active', true)

  let storesProcessed = 0
  for (const store of stores ?? []) {
    try {
      await processWinBack(service, store)
      await processReorderReminders(service, store)
      await processVipMilestones(service, store)
      storesProcessed++
    } catch (e) {
      // One store's failure (bad data, RPC error) shouldn't block every
      // other store's nightly scan from running.
      console.error(`[shopify-lifecycle] store ${store.id} failed:`, e)
    }
  }

  return NextResponse.json({ ok: true, storesProcessed })
}
