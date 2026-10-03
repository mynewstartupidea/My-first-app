export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/get-user-role'
import { resolveOwnerUserId } from '@/lib/resolve-owner-user-id'
import { cancelRazorpaySubscription } from '@/lib/razorpay'

// The Settings → Billing page has told merchants "Cancel anytime" since it
// was built, but this route never existed — app/api/billing/ only ever had
// status, razorpay/create, and razorpay-webhook. There was no way to
// actually cancel from inside the app at all; cancellation_feedback (its
// own table, already live) was written nowhere. Owner/admin only, same
// tier as changing plans.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id, user.email ?? '')
  if (role !== 'owner' && role !== 'admin') {
    return NextResponse.json({ error: 'Only the account owner or an admin can cancel the subscription.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as { reason?: string; detail?: string }
  const reason = (body.reason ?? '').trim()
  if (!reason) return NextResponse.json({ error: 'Please tell us why you\'re cancelling.' }, { status: 400 })

  const service = createServiceClient()
  const ownerId = await resolveOwnerUserId(service, user.id)

  const { data: billing } = await service
    .from('billing').select('razorpay_subscription_id, status').eq('user_id', ownerId).maybeSingle()

  if (!billing?.razorpay_subscription_id || billing.status !== 'active') {
    return NextResponse.json({ error: 'No active subscription to cancel.' }, { status: 400 })
  }

  try {
    await cancelRazorpaySubscription(billing.razorpay_subscription_id)
  } catch (e) {
    console.error('[billing/cancel] Razorpay cancel failed:', e)
    return NextResponse.json({ error: 'Could not cancel with Razorpay. Please try again or contact support.' }, { status: 500 })
  }

  // Razorpay's subscription.cancelled webhook will also fire and set
  // status='cancelled' — set it here too so the UI reflects the change
  // immediately instead of waiting on webhook delivery.
  await service.from('billing').update({
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('user_id', ownerId)

  await service.from('cancellation_feedback').insert({
    user_id: ownerId, reason, detail: body.detail?.trim() || null,
  })

  return NextResponse.json({ ok: true })
}
