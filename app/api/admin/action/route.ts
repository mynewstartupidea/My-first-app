import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

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

  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  if (action === 'change_plan') {
    if (!plan) return NextResponse.json({ error: 'plan required' }, { status: 400 })

    await service.from('billing').upsert({
      user_id,
      plan_name:      plan,
      status:         'active',
      messages_limit: PLAN_LIMITS[plan] ?? 500,
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

  if (action === 'cancel_subscription') {
    await service.from('billing').update({
      status:       'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }).eq('user_id', user_id)

    return NextResponse.json({ success: true })
  }

  if (action === 'remove_user') {
    await service.from('stores').update({ is_active: false }).eq('user_id', user_id)
    await service.from('billing').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('user_id', user_id)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
