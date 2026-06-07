import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = 'vaibhavsingh9574395@gmail.com'

const PLAN_LIMITS: Record<string, number> = {
  trial: 500, starter: 500, growth: 5000, pro: 25000,
}
const PLAN_AMOUNTS: Record<string, number> = {
  trial: 0, starter: 99900, growth: 299900, pro: 799900,
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

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  if (action === 'change_plan') {
    if (!plan) return NextResponse.json({ error: 'plan required' }, { status: 400 })

    await service.from('billing').upsert({
      user_id,
      plan_name:      plan,
      status:         plan === 'trial' ? 'trialing' : 'active',
      messages_limit: PLAN_LIMITS[plan] ?? 500,
      amount_paise:   PLAN_AMOUNTS[plan] ?? 0,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'user_id' })

    // Also update the store plan
    const { data: store } = await service
      .from('stores').select('id').eq('user_id', user_id).eq('is_active', true).maybeSingle()
    if (store) {
      await service.from('stores').update({ plan, updated_at: new Date().toISOString() }).eq('id', store.id)
    }

    return NextResponse.json({ success: true, plan })
  }

  if (action === 'remove_user') {
    // Soft delete: deactivate store + mark billing cancelled
    await service.from('stores').update({ is_active: false }).eq('user_id', user_id)
    await service.from('billing').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('user_id', user_id)
    // Note: full account deletion requires Supabase admin API — we do soft delete here
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
