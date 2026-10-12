import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { provisionStarterTemplates } from '@/lib/whatsapp-templates'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'vaibhavsin9574395@gmail.com'

const PLAN_LIMITS: Record<string, number> = {
  free: 500, trial: 500,
  starter: 5_000, growth: 15_000, scale: 50_000, enterprise: 999_999_999,
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const body = await request.json()
  const { action, user_id, plan } = body as { action: string; user_id: string; plan?: string }

  // One-off: push the new lifecycle-automation starter templates (added for
  // win_back/repeat_purchase/replenishment_reminder/vip_milestone/
  // welcome_series_1/welcome_series_2/cross_sell) to every connected WABA.
  // provisionStarterTemplates() is add-only — it already treats Meta's
  // "already exists" error as a graceful skip (lib/whatsapp-templates.ts),
  // so this is safe to run against accounts that already have the original
  // 6 ecommerce templates approved; only the 7 new ones actually submit.
  // No user_id needed — runs against every connected account, not one.
  if (action === 'provision_lifecycle_templates') {
    const { data: accounts } = await service
      .from('whatsapp_accounts').select('user_id, waba_id, access_token').eq('status', 'connected')
    const results: Record<string, unknown>[] = []
    for (const acc of accounts ?? []) {
      if (!acc.waba_id) continue
      const apiKey = process.env.META_SYSTEM_USER_ACCESS_TOKEN ?? acc.access_token
      if (!apiKey) continue
      const r = await provisionStarterTemplates(acc.waba_id, apiKey)
      results.push({ user_id: acc.user_id, waba_id: acc.waba_id, results: r })
    }
    return NextResponse.json({ success: true, results })
  }

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  if (action === 'change_plan') {
    if (!plan) return NextResponse.json({ error: 'plan required' }, { status: 400 })

    const { error: billingErr } = await service.from('billing').upsert({
      user_id,
      plan_name:      plan,
      status:         'active',
      messages_limit: PLAN_LIMITS[plan] ?? 500,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'user_id' })
    // Was discarded entirely — the modal would show "Save plan" succeeding
    // even if this write failed, leaving the admin believing the customer's
    // plan changed when it didn't.
    if (billingErr) {
      return NextResponse.json({ error: `Couldn't update billing: ${billingErr.message}` }, { status: 500 })
    }

    // Also update the store plan
    const { data: store } = await service
      .from('stores').select('id').eq('user_id', user_id).eq('is_active', true).maybeSingle()
    if (store) {
      const { error: storeErr } = await service.from('stores').update({ plan, updated_at: new Date().toISOString() }).eq('id', store.id)
      if (storeErr) {
        return NextResponse.json({ error: `Billing plan updated, but the store's plan field failed to update: ${storeErr.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, plan })
  }

  if (action === 'cancel_subscription') {
    const { error: cancelErr } = await service.from('billing').update({
      status:       'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }).eq('user_id', user_id)

    if (cancelErr) {
      return NextResponse.json({ error: `Couldn't cancel the subscription: ${cancelErr.message}` }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  if (action === 'remove_user') {
    const { error: storeErr } = await service.from('stores').update({ is_active: false }).eq('user_id', user_id)
    if (storeErr) {
      return NextResponse.json({ error: `Couldn't deactivate the store: ${storeErr.message}` }, { status: 500 })
    }
    const { error: billingErr } = await service.from('billing').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('user_id', user_id)
    if (billingErr) {
      return NextResponse.json({ error: `Store deactivated, but billing failed to update: ${billingErr.message}` }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
